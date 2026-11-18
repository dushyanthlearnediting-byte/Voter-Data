import { useEffect, useRef, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { getMessageTemplate, PLACEHOLDERS, renderMessage, saveMessageTemplate } from '@/lib/api';
import { useToast } from '@/components/Toast';

const SAMPLE_VOTER = {
  fullName: 'Ananya Rao',
  relativeName: 'Ramesh Rao',
  voterId: 'ABC1234567',
  phone: '9876543210',
  wardName: 'Ward 5',
  boothName: 'North Primary School',
  wardSerial: 42,
  age: 35,
  gender: 'female',
};

export default function MessageSettings() {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const toast = useToast();

  useEffect(() => {
    const result = getMessageTemplate();
    setSettings(result);
    setMessage(result.message);
  }, []);

  function insertPlaceholder(token) {
    const textarea = textareaRef.current;
    const start = textarea ? textarea.selectionStart : selectionRef.current.start;
    const end = textarea ? textarea.selectionEnd : selectionRef.current.end;
    const nextMessage = `${message.slice(0, start)}${token}${message.slice(end)}`;
    const nextPosition = start + token.length;
    setMessage(nextMessage);
    selectionRef.current = { start: nextPosition, end: nextPosition };
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextPosition, nextPosition);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveMessageTemplate(message);
      setMessage(saved);
      setSettings(getMessageTemplate());
      toast.success('Message template saved');
    } catch (err) {
      toast.error(err.message || 'Could not save message template');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24">
          <Loader2 className="animate-spin text-brand-600" size={28} />
        </div>
      </div>
    );
  }

  const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200';

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Message for Call / SMS / WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-500">Applies to: <span className="font-medium text-slate-700">{settings.appliesTo}</span></p>
      </div>

      <section className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {!settings.canEdit && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Only your admin can change this message
          </p>
        )}

        <div>
          <label htmlFor="message-template" className="mb-2 block text-sm font-semibold text-slate-800">
            Message template
          </label>
          <textarea
            ref={textareaRef}
            id="message-template"
            rows={5}
            className={`${inputClass} resize-y text-base leading-relaxed`}
            value={message}
            readOnly={!settings.canEdit}
            onChange={(event) => setMessage(event.target.value)}
            onSelect={(event) => {
              selectionRef.current = {
                start: event.target.selectionStart,
                end: event.target.selectionEnd,
              };
            }}
            onBlur={(event) => {
              selectionRef.current = {
                start: event.target.selectionStart,
                end: event.target.selectionEnd,
              };
            }}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-800">Tap a placeholder to insert it</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PLACEHOLDERS.map(({ token, label }) => (
              <button
                type="button"
                key={token}
                disabled={!settings.canEdit}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertPlaceholder(token)}
                className="min-h-16 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-left transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block font-semibold text-brand-800">{token}</span>
                <span className="mt-0.5 block text-xs text-slate-600">{token} = {label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-800">Live preview</h2>
          <div className="mt-2 min-h-24 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {renderMessage(message, SAMPLE_VOTER)}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={!settings.canEdit || saving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
