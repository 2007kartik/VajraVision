import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import earthMapUrl from "../assets/earth-blue-marble.jpg";
import earthCloudsUrl from "../assets/earth-clouds.png";
import earthSpecUrl from "../assets/earth-specular.jpg";

/**
 * Photorealistic 3D Earth Component using Vanilla Three.js
 * - Real NASA Blue Marble photographic surface
 * - Specular reflections on oceans & water bodies
 * - Floating cloud layer with independent rotational velocity
 * - Atmospheric Rayleigh scattering Fresnel rim glow
 * - ISRO / Earth Observation Satellites with orbital trails
 * - Interactive inertia-damped mouse/touch drag + auto-rotation
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
      // 1. Scene setup
      const scene = new THREE.Scene();

      // 2. Camera setup
      const width = container.clientWidth || 480;
      const height = container.clientHeight || 480;
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
      camera.position.set(0, 0, 4.8);

      // 3. Renderer setup
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      // 4. Lighting
      // Sunlight (directional light from upper-right)
      const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.4);
      sunLight.position.set(6, 3.5, 4.5);
      scene.add(sunLight);

      // Deep space ambient fill
      const ambientLight = new THREE.AmbientLight(0x1a2e4a, 0.7);
      scene.add(ambientLight);

      // Atmospheric back-rim light (cool cyan)
      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
      rimLight.position.set(-6, -2, -4);
      scene.add(rimLight);

      // 5. Earth Parent Pivot (tilted 23.4° for axial realism)
      const earthPivot = new THREE.Group();
      earthPivot.rotation.z = (23.4 * Math.PI) / 180;
      earthPivot.rotation.x = 0.1;
      scene.add(earthPivot);

      // Texture loader
      const textureLoader = new THREE.TextureLoader();

      // Surface Map
      const earthTex = textureLoader.load(earthMapUrl, () => setLoaded(true));
      earthTex.colorSpace = THREE.SRGBColorSpace;
      earthTex.anisotropy = 8;

      // Specular Map (oceans shine, land is matte)
      const specTex = textureLoader.load(earthSpecUrl);

      // 6. Earth Mesh
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

      // 7. Clouds Layer
      const cloudsTex = textureLoader.load(earthCloudsUrl);
      cloudsTex.colorSpace = THREE.SRGBColorSpace;
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

      // 8. Atmospheric Glow (Custom Fresnel Shader)
      const atmosVertexShader = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * vec4(vPosition, 1.0);
        }
      `;
      const atmosFragmentShader = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = 1.0 - dot(viewDir, vNormal);
          fresnel = pow(fresnel, 2.8);
          vec3 glowColor = vec3(0.22, 0.68, 1.0); // Vibrant electric cyan
          gl_FragColor = vec4(glowColor, fresnel * 0.75);
        }
      `;
      const atmosGeo = new THREE.SphereGeometry(1.74, 48, 48);
      const atmosMat = new THREE.ShaderMaterial({
        vertexShader: atmosVertexShader,
        fragmentShader: atmosFragmentShader,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
      });
      const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
      earthPivot.add(atmosMesh);

      // 9. Satellites & Orbital System
      const satGroup = new THREE.Group();
      scene.add(satGroup);

      // Satellite 1: RISAT / SAR Radar Observation Satellite
      const satBusGeo = new THREE.BoxGeometry(0.045, 0.024, 0.065);
      const satBusMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
      const sat1 = new THREE.Mesh(satBusGeo, satBusMat);

      // Solar Panels
      const panelGeo = new THREE.BoxGeometry(0.12, 0.003, 0.046);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        emissive: 0x1e40af,
        emissiveIntensity: 0.4,
        metalness: 0.5,
        roughness: 0.3,
      });
      const pLeft = new THREE.Mesh(panelGeo, panelMat);
      pLeft.position.set(-0.09, 0, 0);
      const pRight = new THREE.Mesh(panelGeo, panelMat);
      pRight.position.set(0.09, 0, 0);
      sat1.add(pLeft);
      sat1.add(pRight);

      // SAR Antenna Dish
      const dishGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.005, 16);
      const dishMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });
      const dish = new THREE.Mesh(dishGeo, dishMat);
      dish.position.set(0, 0.02, 0);
      sat1.add(dish);

      satGroup.add(sat1);

      // Orbital Trail Curve
      const trailCount = 100;
      const trailPositions = new Float32Array(trailCount * 3);
      const trailColors = new Float32Array(trailCount * 3);
      for (let i = 0; i < trailCount; i++) {
        const alpha = i / trailCount;
        trailColors[i * 3 + 0] = 0.22 + alpha * 0.78; // gold/orange fade
        trailColors[i * 3 + 1] = 0.65;
        trailColors[i * 3 + 2] = 0.98;
      }
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
      trailGeo.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));

      const trailMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });
      const trailLine = new THREE.Line(trailGeo, trailMat);
      satGroup.add(trailLine);

      // 10. Interactive Drag to Rotate with Inertia
      let isDragging = false;
      let prevPointer = { x: 0, y: 0 };
      let velocity = { x: 0.003, y: 0 };

      const onPointerDown = (e) => {
        isDragging = true;
        prevPointer = { x: e.clientX, y: e.clientY };
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - prevPointer.x;
        const deltaY = e.clientY - prevPointer.y;
        prevPointer = { x: e.clientX, y: e.clientY };

        velocity.x = deltaX * 0.005;
        velocity.y = deltaY * 0.005;

        earthMesh.rotation.y += velocity.x;
        earthPivot.rotation.x += velocity.y;
      };

      const onPointerUp = () => {
        isDragging = false;
      };

      const dom = canvas;
      dom.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      // 11. Resize handling
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

      // 12. Animation Loop
      let t = 0;
      let trailIndex = 0;
      const history = [];

      const animate = () => {
        animId = requestAnimationFrame(animate);

        // Constant gentle rotation if not dragging
        if (!isDragging && !reducedMotion) {
          velocity.x *= 0.95;
          velocity.y *= 0.95;
          earthMesh.rotation.y += 0.0018 + velocity.x;
          cloudsMesh.rotation.y += 0.0024 + velocity.x * 1.1;
          earthPivot.rotation.x += velocity.y;
        }

        // Satellite Orbital Mechanics
        t += 0.014;
        const orbitR = 2.45;
        const orbitInc = 0.72; // ~41° inclination
        const satX = orbitR * Math.cos(t);
        const satY = orbitR * Math.sin(t) * Math.sin(orbitInc);
        const satZ = orbitR * Math.sin(t) * Math.cos(orbitInc);

        sat1.position.set(satX, satY, satZ);
        sat1.lookAt(
          satX - Math.sin(t),
          satY + Math.cos(t) * Math.sin(orbitInc),
          satZ + Math.cos(t) * Math.cos(orbitInc)
        );

        // Update trail buffer
        history.push(new THREE.Vector3(satX, satY, satZ));
        if (history.length > trailCount) history.shift();

        const posAttr = trailGeo.attributes.position;
        for (let i = 0; i < history.length; i++) {
          posAttr.setXYZ(i, history[i].x, history[i].y, history[i].z);
        }
        for (let i = history.length; i < trailCount; i++) {
          posAttr.setXYZ(i, satX, satY, satZ);
        }
        posAttr.needsUpdate = true;

        // Camera zoom reaction based on scrollProgress
        const targetZ = 4.8 - (scrollProgress || 0) * 1.8;
        camera.position.z += (targetZ - camera.position.z) * 0.08;

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        if (animId) cancelAnimationFrame(animId);
        dom.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        resizeObserver.disconnect();

        if (renderer) {
          renderer.dispose();
        }
        earthGeo.dispose();
        earthMat.dispose();
        cloudsGeo.dispose();
        cloudsMat.dispose();
        atmosGeo.dispose();
        atmosMat.dispose();
        satBusGeo.dispose();
        panelGeo.dispose();
        dishGeo.dispose();
        trailGeo.dispose();
      };
    } catch (err) {
      console.error("[SatQuery] WebGL Globe Initialization Failed:", err);
      setWebglError(true);
    }
  }, [scrollProgress, reducedMotion]);

  if (webglError) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src={earthMapUrl}
          alt="Earth"
          style={{ width: "80%", borderRadius: "50%", boxShadow: "0 0 40px rgba(56,189,248,0.3)" }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        userSelect: "none",
      }}
      title="Click and drag to rotate the 3D Earth"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          outline: "none",
        }}
      />
    </div>
  );
}
