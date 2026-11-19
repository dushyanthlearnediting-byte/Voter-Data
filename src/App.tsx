import { useEffect, useState } from 'react';
import { getCurrentUser, logout } from '@/lib/api';
import { ToastProvider, useToast } from '@/components/Toast';
import Login from '@/components/Login';
import Header from '@/components/Header';
import VotersPage from '@/components/VotersPage';
import UsersPage from '@/components/UsersPage';
import Dashboard from '@/components/Dashboard';
import MessageSettings from '@/components/MessageSettings';
import LoadingScreen from '@/components/LoadingScreen';

function AppInner() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState('voters');
  const [previousView, setPreviousView] = useState('voters');
  const [loggingOut, setLoggingOut] = useState(false);
  const toast = useToast();
  const { show } = toast;

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .catch((err) => {
        show(err.message || 'Could not restore your session', 'error', 4000);
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, [show]);

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
      setUser(null);
      toast.info('You have been signed out');
    } catch (err) {
      toast.error(err.message || 'Could not sign out');
    } finally {
      setLoggingOut(false);
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

  function openMessageSettings() {
    setPreviousView(view);
    setView('message-settings');
  }

  function closeMessageSettings() {
    setView(previousView);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        user={user}
        view={view}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onOpenMessageSettings={openMessageSettings}
      />
      <main className="animate-fade-in">
        {view === 'voters' && <VotersPage user={user} />}
        {view === 'dashboard' && <Dashboard user={user} />}
        {view === 'users' && (user.role === 'admin' || user.role === 'sub_admin') && <UsersPage user={user} />}
        {view === 'message-settings' && <MessageSettings user={user} onBack={closeMessageSettings} />}
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
