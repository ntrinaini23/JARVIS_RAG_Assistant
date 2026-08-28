import { useEffect, useState } from 'react';
import { FileText, Layers, MessageSquare, Terminal, RefreshCw, AlertCircle } from 'lucide-react';

interface Stats {
  total_documents: number;
  total_chunks: number;
  total_questions: number;
  ollama_status: string;
  active_model: string;
}

interface ActivityLog {
  id: number;
  message: string;
  activity_type: string;
  timestamp: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    total_documents: 0,
    total_chunks: 0,
    total_questions: 0,
    ollama_status: 'Offline',
    active_model: 'None'
  });
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsRes = await fetch('http://127.0.0.1:8000/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch activity logs
      const actRes = await fetch('http://127.0.0.1:8000/api/activity?limit=5');
      const actData = await actRes.json();
      setActivities(actData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 p-1 relative min-h-screen">
      {/* Glow backgrounds */}
      <div className="glow-backdrop-cyan top-10 left-10" />
      <div className="glow-backdrop-violet bottom-10 right-10" />

      {/* Header section */}
      <div className="flex justify-between items-center relative z-10">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Good Afternoon 👋
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Welcome back to your workspace. JARVIS Knowledge system is operational.
          </p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl glass-panel border border-slate-200/40 hover:border-cyan-400 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Workspace
        </button>
      </div>

      {/* Stats Counter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {/* Document Stats Card */}
        <div className="glass-panel p-6 rounded-2xl border flex items-center justify-between shadow-glass glass-card-hover">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Documents Indexed</p>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{stats.total_documents}</h3>
            <p className="text-[10px] text-cyan-400 font-semibold">Active knowledge files</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Chunks Card */}
        <div className="glass-panel p-6 rounded-2xl border flex items-center justify-between shadow-glass glass-card-hover">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Knowledge Chunks</p>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{stats.total_chunks}</h3>
            <p className="text-[10px] text-violet-400 font-semibold">Indexed text fragments</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Queries Card */}
        <div className="glass-panel p-6 rounded-2xl border flex items-center justify-between shadow-glass glass-card-hover">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Questions Answered</p>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{stats.total_questions}</h3>
            <p className="text-[10px] text-emerald-400 font-semibold">Grounded AI responses</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Model Status Card */}
        <div className="glass-panel p-6 rounded-2xl border flex items-center justify-between shadow-glass glass-card-hover">
          <div className="space-y-1 w-[70%]">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">AI Model Status</p>
            <h3 className={`text-lg font-bold truncate ${stats.ollama_status === 'Online' ? 'text-slate-800 dark:text-slate-100' : 'text-rose-500'}`}>
              {stats.ollama_status === 'Online' ? stats.active_model : 'Offline'}
            </h3>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${stats.ollama_status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[10px] font-semibold text-slate-400">Ollama {stats.ollama_status}</span>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
            stats.ollama_status === 'Online' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
          }`}>
            <Terminal className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Layout (Activity Feed) */}
      <div className="relative z-10">
        
        {/* Recent Activity Log Feed */}
        <div className="glass-panel rounded-3xl p-6 border shadow-glass flex flex-col justify-between min-h-[400px]">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-6">Recent System Activity</h4>
            
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex gap-3 items-start animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-slate-700 mt-2" />
                    <div className="space-y-1.5 flex-grow">
                      <div className="h-3.5 bg-slate-800 rounded-md w-[80%]" />
                      <div className="h-2 bg-slate-900 rounded-md w-[40%]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-48 border border-dashed border-slate-200/20 rounded-2xl p-6">
                <AlertCircle className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No recent activity detected.</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Upload files to populate active logs.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((log) => {
                  const dotColors = {
                    SUCCESS: 'bg-emerald-500 shadow-emerald-500/50',
                    ERROR: 'bg-rose-500 shadow-rose-500/50',
                    WARNING: 'bg-amber-500 shadow-amber-500/50',
                    INFO: 'bg-cyan-500 shadow-cyan-500/50'
                  }[log.activity_type] || 'bg-slate-400';

                  return (
                    <div key={log.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-200/5 transition-colors border border-transparent hover:border-slate-200/10">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-lg ${dotColors}`} />
                      <div className="space-y-0.5">
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal">{log.message}</p>
                        <span className="text-[9px] text-slate-400 font-semibold">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="border-t border-slate-200/20 pt-4 flex justify-between items-center text-[10px] text-slate-500">
            <span>Tracking active pipeline operations</span>
          </div>
        </div>

      </div>
    </div>
  );
}
