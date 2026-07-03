import { useEffect, useState } from 'react';
import { Monitor, Lock, User, Eye, EyeOff, ShieldAlert, Clock, KeyRound } from 'lucide-react';
import { apiUrl } from './config';

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

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [remaining, setRemaining]   = useState<number | null>(null);
  const [blocked, setBlocked]       = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [countdown, setCountdown]   = useState(0);

  // ── Changement de mot de passe obligatoire ──────────────────────────────────
  const [mustChangePwd, setMustChangePwd] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<LoginUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [changePwdError, setChangePwdError] = useState<string | null>(null);
  const [changePwdSuccess, setChangePwdSuccess] = useState(false);

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

      if (response.status === 403 && data.accountBlocked) {
        setError(data.message || 'Votre compte a été désactivé. Contactez l\'administrateur.');
        return;
      }

      if (response.status === 429 || data.blocked) {
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

      setError(null);
      setRemaining(null);
      setBlocked(false);

      if (data.mustChangePassword) {
        setPendingToken(data.token);
        setPendingUser(data.user);
        setMustChangePwd(true);
        return;
      }

      onLogin(data.user, data.token);
    } catch {
      setError('Impossible de joindre le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setChangePwdError('Veuillez remplir tous les champs.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePwdError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword.length < 6) {
      setChangePwdError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setChangingPwd(true);
    setChangePwdError(null);
    try {
      const r = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingToken}` },
        body: JSON.stringify({ currentPassword: password, newPassword })
      });
      const data = await r.json();
      if (!r.ok) {
        setChangePwdError(data.message || 'Erreur lors du changement.');
        return;
      }
      setChangePwdSuccess(true);
      setTimeout(() => {
        if (pendingUser && pendingToken) onLogin(pendingUser, pendingToken);
      }, 1200);
    } catch {
      setChangePwdError('Impossible de joindre le serveur.');
    } finally {
      setChangingPwd(false);
    }
  };

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  if (mustChangePwd) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl shadow-lg mb-4 ring-4 ring-amber-500/30">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Changement de mot de passe</h1>
            <p className="text-amber-300 mt-1 text-sm">Première connexion — vous devez changer votre mot de passe</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {changePwdSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm font-semibold text-green-700">Mot de passe modifié avec succès !</p>
                <p className="text-xs text-gray-400 mt-1">Redirection vers l'application…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {changePwdError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{changePwdError}</div>
                )}
                <p className="text-sm text-gray-600">
                  <strong>{pendingUser?.name}</strong>, pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showNewPwd ? 'text' : 'password'} value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showConfirmPwd ? 'text' : 'password'} value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Retaper le mot de passe"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
                    <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button onClick={handleChangePassword} disabled={changingPwd}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                  {changingPwd ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Changement…</>
                  ) : 'Changer le mot de passe'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
