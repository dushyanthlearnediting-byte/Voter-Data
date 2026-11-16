import { useEffect, useState } from 'react';
import { getCurrentUser, logout } from '@/lib/api';
import { ToastProvider, useToast } from '@/components/Toast';
import Login from '@/components/Login';
import Header from '@/components/Header';
import VotersPage from '@/components/VotersPage';
import UsersPage from '@/components/UsersPage';
import Dashboard from '@/components/Dashboard';
import LoadingScreen from '@/components/LoadingScreen';

function AppInner() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState('voters');
  const [loggingOut, setLoggingOut] = useState(false);
  const toast = useToast();

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .finally(() => setBooting(false));
  }, []);

  if (booting || loggingOut) {
    return <LoadingScreen label={loggingOut ? 'Signing out…' : 'Loading…'} />;
  }

  if (!user) {
    return <Login onLoggedIn={(u) => { setUser(u); setView('voters'); }} />;
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setUser(null);
      setLoggingOut(false);
      toast.info('You have been signed out');
    }
  }

  function handleNavigate(next) {
    // role guard: data_entry cannot see users
    if (user.role === 'data_entry' && next === 'users') {
      toast.error('You do not have access to that page');
      return;
    }
    setView(next);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} view={view} onNavigate={handleNavigate} onLogout={handleLogout} />
      <main className="animate-fade-in">
        {view === 'voters' && <VotersPage user={user} />}
        {view === 'dashboard' && <Dashboard user={user} />}
        {view === 'users' && (user.role === 'admin' || user.role === 'sub_admin') && <UsersPage user={user} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
