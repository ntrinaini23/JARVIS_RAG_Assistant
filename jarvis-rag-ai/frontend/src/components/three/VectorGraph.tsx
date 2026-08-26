import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface NodeData {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
  x: number;
  y: number;
  z: number;
}

interface VectorGraphProps {
  nodes: NodeData[];
  onSelectNode?: (node: NodeData) => void;
}

export default function VectorGraph({ nodes, onSelectNode }: VectorGraphProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [activeQueryPulse, setActiveQueryPulse] = useState<{ x: number, y: number, z: number, scale: number } | null>(null);

  // Fallback mock nodes if database has no files yet, to keep the UX gorgeous
  const displayNodes = nodes.length > 0 ? nodes : [
    { id: '1', filename: 'handbook.pdf', chunk_index: 0, text: 'This is a sample chunk from the college student handbook discussing attendance policies.', x: -2.1, y: 1.5, z: 0.5 },
    { id: '2', filename: 'handbook.pdf', chunk_index: 1, text: 'Students must maintain at least 75% attendance to qualify for examinations.', x: -2.3, y: 1.7, z: 0.8 },
    { id: '3', filename: 'benefits.txt', chunk_index: 0, text: 'Company benefits include healthcare, dental insurance, and a matching 401k plan.', x: 2.5, y: -1.2, z: 1.2 },
    { id: '4', filename: 'benefits.txt', chunk_index: 1, text: 'Healthcare insurance covers prescription drugs and annual wellness checkups.', x: 2.7, y: -0.9, z: 1.5 },
    { id: '5', filename: 'ai_policy.docx', chunk_index: 0, text: 'Guidelines for the responsible use of generative artificial intelligence systems.', x: 0.2, y: 3.1, z: -1.0 },
    { id: '6', filename: 'ai_policy.docx', chunk_index: 1, text: 'Generative tools may be used for brainstorming and styling, but not grading.', x: 0.5, y: 2.8, z: -0.7 }
  ];

  // Rotate graph slowly
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.05;
      groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.05;
    }

    // Animate search pulse if active
    if (activeQueryPulse) {
      if (activeQueryPulse.scale < 8) {
        setActiveQueryPulse(prev => prev ? { ...prev, scale: prev.scale + 0.15 } : null);
      } else {
        setActiveQueryPulse(null);
      }
    }
  });

  // Periodically trigger a mock search query pulse from the center to demonstrate retrieval
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick random node to pulse towards
      const target = displayNodes[Math.floor(Math.random() * displayNodes.length)];
      setActiveQueryPulse({
        x: target.x,
        y: target.y,
        z: target.z,
        scale: 0.1
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [displayNodes]);

  // Color generator based on file name
  const getFileColor = (filename: string) => {
    const colors = [
      '#06b6d4', // Cyan
      '#8b5cf6', // Violet
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#ec4899', // Pink
    ];
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
      hash = filename.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <group ref={groupRef}>
      {/* Node Spheres */}
      {displayNodes.map((node) => {
        const color = getFileColor(node.filename);
        const isHovered = hoveredNode?.id === node.id;
        
        return (
          <group key={node.id} position={[node.x, node.y, node.z]}>
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredNode(node);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredNode(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectNode) onSelectNode(node);
              }}
            >
              <sphereGeometry args={[isHovered ? 0.22 : 0.15, 16, 16]} />
              <meshBasicMaterial color={color} />
            </mesh>

            {/* Glowing outer ring when hovered */}
            {isHovered && (
              <mesh>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={0.25}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}

            {/* Tooltip Popup */}
            {isHovered && (
              <Html distanceFactor={8} zIndexRange={[10, 20]}>
                <div className="bg-slate-950/90 text-slate-100 border border-slate-700/60 p-3 rounded-lg w-56 text-xs shadow-glass backdrop-blur-md pointer-events-none">
                  <p className="font-semibold text-cyan-400 truncate mb-1">{node.filename}</p>
                  <p className="text-slate-400 leading-normal line-clamp-3">"{node.text}"</p>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Connection Lines (Draw mock lines between nearby nodes to look like vector clusters) */}
      {displayNodes.map((n1, i) => {
        return displayNodes.slice(i + 1).map((n2) => {
          // Calculate distance
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dz = n1.z - n2.z;
          const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          // Connect only close clusters (distance < 3)
          if (distance < 3.0) {
            const points = [new THREE.Vector3(n1.x, n1.y, n1.z), new THREE.Vector3(n2.x, n2.y, n2.z)];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            
            return (
              <line key={`${n1.id}-${n2.id}`} {...({ geometry: lineGeometry } as any)}>
                <lineBasicMaterial
                  color="#475569"
                  transparent
                  opacity={0.2}
                />
              </line>
            );
          }
          return null;
        });
      })}

      {/* Semantic Search Pulse Visualization */}
      {activeQueryPulse && (
        <mesh position={[activeQueryPulse.x, activeQueryPulse.y, activeQueryPulse.z]}>
          <sphereGeometry args={[activeQueryPulse.scale * 0.3, 32, 32]} />
          <meshBasicMaterial
            color="#06b6d4"
            transparent
            opacity={Math.max(0, 0.4 - (activeQueryPulse.scale / 20))}
            wireframe
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}
