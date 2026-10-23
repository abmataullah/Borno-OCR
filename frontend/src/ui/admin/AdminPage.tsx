import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@state/auth-context';
import {
  api, type AdminUser, type AdminProject, type Payment,
  type AppSettingsData, type AdminSupportTicket, type SupportTicket, type TicketMessage,
} from '@api/client';
import {
  FileText, Users, DollarSign, TrendingUp, Loader2, Shield, Plus, Trash2, Crown,
  HardDrive, ArrowLeft, Search, Mail, Info, Download, Settings as SettingsIcon,
  MessageSquare, Send, Eye, EyeOff, Check as CheckIcon,
} from 'lucide-react';

type Tab = 'stats' | 'users' | 'projects' | 'payments' | 'settings' | 'support';

interface AdminStats {
  users: number;
  projects: number;
  payments: number;
  revenue: number;
  planDistribution: Record<string, number>;
}

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('stats');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [settings, setSettings] = useState<AppSettingsData | null>(null);
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);

  const loadData = useCallback(async (which: Tab) => {
    setLoading(true);
    try {
      if (which === 'stats') setStats(await api.admin.stats());
      else if (which === 'users') setUsers(await api.admin.listUsers());
      else if (which === 'projects') setProjects(await api.admin.listProjects());
      else if (which === 'payments') setPayments(await api.admin.listPayments());
      else if (which === 'settings') setSettings(await api.admin.getSettings());
      else if (which === 'support') setTickets(await api.admin.listTickets());
    } catch {/* ignore */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(tab); }, [tab, loadData]);

  // If user isn't admin, show access denied
  if (user && !user.isAdmin) {
    return <AdminAccessDenied />;
  }

  return (
    <div className="min-h-screen bg-app-bg text-text-primary relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gold/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-app-bg/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-gold" />
            <span className="font-bold text-shimmer">BornoOCR</span>
            <span className="ml-2 text-[10px] bg-gold text-text-on-gold px-2 py-0.5 rounded-full font-bold tracking-wider">
              ADMIN
            </span>
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-12 bg-gold/15 border border-gold/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-text-tertiary">
                Manage customers, projects, payments & system data.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-12 bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] w-fit">
          {(['stats', 'users', 'projects', 'payments', 'settings', 'support'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-8 text-sm font-medium capitalize transition-all ${
                tab === t
                  ? 'bg-gold text-text-on-gold shadow-gold-glow'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 text-gold animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'stats' && <StatsTab stats={stats} />}
            {tab === 'users' && (
              <UsersTab
                users={users}
                search={userSearch}
                onSearch={setUserSearch}
                onUpdatePlan={async (id, plan) => { await api.admin.updatePlan(id, plan); loadData('users'); }}
                onSetAdmin={async (id, val) => { await api.admin.setAdmin(id, val); loadData('users'); }}
                onDeleteUser={async (id) => {
                  if (!confirm('Delete this user and all their data?')) return;
                  await api.admin.deleteUser(id); loadData('users');
                }}
                onAddPayment={() => setShowPaymentModal(true)}
              />
            )}
            {tab === 'projects' && <ProjectsTab projects={projects} />}
            {tab === 'payments' && <PaymentsTab payments={payments} />}
            {tab === 'settings' && settings && (
              <SettingsTab
                settings={settings}
                onSave={async (patch) => { setSettings(await api.admin.updateSettings(patch)); }}
              />
            )}
            {tab === 'support' && (
              <SupportTab tickets={tickets} onRefresh={() => loadData('support')} />
            )}
          </>
        )}
      </main>

      {showPaymentModal && (
        <ManualPaymentModal
          users={users}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { setShowPaymentModal(false); loadData('users'); }}
        />
      )}
    </div>
  );
}

function AdminAccessDenied() {
  return (
    <div className="min-h-screen bg-app-bg text-text-primary flex items-center justify-center p-6">
      <div className="max-w-md w-full glass rounded-24 p-8 text-center">
        <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-status-danger/15 border border-status-danger/30 mb-4">
          <Shield className="h-8 w-8 text-status-danger" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
        <p className="text-text-secondary mb-6">
          You are signed in, but your account does not have admin privileges.
          Contact a system admin to upgrade your account.
        </p>
        <Link to="/dashboard" className="btn-glass">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function StatsTab({ stats }: { stats: AdminStats | null }) {
  if (!stats) return null;
  return (
    <div>
      {/* Info banner */}
      <div className="glass rounded-12 p-4 mb-6 flex items-start gap-3">
        <Info className="h-5 w-5 text-gold mt-0.5 shrink-0" />
        <div className="text-sm">
          <span className="font-semibold text-text-primary">Customer data is available below.</span>
          <span className="text-text-tertiary"> Use the "Users" tab to view all customers, "Projects" to see their files, and "Payments" to track revenue.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <BigStatCard icon={Users} label="Total Users" value={stats.users} accent="from-blue-500/20" />
        <BigStatCard icon={FileText} label="Total Projects" value={stats.projects} accent="from-purple-500/20" />
        <BigStatCard icon={DollarSign} label="Payments" value={stats.payments} accent="from-green-500/20" />
        <BigStatCard icon={TrendingUp} label="Revenue" value={`৳${(stats.revenue / 100).toFixed(2)}`} accent="from-gold/30" />
      </div>

      <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gold" />
          Plan Distribution
        </h3>
        <div className="space-y-3">
          {Object.entries(stats.planDistribution).map(([plan, count]) => {
            const pct = stats.users > 0 ? (count / stats.users) * 100 : 0;
            return (
              <div key={plan} className="flex items-center gap-3">
                <span className="w-20 text-sm capitalize font-medium">{plan}</span>
                <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-gold to-yellow-300"
                  />
                </div>
                <span className="text-sm text-text-secondary w-16 text-right">
                  {count} <span className="text-xs text-text-tertiary">({pct.toFixed(0)}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BigStatCard({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: string | number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 p-5 hover:border-gold/30 hover:-translate-y-0.5 transition-all overflow-hidden group`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-16 pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center gap-2 text-text-tertiary mb-2">
          <Icon className="h-4 w-4 text-gold" />
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-3xl font-extrabold">{value}</p>
      </div>
    </motion.div>
  );
}

function UsersTab({
  users, search, onSearch, onUpdatePlan, onSetAdmin, onDeleteUser, onAddPayment,
}: {
  users: AdminUser[];
  search: string;
  onSearch: (s: string) => void;
  onUpdatePlan: (userId: string, planId: string) => void;
  onSetAdmin: (userId: string, isAdmin: boolean) => void;
  onDeleteUser: (userId: string) => void;
  onAddPayment: () => void;
}) {
  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  function exportCsv() {
    const header = ['Email', 'Name', 'Plan', 'Storage Used (MB)', 'Storage Quota (MB)', 'Is Admin', 'Joined At'];
    const rows = filtered.map((u) => [
      u.email,
      u.name ?? '',
      u.plan,
      String(u.storageUsedMb),
      String(u.storageQuotaMb),
      u.isAdmin ? 'yes' : 'no',
      new Date(u.createdAt).toISOString(),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bornoocr-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-3 py-2.5 bg-app-panel/60 backdrop-blur-xl border border-white/[0.08] rounded-12 text-sm focus:border-gold focus:outline-none"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-text-secondary border border-white/[0.08] rounded-12 hover:bg-white/5 hover:text-text-primary transition disabled:opacity-50 shrink-0"
          title="Export customer emails & data for marketing/retargeting"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
        <button onClick={onAddPayment} className="btn-gold-3d shrink-0">
          <Plus className="h-4 w-4" /> Add Manual Payment
        </button>
      </div>

      <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/[0.06]">
              <tr className="text-text-tertiary text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-semibold">User</th>
                <th className="text-left px-5 py-3 font-semibold">Plan</th>
                <th className="text-left px-5 py-3 font-semibold">Storage</th>
                <th className="text-left px-5 py-3 font-semibold">Joined</th>
                <th className="text-center px-5 py-3 font-semibold">Admin</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center text-sm font-bold text-text-on-gold flex-shrink-0">
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name ?? 'Unnamed'}</div>
                        <div className="text-text-tertiary text-xs truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.plan}
                      onChange={(e) => onUpdatePlan(u.id, e.target.value)}
                      className="bg-app-elevated/60 border border-white/[0.08] rounded-8 text-xs px-2 py-1 focus:border-gold focus:outline-none"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-3.5 w-3.5 text-text-tertiary" />
                      <div>
                        <div className="text-xs">{u.storageUsedMb} / {u.storageQuotaMb} MB</div>
                        <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-gold"
                            style={{ width: `${Math.min((u.storageUsedMb / u.storageQuotaMb) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-text-tertiary text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => onSetAdmin(u.id, !u.isAdmin)}
                      className={`p-1.5 rounded-8 transition ${
                        u.isAdmin
                          ? 'text-gold bg-gold/10 hover:bg-gold/20'
                          : 'text-text-tertiary hover:text-text-primary hover:bg-white/5'
                      }`}
                      title={u.isAdmin ? 'Remove admin' : 'Make admin'}
                    >
                      <Crown className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => onDeleteUser(u.id)}
                      className="p-1.5 rounded-8 text-text-tertiary hover:text-status-danger hover:bg-status-danger/10 transition"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-text-tertiary">
                    No users found{search && ` matching "${search}"`}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProjectsTab({ projects }: { projects: AdminProject[] }) {
  return (
    <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] border-b border-white/[0.06]">
            <tr className="text-text-tertiary text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-semibold">Project</th>
              <th className="text-left px-5 py-3 font-semibold">User ID</th>
              <th className="text-left px-5 py-3 font-semibold">Pages</th>
              <th className="text-left px-5 py-3 font-semibold">Size</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
              <th className="text-left px-5 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3">
                  <div className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gold flex-shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-text-tertiary text-xs font-mono">{p.userId.slice(0, 8)}…</td>
                <td className="px-5 py-3">{p.pageCount}</td>
                <td className="px-5 py-3 text-text-tertiary">{(p.fileSizeKb / 1024).toFixed(2)} MB</td>
                <td className="px-5 py-3">
                  {p.isShared ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/30">Shared</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-text-tertiary">Private</span>
                  )}
                </td>
                <td className="px-5 py-3 text-text-tertiary text-xs">{new Date(p.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsTab({ payments }: { payments: Payment[] }) {
  return (
    <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] border-b border-white/[0.06]">
            <tr className="text-text-tertiary text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-semibold">Payment</th>
              <th className="text-left px-5 py-3 font-semibold">User</th>
              <th className="text-left px-5 py-3 font-semibold">Amount</th>
              <th className="text-left px-5 py-3 font-semibold">Provider</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
              <th className="text-left px-5 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-text-tertiary">{p.id.slice(0, 12)}…</td>
                <td className="px-5 py-3 font-mono text-xs text-text-tertiary">{p.userId.slice(0, 12)}…</td>
                <td className="px-5 py-3 font-semibold">
                  {(p.amount / 100).toFixed(2)} <span className="text-xs text-text-tertiary">{p.currency}</span>
                </td>
                <td className="px-5 py-3 text-text-secondary capitalize">{p.provider}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-5 py-3 text-text-tertiary text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-status-success/10 text-status-success border-status-success/30',
    completed: 'bg-status-success/10 text-status-success border-status-success/30',
    failed: 'bg-status-danger/10 text-status-danger border-status-danger/30',
    pending: 'bg-status-warning/10 text-status-warning border-status-warning/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-white/5 text-text-tertiary border-white/10'}`}>
      {status}
    </span>
  );
}

function ManualPaymentModal({
  users, onClose, onSuccess,
}: { users: AdminUser[]; onClose: () => void; onSuccess: () => void }) {
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [planId, setPlanId] = useState('pro');
  const [amount, setAmount] = useState(900);
  const [provider, setProvider] = useState('manual');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.admin.addManualPayment({ userId, planId, amount, provider, note });
      onSuccess();
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-24 p-6 w-full max-w-md shadow-2xl"
      >
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-gold" />
          Add Manual Payment
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          Manually assign a plan to a customer. Useful for bKash/cash payments outside the platform.
        </p>

        <div className="space-y-3">
          <Field label="Customer">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.email} ({u.name ?? 'Unnamed'})</option>
              ))}
            </select>
          </Field>

          <Field label="Plan">
            <select
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                if (e.target.value === 'pro') setAmount(900);
                if (e.target.value === 'business') setAmount(2900);
                if (e.target.value === 'free') setAmount(0);
              }}
              className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            >
              <option value="free">Free</option>
              <option value="pro">Pro (৳900)</option>
              <option value="business">Business (৳2900)</option>
            </select>
          </Field>

          <Field label="Amount (BDT)">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </Field>

          <Field label="Payment Method">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            >
              <option value="manual">Manual / Cash</option>
              <option value="bkash">bKash</option>
              <option value="sslcommerz">SSL Commerz</option>
              <option value="stripe">Stripe</option>
            </select>
          </Field>

          <Field label="Note (optional)">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid via bKash on Jun 23"
              className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </Field>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-12 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/5 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || !userId} className="btn-gold-3d flex-1 justify-center disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Payment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingsTab({
  settings, onSave,
}: { settings: AppSettingsData; onSave: (patch: Partial<AppSettingsData>) => Promise<void> }) {
  const [draft, setDraft] = useState<AppSettingsData>(settings);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  async function saveGateway(provider: 'stripe' | 'bkash' | 'sslcommerz') {
    setSaving(provider);
    try {
      await onSave({ gateways: { [provider]: draft.gateways[provider] } as AppSettingsData['gateways'] });
      setSaved(provider);
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setSaving(null);
    }
  }

  async function savePlans() {
    setSaving('plans');
    try {
      await onSave({ planOverrides: draft.planOverrides });
      setSaved('plans');
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setSaving(null);
    }
  }

  function updateGateway(provider: 'stripe' | 'bkash' | 'sslcommerz', field: string, value: string | boolean) {
    setDraft((d) => ({
      ...d,
      gateways: { ...d.gateways, [provider]: { ...d.gateways[provider], [field]: value } },
    }));
  }

  function updatePlanOverride(planId: string, field: 'priceUsd' | 'priceBdt', value: number) {
    setDraft((d) => ({
      ...d,
      planOverrides: {
        ...d.planOverrides,
        [planId]: { ...d.planOverrides[planId], [field]: value },
      },
    }));
  }

  const inputType = showSecrets ? 'text' : 'password';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="glass rounded-12 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-gold mt-0.5 shrink-0" />
        <div className="text-sm">
          <span className="font-semibold text-text-primary">Payment gateway & plan pricing.</span>
          <span className="text-text-tertiary"> Configure real credentials here to enable live checkout (Stripe / bKash / SSLCommerz). If disabled or empty, the environment variables are used as a fallback, or checkout falls back to a mock URL.</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowSecrets((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition"
        >
          {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showSecrets ? 'Hide secrets' : 'Show secrets'}
        </button>
      </div>

      {/* Stripe */}
      <GatewayCard
        title="Stripe"
        enabled={draft.gateways.stripe.enabled}
        onToggle={(v) => updateGateway('stripe', 'enabled', v)}
        onSave={() => saveGateway('stripe')}
        saving={saving === 'stripe'}
        saved={saved === 'stripe'}
      >
        <Field label="Secret Key">
          <input
            type={inputType}
            value={draft.gateways.stripe.secretKey ?? ''}
            onChange={(e) => updateGateway('stripe', 'secretKey', e.target.value)}
            placeholder="sk_live_..."
            className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
          />
        </Field>
      </GatewayCard>

      {/* bKash */}
      <GatewayCard
        title="bKash"
        enabled={draft.gateways.bkash.enabled}
        onToggle={(v) => updateGateway('bkash', 'enabled', v)}
        onSave={() => saveGateway('bkash')}
        saving={saving === 'bkash'}
        saved={saved === 'bkash'}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="App Key">
            <input type={inputType} value={draft.gateways.bkash.appKey ?? ''} onChange={(e) => updateGateway('bkash', 'appKey', e.target.value)} className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
          <Field label="App Secret">
            <input type={inputType} value={draft.gateways.bkash.appSecret ?? ''} onChange={(e) => updateGateway('bkash', 'appSecret', e.target.value)} className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
          <Field label="Username">
            <input type={inputType} value={draft.gateways.bkash.username ?? ''} onChange={(e) => updateGateway('bkash', 'username', e.target.value)} className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
          <Field label="Password">
            <input type={inputType} value={draft.gateways.bkash.password ?? ''} onChange={(e) => updateGateway('bkash', 'password', e.target.value)} className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
          <Field label="Base URL (sandbox/live)">
            <input type="text" value={draft.gateways.bkash.baseUrl ?? ''} onChange={(e) => updateGateway('bkash', 'baseUrl', e.target.value)} placeholder="https://tokenized.sandbox.bka.sh/v1.2.0-beta" className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
        </div>
      </GatewayCard>

      {/* SSLCommerz */}
      <GatewayCard
        title="SSLCommerz"
        enabled={draft.gateways.sslcommerz.enabled}
        onToggle={(v) => updateGateway('sslcommerz', 'enabled', v)}
        onSave={() => saveGateway('sslcommerz')}
        saving={saving === 'sslcommerz'}
        saved={saved === 'sslcommerz'}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Store ID">
            <input type={inputType} value={draft.gateways.sslcommerz.storeId ?? ''} onChange={(e) => updateGateway('sslcommerz', 'storeId', e.target.value)} className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
          <Field label="Store Password">
            <input type={inputType} value={draft.gateways.sslcommerz.storePasswd ?? ''} onChange={(e) => updateGateway('sslcommerz', 'storePasswd', e.target.value)} className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
          <Field label="Base URL (sandbox/live)">
            <input type="text" value={draft.gateways.sslcommerz.baseUrl ?? ''} onChange={(e) => updateGateway('sslcommerz', 'baseUrl', e.target.value)} placeholder="https://sandbox.sslcommerz.com/gwprocess/v3/api.php" className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </Field>
        </div>
      </GatewayCard>

      {/* Plan price overrides */}
      <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gold" /> Plan Pricing Overrides
          </h3>
          <button onClick={savePlans} disabled={saving === 'plans'} className="btn-gold-3d text-xs px-3 py-1.5 disabled:opacity-50">
            {saving === 'plans' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved === 'plans' ? <CheckIcon className="h-3.5 w-3.5" /> : 'Save Prices'}
          </button>
        </div>
        <div className="space-y-3">
          {(['pro', 'business'] as const).map((planId) => (
            <div key={planId} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-sm font-medium capitalize">{planId}</span>
              <Field label="USD">
                <input
                  type="number"
                  value={draft.planOverrides[planId]?.priceUsd ?? ''}
                  onChange={(e) => updatePlanOverride(planId, 'priceUsd', Number(e.target.value))}
                  className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </Field>
              <Field label="BDT">
                <input
                  type="number"
                  value={draft.planOverrides[planId]?.priceBdt ?? ''}
                  onChange={(e) => updatePlanOverride(planId, 'priceBdt', Number(e.target.value))}
                  className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </Field>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GatewayCard({
  title, enabled, onToggle, onSave, saving, saved, children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-gold" /> {title}
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="accent-gold" />
            Enabled
          </label>
          <button onClick={onSave} disabled={saving} className="btn-gold-3d text-xs px-3 py-1.5 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckIcon className="h-3.5 w-3.5" /> : 'Save'}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function SupportTab({ tickets, onRefresh }: { tickets: AdminSupportTicket[]; onRefresh: () => void }) {
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  return (
    <div>
      <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/[0.06]">
              <tr className="text-text-tertiary text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-semibold">Customer</th>
                <th className="text-left px-5 py-3 font-semibold">Subject</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                <th className="text-left px-5 py-3 font-semibold">Updated</th>
                <th className="text-right px-5 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="text-xs">
                      <div className="font-medium">{t.userName ?? 'Unnamed'}</div>
                      <div className="text-text-tertiary flex items-center gap-1"><Mail className="h-3 w-3" />{t.userEmail}</div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{t.subject}</td>
                  <td className="px-5 py-3">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className="px-5 py-3 text-text-tertiary text-xs">{new Date(t.updatedAt).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setActiveTicketId(t.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gold hover:bg-gold/10 rounded-8 ml-auto"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Open
                    </button>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-text-tertiary">
                    No support tickets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeTicketId && (
        <AdminTicketModal
          ticketId={activeTicketId}
          onClose={() => setActiveTicketId(null)}
          onChanged={onRefresh}
        />
      )}
    </div>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    pending: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    closed: 'bg-status-success/10 text-status-success border-status-success/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-white/5 text-text-tertiary border-white/10'}`}>
      {status}
    </span>
  );
}

function AdminTicketModal({
  ticketId, onClose, onChanged,
}: { ticketId: string; onClose: () => void; onChanged: () => void }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.getTicket(ticketId);
      setTicket(data.ticket);
      setMessages(data.messages);
    } catch {/* ignore */}
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.admin.replyToTicket(ticketId, reply.trim());
      setReply('');
      await load();
      onChanged();
    } catch {/* ignore */}
    finally { setSending(false); }
  }

  async function handleStatusChange(status: 'open' | 'pending' | 'closed') {
    await api.admin.updateTicketStatus(ticketId, status);
    await load();
    onChanged();
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-24 p-6 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col"
      >
        {loading || !ticket ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-gold animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">{ticket.subject}</h2>
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value as 'open' | 'pending' | 'closed')}
                className="bg-app-elevated/60 border border-white/[0.08] rounded-8 text-xs px-2 py-1 focus:border-gold focus:outline-none"
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-12 px-3 py-2 text-sm ${
                    m.senderRole === 'admin' ? 'bg-gold/15 border border-gold/30 ml-auto' : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                    {m.senderRole === 'admin' ? 'You (Admin)' : 'Customer'}
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                placeholder="Type a reply..."
                className="flex-1 bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
              <button onClick={handleSend} disabled={sending || !reply.trim()} className="btn-gold-3d px-3 disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
