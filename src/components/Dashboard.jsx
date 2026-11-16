import { useEffect, useState } from 'react';
import {
  Users, MapPin, CalendarDays, TrendingUp, Loader2, UserCog,
  CheckCircle2, Clock, ClipboardList, RefreshCw, Pencil, ArrowDownUp, CalendarClock,
} from 'lucide-react';
import { getDashboardStats } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';

export default function Dashboard({ user }) {
  const isAdmin = user.role === 'admin';
  const isDataEntry = user.role === 'data_entry';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'total' | 'visited'
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getDashboardStats()
      .then((s) => { if (mounted) setStats(s); })
      .catch((err) => toast.error(err.message || 'Could not load dashboard'))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24">
          <Loader2 className="animate-spin text-brand-600" size={28} />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  if (isDataEntry) {
    return <DataEntryDashboard user={user} stats={stats} />;
  }

  const maxCount = Math.max(...stats.wardCounts.map((w) => w.count), 1);
  const visibleWards = isAdmin
    ? stats.wardCounts
    : stats.wardCounts.filter((w) => w.wardId === user.wardId);

  // Contributors: Admin sees all data-entry people; Sub-Admin sees only their ward's people
  const baseContributors = isAdmin
    ? stats.contributors
    : stats.contributors.filter((c) => c.wardId === user.wardId);

  const visibleContributors = [...baseContributors].sort((a, b) => {
    if (sortBy === 'total') return b.total - a.total;
    if (sortBy === 'visited') return b.visited - a.visited;
    return new Date(b.lastEntryAt || 0) - new Date(a.lastEntryAt || 0);
  });

  const statCards = [
    {
      label: 'Total Voters',
      value: isAdmin ? stats.total : (stats.wardCounts.find((w) => w.wardId === user.wardId)?.count ?? 0),
      icon: Users,
      tint: 'bg-brand-50 text-brand-700',
      sub: isAdmin ? 'across all wards' : `in ${user.wardName}`,
    },
    {
      label: "Today's Entries",
      value: stats.todaysEntries,
      icon: TrendingUp,
      tint: 'bg-sky-50 text-sky-700',
      sub: 'added today',
    },
    {
      label: 'Wards Tracked',
      value: isAdmin ? stats.wardCounts.length : 1,
      icon: MapPin,
      tint: 'bg-amber-50 text-amber-700',
      sub: isAdmin ? 'active wards' : 'your assignment',
    },
    {
      label: 'Follow-ups',
      value: stats.statusBreakdown.follow_up,
      icon: CalendarDays,
      tint: 'bg-rose-50 text-rose-700',
      sub: 'pending visits',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {isAdmin ? 'Overview across all wards.' : `Overview for ${user.wardName}.`}
        </p>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tint}`}>
                <Icon size={18} />
              </span>
              <p className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{c.value}</p>
              <p className="text-sm font-medium text-slate-700">{c.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Ward-wise bar chart */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Ward-wise Voter Count</h2>
        <p className="text-xs text-slate-500 mt-0.5">Number of registered voters per ward</p>
        <div className="mt-5 space-y-3">
          {visibleWards.map((w) => (
            <div key={w.wardId}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">{w.wardName}</span>
                <span className="tabular-nums text-slate-500">{w.count}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-700 ease-out"
                  style={{ width: `${(w.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Status Breakdown</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Not visited', value: stats.statusBreakdown.not_visited, color: 'bg-slate-400' },
            { label: 'Visited', value: stats.statusBreakdown.visited, color: 'bg-brand-500' },
            { label: 'Follow-up', value: stats.statusBreakdown.follow_up, color: 'bg-amber-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.color} mb-2`} />
              <p className="text-xl font-bold text-slate-900 tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Entries by person */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <UserCog size={18} className="text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900">Entries by Data Entry Staff</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin ? 'Records entered by each data entry person across all wards.' : `Records entered by your data entry staff in ${user.wardName}.`}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <ArrowDownUp size={14} className="text-slate-400 ml-1.5" />
            {[
              { id: 'date', label: 'Date' },
              { id: 'total', label: 'Total' },
              { id: 'visited', label: 'Visited' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  sortBy === opt.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {visibleContributors.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
            <p className="text-sm text-slate-500">No entries recorded by data entry staff yet.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {visibleContributors.map((c) => (
              <div key={c.userId} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {c.wardName || 'Unassigned'}
                      </span>
                      {c.lastEntryAt && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <CalendarClock size={12} /> Last entry {formatDateTime(c.lastEntryAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1 text-slate-600" title="Total entries">
                      <Users size={14} className="text-slate-400" />
                      <span className="font-semibold tabular-nums">{c.total}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-brand-700" title="Visited">
                      <CheckCircle2 size={14} />
                      <span className="font-semibold tabular-nums">{c.visited}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-600" title="Follow-up needed">
                      <Clock size={14} />
                      <span className="font-semibold tabular-nums">{c.followUp}</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar: visited + follow-up share of total */}
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden flex">
                  <div
                    className="h-full bg-brand-500 transition-all duration-700"
                    style={{ width: `${(c.visited / c.total) * 100}%` }}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-700"
                    style={{ width: `${(c.followUp / c.total) * 100}%` }}
                  />
                </div>

                {/* Legend */}
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" /> Visited {c.visited}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Follow-up {c.followUp}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" /> Not visited {c.notVisited}</span>
                  {c.todays > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-sky-600">
                      <TrendingUp size={12} /> {c.todays} today
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Data Entry personal dashboard ----------------
function DataEntryDashboard({ user, stats }) {
  const mine = stats.contributors.find((c) => c.name === user.name) || {
    name: user.name,
    wardName: user.wardName,
    total: 0,
    visited: 0,
    notVisited: 0,
    followUp: 0,
    todays: 0,
  };

  // "Updated" approximated as records they entered that are now marked visited or follow-up
  // (i.e. they came back and updated the status from not_visited).
  const updated = mine.visited + mine.followUp;
  const completionPct = mine.total > 0 ? Math.round((updated / mine.total) * 100) : 0;

  const cards = [
    {
      label: 'My Entries',
      value: mine.total,
      icon: ClipboardList,
      tint: 'bg-brand-50 text-brand-700',
      sub: 'records I added',
    },
    {
      label: 'Visited',
      value: mine.visited,
      icon: CheckCircle2,
      tint: 'bg-brand-50 text-brand-700',
      sub: 'marked visited',
    },
    {
      label: "Updated",
      value: updated,
      icon: Pencil,
      tint: 'bg-sky-50 text-sky-700',
      sub: 'statuses I changed',
    },
    {
      label: 'Today',
      value: mine.todays,
      icon: TrendingUp,
      tint: 'bg-sky-50 text-sky-700',
      sub: 'added today',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your voter entry progress in {user.wardName}.
        </p>
      </div>

      {/* Personal stat cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tint}`}>
                <Icon size={18} />
              </span>
              <p className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{c.value}</p>
              <p className="text-sm font-medium text-slate-700">{c.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* My status breakdown */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">My Status Breakdown</h2>
        <p className="text-xs text-slate-500 mt-0.5">How the records you entered are tracked</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Not visited', value: mine.notVisited, color: 'bg-slate-400' },
            { label: 'Visited', value: mine.visited, color: 'bg-brand-500' },
            { label: 'Follow-up', value: mine.followUp, color: 'bg-amber-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.color} mb-2`} />
              <p className="text-xl font-bold text-slate-900 tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Completion progress */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-slate-900">Update Progress</h2>
          </div>
          <span className="text-sm font-bold text-brand-700 tabular-nums">{completionPct}%</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Share of your entries you've followed up on</p>

        <div className="mt-4 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-700 ease-out"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{updated} of {mine.total} updated</span>
          <span>{mine.total - updated} still not visited</span>
        </div>
      </div>
    </div>
  );
}
