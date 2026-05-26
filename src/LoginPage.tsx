import React, { useEffect, useState } from 'react';
import { Monitor, Lock, User, Eye, EyeOff, ShieldAlert, Clock } from 'lucide-react';

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


const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [remaining, setRemaining]   = useState<number | null>(null); // tentatives restantes
  const [blocked, setBlocked]       = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [countdown, setCountdown]   = useState(0); // secondes avant déblocage

  // Décompte si compte bloqué
  useEffect(() => {
    if (!blocked || countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown(s => {
        if (s <= 1) { setBlocked(false); setError(null); setRemaining(null); clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [blocked, countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
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

      if (response.status === 429 || data.blocked) {
        // Compte bloqué par le serveur
        const mins = data.minutesLeft ?? 15;
        setBlocked(true);
        setMinutesLeft(mins);
        setCountdown(mins * 60);
        setError(data.message);
        return;
      }

      if (!response.ok) {
        setRemaining(data.remaining ?? null);
        if (data.remaining === 0) {
          setBlocked(true);
          setMinutesLeft(data.minutesLeft ?? 15);
          setCountdown((data.minutesLeft ?? 15) * 60);
        }
        setError(data.message || 'Identifiant ou mot de passe incorrect.');
        return;
      }

      // Succès
      setError(null);
      setRemaining(null);
      setBlocked(false);
      onLogin(data.user, data.token);
    } catch {
      setError('Impossible de joindre le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4 ring-4 ring-blue-500/30">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Gestion Équipements IT</h1>
          <p className="text-blue-300 mt-1 text-sm">Identifiez-vous pour accéder à l'application</p>
        </div>

        {/* Carte login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Bannière bloquée */}
          {blocked && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Accès temporairement bloqué</p>
                <p className="text-xs text-red-600 mt-0.5">Trop de tentatives échouées. Réessayez dans :</p>
                <p className="text-lg font-mono font-bold text-red-700 mt-1 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Identifiant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Votre identifiant"
                  autoComplete="username"
                  autoFocus
                  disabled={blocked}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  disabled={blocked}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erreur + tentatives restantes */}
            {error && !blocked && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <p>{error}</p>
                {remaining !== null && remaining > 0 && (
                  <p className="mt-1 text-xs font-medium text-red-500">
                    {remaining} tentative{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''} avant blocage temporaire.
                  </p>
                )}
              </div>
            )}

            {/* Bouton */}
            <button type="submit" disabled={loading || blocked}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connexion…</>
              ) : blocked ? (
                <><Clock className="w-4 h-4" /> Accès bloqué</>
              ) : (
                'Se connecter'
              )}
            </button>

          </form>

          {/* Pied de carte */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Accès réservé au personnel autorisé. Toute tentative non autorisée est enregistrée.
          </div>
        </div>

        <p className="text-center text-xs text-blue-400 mt-4 opacity-60">
          {minutesLeft > 0 ? '' : 'Système sécurisé · Authentification requise'}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
