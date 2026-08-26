import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Search, 
  HelpCircle,
  FileText
} from 'lucide-react';


interface Source {
  file_name: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

interface ChatProps {
  chatState: 'idle' | 'searching' | 'thinking' | 'responding' | 'error';
  setChatState: (state: 'idle' | 'searching' | 'thinking' | 'responding' | 'error') => void;
}

export default function Chat({ chatState, setChatState }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Custom states matching the requested search pipeline display
  const [searchingLog, setSearchingLog] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    "What is the overall attendance policy?",
    "Summarize the core guidelines in the documents.",
    "Are there any specific medical leave terms?",
    "Who is allowed to use generative AI tools?"
  ];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, searchingLog]);

  const [activeModel, setActiveModel] = useState('qwen2.5:0.5b');
  const [activeProvider, setActiveProvider] = useState('ollama');

  // Load chat history and configurations on mount
  useEffect(() => {
    const saved = localStorage.getItem('jarvis_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      } catch (e) {
        console.error('Error loading chat history:', e);
      }
    }

    const fetchConfigs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/settings');
        if (res.ok) {
          const data = await res.json();
          const s = data.settings;
          const provider = s.llm_provider || 'ollama';
          setActiveProvider(provider);
          if (provider === 'gemini') {
            setActiveModel(s.gemini_model || 'gemini-1.5-flash');
          } else if (provider === 'openai') {
            setActiveModel(s.openai_model || 'gpt-4o-mini');
          } else {
            setActiveModel(s.llm_model || 'qwen2.5:0.5b');
          }
        }
      } catch (e) {
        console.error('Error fetching RAG settings:', e);
      }
    };
    fetchConfigs();
  }, []);

  // Save history helper
  const saveChatHistory = (history: Message[]) => {
    localStorage.setItem('jarvis_chat_history', JSON.stringify(history));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem('jarvis_chat_history');
    setChatState('idle');
    setSearchingLog(null);
  };

  const handleSubmit = async (textToSend: string) => {
    if (!textToSend.trim() || chatState !== 'idle') return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setInput('');

    // Trigger Search Phase
    setChatState('searching');
    setSearchingLog("🧠 JARVIS is searching the knowledge base...");

    try {
      // Connect to SSE stream endpoint
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSend })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setSearchingLog("📄 Extracting retrieved chunks...");
      
      const assistantMsgId = Math.random().toString();
      let assistantContent = '';
      let assistantSources: Source[] = [];

      // Reader loop for SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error("Failed to initialize stream reader.");
      }

      // Transition to Responding State
      setChatState('responding');
      setSearchingLog("✨ JARVIS is generating a grounded answer...");

      let buffer = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep the trailing partial line

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // we can parse event types (metadata, content, end, error)
            continue;
          }
          if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (!dataStr || dataStr === '{}') continue;

            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.sources) {
                assistantSources = dataObj.sources;
                
                // Log detailed search results
                if (assistantSources.length > 0) {
                  setSearchingLog(`📄 Found ${assistantSources.length} relevant sources...`);
                } else {
                  setSearchingLog("⚠️ No matching chunks found. Defaulting to fallback.");
                }
              }
              if (dataObj.delta) {
                // Clear the logs overlay when the response starts streaming in
                setSearchingLog(null);
                assistantContent += dataObj.delta;
                
                // Update active message block dynamically
                setMessages((prev) => {
                  const filtered = prev.filter(m => m.id !== assistantMsgId);
                  return [...filtered, {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: assistantContent,
                    sources: assistantSources,
                    timestamp: new Date()
                  }];
                });
              }
              if (dataObj.error) {
                throw new Error(dataObj.error);
              }
            } catch (err) {
              console.error("Error parsing event line", err);
            }
          }
        }
      }

      // Finish streaming cleanly
      setChatState('idle');
      setSearchingLog(null);

      // Persist finished log
      setMessages((prev) => {
        saveChatHistory(prev);
        return prev;
      });

    } catch (err: any) {
      console.error(err);
      setChatState('error');
      setSearchingLog(null);
      
      const errMsg: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: `Error: Unable to generate response. Check that the backend server is running and Ollama contains model 'qwen2.5:0.5b'. (${err.message})`,
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const next = [...prev, errMsg];
        saveChatHistory(next);
        return next;
      });
      
      setTimeout(() => setChatState('idle'), 4000);
    }
  };

  // Simple formatter to parse list items, bold texts, and basic markdown elements natively
  const formatMarkdownText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Bold text formatting **text** -> <strong>text</strong>
      let formattedLine = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      
      // Inline code blocks `code` -> <code>code</code>
      const codeRegex = /`(.*?)`/g;

      // Handle simple formatting
      formattedLine = formattedLine.replace(boldRegex, '<strong>$1</strong>');
      formattedLine = formattedLine.replace(codeRegex, '<code class="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-400 font-mono">$1</code>');

      // Check if it is a list element
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-300 my-1" 
              dangerouslySetInnerHTML={{ __html: formattedLine.trim().substring(2) }} 
          />
        );
      }
      
      return (
        <p key={idx} className="my-2 leading-relaxed" 
           dangerouslySetInnerHTML={{ __html: formattedLine }} 
        />
      );
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 p-1 relative z-10 items-stretch min-h-[calc(100vh-140px)]">
      
      {/* Left Column: Chat Console */}
      <div className="xl:col-span-3 glass-panel rounded-3xl border shadow-glass flex flex-col justify-between overflow-hidden h-[calc(100vh-160px)]">
        
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-200/20 dark:border-slate-800/20 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-neon-cyan" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Grounded Knowledge Mode</span>
          </div>
          {messages.length > 0 && (
            <button 
              onClick={handleClearChat}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-[var(--text-muted)] hover:text-rose-450 transition-colors"
              title="Clear Conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Message Log */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            /* Empty Chat State */
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-6 py-12">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center shadow-glass shadow-neon-cyan animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Ask JARVIS Anything</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Ask questions about your uploaded documents. JARVIS retrieves facts semantically and gives grounded responses.
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-4">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(q)}
                    className="p-4 text-left text-xs bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 hover:border-cyan-500/50 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-slate-900/80 text-[var(--text-secondary)] transition-all duration-200 shadow-glass"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Loaded Log */
            <div className="space-y-6">
              {messages.map((msg) => {
                const isAI = msg.role === 'assistant';
                
                return (
                  <div 
                    key={msg.id} 
                    className={`flex gap-4 ${isAI ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAI && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-neon-cyan text-white text-xs font-bold flex-shrink-0">
                        J
                      </div>
                    )}
                    
                    <div className={`max-w-[80%] rounded-2xl p-5 border relative group shadow-sm transition-colors
                      ${isAI 
                        ? 'bg-slate-100/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-850/80 text-[var(--text-primary)] rounded-tl-none' 
                        : 'bg-gradient-to-r from-cyan-500/10 to-cyan-600/15 dark:from-cyan-500/20 dark:to-cyan-600/20 border-cyan-300/30 dark:border-cyan-500/30 text-[var(--text-primary)] rounded-tr-none'
                      }`}
                    >
                      <div className="text-xs font-normal">
                        {isAI ? formatMarkdownText(msg.content) : <p>{msg.content}</p>}
                      </div>

                      {/* Source Citation block */}
                      {isAI && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/60">
                          <p className="text-[10px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" /> Source Citations:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, i) => (
                              <div 
                                key={i} 
                                className="flex items-center gap-1.5 bg-slate-200/50 dark:bg-slate-950/80 border border-slate-300/50 dark:border-slate-800/80 rounded-lg px-2.5 py-1 text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold"
                                title={`Similarity Score: ${src.score}`}
                              >
                                <span>{src.file_name}</span>
                                <span className="text-slate-500 font-normal">({Math.round(src.score * 100)}%)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons (copy, etc.) on hover */}
                      {isAI && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-950/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* RAG pipeline state log */}
              {searchingLog && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-neon-cyan text-white text-xs font-bold flex-shrink-0 animate-pulse">
                    J
                  </div>
                  <div className="bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/40 rounded-2xl rounded-tl-none p-4 max-w-[80%] text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <Search className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span>{searchingLog}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200/20 dark:border-slate-800/20 bg-slate-50/50 dark:bg-slate-950/50">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
            className="flex gap-4"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chatState === 'idle' ? "Ask JARVIS anything about your knowledge base..." : "JARVIS is thinking..."}
              disabled={chatState !== 'idle'}
              className="flex-grow bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/40 outline-none rounded-2xl px-6 py-4 text-sm text-[var(--text-primary)] disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || chatState !== 'idle'}
              className="w-14 bg-gradient-to-tr from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 shadow-neon-cyan flex items-center justify-center rounded-2xl text-white disabled:opacity-50 transition-all duration-200"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>

      {/* Right Column: AI status monitor (JARVIS 3D Orb visualizer side pane) */}
      <div className="hidden xl:flex flex-col gap-6 justify-between h-[calc(100vh-160px)]">
        
        {/* Visualizer Panel */}
        <div className="glass-panel border rounded-3xl p-6 shadow-glass flex-grow flex flex-col justify-between overflow-hidden relative">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Orb Status Link</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Real-time LLM inference diagnostics</p>
          </div>

          <div className="w-full h-64 my-6 flex-grow flex items-center justify-center relative overflow-hidden">
            {/* Pulsing neon rings that indicate system status */}
            <div className={`w-36 h-36 rounded-full border border-dashed transition-all duration-1000 flex items-center justify-center relative
              ${chatState === 'searching' ? 'border-cyan-400 animate-spin scale-110' : ''}
              ${chatState === 'thinking' ? 'border-violet-500 animate-pulse' : ''}
              ${chatState === 'responding' ? 'border-emerald-400 animate-bounce' : ''}
              ${chatState === 'error' ? 'border-rose-500 animate-ping' : ''}
              ${chatState === 'idle' ? 'border-cyan-500/30 animate-pulse' : ''}
            `}>
              <div className={`absolute inset-3 rounded-full border border-double transition-all duration-700
                ${chatState === 'searching' ? 'border-cyan-400/50' : ''}
                ${chatState === 'thinking' ? 'border-violet-500/50' : ''}
                ${chatState === 'responding' ? 'border-emerald-400/50' : ''}
                ${chatState === 'error' ? 'border-rose-500/50' : ''}
                ${chatState === 'idle' ? 'border-cyan-500/10' : ''}
              `} />
              
              <div className="w-24 h-24 bg-slate-200/50 dark:bg-slate-950/80 backdrop-blur-md rounded-full flex flex-col items-center justify-center text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] border border-slate-350 dark:border-slate-800 shadow-neon-cyan">
                <span className="text-slate-500 uppercase text-[8px] mb-1">Inference</span>
                <span className={`uppercase font-mono ${
                  chatState === 'idle' ? 'text-cyan-600 dark:text-cyan-400' :
                  chatState === 'error' ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-400 animate-pulse'
                }`}>{chatState}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 bg-slate-100/50 dark:bg-slate-900/60 p-4 border border-slate-200/50 dark:border-slate-800 rounded-2xl text-[10px] text-[var(--text-secondary)] transition-colors">
            <div className="flex justify-between">
              <span>ACTIVE PROVIDER:</span>
              <span className="font-semibold text-[var(--text-primary)] uppercase">{activeProvider}</span>
            </div>
            <div className="flex justify-between">
              <span>ACTIVE MODEL:</span>
              <span className="font-semibold text-[var(--text-primary)]">{activeModel}</span>
            </div>
            <div className="flex justify-between">
              <span>PIPELINE ENGINE:</span>
              <span className="font-semibold text-[var(--text-primary)]">LlamaIndex VectorStore</span>
            </div>
            <div className="flex justify-between">
              <span>SYSTEM STATE:</span>
              <span className={`font-semibold uppercase ${
                chatState === 'idle' ? 'text-cyan-500 dark:text-cyan-400' :
                chatState === 'error' ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-400 animate-pulse'
              }`}>{chatState}</span>
            </div>
          </div>
        </div>

        {/* Quick Diagnostics guide */}
        <div className="glass-panel border rounded-3xl p-5 shadow-glass flex items-start gap-4">
          <HelpCircle className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-xs font-semibold text-slate-200">Retrieval Grounding</h5>
            <p className="text-[10px] text-slate-400 leading-normal">
              If the retrieved similarity score is below the threshold, JARVIS refuses to answer to avoid hallucinations.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
