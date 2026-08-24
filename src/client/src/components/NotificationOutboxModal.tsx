import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, X, CheckCircle, AlertCircle, Clock, Eye, Play } from 'lucide-react';
import { NotificationItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationOutboxModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [triggeringWorker, setTriggeringWorker] = useState(false);
  const [workerMessage, setWorkerMessage] = useState<string | null>(null);

  const fetchOutbox = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/outbox');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch outbox:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerWorker = async () => {
    setTriggeringWorker(true);
    setWorkerMessage(null);
    try {
      const res = await fetch('/api/admin/worker/trigger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clinicpulse_token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        setWorkerMessage(`Worker cycle completed: ${data.medicationRemindersSent || 0} medication reminders, ${data.notificationQueueResult?.processed || 0} notifications processed.`);
        fetchOutbox();
      } else {
        setWorkerMessage(`Worker response: ${data.message || data.error}`);
      }
    } catch (err: any) {
      setWorkerMessage(`Trigger failed: ${err.message}`);
    } finally {
      setTriggeringWorker(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOutbox();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-100 text-brand-600 rounded-xl">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Email Notification Outbox & Queue</h2>
              <p className="text-xs text-slate-500">Live delivery status, retry queue, and generated email logs</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerWorker}
              disabled={triggeringWorker}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition disabled:opacity-50"
              title="Execute background jobs for medication reminders and email retries immediately"
            >
              <Play className={`w-3.5 h-3.5 ${triggeringWorker ? 'animate-spin' : ''}`} />
              {triggeringWorker ? 'Running Worker...' : 'Run Worker Cycle'}
            </button>

            <button
              onClick={fetchOutbox}
              disabled={loading}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition"
              title="Refresh outbox"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Worker Alert feedback */}
        {workerMessage && (
          <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-blue-800 text-xs flex items-center justify-between">
            <span>⚡ {workerMessage}</span>
            <button onClick={() => setWorkerMessage(null)} className="text-blue-500 hover:text-blue-700">✕</button>
          </div>
        )}

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading && notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No notifications generated yet. Book an appointment or trigger medication reminders to see logs.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {notifications.map((n) => {
                const isSent = n.status === 'SENT';
                const isRetrying = n.status === 'RETRYING';
                const isFailed = n.status === 'FAILED';

                return (
                  <div
                    key={n.id}
                    className="p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                          isSent ? 'bg-emerald-100 text-emerald-800' :
                          isRetrying ? 'bg-amber-100 text-amber-800' :
                          isFailed ? 'bg-rose-100 text-rose-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {isSent && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                          {isRetrying && <Clock className="w-3 h-3 text-amber-600" />}
                          {isFailed && <AlertCircle className="w-3 h-3 text-rose-600" />}
                          {n.status}
                        </span>

                        <span className="px-2 py-0.5 text-[11px] font-mono bg-slate-100 text-slate-600 rounded">
                          {n.notification_type}
                        </span>

                        <span className="text-xs text-slate-400">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-800 truncate">{n.subject}</h4>
                      <p className="text-xs text-slate-500 truncate">
                        To: <span className="font-medium text-slate-700">{n.recipient_name}</span> ({n.recipient_email})
                        {n.attempts > 1 && ` • Attempts: ${n.attempts}/${n.max_attempts}`}
                      </p>
                      {n.error_message && (
                        <p className="text-xs text-rose-600 font-medium mt-0.5">Error: {n.error_message}</p>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedNotif(n)}
                      className="px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg flex items-center gap-1.5 transition shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Email
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Showing latest {notifications.length} notifications</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Email Body Preview Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">{selectedNotif.notification_type}</span>
                <h3 className="text-base font-bold text-slate-900">{selectedNotif.subject}</h3>
                <p className="text-xs text-slate-500">To: {selectedNotif.recipient_name} &lt;{selectedNotif.recipient_email}&gt;</p>
              </div>
              <button
                onClick={() => setSelectedNotif(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm prose prose-sm max-w-none">
                {selectedNotif.body_html ? (
                  <div dangerouslySetInnerHTML={{ __html: selectedNotif.body_html }} />
                ) : (
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedNotif.body_text}</p>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
