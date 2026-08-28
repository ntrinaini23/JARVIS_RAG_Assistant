import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { 
  Network, 
  Layers, 
  Search, 
  ArrowRight, 
  Cpu, 
  Database,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import VectorGraph from '../components/three/VectorGraph';

interface NodeData {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
  x: number;
  y: number;
  z: number;
}

interface KnowledgeBaseProps {
  enable3D: boolean;
  setEnable3D: (enable: boolean) => void;
}

export default function KnowledgeBase({ enable3D, setEnable3D }: KnowledgeBaseProps) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  const fetchGraphData = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/knowledge-graph');
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes);
      }
    } catch (err) {
      console.error('Error fetching knowledge graph coordinates:', err);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const pipelineStages = [
    { title: "Documents", desc: "PDF, TXT, DOCX uploads", icon: Layers, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
    { title: "Smart Chunks", desc: "Sentence-aware parsing", icon: Layers, color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
    { title: "Embeddings", desc: "384d vector maps", icon: Network, color: "text-pink-400 bg-pink-500/10 border-pink-500/30" },
    { title: "ChromaDB", desc: "Local vector indexing", icon: Database, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
    { title: "Retrieval", desc: "Semantic similarity top-k", icon: Search, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    { title: "Ollama LLM", desc: "Grounded responses", icon: Cpu, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  ];

  return (
    <div className="space-y-8 p-1 z-10 relative min-h-screen">
      
      {/* Page Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Vector Space & Pipeline</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Visualize how your documents are processed, embedded, and retrieved in 3D vector space.
          </p>
        </div>
        
        {/* Graph toggle controls */}
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchGraphData}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-cyan-400 border border-slate-800 transition-all"
            title="Reload Vector Nodes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <div className="glass-panel border rounded-xl px-4 py-2 flex items-center gap-3 text-xs font-semibold">
            <span className="text-slate-400">Interactive 3D:</span>
            <button
              onClick={() => setEnable3D(!enable3D)}
              className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none
                ${enable3D ? 'bg-cyan-500' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200
                ${enable3D ? 'transform translate-x-4' : ''}`} 
              />
            </button>
          </div>
        </div>
      </div>

      {/* RAG pipeline flowchart diagram */}
      <div className="glass-panel border rounded-3xl p-6 shadow-glass">
        <h3 className="text-sm font-semibold text-slate-200 mb-6">Semantic RAG Processing pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 items-center">
          {pipelineStages.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div key={idx} className="flex items-center gap-2 w-full">
                {/* Stage box */}
                <div className="flex-grow glass-panel border rounded-2xl p-4 flex flex-col items-center text-center space-y-2 relative group shadow-sm hover:border-cyan-500/40 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stage.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-100">{stage.title}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{stage.desc}</p>
                  </div>
                </div>
                {/* Arrow */}
                {idx < 5 && (
                  <ArrowRight className="hidden xl:block w-4 h-4 text-slate-650 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Vector graph visualizer panel */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-stretch">
        
        {/* Interactive 3D Canvas Box */}
        <div className="xl:col-span-3 glass-panel border rounded-3xl p-6 shadow-glass min-h-[500px] flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-6 left-6 z-10">
            <h4 className="text-sm font-semibold text-slate-200">Semantic Document Clusters</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Click a node to inspect its document content. Drag to rotate.</p>
          </div>

          <div className="w-full h-96 flex-grow mt-4">
            {enable3D ? (
              <Canvas camera={{ position: [0, 0, 7.5], fov: 60 }}>
                <ambientLight intensity={0.8} />
                <directionalLight position={[3, 3, 3]} intensity={1.5} />
                <VectorGraph 
                  nodes={nodes} 
                  onSelectNode={(node) => setSelectedNode(node)} 
                />
                <OrbitControls enableZoom enablePan autoRotate={!selectedNode} autoRotateSpeed={0.15} />
              </Canvas>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                <Network className="w-16 h-16 animate-pulse" />
                <p className="text-xs font-semibold">3D Visualizer Disabled.</p>
                <p className="text-[10px] text-slate-500 text-center max-w-xs">
                  To view the 3D embedding cluster space, toggle "Interactive 3D: ON" in the upper right or settings panel.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200/20 pt-4 flex justify-between text-[10px] text-slate-500">
            <span>Graph nodes: {nodes.length || 6} clusters</span>
            <span>Cosine similarity metrics mapped</span>
          </div>
        </div>

        {/* Selected Node Inspector Detail panel */}
        <div className="glass-panel border rounded-3xl p-6 shadow-glass flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-6">Metadata Inspector</h4>
            
            {selectedNode ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">Source Document</span>
                  <h5 className="text-sm font-semibold text-slate-100 truncate">{selectedNode.filename}</h5>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-violet-400 font-bold uppercase tracking-wider">Chunk Index</span>
                  <p className="text-xs font-mono font-semibold">Fragment #{selectedNode.chunk_index}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-pink-400 font-bold uppercase tracking-wider">Coordinates (Projection)</span>
                  <p className="text-[10px] font-mono text-slate-400">
                    X: {selectedNode.x} | Y: {selectedNode.y} | Z: {selectedNode.z}
                  </p>
                </div>

                <div className="space-y-1 border-t border-slate-800 pt-3">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Chunk Text Snippet</span>
                  <div className="bg-slate-100 dark:bg-slate-950/80 p-4 border border-slate-200 dark:border-slate-900 rounded-2xl text-[11px] text-[var(--text-secondary)] leading-relaxed max-h-56 overflow-y-auto">
                    "{selectedNode.text}"
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20 border border-dashed border-slate-200/20 rounded-2xl p-4">
                <HelpCircle className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No node selected</p>
                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                  Click on any vector node in the 3D graph to inspect its embedding coordinates and text segment content.
                </p>
              </div>
            )}
          </div>

          {selectedNode && (
            <button 
              onClick={() => setSelectedNode(null)}
              className="w-full mt-4 py-2 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-[10px] text-[var(--text-muted)] hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              Clear Inspector Selection
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
