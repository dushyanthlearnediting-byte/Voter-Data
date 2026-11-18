import { useEffect, useRef, useState } from 'react';
import { Vote, Settings, LayoutDashboard, Users, ListChecks } from 'lucide-react';
import { roleDisplay } from '@/lib/format';

export default function Header({ user, view, onNavigate, onLogout }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const canSeeUsers = user.role === 'admin' || user.role === 'sub_admin';
  const canSeeDashboard = true; // all roles see their own dashboard

  const navItems = [
    { id: 'voters', label: 'Voters', icon: ListChecks, show: true },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: canSeeDashboard },
    { id: 'users', label: 'Users', icon: Users, show: canSeeUsers },
  ].filter((i) => i.show);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setSettingsOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-600 text-white">
              <Vote size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate leading-tight">Voter Data Manager</p>
              <p className="text-xs text-brand-700 font-medium truncate">{roleDisplay(user)}</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Settings size={19} />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('message-settings');
                    setSettingsOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Message settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    onLogout();
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav (below) */}
        <nav className="sm:hidden flex items-center gap-1 pb-2 -mt-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`inline-flex flex-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
