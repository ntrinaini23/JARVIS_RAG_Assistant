import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface JarvisOrbProps {
  state: 'idle' | 'searching' | 'thinking' | 'responding' | 'error';
  theme?: 'light' | 'dark';
}

export default function JarvisOrb({ state, theme = 'dark' }: JarvisOrbProps) {
  const orbRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const isDark = theme !== 'light';

  // Define state behaviors
  const config = {
    idle: {
      color: '#06b6d4',       // Neon Cyan
      distort: 0.3,
      speed: 1.5,
      roughness: 0.2,
      metalness: 0.8,
      rotationSpeed: 0.3,
    },
    searching: {
      color: '#3b82f6',       // Electric Blue
      distort: 0.6,
      speed: 4.0,
      roughness: 0.4,
      metalness: 0.9,
      rotationSpeed: 1.5,
    },
    thinking: {
      color: '#8b5cf6',       // Purple Violet
      distort: 0.4,
      speed: 3.0,
      roughness: 0.1,
      metalness: 0.7,
      rotationSpeed: 0.8,
    },
    responding: {
      color: '#10b981',      // Emerald Green
      distort: 0.25,
      speed: 2.0,
      roughness: 0.3,
      metalness: 0.8,
      rotationSpeed: 0.5,
    },
  }[state];

  // If in light mode, change the animation colors to shades of blue (except error)
  const orbColor = isDark 
    ? config.color 
    : {
        idle: '#2563eb',       // Royal Blue
        searching: '#1d4ed8',  // Deep Blue
        thinking: '#4f46e5',   // Indigo Blue
        responding: '#0284c7', // Sky Blue
        error: '#ef4444',      // Red
      }[state];

  // Adjust material properties and blending based on theme
  const currentMetalness = isDark ? config.metalness : 0.05;
  const currentRoughness = isDark ? config.roughness : 0.5;
  const currentBlending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;

  // Particle positions
  const particleCount = 120;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const radius = 2.0 + Math.random() * 0.8;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  useFrame((stateFrame) => {
    const time = stateFrame.clock.getElapsedTime();
    
    // Rotate orb
    if (orbRef.current) {
      orbRef.current.rotation.y += 0.005 * config.rotationSpeed;
      orbRef.current.rotation.x = Math.sin(time * 0.5) * 0.15;
      
      // Floating effect
      orbRef.current.position.y = Math.sin(time * 1.2) * 0.12;
    }

    // Rotate and animate surrounding particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y -= 0.008 * config.rotationSpeed;
      // Pulse particles
      const scale = 1.0 + Math.sin(time * 2.0) * 0.05 * (state === 'thinking' ? 1.8 : 0.8);
      particlesRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group>
      {/* Central JARVIS Orb */}
      <Sphere ref={orbRef} args={[1.3, 64, 64]}>
        <MeshDistortMaterial
          color={orbColor}
          distort={config.distort}
          speed={config.speed}
          roughness={currentRoughness}
          metalness={currentMetalness}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
        />
      </Sphere>

      {/* Glow Center Sphere */}
      <mesh>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshBasicMaterial
          color={orbColor}
          transparent
          opacity={isDark ? 0.15 : 0.3}
          blending={currentBlending}
        />
      </mesh>

      {/* Floating Knowledge Dust particles around the Orb */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          color={orbColor}
          transparent
          opacity={isDark ? 0.8 : 0.9}
          sizeAttenuation
          blending={currentBlending}
        />
      </points>
    </group>
  );
}
