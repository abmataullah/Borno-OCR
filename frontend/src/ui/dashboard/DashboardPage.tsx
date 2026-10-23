import { requestUpgrade } from '../../lib/upgrade';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@state/auth-context';
import { useEditorStore } from '@state/editor-store';
import {
  listAllProjects, createProject, deleteProjectData, deleteAllProjects,
  countAllProjects, renameProjectData, type ProjectMeta,
} from '@engine/project-service';
import { api } from '@api/client';
import {
  FileText, Plus, Search, Trash2, Share2, Clock, Loader2, LogOut,
  HardDrive, Shield, Crown, Sparkles, FolderOpen, HelpCircle, ChevronDown, Upload,
  Pencil, Check, X, MessageCircle,
} from 'lucide-react';

export function DashboardPage() {
  const { user, logout, isEmbed } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const list = await listAllProjects();
      console.log('[dashboard] loaded projects:', list.length);
      setProjects(list);
    } catch (e) {
      console.error('[dashboard] failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleCreate() {
    setCreating(true);
    try {
      const project = await createProject();
      navigate(`/editor/${project.id}`);
    } catch (e) {
      console.error('[dashboard] create failed:', e);
      alert('Failed to create project. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    // Clear editor store if it holds this project
    const editorState = useEditorStore.getState();
    if (editorState.project?.id === id) {
      editorState.setProject(null);
    }
    await deleteProjectData(id);
    await loadProjects();
  }

  async function handleClearAll() {
    if (filtered.length === 0) return;
    if (!confirm(`Delete all ${filtered.length} projects? This cannot be undone.`)) return;
    console.log('[dashboard] clearAll before:', await countAllProjects());
    useEditorStore.setState({ project: null });
    await deleteAllProjects();
    setProjects([]);
    await loadProjects();
    console.log('[dashboard] clearAll after:', await countAllProjects());
  }

  async function handleShare(id: string) {
    try {
      const result = await api.projects.share(id, true);
      if (result.shareToken) {
        const url = `${window.location.origin}/share/${result.shareToken}`;
        navigator.clipboard.writeText(url);
        alert('Share link copied to clipboard!');
      }
    } catch {
      // ignore
    }
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  async function confirmRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    await renameProjectData(id, trimmed);
    setRenamingId(null);
    setRenameValue('');
    await loadProjects();
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  // Note: ProjectMeta doesn't have fileSizeKb, use 0 for display
  const storageUsed = user?.storageUsedMb ?? 0;
  const storageQuota = user?.storageQuotaMb ?? 100;
  const storagePct = Math.min((storageUsed / storageQuota) * 100, 100);

  return (
    <div className="min-h-screen bg-app-bg text-text-primary relative">
      {/* Background ambient gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-app-bg/70 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gold blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
              <FileText className="h-6 w-6 text-gold relative" />
            </div>
            <span className="text-lg font-bold text-shimmer">BornoOCR</span>
          </Link>

          <div className="flex items-center gap-2">
            {user?.isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-8 bg-gold/10 border border-gold/30 text-sm text-gold hover:bg-gold/20 transition-all"
              >
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
            {isEmbed ? (
              <button
                type="button"
                onClick={() => requestUpgrade()}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-8 text-sm text-text-secondary hover:text-gold hover:bg-white/5 transition-all"
              >
                <Crown className="h-4 w-4" /> Upgrade
              </button>
            ) : (
              <Link
                to="/pricing"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-8 text-sm text-text-secondary hover:text-gold hover:bg-white/5 transition-all"
              >
                <Crown className="h-4 w-4" /> Upgrade
              </Link>
            )}
            <Link
              to="/help"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-8 text-sm text-text-secondary hover:text-gold hover:bg-white/5 transition-all"
            >
              <HelpCircle className="h-4 w-4" /> Help
            </Link>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-8 hover:bg-white/5 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center text-xs font-bold text-text-on-gold">
                  {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase()}
                </div>
                <ChevronDown className="h-3 w-3 text-text-tertiary" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-64 rounded-12 glass shadow-2xl overflow-hidden"
                  >
                    <div className="p-3 border-b border-white/[0.06]">
                      <div className="text-sm font-semibold text-text-primary truncate">
                        {user?.name ?? 'User'}
                      </div>
                      <div className="text-xs text-text-tertiary truncate">{user?.email}</div>
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-[10px] font-bold text-gold uppercase">
                        {user?.plan ?? 'Free'} Plan
                      </div>
                    </div>
                    <div className="p-1">
                      {isEmbed ? (
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); requestUpgrade(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-8 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition text-left"
                        >
                          <Crown className="h-4 w-4" /> Upgrade Plan
                        </button>
                      ) : (
                        <Link to="/pricing" className="flex items-center gap-2 px-3 py-2 rounded-8 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition">
                          <Crown className="h-4 w-4" /> Upgrade Plan
                        </Link>
                      )}
                      <Link to="/help" className="flex items-center gap-2 px-3 py-2 rounded-8 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition">
                        <HelpCircle className="h-4 w-4" /> Help & Tutorials
                      </Link>
                      <Link to="/support" className="flex items-center gap-2 px-3 py-2 rounded-8 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition">
                        <MessageCircle className="h-4 w-4" /> Contact Support
                      </Link>
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-8 text-sm text-status-danger hover:bg-status-danger/10 transition"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold mb-1">
            Welcome back, <span className="text-gradient-gold">{user?.name?.split(' ')[0] ?? 'there'}</span>
          </h1>
          <p className="text-text-secondary">Pick up where you left off or start something new.</p>
        </motion.div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={FolderOpen}
            label="Projects"
            value={String(projects.length)}
            sub={`${filtered.length} shown`}
            delay={0}
          />
          <StatCard
            icon={HardDrive}
            label="Storage"
            value={`${storageUsed} MB`}
            sub={`of ${storageQuota} MB used`}
            progress={storagePct}
            delay={0.05}
          />
          <StatCard
            icon={Crown}
            label="Plan"
            value={String(user?.plan ?? 'free').toUpperCase()}
            sub="Click to upgrade"
            onClick={isEmbed ? () => requestUpgrade() : undefined}
            to={isEmbed ? undefined : "/pricing"}
            delay={0.1}
          />
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-10 py-3 bg-app-panel/60 backdrop-blur-xl border border-white/[0.08] rounded-12 text-text-primary placeholder-text-tertiary focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] transition-all"
            />
            {search.trim() && projects.length > 0 && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold animate-spin" />
            )}
          </div>
          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-2 px-4 py-3 rounded-12 bg-app-panel/60 backdrop-blur-xl border border-white/[0.08] text-sm font-medium text-text-primary hover:border-gold/30 hover:bg-gold/5 transition-all shrink-0"
          >
            <Upload className="h-4 w-4 text-gold" />
            Import PDF
          </button>
          <button onClick={handleCreate} disabled={creating} className="btn-gold-3d shrink-0 disabled:opacity-50">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New Project
          </button>
          {filtered.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-3 rounded-12 border border-status-danger/30 text-sm font-medium text-status-danger hover:bg-status-danger/10 transition-all shrink-0"
            >
              <Trash2 className="h-4 w-4" /> Clear All
            </button>
          )}
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 text-gold animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={handleCreate} hasSearch={!!search} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                onClick={() => navigate(`/editor/${project.id}`)}
                className="group relative bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 p-5 hover:border-gold/30 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(212,175,55,0.3)] transition-all duration-300 cursor-pointer"
              >
                {/* Document thumbnail */}
                <div className="mb-4 aspect-[4/3] rounded-12 bg-gradient-to-br from-app-elevated to-app-canvas border border-white/[0.05] flex items-center justify-center relative overflow-hidden">
                  <FileText className="h-10 w-10 text-gold/40 group-hover:text-gold/70 group-hover:scale-110 transition-all duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-app-bg/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <h3 className="font-semibold text-text-primary text-sm mb-1 truncate">
                  {renamingId === project.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename(project.id);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        className="w-full bg-app-elevated border border-gold/40 rounded-4 px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-gold"
                      />
                      <button onClick={() => confirmRename(project.id)} className="p-1 text-status-success hover:bg-app-hover rounded" title="Confirm">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelRename} className="p-1 text-text-tertiary hover:bg-app-hover rounded" title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    project.name
                  )}
                </h3>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-text-tertiary">
                    <span>{project.pageCount} pages</span>
                  </div>
                  <div className="flex items-center gap-1 text-text-tertiary">
                    <Clock className="h-3 w-3" />
                    {formatRelative(project.updatedAt)}
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(project.id, project.name); }}
                    className="p-1.5 rounded-8 bg-app-bg/70 backdrop-blur border border-white/10 text-text-secondary hover:text-gold hover:border-gold/30 transition"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleShare(project.id); }}
                    className="p-1.5 rounded-8 bg-app-bg/70 backdrop-blur border border-white/10 text-text-secondary hover:text-gold hover:border-gold/30 transition"
                    title="Share"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                    className="p-1.5 rounded-8 bg-app-bg/70 backdrop-blur border border-white/10 text-text-secondary hover:text-status-danger hover:border-status-danger/30 transition"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, progress, to, onClick, delay = 0,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sub: string;
  progress?: number;
  to?: string;
  onClick?: () => void;
  delay?: number;
}) {
  const cardCls = "block bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 p-5 hover:border-gold/30 transition-all hover:-translate-y-0.5 group";
  const inner = (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-text-tertiary">
          <Icon className="h-4 w-4 text-gold" />
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary mb-1">{value}</p>
      <p className="text-xs text-text-tertiary">{sub}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold to-yellow-300 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className={cardCls}>{inner}</button>
      ) : to ? (
        <Link to={to} className={cardCls}>{inner}</Link>
      ) : (
        <div className={cardCls}>{inner}</div>
      )}
    </motion.div>
  );
}

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gold/20 blur-2xl rounded-full" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gold/30 to-gold/5 border border-gold/30 flex items-center justify-center">
          {hasSearch ? (
            <Search className="h-8 w-8 text-gold" />
          ) : (
            <Sparkles className="h-8 w-8 text-gold" />
          )}
        </div>
      </div>
      <h3 className="text-xl font-bold mb-2">
        {hasSearch ? 'No matching projects' : 'Start your first project'}
      </h3>
      <p className="text-text-secondary max-w-md mb-6">
        {hasSearch
          ? 'Try a different search term or clear your search to see all projects.'
          : 'Upload a PDF, edit text & tables, then export back. All your work stays synced across devices.'}
      </p>
      {!hasSearch && (
        <button onClick={onCreate} className="btn-gold-3d">
          <Plus className="h-4 w-4" />
          Create new project
        </button>
      )}
    </motion.div>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h`;
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString();
}
