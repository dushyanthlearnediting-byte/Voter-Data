import { useEffect, useState } from 'react';
import {
  X, Pencil, Trash2, Phone, MessageSquare, MessageCircle, Building2,
  Hash, MapPin, Calendar, User, IdCard, Phone as PhoneIcon, UserCircle,
} from 'lucide-react';
import { getContactLinks, updateVoter } from '@/lib/api';
import { statusMeta, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';

export default function VoterDetailsPanel({ voter, messageTemplate, canDelete, userRole, onClose, onEdit, onDelete, onVoterUpdated }) {
  const [editedMessage, setEditedMessage] = useState('');
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const toast = useToast();

  const isAdmin = userRole === 'admin';
  const canEditPhone = userRole === 'sub_admin' || userRole === 'data_entry';

  useEffect(() => {
    if (voter && messageTemplate) {
      setEditedMessage(messageTemplate);
    }
    setPhoneEditing(false);
  }, [voter, messageTemplate]);

  if (!voter) return null;

  function startPhoneEdit() {
    setPhoneDraft(voter.phone || '');
    setPhoneEditing(true);
  }

  async function handleSavePhone() {
    if (!/^[6-9]\d{9}$/.test(phoneDraft)) {
      toast.error('Phone must be 10 digits starting with 6–9');
      return;
    }
    setPhoneSaving(true);
    try {
      const updated = await updateVoter(voter.id, { phone: phoneDraft });
      toast.success('Phone number updated');
      setPhoneEditing(false);
      onVoterUpdated?.(updated);
    } catch (err) {
      toast.error(err.message || 'Could not update phone');
    } finally {
      setPhoneSaving(false);
    }
  }

  const sm = statusMeta(voter.status);
  const links = getContactLinks(voter, editedMessage || messageTemplate);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Bottom sheet on mobile, right side panel on desktop */}
      <aside className="fixed z-[71] inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[400px] bg-white shadow-2xl rounded-t-2xl sm:rounded-none flex flex-col max-h-[85vh] sm:max-h-screen animate-slide-up sm:animate-none overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 flex-none">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">{voter.fullName}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{voter.voterId}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Contact buttons */}
          {links.canContact ? (
            <div className="grid grid-cols-3 gap-2.5">
              <a
                href={links.call}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-green-500 px-2 py-3.5 text-white hover:bg-green-600 active:scale-[0.98] transition shadow-sm"
              >
                <Phone size={22} />
                <span className="text-xs font-semibold">Call</span>
              </a>
              <a
                href={links.sms}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-500 px-2 py-3.5 text-white hover:bg-blue-600 active:scale-[0.98] transition shadow-sm"
              >
                <MessageSquare size={22} />
                <span className="text-xs font-semibold">SMS</span>
              </a>
              <a
                href={links.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-xl bg-[#075E54] px-2 py-3.5 text-white hover:bg-[#064d44] active:scale-[0.98] transition shadow-sm"
              >
                <MessageCircle size={22} />
                <span className="text-xs font-semibold">WhatsApp</span>
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-center">
              <p className="text-sm text-amber-800 font-medium">
                {canEditPhone ? 'No phone number. Tap the phone field below to add one.' : 'No phone number.'}
              </p>
            </div>
          )}

          {/* Editable message preview */}
          {links.canContact && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Message (edit before sending)
              </label>
              <textarea
                rows={4}
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 resize-none text-sm leading-relaxed"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                SMS and WhatsApp links update as you edit.
              </p>
            </div>
          )}

          {/* Details */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <DetailRow icon={IdCard} label="Voter ID" value={voter.voterId} mono />
            <div className="flex items-start gap-3">
              <PhoneIcon size={16} className="text-slate-400 mt-0.5 flex-none" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">Phone</p>
                {phoneEditing ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-mono text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                      placeholder="9876543210"
                    />
                    <button
                      onClick={() => handleSavePhone()}
                      disabled={phoneSaving}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {phoneSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setPhoneEditing(false); setPhoneDraft(''); }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : canEditPhone ? (
                  <button
                    onClick={startPhoneEdit}
                    className="group inline-flex items-center gap-1.5 text-sm font-mono text-slate-800 hover:text-brand-700 transition"
                  >
                    {voter.phone || '—'}
                    <Pencil size={13} className="text-slate-300 group-hover:text-brand-600 transition" />
                  </button>
                ) : (
                  <div className="text-sm text-slate-800 font-mono">{voter.phone || '—'}</div>
                )}
              </div>
            </div>
            <DetailRow
              icon={UserCircle}
              label="Status"
              value={
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${sm.className}`}>
                  {sm.label}
                </span>
              }
            />
            <DetailRow icon={Building2} label="Booth" value={voter.boothName || '—'} />
            {voter.wardSerial != null && (
              <DetailRow icon={Hash} label="Serial number" value={String(voter.wardSerial)} />
            )}
            {voter.wardName && (
              <DetailRow icon={MapPin} label="Ward" value={voter.wardName} />
            )}
            {voter.age != null && (
              <DetailRow icon={User} label="Age" value={`${voter.age} yrs`} />
            )}
            {voter.gender && (
              <DetailRow
                icon={User}
                label="Gender"
                value={voter.gender.charAt(0).toUpperCase() + voter.gender.slice(1)}
              />
            )}
            <DetailRow icon={Calendar} label="Added" value={formatDate(voter.createdAt)} />
            {voter.address && (
              <div className="pt-1 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Address</p>
                <p className="text-sm text-slate-700 leading-relaxed">{voter.address}</p>
              </div>
            )}
            {voter.notes && (
              <div className="pt-1 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-slate-700 leading-relaxed">{voter.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 border-t border-slate-100 bg-white px-5 py-3.5 flex-none">
          {isAdmin && (
            <button
              onClick={() => onEdit(voter)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition"
            >
              <Pencil size={17} /> Edit
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(voter)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
            >
              <Trash2 size={17} /> Delete
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function DetailRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="text-slate-400 mt-0.5 flex-none" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <div className={`text-sm text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}
