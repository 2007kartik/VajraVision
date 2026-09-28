import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import earthMapUrl from "../assets/earth-blue-marble.jpg";
import earthCloudsUrl from "../assets/earth-clouds.png";
import earthSpecUrl from "../assets/earth-specular.jpg";

/**
 * Photorealistic 3D Earth with:
 * - Continuous auto-rotation (never stops, drag adds on top)
 * - Inertia-damped drag
 * - Full 3D Rocket orbiting the globe (body + nose + fins + window + exhaust plume)
 * - Orbital trail behind rocket
 * - Atmospheric Fresnel glow
 */
export default function Hero({ scrollProgress = 0, reducedMotion = false }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animId = null;
    let renderer = null;

    try {
      // ── Scene ──────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();

      // ── Camera ─────────────────────────────────────────────────────────────
      const width  = container.clientWidth  || 480;
      const height = container.clientHeight || 480;
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
      camera.position.set(0, 0, 4.8);

      // ── Renderer ───────────────────────────────────────────────────────────
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      // ── Lighting ───────────────────────────────────────────────────────────
      const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.6);
      sunLight.position.set(6, 3.5, 4.5);
      scene.add(sunLight);

      const ambientLight = new THREE.AmbientLight(0x1a2e4a, 0.8);
      scene.add(ambientLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
      rimLight.position.set(-6, -2, -4);
      scene.add(rimLight);

      // ── Earth Pivot (axial tilt 23.4°) ─────────────────────────────────────
      const earthPivot = new THREE.Group();
      earthPivot.rotation.z = (23.4 * Math.PI) / 180;
      earthPivot.rotation.x = 0.1;
      scene.add(earthPivot);

      // ── Textures ───────────────────────────────────────────────────────────
      const textureLoader = new THREE.TextureLoader();
      const earthTex  = textureLoader.load(earthMapUrl, () => setLoaded(true));
      earthTex.colorSpace = THREE.SRGBColorSpace;
      earthTex.anisotropy = 8;
      const specTex   = textureLoader.load(earthSpecUrl);
      const cloudsTex = textureLoader.load(earthCloudsUrl);
      cloudsTex.colorSpace = THREE.SRGBColorSpace;

      // ── Earth Mesh ─────────────────────────────────────────────────────────
      const earthGeo = new THREE.SphereGeometry(1.65, 64, 64);
      const earthMat = new THREE.MeshPhongMaterial({
        map: earthTex,
        specularMap: specTex,
        specular: new THREE.Color(0x385577),
        shininess: 18,
        bumpScale: 0.02,
      });
      const earthMesh = new THREE.Mesh(earthGeo, earthMat);
      earthPivot.add(earthMesh);

      // ── Clouds ─────────────────────────────────────────────────────────────
      const cloudsGeo = new THREE.SphereGeometry(1.668, 64, 64);
      const cloudsMat = new THREE.MeshStandardMaterial({
        map: cloudsTex,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
      earthPivot.add(cloudsMesh);

      // ── Atmosphere Glow ────────────────────────────────────────────────────
      const atmosVert = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal   = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * vec4(vPosition, 1.0);
        }
      `;
      const atmosFrag = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = 1.0 - dot(viewDir, vNormal);
          fresnel = pow(fresnel, 2.6);
          vec3 glowColor = vec3(0.22, 0.68, 1.0);
          gl_FragColor = vec4(glowColor, fresnel * 0.8);
        }
      `;
      const atmosGeo = new THREE.SphereGeometry(1.75, 48, 48);
      const atmosMat = new THREE.ShaderMaterial({
        vertexShader: atmosVert,
        fragmentShader: atmosFrag,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
      });
      earthPivot.add(new THREE.Mesh(atmosGeo, atmosMat));

      // ── Rocket Model ───────────────────────────────────────────────────────
      const rocketGroup = new THREE.Group();

      // Body — white/silver cylinder
      const bodyGeo = new THREE.CylinderGeometry(0.042, 0.052, 0.26, 16);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, metalness: 0.65, roughness: 0.3 });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      rocketGroup.add(bodyMesh);

      // Nose cone
      const noseGeo = new THREE.ConeGeometry(0.042, 0.11, 16);
      const noseMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 });
      const noseMesh = new THREE.Mesh(noseGeo, noseMat);
      noseMesh.position.y = 0.185;
      rocketGroup.add(noseMesh);

      // 3 Fins at base
      const finMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 });
      const finGeoArr = [];
      for (let i = 0; i < 3; i++) {
        const finGeoI = new THREE.ConeGeometry(0.001, 0.001, 3); // placeholder, replaced by shape
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(0.08, -0.09);
        finShape.lineTo(0.08, 0);
        finShape.lineTo(0, 0);
        const extSettings = { depth: 0.007, bevelEnabled: false };
        const finGeoI2 = new THREE.ExtrudeGeometry(finShape, extSettings);
        finGeoArr.push(finGeoI2);
        const finMesh = new THREE.Mesh(finGeoI2, finMat);
        const angle = (i * 2 * Math.PI) / 3;
        finMesh.position.set(
          0.052 * Math.cos(angle),
          -0.1,
          0.052 * Math.sin(angle)
        );
        finMesh.rotation.y = -angle;
        rocketGroup.add(finMesh);
      }

      // Window porthole — glowing cyan
      const windowGeo = new THREE.CircleGeometry(0.017, 16);
      const windowMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.5,
        metalness: 0.1,
        roughness: 0.1,
      });
      const windowMesh = new THREE.Mesh(windowGeo, windowMat);
      windowMesh.position.set(0.043, 0.06, 0);
      windowMesh.rotation.y = Math.PI / 2;
      rocketGroup.add(windowMesh);

      // Exhaust glow sphere
      const exhaustGeo = new THREE.SphereGeometry(0.035, 12, 12);
      const exhaustMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 3.5,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const exhaustMesh = new THREE.Mesh(exhaustGeo, exhaustMat);
      exhaustMesh.position.y = -0.165;
      rocketGroup.add(exhaustMesh);

      // Exhaust plume cone (pointing down)
      const plumeGeo = new THREE.ConeGeometry(0.024, 0.13, 12);
      const plumeMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 4.5,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const plumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
      plumeMesh.position.y = -0.235;
      plumeMesh.rotation.z = Math.PI; // tip points down
      rocketGroup.add(plumeMesh);

      rocketGroup.scale.setScalar(1.6);
      scene.add(rocketGroup);

      // ── Orbital Trail ──────────────────────────────────────────────────────
      const TRAIL_COUNT = 130;
      const trailPositions = new Float32Array(TRAIL_COUNT * 3);
      const trailColors    = new Float32Array(TRAIL_COUNT * 3);
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const alpha = i / TRAIL_COUNT;
        trailColors[i * 3 + 0] = 0.2 + alpha * 0.6;
        trailColors[i * 3 + 1] = 0.65;
        trailColors[i * 3 + 2] = 1.0;
      }
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
      trailGeo.setAttribute("color",    new THREE.BufferAttribute(trailColors, 3));
      const trailMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      scene.add(new THREE.Line(trailGeo, trailMat));

      // ── Drag Interaction ───────────────────────────────────────────────────
      const AUTO_ROT = 0.0025;
      let isDragging = false;
      let prevPointer = { x: 0, y: 0 };
      let dragVelX = 0;
      let dragVelY = 0;

      const onPointerDown = (e) => {
        isDragging = true;
        prevPointer = { x: e.clientX, y: e.clientY };
        dragVelX = 0; dragVelY = 0;
      };
      const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        prevPointer = { x: e.clientX, y: e.clientY };
        dragVelX = dx * 0.005;
        dragVelY = dy * 0.005;
        earthMesh.rotation.y  += dragVelX;
        earthPivot.rotation.x += dragVelY;
      };
      const onPointerUp = () => { isDragging = false; };

      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove",  onPointerMove);
      window.addEventListener("pointerup",    onPointerUp);

      // ── Resize ─────────────────────────────────────────────────────────────
      const resizeObserver = new ResizeObserver(() => {
        if (!container || !renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      resizeObserver.observe(container);

      // ── Animation Loop ─────────────────────────────────────────────────────
      let t = 0;
      const history = [];

      const animate = () => {
        animId = requestAnimationFrame(animate);

        if (!reducedMotion) {
          // Earth ALWAYS rotates – drag velocity blends on top and damps away
          earthMesh.rotation.y  += AUTO_ROT + dragVelX;
          cloudsMesh.rotation.y += AUTO_ROT * 1.38 + dragVelX * 1.12;
          if (!isDragging) {
            dragVelX *= 0.91;
            if (Math.abs(dragVelY) > 0.00008) {
              earthPivot.rotation.x += dragVelY;
              dragVelY *= 0.91;
            }
          }
        }

        // ── Rocket orbit ──────────────────────────────────────────────────
        t += 0.018;
        const ORBIT_R   = 2.52;
        const ORBIT_INC = 0.65; // ~37° inclination

        const rX = ORBIT_R * Math.cos(t);
        const rY = ORBIT_R * Math.sin(t) * Math.sin(ORBIT_INC);
        const rZ = ORBIT_R * Math.sin(t) * Math.cos(ORBIT_INC);

        rocketGroup.position.set(rX, rY, rZ);

        // Orientation: nose points along velocity tangent, up toward away-from-globe
        const forward = new THREE.Vector3(
          -Math.sin(t),
           Math.cos(t) * Math.sin(ORBIT_INC),
           Math.cos(t) * Math.cos(ORBIT_INC)
        ).normalize();
        const outward = new THREE.Vector3(rX, rY, rZ).normalize();
        const right   = new THREE.Vector3().crossVectors(outward, forward).normalize();
        // Re-orthogonalize forward
        const corrForward = new THREE.Vector3().crossVectors(right, outward).normalize();

        const rm = new THREE.Matrix4();
        rm.makeBasis(right, outward, corrForward.negate());
        rocketGroup.quaternion.setFromRotationMatrix(rm);

        // Pulse exhaust
        const pulse = 0.88 + 0.12 * Math.sin(t * 20);
        exhaustMesh.scale.setScalar(pulse);
        plumeMesh.scale.y = pulse * 1.3;

        // ── Trail ────────────────────────────────────────────────────────
        history.push(new THREE.Vector3(rX, rY, rZ));
        if (history.length > TRAIL_COUNT) history.shift();

        const posAttr = trailGeo.attributes.position;
        for (let i = 0; i < history.length; i++) {
          posAttr.setXYZ(i, history[i].x, history[i].y, history[i].z);
        }
        for (let i = history.length; i < TRAIL_COUNT; i++) {
          posAttr.setXYZ(i, rX, rY, rZ);
        }
        posAttr.needsUpdate = true;

        // ── Camera zoom ──────────────────────────────────────────────────
        const targetZ = 4.8 - (scrollProgress || 0) * 1.8;
        camera.position.z += (targetZ - camera.position.z) * 0.08;

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        if (animId) cancelAnimationFrame(animId);
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove",  onPointerMove);
        window.removeEventListener("pointerup",    onPointerUp);
        resizeObserver.disconnect();
        if (renderer) renderer.dispose();
        [earthGeo, earthMat, cloudsGeo, cloudsMat, atmosGeo, atmosMat,
         bodyGeo, noseGeo, windowGeo, exhaustGeo, plumeGeo, trailGeo,
         ...finGeoArr].forEach(o => { try { o.dispose(); } catch(_) {} });
      };
    } catch (err) {
      console.error("[VajraVision] WebGL Globe Init Failed:", err);
      setWebglError(true);
    }
  }, [scrollProgress, reducedMotion]);

  if (webglError) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={earthMapUrl} alt="Earth"
          style={{ width: "80%", borderRadius: "50%", boxShadow: "0 0 40px rgba(56,189,248,0.3)" }} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%", height: "100%",
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "grab", userSelect: "none",
      }}
      title="Drag to rotate the Earth"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", outline: "none" }}
      />
    </div>
  );
}
