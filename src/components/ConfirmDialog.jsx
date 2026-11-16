import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmStyle = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClasses = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  }[confirmStyle];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl animate-slide-up overflow-hidden">
        <div className="flex items-start gap-4 p-5">
          <span className="flex-none inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={22} />
          </span>
          <div className="pt-0.5">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {message && <p className="mt-1 text-sm text-slate-600 leading-relaxed">{message}</p>}
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
