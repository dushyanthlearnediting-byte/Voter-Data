import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
      <Loader2 className="animate-spin text-brand-600" size={32} />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
