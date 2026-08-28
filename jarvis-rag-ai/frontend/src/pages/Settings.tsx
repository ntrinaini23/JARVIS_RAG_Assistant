import { useState, useEffect } from 'react';
import {
  Sliders,
  Palette,
  Save,
  HelpCircle,
  AlertCircle,
  Cpu
} from 'lucide-react';

interface SettingsProps {
  enable3D: boolean;
  setEnable3D: (enable: boolean) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export default function Settings({ enable3D, setEnable3D, theme, setTheme }: SettingsProps) {
  // RAG States
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(64);
  const [topK, setTopK] = useState(4);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.40);

  // LLM states
  const [llmProvider, setLlmProvider] = useState('ollama');
  const [availableModels, setAvailableModels] = useState<string[]>(['qwen2.5:0.5b']);
  const [activeModel, setActiveModel] = useState('qwen2.5:0.5b');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(1024);

  const [reduceAnimation, setReduceAnimation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch settings from API on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/settings');
        if (res.ok) {
          const data = await res.json();
          const s = data.settings;
          setChunkSize(parseInt(s.chunk_size) || 512);
          setChunkOverlap(parseInt(s.chunk_overlap) || 64);
          setTopK(parseInt(s.top_k) || 4);
          setSimilarityThreshold(parseFloat(s.similarity_threshold) || 0.40);
          setActiveModel(s.llm_model || 'qwen2.5:0.5b');
          setTemperature(parseFloat(s.temperature) || 0.1);
          setMaxTokens(parseInt(s.max_tokens) || 1024);
          setLlmProvider(s.llm_provider || 'ollama');
          setGeminiApiKey(s.gemini_api_key || '');
          setOpenaiApiKey(s.openai_api_key || '');
          setOpenaiModel(s.openai_model || 'gpt-4o-mini');
          setGeminiModel(s.gemini_model || 'gemini-1.5-flash');

          if (data.available_models && data.available_models.length > 0) {
            setAvailableModels(data.available_models);
          }
        }
      } catch (err) {
        console.error('Error fetching settings from API:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      const payload = {
        chunk_size: chunkSize.toString(),
        chunk_overlap: chunkOverlap.toString(),
        top_k: topK.toString(),
        similarity_threshold: similarityThreshold.toString(),
        llm_model: activeModel,
        temperature: temperature.toString(),
        max_tokens: maxTokens.toString(),
        llm_provider: llmProvider,
        gemini_api_key: geminiApiKey,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
        gemini_model: geminiModel
      };

      const res = await fetch('http://127.0.0.1:8000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  return (
    <div className="space-y-8 p-1 z-10 relative min-h-screen max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">System Configuration</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Optimize RAG vector generation thresholds and active LLM configuration parameters.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>System configuration updated successfully and applied dynamically!</span>
        </div>
      )}

      {/* Grid of config sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

        {/* RAG pipeline parameters config box */}
        <div className="glass-panel border rounded-3xl p-6 shadow-glass space-y-6">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" /> Vector & Chunk Settings
          </h3>

          <div className="space-y-5 text-xs">
            {/* Chunk Size */}
            <div className="space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-350">Chunk Character Size</span>
                <span className="text-cyan-400 font-mono">{chunkSize} char</span>
              </div>
              <input
                type="range"
                min={256}
                max={1500}
                step={32}
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[10px] text-slate-500">Larger sizes capture more context; smaller chunks isolate specific topics.</p>
            </div>

            {/* Chunk Overlap */}
            <div className="space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-350">Chunk Overlap</span>
                <span className="text-cyan-400 font-mono">{chunkOverlap} char</span>
              </div>
              <input
                type="range"
                min={0}
                max={256}
                step={8}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[10px] text-slate-500">Provides redundancy context boundaries between adjacent fragments.</p>
            </div>

            {/* Top-K retrieval */}
            <div className="space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-350">Top-K Retrieval Nodes</span>
                <span className="text-cyan-400 font-mono">{topK} nodes</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[10px] text-slate-500">The count of nearest neighbor chunks forwarded to the prompt context.</p>
            </div>

            {/* Similarity Threshold */}
            <div className="space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-350">Similarity Cutoff (Cosine)</span>
                <span className="text-cyan-400 font-mono">{(similarityThreshold * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.10}
                max={0.90}
                step={0.05}
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[10px] text-slate-500">Discard retrieved content that is less similar to the question than this limit.</p>
            </div>
          </div>
        </div>

        {/* LLM configs box */}
        <div className="glass-panel border rounded-3xl p-6 shadow-glass space-y-6">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Cpu className="w-4 h-4 text-violet-400" /> LLM Inference Settings
          </h3>

          <div className="space-y-5 text-xs">
            {/* LLM Provider Select */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-350 block">Inference Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80"
              >
                <option value="ollama">Ollama (Local LLM)</option>
                <option value="gemini">Google Gemini API</option>
                <option value="openai">OpenAI Chat API</option>
              </select>
              <p className="text-[10px] text-slate-500">Choose the LLM engine for processing retrieved chunks and generating answers.</p>
            </div>

            {/* Conditionally render fields based on Provider */}
            {llmProvider === 'ollama' && (
              <div className="space-y-4 border-t border-slate-800/40 pt-4">
                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block">Target Ollama Model</label>
                  <select
                    value={activeModel}
                    onChange={(e) => setActiveModel(e.target.value)}
                    className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">Fetches active models directly from local Ollama host registry tags.</p>
                </div>
              </div>
            )}

            {llmProvider === 'gemini' && (
              <div className="space-y-4 border-t border-slate-800/40 pt-4">
                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block">Target Gemini Model</label>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80"
                  >
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & lightweight)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Highly reasoning)</option>
                    <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block">Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Required to generate answers using Google Gemini cloud models.</p>
                </div>
              </div>
            )}

            {llmProvider === 'openai' && (
              <div className="space-y-4 border-t border-slate-800/40 pt-4">
                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block">Target OpenAI Model</label>
                  <select
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (Cost efficient & fast)</option>
                    <option value="gpt-4o">gpt-4o (High performance)</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy model)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block">OpenAI API Key</label>
                  <input
                    type="password"
                    placeholder="sk-proj-..."
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Required to generate answers using OpenAI GPT models.</p>
                </div>
              </div>
            )}

            {/* Temperature */}
            <div className="space-y-2 border-t border-slate-800/40 pt-4">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-350">Generation Temperature</span>
                <span className="text-cyan-400 font-mono">{temperature}</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={1.0}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[10px] text-slate-500">Lower values (e.g. 0.1) enforce logical facts; higher values add creativity.</p>
            </div>

            {/* Max response tokens */}
            <div className="space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-350">Max Predicted Tokens</span>
                <span className="text-cyan-400 font-mono">{maxTokens} tokens</span>
              </div>
              <input
                type="range"
                min={128}
                max={2048}
                step={128}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[10px] text-slate-500">Bounds the maximum response token length generated by the model.</p>
            </div>
          </div>
        </div>

        {/* Theme/Appearance config box */}
        <div className="glass-panel border rounded-3xl p-6 shadow-glass space-y-6">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Palette className="w-4 h-4 text-emerald-400" /> UI & Appearance Settings
          </h3>

          <div className="space-y-5 text-xs">
            {/* 3D Toggles */}
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
              <div className="space-y-0.5">
                <h5 className="font-semibold text-slate-200">Enable Interactive 3D Scenes</h5>
                <p className="text-[10px] text-slate-500 max-w-[240px]">Uses WebGL R3F canvases on Dashboard and Graph pages.</p>
              </div>
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

            {/* Dark theme toggle */}
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
              <div className="space-y-0.5">
                <h5 className="font-semibold text-slate-200">Force Obsidian Theme</h5>
                <p className="text-[10px] text-slate-500 max-w-[240px]">Renders UI using premium slate-950 dark tones.</p>
              </div>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none
                  ${theme === 'dark' ? 'bg-cyan-500' : 'bg-slate-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200
                  ${theme === 'dark' ? 'transform translate-x-4' : ''}`}
                />
              </button>
            </div>

            {/* Animations Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h5 className="font-semibold text-slate-200">Reduce Client Animations</h5>
                <p className="text-[10px] text-slate-500 max-w-[240px]">Speeds up canvas rendering and disables particle movements.</p>
              </div>
              <button
                onClick={() => setReduceAnimation(!reduceAnimation)}
                className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none
                  ${reduceAnimation ? 'bg-cyan-500' : 'bg-slate-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200
                  ${reduceAnimation ? 'transform translate-x-4' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* RAG Diagnostics note */}
        <div className="glass-panel border rounded-3xl p-5 shadow-glass flex items-start gap-4 bg-slate-100/50 dark:bg-slate-900/20">
          <HelpCircle className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-xs font-semibold text-slate-200">Grounding Safety</h5>
            <p className="text-[10px] text-slate-400 leading-normal">
              Settings are saved persistently on the backend. When uploading files, the system chunks them according to the active chunk size and overlap parameters configured here.
            </p>
          </div>
        </div>

      </div>

      {/* Save Settings Trigger Bar */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-xs rounded-xl shadow-neon-cyan transition-all duration-200"
        >
          <Save className="w-4 h-4" />
          Save System Configuration
        </button>
      </div>

    </div>
  );
}
