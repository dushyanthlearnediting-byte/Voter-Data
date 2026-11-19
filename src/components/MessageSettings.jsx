import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, Loader2, Lock, Users, Eye } from 'lucide-react';
import {
  getMessageTemplate,
  saveMessageTemplate,
  renderMessage,
  PLACEHOLDERS,
} from '@/lib/api';
import { useToast } from '@/components/Toast';

const SAMPLE_VOTER = {
  fullName: 'Aarav Sharma',
  voterId: 'ABC1234567',
  relativeName: 'S/o Sharma',
  phone: '9876543210',
  wardName: 'Ward 1',
  boothName: 'Booth 1 - Govt School',
  age: 35,
  gender: 'male',
  wardSerial: 42,
};

export default function MessageSettings({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [appliesTo, setAppliesTo] = useState('All staff');
  const [isDefault, setIsDefault] = useState(true);
  const textareaRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMessageTemplate()
      .then((res) => {
        if (!mounted) return;
        setTemplate(res.message);
        setCanEdit(res.canEdit);
        setAppliesTo(res.appliesTo);
        setIsDefault(res.isDefault);
      })
      .catch((err) => toast.error(err.message || 'Could not load message'))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function insertPlaceholder(token) {
    if (!canEdit) return;
    const ta = textareaRef.current;
    if (!ta) {
      setTemplate((t) => t + token);
      return;
    }
    const start = ta.selectionStart ?? template.length;
    const end = ta.selectionEnd ?? template.length;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      const pos = start + token.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveMessageTemplate(template);
      setTemplate(saved);
      toast.success('Message saved');
    } catch (err) {
      toast.error(err.message || 'Could not save message');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setTemplate('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const preview = renderMessage(template, SAMPLE_VOTER);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6">
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24">
          <Loader2 className="animate-spin text-brand-600" size={28} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-slate-900">Message for Call / SMS / WhatsApp</h1>
        <p className="text-sm text-slate-500 mt-1">
          This message is used when contacting voters. Tap a chip to insert a placeholder.
        </p>
      </div>

      {/* Applies to */}
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Users size={18} className="text-brand-600" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Applies to</p>
          <p className="text-sm font-medium text-slate-800">{appliesTo}</p>
        </div>
      </div>

      {/* Template box */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="msg-template" className="text-sm font-semibold text-slate-800">
            Message template
          </label>
          {!canEdit && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <Lock size={12} /> Read only
            </span>
          )}
        </div>

        <textarea
          id="msg-template"
          ref={textareaRef}
          rows={6}
          disabled={!canEdit}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed resize-none text-base leading-relaxed"
          placeholder="Type your message…"
        />

        {/* Placeholder chips */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500 mb-2.5">Tap to insert</p>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.token}
                type="button"
                disabled={!canEdit}
                onClick={() => insertPlaceholder(p.token)}
                className={`inline-flex flex-col items-start rounded-lg border px-3 py-2 text-left transition ${
                  canEdit
                    ? 'border-brand-200 bg-brand-50 hover:bg-brand-100 active:scale-[0.97]'
                    : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-70'
                }`}
              >
                <span className="text-sm font-semibold text-brand-700">{p.token}</span>
                <span className="text-xs text-slate-500">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {!canEdit && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            Only your admin can change this message.
          </p>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          {canEdit && (
            <button
              onClick={handleReset}
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canEdit || saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save message
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-800">Preview with sample voter</h2>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3.5 text-slate-800 text-base leading-relaxed whitespace-pre-wrap">
          {preview || <span className="text-slate-400">Your message preview will appear here…</span>}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Sample: {SAMPLE_VOTER.fullName}, {SAMPLE_VOTER.voterId}, {SAMPLE_VOTER.boothName}, {SAMPLE_VOTER.wardName}, Serial #{SAMPLE_VOTER.wardSerial}
        </p>
      </div>
    </div>
  );
}
