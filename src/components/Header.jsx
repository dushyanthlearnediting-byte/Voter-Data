import { useState, useRef, useEffect } from 'react';
import { Vote, LogOut, LayoutDashboard, Users, ListChecks, Settings, MessageSquare } from 'lucide-react';
import { roleDisplay } from '@/lib/format';

export default function Header({ user, view, onNavigate, onLogout, onOpenMessageSettings }) {
  const canSeeUsers = user.role === 'admin' || user.role === 'sub_admin';
  const canSeeDashboard = true;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const navItems = [
    { id: 'voters', label: 'Voters', icon: ListChecks, show: true },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: canSeeDashboard },
    { id: 'users', label: 'Users', icon: Users, show: canSeeUsers },
  ].filter((i) => i.show);

  function handleNavigate(id) {
    setMenuOpen(false);
    onNavigate(id);
  }

  function handleOpenMessageSettings() {
    setMenuOpen(false);
    onOpenMessageSettings?.();
  }

  function handleLogout() {
    setMenuOpen(false);
    onLogout();
  }

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
                  onClick={() => handleNavigate(item.id)}
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

          {/* Settings dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((s) => !s)}
              aria-label="Settings"
              className={`inline-flex items-center justify-center rounded-lg border p-2.5 transition ${
                menuOpen
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings size={20} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-300/40 overflow-hidden animate-fade-in">
                <button
                  onClick={handleOpenMessageSettings}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left"
                >
                  <MessageSquare size={18} className="text-brand-600" />
                  Message settings
                </button>
                <div className="h-px bg-slate-100" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition text-left"
                >
                  <LogOut size={18} />
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
                onClick={() => handleNavigate(item.id)}
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
