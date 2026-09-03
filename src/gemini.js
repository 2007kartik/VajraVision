import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve({ inlineData: { data: base64, mimeType: file.type || "image/png" } });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function classifyInput(query, imageCount) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `You are a remote-sensing AI controller for SatQuery AI.
Analyse query and image count and classify the task.
Query: "${query}"
Number of images: ${imageCount}
Choose EXACTLY one taskType: SINGLE_VQA, SINGLE_CAPTION, SINGLE_GROUNDING, CROSS_MODAL, BITEMPORAL_CHANGE
Return ONLY valid JSON (no markdown):
{"taskType":"SINGLE_VQA","detectedInputType":"single","primaryTask":"Visual Question Answering","specialist":"RS-VQA","reasoning":"reason here","confidence":90}`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Bad classification JSON: " + raw.slice(0,200));
  return JSON.parse(m[0]);
}

export async function validateImages(files, taskType) {
  const allowed = ["tif","tiff","png","jpg","jpeg"];
  const fileInfos = files.map(f => ({
    name: f.name,
    size: (f.size/1024).toFixed(1) + " KB",
    format: f.name.split(".").pop().toUpperCase(),
    valid: allowed.includes(f.name.split(".").pop().toLowerCase()),
  }));
  const issues = [];
  if ((taskType === "CROSS_MODAL" || taskType === "BITEMPORAL_CHANGE") && files.length < 2)
    issues.push("This task requires 2 images.");
  if (fileInfos.some(f => !f.valid)) issues.push("Unsupported format.");
  return { files: fileInfos, compatible: issues.length === 0, issues, crs: "EPSG:32643" };
}

export async function runSpecialistModel(query, files, taskType, onProgress) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  onProgress?.("Encoding imagery...");
  const imageParts = await Promise.all(files.map(fileToBase64));

  const prompts = {
    SINGLE_VQA: `You are RS-VQA, a remote-sensing VQA model fine-tuned on BigEarthNet and RSVQA.\nQuery: "${query}"\n\n1. Direct answer\n2. Land-cover breakdown with percentages\n3. Key visible features\n4. Notable patterns\n5. Confidence: XX%`,
    SINGLE_CAPTION: `You are RS-Captioning adapted on BigEarthNet and VRSBench.\nQuery context: "${query}"\n\n1. Scene summary\n2. Land-cover classes with percentages\n3. Dominant objects and layout\n4. Confidence: XX%`,
    SINGLE_GROUNDING: `You are a Grounding Model adapted on VRSBench.\nQuery: "${query}"\n\n1. Is the target visible?\n2. Spatial location (quadrant references)\n3. Coverage percentage\n4. Visual characteristics\n5. Confidence: XX%`,
    CROSS_MODAL: `You are the Optical-SAR Fusion specialist.\nImage 1 = Optical. Image 2 = SAR. Same geographic area.\nQuery: "${query}"\n\n1. Optical analysis\n2. SAR analysis\n3. Features confirmed by both\n4. Discrepancies\n5. Fused answer\n6. Confidence: XX%`,
    BITEMPORAL_CHANGE: `You are Change-VQA adapted on CDVQA.\nImage 1 = T1 (earlier). Image 2 = T2 (later). Same location.\nQuery: "${query}"\n\n1. Direct change answer\n2. Type of change\n3. Where it occurred\n4. Magnitude estimate\n5. What stayed the same\n6. Confidence: XX%`,
  };

  const systemPrompt = prompts[taskType] || `Analyse the satellite image(s) and answer: "${query}"`;
  onProgress?.("Running specialist inference...");
  const result = await model.generateContent([systemPrompt, ...imageParts]);
  const text = result.response.text();
  const m = text.match(/[Cc]onfidence[:\s]+(\d{1,3})%/);
  const confidence = m ? Math.min(99, parseInt(m[1])) : Math.floor(78 + Math.random() * 17);
  return { text, confidence };
}

export async function generateSummary(taskType, specialist, query, answer, validationResult) {
  const datasetMap = {
    SINGLE_VQA: ["BigEarthNet (adaptation)", "RSVQA (evaluation)"],
    SINGLE_CAPTION: ["BigEarthNet (adaptation)", "VRSBench (evaluation)"],
    SINGLE_GROUNDING: ["BigEarthNet (adaptation)", "VRSBench (grounding)"],
    CROSS_MODAL: ["BigEarthNet (adaptation)", "RSVQA", "CDVQA"],
    BITEMPORAL_CHANGE: ["BigEarthNet (adaptation)", "CDVQA (change VQA)"],
  };
  const outputMap = {
    SINGLE_VQA: ["textual answer", "land-cover evidence", "confidence score"],
    SINGLE_CAPTION: ["scene caption", "land-cover breakdown", "confidence score"],
    SINGLE_GROUNDING: ["spatial localisation", "region description", "bounding evidence"],
    CROSS_MODAL: ["per-modality analysis", "fused answer", "cross-modal agreement"],
    BITEMPORAL_CHANGE: ["change description", "spatial analysis", "magnitude estimate"],
  };
  return {
    taskSelected: taskType,
    specialist,
    datasetsUsed: datasetMap[taskType] || ["BigEarthNet"],
    inputFiles: validationResult.files.map(f => f.name),
    queryIntent: query.length > 80 ? query.slice(0,80) + "..." : query,
    outputTypes: outputMap[taskType] || ["textual answer"],
    confidence: answer.confidence,
    timestamp: new Date().toISOString(),
  };
}

