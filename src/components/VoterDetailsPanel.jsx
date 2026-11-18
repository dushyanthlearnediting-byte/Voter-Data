import { useEffect, useState } from 'react';
import { MessageCircle, Pencil, Phone, Trash2, X } from 'lucide-react';
import { getContactLinks, getMessageTemplate } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function VoterDetailsPanel({ voter, canDelete, onClose, onEdit, onDelete }) {
  const [editedMessage, setEditedMessage] = useState('');

  useEffect(() => {
    const message = getMessageTemplate().message;
    setEditedMessage(message);
  }, [voter]);

  if (!voter) return null;

  const links = getContactLinks(voter, editedMessage);
  const actions = [
    { label: 'Call', href: links.call, icon: Phone, className: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: 'SMS', href: links.sms, icon: MessageCircle, className: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'WhatsApp', href: links.whatsapp, icon: MessageCircle, className: 'bg-green-800 hover:bg-green-900', external: true },
  ];
  const details = [
    ['Voter ID', voter.voterId],
    ['Relative name', voter.relativeName],
    ['Phone', voter.phone],
    ['Ward', voter.wardName],
    ['Booth name', voter.boothName],
    ['Ward serial', voter.wardSerial],
    ['Age', voter.age],
    ['Gender', voter.gender],
    ['Address', voter.address],
    ['Status', voter.status?.replace('_', ' ')],
    ['Added', formatDate(voter.createdAt)],
    ['Added by', voter.createdBy],
    ['Notes', voter.notes],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Close voter details"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <section className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none sm:animate-fade-in">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{voter.fullName}</h2>
            <p className="font-mono text-xs text-slate-500">{voter.voterId}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-2">
            {actions.map(({ label, href, icon: Icon, className, external }) => (
              links.canContact ? (
                <a
                  key={label}
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-white transition ${className}`}
                >
                  <Icon size={18} /> {label}
                </a>
              ) : (
                <button
                  key={label}
                  type="button"
                  disabled
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-white opacity-40 ${className}`}
                >
                  <Icon size={18} /> {label}
                </button>
              )
            ))}
          </div>

          {!links.canContact && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No phone number. Tap Edit to add one.
            </p>
          )}

          <div>
            <label htmlFor="voter-message-preview" className="mb-2 block text-sm font-semibold text-slate-800">
              Message preview
            </label>
            <textarea
              id="voter-message-preview"
              rows={5}
              value={links.message}
              onChange={(event) => setEditedMessage(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            {details.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
              <div key={label} className="min-w-0 py-1">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="break-words text-sm text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onEdit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <Pencil size={16} /> Edit
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
