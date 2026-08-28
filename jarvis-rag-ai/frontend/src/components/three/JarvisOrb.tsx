import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface JarvisOrbProps {
  state: 'idle' | 'searching' | 'thinking' | 'responding' | 'error';
  theme?: 'light' | 'dark';
}

export default function JarvisOrb({ state, theme = 'dark' }: JarvisOrbProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const webGroupRef = useRef<THREE.LineSegments>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const isDark = theme !== 'light';

  // Dynamic colors and speed parameters mapping state to the web background
  const config = {
    idle: {
      coreColor: isDark ? '#00ffff' : '#0284c7',       // Cyan vs Sky Blue
      webColor: isDark ? '#0088ff' : '#1d4ed8',        // Blue vs Deep Blue
      particleColor: isDark ? '#00ffff' : '#2563eb',   // Cyan vs Royal Blue
      speedMultiplier: 1.0,
    },
    searching: {
      coreColor: isDark ? '#0088ff' : '#1d4ed8',       // Blue vs Deep Blue
      webColor: isDark ? '#1d4ed8' : '#1e3a8a',        // Deep Blue vs Navy
      particleColor: isDark ? '#60a5fa' : '#3b82f6',   // Sky Blue vs Royal Blue
      speedMultiplier: 2.2,
    },
    thinking: {
      coreColor: isDark ? '#a78bfa' : '#6366f1',       // Violet vs Indigo
      webColor: isDark ? '#6d28d9' : '#4f46e5',        // Deep Purple vs Indigo
      particleColor: isDark ? '#c084fc' : '#818cf8',   // Purple vs Light Indigo
      speedMultiplier: 1.6,
    },
    responding: {
      coreColor: isDark ? '#34d399' : '#0ea5e9',       // Emerald vs Cyan
      webColor: isDark ? '#0d9488' : '#0284c7',        // Teal vs Sky Blue
      particleColor: isDark ? '#6ee7b7' : '#38bdf8',   // Mint vs Blue-Cyan
      speedMultiplier: 1.2,
    },
    error: {
      coreColor: '#ef4444',                            // Red
      webColor: '#b91c1c',                             // Crimson
      particleColor: '#fca5a5',                        // Light Red
      speedMultiplier: 3.0,
    },
  }[state];

  // =============================
  // PARTICLES
  // =============================
  const particleCount = 1200;
  const particlePositions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 40;
    }
    return pos;
  }, []);

  // =============================
  // WEB STRUCTURE
  // =============================
  const pointCount = 100;
  const linePositions = useMemo(() => {
    // 1. Generate random points
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < pointCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 8 + 1;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          (Math.random() - 0.5) * 4
        )
      );
    }

    // 2. Identify connections with distance < 2.5
    const vertices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const distance = points[i].distanceTo(points[j]);
        if (distance < 2.5) {
          vertices.push(points[i].x, points[i].y, points[i].z);
          vertices.push(points[j].x, points[j].y, points[j].z);
        }
      }
    }
    return new Float32Array(vertices);
  }, []);

  useFrame((stateFrame) => {
    const elapsedTime = stateFrame.clock.getElapsedTime();
    const pointerX = stateFrame.pointer.x; // Range [-1, 1]
    const pointerY = stateFrame.pointer.y; // Range [-1, 1]
    const speed = config.speedMultiplier;

    // Rotate particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y = elapsedTime * 0.02 * speed;
    }

    // Rotate and interactive sway webGroup
    if (webGroupRef.current) {
      webGroupRef.current.rotation.z = elapsedTime * 0.04 * speed;
      webGroupRef.current.rotation.y += (pointerX * 0.15 - webGroupRef.current.rotation.y) * 0.02 * speed;
      webGroupRef.current.rotation.x += (pointerY * 0.1 - webGroupRef.current.rotation.x) * 0.02 * speed;
    }

    // Rotate core & float levitation
    if (coreRef.current) {
      coreRef.current.rotation.x = elapsedTime * 0.4 * speed;
      coreRef.current.rotation.y = elapsedTime * 0.6 * speed;
      coreRef.current.position.y = Math.sin(elapsedTime * 1.5 * speed) * 0.5;
    }
  });

  return (
    <group>
      {/* Central 3D Core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[2.2, 2]} />
        <meshBasicMaterial
          color={config.coreColor}
          wireframe
          transparent
          opacity={isDark ? 0.65 : 0.4}
        />
      </mesh>

      {/* Web Connections */}
      <lineSegments ref={webGroupRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={config.webColor}
          transparent
          opacity={isDark ? 0.35 : 0.25}
        />
      </lineSegments>

      {/* Starfield Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={config.particleColor}
          size={0.035}
          transparent
          opacity={isDark ? 0.65 : 0.45}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
