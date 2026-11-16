// Human-readable role + status helpers shared across the app.

export const ROLE_LABELS = {
  admin: 'Admin',
  sub_admin: 'Sub-Admin',
  data_entry: 'Data Entry',
};

export function roleDisplay(user) {
  if (!user) return '';
  const base = ROLE_LABELS[user.role] || user.role;
  if (user.role === 'admin') return base;
  return `${base} – ${user.wardName || `Ward ${user.wardId}`}`;
}

export const STATUS_OPTIONS = [
  { value: 'not_visited', label: 'Not visited', className: 'bg-slate-100 text-slate-700' },
  { value: 'visited', label: 'Visited', className: 'bg-brand-100 text-brand-700' },
  { value: 'follow_up', label: 'Follow-up needed', className: 'bg-amber-100 text-amber-700' },
];

export function statusMeta(value) {
  return STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
