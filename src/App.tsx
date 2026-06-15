import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import ITEquipmentManager from './ITEquipmentManager';
import { apiUrl } from './config';

interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
}

const App = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  const doLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  // ── Intercepteur global 401 : déconnexion automatique si token expiré ──────
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        // Ne pas déconnecter sur la route login elle-même
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/me')) {
          doLogout();
        }
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        const user: AuthUser = JSON.parse(stored);
        fetch(apiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => {
            if (res.ok) {
              setCurrentUser(user);
            } else {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          })
          .catch(() => {
            // Backend injoignable — on fait confiance au token stocké
            setCurrentUser(user);
          })
          .finally(() => setChecking(false));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setChecking(false);
      }
    } else {
      setChecking(false);
    }
  }, []);

  const handleLogin = (user: AuthUser, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {}
    }
    doLogout();
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <ITEquipmentManager currentUser={currentUser} onLogout={handleLogout} />;
};

export default App;
