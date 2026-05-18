import React, { useState } from 'react';
import { Monitor, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface LoginUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
}

interface LoginPageProps {
  onLogin: (user: LoginUser, token: string) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrateur', color: 'bg-red-100 text-red-700' },
  technicien: { label: 'Technicien', color: 'bg-blue-100 text-blue-700' },
  user: { label: 'Utilisateur', color: 'bg-gray-100 text-gray-700' }
};

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Erreur de connexion.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez que le backend est démarré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion Équipements IT</h1>
          <p className="text-gray-500 mt-1 text-sm">Connectez-vous pour accéder à l'application</p>
        </div>

        {/* Carte login */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Champ identifiant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identifiant
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Votre identifiant"
                  autoComplete="username"
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            {/* Champ mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Comptes de démonstration */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-3 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Comptes disponibles
            </p>
            <div className="space-y-2">
              {[
                { username: 'admin', password: 'admin2024', role: 'admin', desc: 'Accès complet (CRUD)' },
                { username: 'technicien', password: 'tech2024', role: 'technicien', desc: 'Lecture seule' },
                { username: 'utilisateur', password: 'user2024', role: 'user', desc: 'Lecture seule' }
              ].map((account) => {
                const roleInfo = roleLabels[account.role] ?? { label: account.role, color: 'bg-gray-100 text-gray-700' };
                return (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => {
                      setUsername(account.username);
                      setPassword(account.password);
                      setError(null);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-left"
                  >
                    <div>
                      <span className="text-sm font-mono font-medium text-gray-800">{account.username}</span>
                      <span className="text-xs text-gray-400 ml-2">/ {account.password}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{account.desc}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
