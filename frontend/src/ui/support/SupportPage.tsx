import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, type SupportTicket, type TicketMessage } from '@api/client';
import {
  ArrowLeft, MessageCircle, Plus, Send, Loader2, Clock, X,
} from 'lucide-react';

export function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await api.tickets.list());
    } catch {/* ignore */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-app-bg text-text-primary">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-app-bg/70 border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-gold" /> Support
            </h1>
            <p className="text-sm text-text-tertiary">Get help from our team — we typically reply within a day.</p>
          </div>
          <button onClick={() => setShowNewModal(true)} className="btn-gold-3d">
            <Plus className="h-4 w-4" /> New Ticket
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-gold animate-spin" />
          </div>
        ) : (
          <div className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 overflow-hidden">
            {tickets.length === 0 ? (
              <div className="px-6 py-16 text-center text-text-tertiary">
                No support tickets yet. Click "New Ticket" if you need help.
              </div>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTicketId(t.id)}
                  className="w-full flex items-center justify-between px-6 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition text-left"
                >
                  <div>
                    <div className="font-medium text-sm">{t.subject}</div>
                    <div className="text-xs text-text-tertiary flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" /> Updated {new Date(t.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </button>
              ))
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {showNewModal && (
          <NewTicketModal
            onClose={() => setShowNewModal(false)}
            onCreated={(ticket) => { setShowNewModal(false); load(); setActiveTicketId(ticket.id); }}
          />
        )}
        {activeTicketId && (
          <TicketThreadModal
            ticketId={activeTicketId}
            onClose={() => { setActiveTicketId(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    pending: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    closed: 'bg-status-success/10 text-status-success border-status-success/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${map[status] ?? 'bg-white/5 text-text-tertiary border-white/10'}`}>
      {status}
    </span>
  );
}

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: SupportTicket) => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await api.tickets.create(subject.trim(), message.trim());
      onCreated(ticket);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-24 p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">New Support Ticket</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-3 text-sm text-status-danger bg-status-danger/10 border border-status-danger/30 rounded-8 px-3 py-2">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 block">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Can't export to DOCX"
              className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Describe your issue in detail..."
              className="w-full bg-app-elevated/60 border border-white/[0.08] rounded-12 px-3 py-2.5 text-sm focus:border-gold focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-12 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/5 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !subject.trim() || !message.trim()}
            className="btn-gold-3d flex-1 justify-center disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TicketThreadModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.tickets.get(ticketId);
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
      await api.tickets.reply(ticketId, reply.trim());
      setReply('');
      await load();
    } catch {/* ignore */}
    finally { setSending(false); }
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
              <div className="flex items-center gap-2">
                <StatusBadge status={ticket.status} />
                <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-12 px-3 py-2 text-sm ${
                    m.senderRole === 'customer' ? 'bg-gold/15 border border-gold/30 ml-auto' : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                    {m.senderRole === 'customer' ? 'You' : 'Support Team'}
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            {ticket.status !== 'closed' ? (
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
            ) : (
              <div className="text-center text-xs text-text-tertiary py-2">This ticket is closed.</div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
