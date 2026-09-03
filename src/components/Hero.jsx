import { useRef, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/* ── real Earth photographic textures (CORS-enabled GitHub raw source) ── */
const EARTH_MAP_URL  = "https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/earthmap1k.jpg";
const EARTH_BUMP_URL = "https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/earthbump1k.jpg";
const EARTH_SPEC_URL = "https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/earthspec1k.jpg";

/* loads a texture without throwing — resolves null on failure */
function loadTextureSafe(url, onColor) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (onColor) {
          if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
          else if ("encoding"  in tex) tex.encoding = THREE.sRGBEncoding;
        }
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/* ── deterministic pseudo-random ── */
function makeRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/* equirectangular lon/lat → canvas pixel */
function lonLatToXY(lon, lat, w, h) {
  return { x: ((lon + 180) / 360) * w, y: ((90 - lat) / 180) * h };
}

/* organic wobbly landmass */
function drawLandmass(ctx, cx, cy, rx, ry, points, seed, fill) {
  const rand = makeRand(seed);
  const coords = [];
  const step = (Math.PI * 2) / points;
  for (let i = 0; i < points; i++) {
    const angle = i * step;
    const wobble = 0.62 + rand() * 0.65;
    coords.push([cx + Math.cos(angle) * rx * wobble, cy + Math.sin(angle) * ry * wobble]);
  }
  ctx.beginPath();
  const mid0 = [
    (coords[0][0] + coords[coords.length - 1][0]) / 2,
    (coords[0][1] + coords[coords.length - 1][1]) / 2,
  ];
  ctx.moveTo(mid0[0], mid0[1]);
  for (let i = 0; i < coords.length; i++) {
    const next = coords[(i + 1) % coords.length];
    const mid = [(coords[i][0] + next[0]) / 2, (coords[i][1] + next[1]) / 2];
    ctx.quadraticCurveTo(coords[i][0], coords[i][1], mid[0], mid[1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/* 2:1 equirectangular procedural canvas — instant placeholder + offline fallback */
function buildEarthCanvas() {
  const w = 1024, h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");

  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0,   "#123049");
  ocean.addColorStop(0.5, "#1a3a5c");
  ocean.addColorStop(1,   "#123049");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  const continents = [
    { lon: -100, lat:  48, rx:  95, ry:  78, pts: 14, seed: 11, col: "#2d5a27" },
    { lon:  -80, lat:   8, rx:  34, ry:  34, pts: 10, seed: 12, col: "#356030" },
    { lon:  -58, lat: -18, rx:  62, ry:  95, pts: 14, seed: 21, col: "#3a6b2a" },
    { lon:   18, lat:   6, rx:  68, ry: 100, pts: 14, seed: 31, col: "#2d5a27" },
    { lon:   12, lat:  50, rx:  42, ry:  30, pts: 10, seed: 41, col: "#3a6b2a" },
    { lon:   95, lat:  52, rx: 150, ry:  70, pts: 16, seed: 51, col: "#2d5a27" },
    { lon:  100, lat:  22, rx:  90, ry:  48, pts: 14, seed: 52, col: "#3a6b2a" },
    { lon:  135, lat: -25, rx:  58, ry:  40, pts: 12, seed: 61, col: "#5c7a3b" },
    { lon:  -42, lat:  74, rx:  30, ry:  24, pts: 10, seed: 71, col: "#c9d6de" },
  ];
  continents.forEach(({ lon, lat, rx, ry, pts, seed, col }) => {
    const { x, y } = lonLatToXY(lon, lat, w, h);
    drawLandmass(ctx, x, y, rx, ry, pts, seed, col);
    drawLandmass(ctx, x + rx * 0.12, y - ry * 0.08, rx * 0.55, ry * 0.55, pts, seed + 3, "rgba(0,0,0,0.12)");
  });

  const islandRand = makeRand(99);
  [{ lon: 118, lat: 2 }, { lon: -75, lat: 20 }].forEach(({ lon, lat }) => {
    const { x, y } = lonLatToXY(lon, lat, w, h);
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.arc(x + (islandRand() - 0.5) * 90, y + (islandRand() - 0.5) * 40, 3 + islandRand() * 5, 0, Math.PI * 2);
      ctx.fillStyle = "#356030";
      ctx.fill();
    }
  });

  const capH = h * 0.09;
  const capN = ctx.createLinearGradient(0, 0, 0, capH);
  capN.addColorStop(0, "rgba(225,238,255,0.92)");
  capN.addColorStop(1, "rgba(225,238,255,0)");
  ctx.fillStyle = capN;
  ctx.fillRect(0, 0, w, capH);

  const capS = ctx.createLinearGradient(0, h - capH, 0, h);
  capS.addColorStop(0, "rgba(225,238,255,0)");
  capS.addColorStop(1, "rgba(225,238,255,0.92)");
  ctx.fillStyle = capS;
  ctx.fillRect(0, h - capH, w, capH);

  return canvas;
}

/* ── satellite on orbital path ── */
function Satellite() {
  const groupRef = useRef();
  const trailRef = useRef();
  const trailPoints = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.18;
    const r = 1.72, inc = Math.PI / 5;
    const x = r * Math.cos(t);
    const y = r * Math.sin(t) * Math.sin(inc);
    const z = r * Math.sin(t) * Math.cos(inc);

    if (groupRef.current) {
      groupRef.current.position.set(x, y, z);
      const dx = -Math.sin(t);
      const dy =  Math.cos(t) * Math.sin(inc);
      const dz =  Math.cos(t) * Math.cos(inc);
      groupRef.current.lookAt(x + dx, y + dy, z + dz);
    }

    trailPoints.current.push(new THREE.Vector3(x, y, z));
    if (trailPoints.current.length > 80) trailPoints.current.shift();
    if (trailRef.current && trailPoints.current.length > 1) {
      const geo = new THREE.BufferGeometry().setFromPoints(trailPoints.current);
      trailRef.current.geometry.dispose();
      trailRef.current.geometry = geo;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {/* main bus */}
        <mesh>
          <boxGeometry args={[0.042, 0.022, 0.06]} />
          <meshStandardMaterial color="#B0BEC5" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* solar panel left */}
        <mesh position={[-0.085, 0, 0]}>
          <boxGeometry args={[0.1, 0.003, 0.044]} />
          <meshStandardMaterial color="#1a237e" metalness={0.4} roughness={0.5} emissive="#1565C0" emissiveIntensity={0.3} />
        </mesh>
        {/* solar panel right */}
        <mesh position={[0.085, 0, 0]}>
          <boxGeometry args={[0.1, 0.003, 0.044]} />
          <meshStandardMaterial color="#1a237e" metalness={0.4} roughness={0.5} emissive="#1565C0" emissiveIntensity={0.3} />
        </mesh>
        {/* antenna dish */}
        <mesh position={[0, 0.022, 0]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.004, 12]} />
          <meshStandardMaterial color="#CFD8DC" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* antenna mast */}
        <mesh position={[0, 0.016, 0]}>
          <cylinderGeometry args={[0.002, 0.002, 0.014, 6]} />
          <meshStandardMaterial color="#90A4AE" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* status light */}
        <mesh position={[0.02, 0.012, 0.03]}>
          <sphereGeometry args={[0.004, 8, 8]} />
          <meshStandardMaterial color="#F2A93B" emissive="#F2A93B" emissiveIntensity={3} />
        </mesh>
      </group>

      {/* orbital trail */}
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#F2A93B" transparent opacity={0.28} />
      </line>
    </group>
  );
}

/* ── Earth ── */
function Earth({ scrollProgress }) {
  const meshRef = useRef();
  const atmosphereRef = useRef();

  /* procedural placeholder — ready before network textures arrive */
  const earthTexture = useRef(null);
  if (!earthTexture.current) {
    earthTexture.current = new THREE.CanvasTexture(buildEarthCanvas());
    earthTexture.current.anisotropy = 8;
    earthTexture.current.needsUpdate = true;
  }

  /* photographic textures loaded async */
  const [realMap,  setRealMap]  = useState(null);
  const [realBump, setRealBump] = useState(null);
  const [realSpec, setRealSpec] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadTextureSafe(EARTH_MAP_URL,  true ).then((t) => { if (!cancelled && t) setRealMap(t);  });
    loadTextureSafe(EARTH_BUMP_URL, false).then((t) => { if (!cancelled && t) setRealBump(t); });
    loadTextureSafe(EARTH_SPEC_URL, false).then((t) => { if (!cancelled && t) setRealSpec(t); });
    return () => { cancelled = true; };
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.y = clock.getElapsedTime() * 0.04;
    if (atmosphereRef.current)
      atmosphereRef.current.material.opacity = Math.max(0, 0.07 - scrollProgress * 0.08);
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={realMap || earthTexture.current}
          bumpMap={realBump || null}
          bumpScale={realBump ? 0.015 : 0}
          specularMap={realSpec || null}
          specular={new THREE.Color(realSpec ? "#3a3a3a" : "#111111")}
          shininess={realSpec ? 10 : 4}
        />
      </mesh>
      {/* atmosphere glow */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[1.04, 48, 48]} />
        <meshStandardMaterial color="#4FD1C5" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ── camera driven by scroll progress ── */
function CameraRig({ scrollProgress }) {
  const { camera } = useThree();
  useFrame(() => {
    const targetZ = 4 - scrollProgress * 2.7;
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    camera.fov = 45 + scrollProgress * 10;
    camera.updateProjectionMatrix();
  });
  return null;
}

/* ── scene ── */
function GlobeScene({ scrollProgress }) {
  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} color="#fff8f0" />
      <directionalLight position={[-4, -2, -3]} intensity={0.22} color="#4FD1C5" />
      <Stars radius={120} depth={60} count={3500} factor={4} saturation={0} fade speed={0.3} />
      <Earth scrollProgress={scrollProgress} />
      <Satellite />
      <CameraRig scrollProgress={scrollProgress} />
    </>
  );
}

/* ── static SVG fallback ── */
function StaticFallback() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0E14" }}>
      <svg viewBox="0 0 320 320" width="320" height="320" aria-hidden="true">
        <defs>
          <radialGradient id="eg2" cx="38%" cy="33%" r="60%">
            <stop offset="0%"   stopColor="#2d6a4f" />
            <stop offset="45%"  stopColor="#1b4332" />
            <stop offset="72%"  stopColor="#1C3A4A" />
            <stop offset="100%" stopColor="#0d1b2a" />
          </radialGradient>
        </defs>
        <circle cx="160" cy="160" r="130" fill="url(#eg2)" />
        <circle cx="160" cy="160" r="130" fill="none" stroke="#4FD1C5" strokeWidth="0.8" opacity="0.4" />
        <ellipse cx="160" cy="160" rx="130" ry="22" fill="none" stroke="#1E2A36" strokeWidth="0.5" />
        <circle cx="245" cy="100" r="4" fill="#F2A93B" />
        <line x1="160" y1="160" x2="245" y2="100" stroke="#F2A93B" strokeWidth="0.6" opacity="0.4" />
      </svg>
    </div>
  );
}

/* ── exported Hero ── */
export default function Hero({ scrollProgress = 0, reducedMotion = false }) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl2") && !c.getContext("webgl")) setHasWebGL(false);
    } catch { setHasWebGL(false); }
  }, []);

  if (reducedMotion || !hasWebGL || hasError) return <StaticFallback />;

  return (
    <div style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        dpr={[1, Math.min(window.devicePixelRatio, 1.5)]}
        style={{ background: "transparent" }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onError={() => setHasError(true)}
      >
        <Suspense fallback={null}>
          <GlobeScene scrollProgress={scrollProgress} />
        </Suspense>
      </Canvas>
    </div>
  );
}
