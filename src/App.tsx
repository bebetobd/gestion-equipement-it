import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import ITEquipmentManager from './ITEquipmentManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        const user: AuthUser = JSON.parse(stored);
        // Verify token is still valid against the server
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
            // Backend unreachable — trust stored user for now
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
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
