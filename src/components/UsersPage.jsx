import { useEffect, useState } from 'react';
import { UserPlus, Users as UsersIcon, Trash2, Loader2, X, ShieldCheck, MapPin } from 'lucide-react';
import { getUsers, getWards, createUser, deleteUser } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

const ROLE_BADGE = {
  admin: 'bg-brand-100 text-brand-700',
  sub_admin: 'bg-sky-100 text-sky-700',
  data_entry: 'bg-slate-100 text-slate-700',
};

export default function UsersPage({ user }) {
  const isAdmin = user.role === 'admin';
  const [users, setUsers] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  // Sub-admin can only create data_entry users for their own ward
  const allowedRoles = isAdmin
    ? [{ value: 'admin', label: 'Admin' }, { value: 'sub_admin', label: 'Sub-Admin' }, { value: 'data_entry', label: 'Data Entry' }]
    : [{ value: 'data_entry', label: 'Data Entry' }];

  async function load() {
    setLoading(true);
    try {
      const [u, w] = await Promise.all([getUsers(), getWards()]);
      setUsers(u);
      setWards(w);
    } catch (err) {
      toast.error(err.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete() {
    if (!confirm) return;
    try {
      await deleteUser(confirm.id);
      toast.success('User removed');
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Could not remove user');
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? 'Manage all staff accounts and roles.' : `Manage Data Entry staff for ${user.wardName}.`}
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 active:scale-[0.99] transition shadow-sm"
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
          <Loader2 className="animate-spin text-brand-600" size={28} />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex-none inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <UsersIcon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 truncate">{u.email}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><ShieldCheck size={13} /> {u.phone || '—'}</span>
                    {u.wardName && <span className="flex items-center gap-1"><MapPin size={13} /> {u.wardName}</span>}
                  </div>
                </div>
                {isAdmin && u.role !== 'admin' && (
                  <button
                    onClick={() => setConfirm(u)}
                    className="flex-none rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                    aria-label="Remove user"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UserAddForm
        open={formOpen}
        user={user}
        wards={wards}
        allowedRoles={allowedRoles}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Remove user?"
        message={confirm ? `This will remove ${confirm.name} from the system. They will lose access immediately.` : ''}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function UserAddForm({ open, user, wards, allowedRoles, onClose, onSaved }) {
  const isAdmin = user.role === 'admin';
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: allowedRoles[0].value,
    wardId: isAdmin ? '' : String(user.wardId),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm({
        name: '', email: '', phone: '', password: '',
        role: allowedRoles[0].value,
        wardId: isAdmin ? '' : String(user.wardId),
      });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = 'Phone must be 10 digits';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.role !== 'admin' && !form.wardId) e.wardId = 'Ward is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await createUser({
        ...form,
        wardId: form.role === 'admin' ? null : form.wardId,
      });
      toast.success('User created successfully');
      onSaved?.();
    } catch (err) {
      toast.error(err.message || 'Could not create user');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-xl border bg-white px-3.5 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2';
  const wardLocked = !isAdmin;
  const needsWard = form.role !== 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl animate-slide-up">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Add User</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Full name" required error={errors.name}>
            <input
              className={`${inputClass} ${errBorder(errors.name)}`}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Staff name"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" required error={errors.email}>
              <input
                type="email"
                className={`${inputClass} ${errBorder(errors.email)}`}
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="user@ward.gov"
              />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <input
                inputMode="numeric"
                maxLength={10}
                className={`${inputClass} ${errBorder(errors.phone)}`}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
              />
            </Field>
          </div>

          <Field label="Password" required error={errors.password}>
            <input
              type="text"
              className={`${inputClass} ${errBorder(errors.password)}`}
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role" required>
              <select
                className={`${inputClass} border-slate-300 focus:border-brand-500 focus:ring-brand-200`}
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
              >
                {allowedRoles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {!isAdmin && (
                <p className="mt-1 text-xs text-slate-400">You can only add Data Entry users.</p>
              )}
            </Field>
            {needsWard && (
              <Field label="Ward" required error={errors.wardId}>
                <select
                  disabled={wardLocked}
                  className={`${inputClass} ${errBorder(errors.wardId)} ${wardLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  value={form.wardId}
                  onChange={(e) => setField('wardId', e.target.value)}
                >
                  <option value="">Select</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                {wardLocked && <p className="mt-1 text-xs text-slate-400">Locked to your ward</p>}
              </Field>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 active:scale-[0.99] transition disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              Create user
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function errBorder(err) {
  return err
    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200';
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
