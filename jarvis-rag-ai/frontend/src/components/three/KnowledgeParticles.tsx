import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function KnowledgeParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  
  const particleCount = 200;
  
  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const spd = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      // Scatter in a cube from -8 to 8
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      
      spd[i] = 0.1 + Math.random() * 0.3;
    }
    return [pos, spd];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const positionAttribute = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      
      // Floating motion
      positionAttribute.array[idx + 1] += Math.sin(time + i) * 0.002 * speeds[i];
      positionAttribute.array[idx] += Math.cos(time * 0.5 + i) * 0.001 * speeds[i];
      
      // Wrap around boundaries
      if (positionAttribute.array[idx + 1] > 8) positionAttribute.array[idx + 1] = -8;
      if (positionAttribute.array[idx + 1] < -8) positionAttribute.array[idx + 1] = 8;
      if (positionAttribute.array[idx] > 8) positionAttribute.array[idx] = -8;
      if (positionAttribute.array[idx] < -8) positionAttribute.array[idx] = 8;
    }
    
    positionAttribute.needsUpdate = true;
    pointsRef.current.rotation.y = time * 0.01;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#a78bfa"
        transparent
        opacity={0.35}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
