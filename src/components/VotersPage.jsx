import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight,
  Download, Upload, Filter, X, Phone, MapPin, Calendar, FileSpreadsheet,
} from 'lucide-react';
import { getVoters, getWards, deleteVoter, exportVoters, importVoters, downloadImportTemplate } from '@/lib/api';
import { STATUS_OPTIONS, statusMeta, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import VoterForm from '@/components/VoterForm';
import VoterDetailsPanel from '@/components/VoterDetailsPanel';

const PAGE_SIZE = 50;

export default function VotersPage({ user }) {
  const isAdmin = user.role === 'admin';
  const canEditAll = user.role === 'admin' || user.role === 'sub_admin';
  const canExport = user.role === 'admin' || user.role === 'sub_admin';
  const canDelete = user.role !== 'data_entry';

  const [wards, setWards] = useState([]);
  const [voters, setVoters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [wardId, setWardId] = useState(isAdmin ? '' : String(user.wardId));
  const [status, setStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedVoter, setSelectedVoter] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  const fileRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    getWards().then(setWards);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVoters({
        search,
        wardId: wardId || null,
        status: status || null,
        page,
        pageSize: PAGE_SIZE,
      });
      setVoters(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      toast.error(err.message || 'Could not load voters');
    } finally {
      setLoading(false);
    }
  }, [search, wardId, status, page, toast]);

  const prevFilters = useRef({ search, wardId, status });
  useEffect(() => {
    const p = prevFilters.current;
    const filtersChanged = p.search !== search || p.wardId !== wardId || p.status !== status;
    prevFilters.current = { search, wardId, status };

    // a new search/filter always starts from page 1 (this effect then runs again)
    if (filtersChanged && page !== 1) {
      setPage(1);
      return undefined;
    }
    // wait a moment while typing in the search box; load at once for page changes
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(load, filtersChanged ? 350 : 0);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, wardId, status, page]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(voter) {
    setEditing(voter);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!confirm) return;
    try {
      await deleteVoter(confirm.id);
      toast.success('Voter deleted');
      setConfirm(null);
      setSelectedVoter(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Could not delete voter');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await exportVoters(wardId || null);
      toast.success(`Exported ${res.count} voters`);
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importVoters(file);
      const parts = [`Imported ${res.added} of ${res.total} rows`];
      if (res.skippedExisting) parts.push(`${res.skippedExisting} already in the list`);
      if (res.errors.length) parts.push(`${res.errors.length} rows had problems`);
      toast.success(parts.join(' · '));
      if (res.errors.length) {
        const first = res.errors.slice(0, 3).map((er) => `Row ${er.row}: ${er.message}`).join('  |  ');
        toast.error(`${first}${res.errors.length > 3 ? `  (+${res.errors.length - 3} more)` : ''}`);
      }
      load();
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      e.target.value = '';
    }
  }

  function clearFilters() {
    setSearch('');
    setWardId(isAdmin ? '' : String(user.wardId));
    setStatus('');
    setPage(1);
  }

  const hasFilters = search || (isAdmin ? wardId : false) || status;
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Voters</h1>
            <p className="text-sm text-slate-500 mt-0.5">Search, update and track voter outreach.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canExport && (
              <>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-60"
                >
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  <span className="hidden sm:inline">Export to Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">Import from Excel</span>
                  <span className="sm:hidden">Import</span>
                </button>
                <button
                  onClick={() => downloadImportTemplate().catch((err) => toast.error(err.message || 'Could not create template'))}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <FileSpreadsheet size={16} />
                  <span className="hidden sm:inline">Template</span>
                </button>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportFile} />
              </>
            )}
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 active:scale-[0.99] transition shadow-sm"
            >
              <Plus size={18} />
              Add Voter
            </button>
          </div>
        </div>

        {/* Search + filter row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, voter ID or phone…"
              className="w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`sm:hidden inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              showFilters ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            <Filter size={18} />
            Filters
          </button>
          <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row gap-3`}>
            {isAdmin && (
              <select
                value={wardId}
                onChange={(e) => { setWardId(e.target.value); setPage(1); }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition"
              >
                <option value="">All wards</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={16} />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : total > 0 ? `Showing ${startIdx}–${endIdx} of ${total} voters` : 'No voters found'}
        </p>
      </div>

      {/* Table (desktop) / cards (mobile) */}
      {loading ? (
        <div className="mt-4 flex items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
          <Loader2 className="animate-spin text-brand-600" size={28} />
        </div>
      ) : voters.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">No voters match your filters.</p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-4 hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Voter ID</th>
                  <th className="px-4 py-3">Phone</th>
                  {isAdmin && <th className="px-4 py-3">Ward</th>}
                  <th className="px-4 py-3">Booth name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {voters.map((v) => {
                  const sm = statusMeta(v.status);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVoter(v)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedVoter(v);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-slate-50/70 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{v.fullName}</div>
                        <div className="text-xs text-slate-500">{v.age ? `${v.age} yrs` : ''}{v.gender ? ` · ${v.gender}` : ''}</div>
                        {v.relativeName && <div className="text-xs text-slate-400">C/o {v.relativeName}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{v.voterId}</td>
                      <td className="px-4 py-3 text-slate-700">{v.phone || '—'}</td>
                      {isAdmin && <td className="px-4 py-3 text-slate-700">{v.wardName}</td>}
                      <td className="px-4 py-3 text-slate-700">{v.boothName || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${sm.className}`}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(v.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEditAll && (
                            <button
                              onClick={(event) => { event.stopPropagation(); openEdit(v); }}
                              className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700 transition"
                              aria-label="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(event) => { event.stopPropagation(); setConfirm(v); }}
                              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                              aria-label="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-4 md:hidden space-y-3">
            {voters.map((v) => {
              const sm = statusMeta(v.status);
              return (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedVoter(v)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedVoter(v);
                    }
                  }}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{v.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{v.voterId}</p>
                    </div>
                    <span className={`flex-none inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${sm.className}`}>
                      {sm.label}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {v.phone || '—'}</p>
                    {isAdmin && <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {v.wardName}</p>}
                    <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {v.boothName || 'Booth name not set'}</p>
                    <p className="flex items-center gap-2"><Calendar size={14} className="text-slate-400" /> {formatDate(v.createdAt)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                    {canEditAll && (
                      <button
                        onClick={(event) => { event.stopPropagation(); openEdit(v); }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition"
                      >
                        <Pencil size={15} /> Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(event) => { event.stopPropagation(); setConfirm(v); }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 hidden sm:block">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-sm text-slate-600 sm:hidden font-medium">{page}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <VoterForm
        open={formOpen}
        voter={editing}
        user={user}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <VoterDetailsPanel
        voter={selectedVoter}
        canDelete={canDelete}
        canEditAll={canEditAll}
        onClose={() => setSelectedVoter(null)}
        onEdit={() => {
          openEdit(selectedVoter);
          setSelectedVoter(null);
        }}
        onDelete={() => {
          setConfirm(selectedVoter);
          setSelectedVoter(null);
        }}
        onPhoneSaved={(updatedVoter) => {
          setSelectedVoter(updatedVoter);
          setVoters((current) => current.map((voter) => (
            voter.id === updatedVoter.id ? updatedVoter : voter
          )));
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Delete voter?"
        message={confirm ? `This will permanently remove ${confirm.fullName} (${confirm.voterId}) from the list.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
