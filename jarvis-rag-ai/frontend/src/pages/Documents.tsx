import { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  FileCheck,
  RefreshCw 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DocumentFile {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  status: 'Uploaded' | 'Processing' | 'Indexed' | 'Failed';
  chunk_count: number;
  upload_time: string;
}

export default function Documents() {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'files' | 'websites' | 'database'>('files');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [webIngesting, setWebIngesting] = useState(false);
  const [dbName, setDbName] = useState('HR Policy Database');
  const [tableName, setTableName] = useState('employee_records');
  const [dbTextContent, setDbTextContent] = useState('');
  const [dbIngesting, setDbIngesting] = useState(false);

  const dbPresets: { [key: string]: { tableName: string, content: string } } = {
    'HR Policy Database': {
      tableName: 'employee_records',
      content: `[Employee Database Records]\nRecord #1:\nName: Alex Smith\nRole: Senior Engineer\nOffice: Seattle\nAnnual Paid Leaves Allocation: 28 days\n\nRecord #2:\nName: Sarah Connor\nRole: Tech Lead\nOffice: Boston\nAnnual Paid Leaves Allocation: 32 days\nMaternity/Paternity Leave policy: 90 paid calendar days\nMedical Reimbursement: Up to $6000 annually with bills`
    },
    'Product Catalog Database': {
      tableName: 'inventory',
      content: `[Product Catalog Inventory]\nItem ID: PRD-9092\nName: Jarvis Core Controller V2\nCategory: Electronics\nUnit Price: $499.00\nIn Stock Quantity: 42 units\nSupplier: Stark Tech Industries\n\nItem ID: PRD-1029\nName: Mini ARC Fusion Cell\nCategory: Power Sources\nUnit Price: $8999.00\nIn Stock Quantity: 5 units\nSupplier: Stark Tech Industries`
    }
  };

  // Populate initial DB preset
  useEffect(() => {
    if (!dbTextContent) {
      setDbTextContent(dbPresets['HR Policy Database'].content);
    }
  }, []);

  const handleDbPresetChange = (name: string) => {
    setDbName(name);
    if (dbPresets[name]) {
      setTableName(dbPresets[name].tableName);
      setDbTextContent(dbPresets[name].content);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Poll documents list every 5 seconds to track background indexing status changes
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'txt', 'docx'].includes(ext)) {
      setErrorMsg(`Unsupported file type: .${ext}. Only PDF, TXT, and DOCX are allowed.`);
      return false;
    }
    // Limit to 15MB files
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg(`File too large: ${file.name}. Max size is 15MB.`);
      return false;
    }
    return true;
  };

  const uploadFile = async (file: File) => {
    setErrorMsg(null);
    const key = file.name;
    setUploadProgress(prev => ({ ...prev, [key]: 10 }));

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate gradual uploading progress in UI
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[key] || 0;
          if (current < 90) return { ...prev, [key]: current + 15 };
          return prev;
        });
      }, 200);

      const res = await fetch('http://127.0.0.1:8000/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(interval);

      if (res.ok) {
        setUploadProgress(prev => ({ ...prev, [key]: 100 }));
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
        fetchDocuments();
        setTimeout(() => {
          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 3000);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Upload failed");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || `Failed to upload file: ${file.name}`);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (validateFile(file)) {
          await uploadFile(file);
        }
      }
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files);
      for (const file of files) {
        if (validateFile(file)) {
          await uploadFile(file);
        }
      }
    }
  };

  const handleWebsiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) return;
    setErrorMsg(null);
    setWebIngesting(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/documents/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl })
      });
      if (res.ok) {
        setWebsiteUrl('');
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
        fetchDocuments();
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "URL ingestion failed");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to fetch website content.");
    } finally {
      setWebIngesting(false);
    }
  };

  const handleDatabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbTextContent.trim()) return;
    setErrorMsg(null);
    setDbIngesting(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/documents/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_name: dbName,
          table_name: tableName,
          text_content: dbTextContent
        })
      });
      if (res.ok) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
        fetchDocuments();
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Database ingestion failed");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to ingest database data.");
    } finally {
      setDbIngesting(false);
    }
  };

  const confirmDelete = async (id: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/documents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDeletingId(null);
        fetchDocuments();
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 p-1 z-10 relative min-h-[calc(100vh-140px)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Document Management</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Add documents to feed your RAG pipeline knowledge base.
          </p>
        </div>
        <button 
          onClick={fetchDocuments}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl glass-panel border hover:border-cyan-400 text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync Files
        </button>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200/10 dark:border-slate-800/60 pb-px text-xs font-semibold">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-6 py-3 border-b-2 transition-all ${
            activeTab === 'files'
              ? 'border-cyan-500 text-cyan-500 dark:text-cyan-400'
              : 'border-transparent text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)]'
          }`}
        >
          File Ingest (PDF, TXT, DOCX)
        </button>
        <button
          onClick={() => setActiveTab('websites')}
          className={`px-6 py-3 border-b-2 transition-all ${
            activeTab === 'websites'
              ? 'border-cyan-500 text-cyan-500 dark:text-cyan-400'
              : 'border-transparent text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)]'
          }`}
        >
          Website Ingest (Web Crawler)
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-6 py-3 border-b-2 transition-all ${
            activeTab === 'database'
              ? 'border-cyan-500 text-cyan-500 dark:text-cyan-400'
              : 'border-transparent text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)]'
          }`}
        >
          Database Ingest (SQL Mockup)
        </button>
      </div>

      {/* Uploader Box & Errors */}
      <div className="space-y-4">
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Contents */}
        {activeTab === 'files' && (
          /* Drag Drop Area */
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`glass-panel border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all duration-200 min-h-[220px] relative
              ${dragActive 
                ? 'border-cyan-400 bg-cyan-500/5' 
                : 'border-slate-300/20 dark:border-slate-850/60 hover:border-cyan-500/20'
              }`}
          >
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileInput}
              className="hidden"
              accept=".pdf,.txt,.docx"
            />

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4 border border-cyan-500/20">
              <Upload className="w-6 h-6 animate-bounce" />
            </div>

            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Drag and drop your documents here
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-6">
              PDF, TXT and DOCX files supported (Max 15MB)
            </p>

            <label
              htmlFor="file-upload"
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-900 hover:border-cyan-500 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-[var(--text-primary)] shadow-glass cursor-pointer transition-all duration-200"
            >
              Browse Files
            </label>
          </div>
        )}

        {activeTab === 'websites' && (
          <form onSubmit={handleWebsiteSubmit} className="glass-panel border border-slate-800/40 rounded-3xl p-8 space-y-4 shadow-glass max-w-xl mx-auto">
            <div className="space-y-1 text-center mb-4">
              <h4 className="text-xs font-semibold text-slate-200">Website Web Crawler Ingest</h4>
              <p className="text-[10px] text-slate-500">Enter a website URL to extract text and build RAG embeddings.</p>
            </div>
            <div className="flex gap-4">
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com/company-handbook"
                className="flex-grow bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs outline-none text-[var(--text-primary)] focus:border-cyan-500/80"
                disabled={webIngesting}
              />
              <button
                type="submit"
                disabled={webIngesting || !websiteUrl.trim()}
                className="px-6 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-xs rounded-xl shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-200"
              >
                {webIngesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting...
                  </>
                ) : (
                  "Crawl URL"
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'database' && (
          <form onSubmit={handleDatabaseSubmit} className="glass-panel border border-slate-800/40 rounded-3xl p-8 space-y-6 shadow-glass max-w-2xl mx-auto">
            <div className="space-y-1 text-center mb-4">
              <h4 className="text-xs font-semibold text-slate-200">Database Table Records Ingest</h4>
              <p className="text-[10px] text-slate-500">Ingest textual data records from database files or connection mockups.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <label className="font-semibold text-slate-350 block">Database Preset Name</label>
                <select
                  value={dbName}
                  onChange={(e) => handleDbPresetChange(e.target.value)}
                  className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80"
                  disabled={dbIngesting}
                >
                  <option value="HR Policy Database">HR Policy Database (SQLite mockup)</option>
                  <option value="Product Catalog Database">Product Catalog Database (MySQL mockup)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-350 block">Table Identifier</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-[var(--text-primary)] focus:border-cyan-500/80"
                  disabled={dbIngesting}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-350 block">Exported Table Rows Text (TXT format)</label>
              <textarea
                value={dbTextContent}
                onChange={(e) => setDbTextContent(e.target.value)}
                rows={6}
                className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 outline-none text-[var(--text-primary)] focus:border-cyan-500/80 font-mono text-[11px]"
                disabled={dbIngesting}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={dbIngesting || !dbTextContent.trim()}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-xs rounded-xl shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-200"
              >
                {dbIngesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting Database...
                  </>
                ) : (
                  "Ingest Table Records"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Active Uploading Progress Monitors */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="glass-panel border rounded-2xl p-4 space-y-3 shadow-glass">
            <h4 className="text-xs font-semibold text-slate-300">Uploading File Queue</h4>
            {Object.entries(uploadProgress).map(([filename, progress]) => (
              <div key={filename} className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                  <span className="truncate max-w-[80%]">{filename}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document table / grids */}
      <div className="glass-panel border rounded-3xl overflow-hidden shadow-glass">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
            <p className="text-xs">Fetching indexing logs...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
            <FileText className="w-12 h-12 text-slate-600" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No documents found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Your knowledge base is empty. Upload text files, PDFs or DOCX files above to start.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800 text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">File Name</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Size</th>
                  <th className="py-4 px-6">Uploaded Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Chunks</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/40 text-[var(--text-secondary)]">
                {documents.map((doc) => {
                  // Badges configurations
                  const statusBadges = {
                    Uploaded: 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400',
                    Processing: 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400 animate-pulse',
                    Indexed: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400',
                    Failed: 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400'
                  }[doc.status] || 'bg-slate-800';

                  return (
                    <tr key={doc.id} className="hover:bg-slate-800/10 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 font-medium text-[var(--text-primary)] flex items-center gap-2 max-w-xs truncate">
                        {doc.status === 'Indexed' ? <FileCheck className="w-4 h-4 text-emerald-400" /> : <FileText className="w-4 h-4 text-slate-400" />}
                        <span className="truncate">{doc.filename}</span>
                      </td>
                      <td className="py-4 px-6 font-semibold">{doc.file_type}</td>
                      <td className="py-4 px-6 text-slate-400">{formatBytes(doc.file_size)}</td>
                      <td className="py-4 px-6 text-slate-400">{new Date(doc.upload_time).toLocaleDateString()}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold tracking-wider ${statusBadges}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-cyan-400 font-semibold">{doc.chunk_count}</td>
                      <td className="py-4 px-6 text-right">
                        {deletingId === doc.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => confirmDelete(doc.id)}
                              className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all font-semibold"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 text-[var(--text-secondary)] rounded-lg transition-all font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(doc.id)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-900 border border-transparent hover:border-slate-250 dark:hover:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 rounded-xl transition-all"
                            title="Delete File & Vectors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
