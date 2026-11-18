import { useEffect, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { addVoter, updateVoter, getWards } from '@/lib/api';
import { STATUS_OPTIONS } from '@/lib/format';
import { useToast } from '@/components/Toast';

const GENDERS = [
  { value: '', label: 'Select' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  fullName: '',
  relativeName: '',
  boothName: '',
  wardSerial: '',
  voterId: '',
  phone: '',
  wardId: '',
  age: '',
  gender: '',
  address: '',
  status: 'not_visited',
  notes: '',
};

export default function VoterForm({ open, voter, user, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [wards, setWards] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const isAdmin = user?.role === 'admin';
  const wardLocked = !isAdmin;

  useEffect(() => {
    let mounted = true;
    getWards().then((w) => {
      if (mounted) setWards(w);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (voter) {
      setForm({
        fullName: voter.fullName || '',
        relativeName: voter.relativeName || '',
        boothName: voter.boothName || '',
        wardSerial: voter.wardSerial ?? '',
        voterId: voter.voterId || '',
        phone: voter.phone || '',
        wardId: voter.wardId ?? '',
        age: voter.age ?? '',
        gender: voter.gender || '',
        address: voter.address || '',
        status: voter.status || 'not_visited',
        notes: voter.notes || '',
      });
    } else {
      setForm({
        ...emptyForm,
        wardId: wardLocked ? (user?.wardId ?? '') : '',
      });
    }
    setErrors({});
  }, [open, voter, user, wardLocked]);

  if (!open) return null;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.voterId.trim()) e.voterId = 'Voter ID is required';
    // Phone is optional (voters imported from the official list get their phone added later)
    if (form.phone.trim() && !/^[6-9]\d{9}$/.test(form.phone.trim())) {
      e.phone = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9';
    }
    if (!form.wardId) e.wardId = 'Ward is required';
    if (form.age && (Number(form.age) < 18 || Number(form.age) > 120)) e.age = 'Age must be 18 to 120';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
      wardId: form.wardId,
    };
    try {
      if (voter) {
        await updateVoter(voter.id, payload);
        toast.success('Voter updated successfully');
      } else {
        await addVoter(payload);
        toast.success('Voter added successfully');
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.message || 'Could not save voter');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-xl border bg-white px-3.5 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl animate-slide-up">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{voter ? 'Edit Voter' : 'Add Voter'}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Full name" required error={errors.fullName}>
            <input
              className={`${inputClass} ${errors.fullName ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              placeholder="e.g. Aarav Sharma"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Father / Husband name">
              <input
                className={`${inputClass} border-slate-300 focus:border-brand-500 focus:ring-brand-200`}
                value={form.relativeName}
                onChange={(e) => setField('relativeName', e.target.value)}
                placeholder="As printed in the voter list"
              />
            </Field>
            <Field label="Booth name">
              <input
                className={`${inputClass} border-slate-300 focus:border-brand-500 focus:ring-brand-200`}
                value={form.boothName}
                onChange={(e) => setField('boothName', e.target.value)}
                placeholder="e.g. North Primary School"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Voter ID" required error={errors.voterId}>
              <input
                className={`${inputClass} ${errors.voterId ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                value={form.voterId}
                onChange={(e) => setField('voterId', e.target.value)}
                placeholder="ABC1234567"
              />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <input
                inputMode="numeric"
                maxLength={10}
                className={`${inputClass} ${errors.phone ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Field label="Ward" required error={errors.wardId}>
              <select
                disabled={wardLocked}
                className={`${inputClass} ${errors.wardId ? 'border-red-400' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'} ${wardLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
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
            <Field label="Age" error={errors.age}>
              <input
                inputMode="numeric"
                className={`${inputClass} ${errors.age ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                value={form.age}
                onChange={(e) => setField('age', e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="35"
              />
            </Field>
            <Field label="Ward serial">
              <input
                inputMode="numeric"
                className={`${inputClass} border-slate-300 focus:border-brand-500 focus:ring-brand-200`}
                value={form.wardSerial}
                onChange={(e) => setField('wardSerial', e.target.value.replace(/\D/g, ''))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Gender">
              <select
                className={`${inputClass} border-slate-300 focus:border-brand-500 focus:ring-brand-200`}
                value={form.gender}
                onChange={(e) => setField('gender', e.target.value)}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Address">
            <textarea
              rows={2}
              className={`${inputClass} border-slate-300 focus:border-brand-500 focus:ring-brand-200 resize-none`}
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Street, area"
            />
          </Field>

          <Field label="Status">
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((s) => {
                const active = form.status === s.value;
                return (
                  <button
                    type="button"
                    key={s.value}
                    onClick={() => setField('status', s.value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              rows={2}
              className={`${inputClass} border-slate-300 focus:border-brand-500 focus:ring-brand-200 resize-none`}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Optional remarks from field visit"
            />
          </Field>

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
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {voter ? 'Save changes' : 'Add voter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
