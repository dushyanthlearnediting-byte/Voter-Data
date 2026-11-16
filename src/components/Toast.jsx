import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 3200) => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, type }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = {
    show,
    success: (m, d) => show(m, 'success', d),
    error: (m, d) => show(m, 'error', d ?? 4000),
    info: (m, d) => show(m, 'info', d),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-3 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const config = {
    success: { icon: CheckCircle2, bar: 'bg-brand-500', ring: 'ring-brand-200', text: 'text-brand-700' },
    error: { icon: AlertTriangle, bar: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700' },
    info: { icon: Info, bar: 'bg-sky-500', ring: 'ring-sky-200', text: 'text-sky-700' },
  }[toast.type] || { icon: Info, bar: 'bg-slate-500', ring: 'ring-slate-200', text: 'text-slate-700' };

  const Icon = config.icon;

  return (
    <div
      className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl bg-white shadow-lg ring-1 ${config.ring} px-4 py-3 w-full`}
      role="status"
    >
      <span className={`mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-50 ${config.text}`}>
        <Icon size={18} />
      </span>
      <p className="flex-1 text-sm font-medium text-slate-800 leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="flex-none rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
