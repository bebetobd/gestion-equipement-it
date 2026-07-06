import { useEffect, useState } from 'react';
import { Monitor, Lock, User, Eye, EyeOff, ShieldAlert, Clock, KeyRound, ChevronRight, Sparkles } from 'lucide-react';
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
        setError(data.message || "Votre compte a été désactivé. Contactez l'administrateur.");
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
      <div className="min-h-screen bling-gradient flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden bling-particles"></div>
        <div className="absolute top-20 left-20 w-2 h-2 bg-amber-400 rounded-full opacity-60" style={{animation:'float 6s ease-in-out infinite'}}></div>
        <div className="absolute top-40 right-32 w-1.5 h-1.5 bg-blue-400 rounded-full opacity-40" style={{animation:'float 8s ease-in-out infinite 1s'}}></div>
        <div className="absolute bottom-32 left-1/3 w-1 h-1 bg-purple-400 rounded-full opacity-50" style={{animation:'float 7s ease-in-out infinite 2s'}}></div>
        <style>{`@keyframes float{0%,100%{transform:translateY(0) scale(1);opacity:0.6}50%{transform:translateY(-20px) scale(1.5);opacity:1}}`}</style>
        <div className="w-full max-w-md relative z-10 animate-slideUp">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl shadow-lg shadow-amber-500/30 mb-4 relative">
              <KeyRound className="w-8 h-8 text-white" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                <span className="text-[8px] text-white font-bold">!</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Changement de mot de passe</h1>
            <p className="text-amber-300/80 mt-1 text-sm">Première connexion — vous devez changer votre mot de passe</p>
          </div>
          <div className="bling-glass rounded-2xl shadow-2xl shadow-black/20 p-8 bling-shine">
            {changePwdSuccess ? (
              <div className="text-center py-6 animate-scaleIn">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 bling-pulse" style={{boxShadow:'0 0 20px rgba(34,197,94,0.3)'}}>
                  <svg className="w-8 h-8 text-green-600 bling-check" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm font-bold text-green-700">Mot de passe modifié !</p>
                <p className="text-xs text-gray-400 mt-1">Redirection…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {changePwdError && (
                  <div className="rounded-xl bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700 flex items-center gap-2 animate-slideDown">
                    <ShieldAlert className="w-4 h-4 shrink-0" /> {changePwdError}
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  <strong>{pendingUser?.name}</strong>, pour des raisons de sécurité, vous devez définir un nouveau mot de passe.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showNewPwd ? 'text' : 'password'} value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="w-full pl-11 pr-11 py-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 outline-none transition-all bling-focus" />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Confirmer</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showConfirmPwd ? 'text' : 'password'} value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Retaper le mot de passe"
                      className="w-full pl-11 pr-11 py-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 outline-none transition-all bling-focus" />
                    <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                      {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button onClick={handleChangePassword} disabled={changingPwd}
                  className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/40 flex items-center justify-center gap-2 text-sm bling-bounce">
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
    <div className="min-h-screen bling-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden bling-particles">
        <div className="absolute top-20 left-[15%] w-2 h-2 bg-blue-400 rounded-full opacity-50" style={{animation:'float 6s ease-in-out infinite'}}></div>
        <div className="absolute top-[30%] right-[10%] w-1.5 h-1.5 bg-purple-400 rounded-full opacity-40" style={{animation:'float 8s ease-in-out infinite 1s'}}></div>
        <div className="absolute bottom-[20%] left-[25%] w-1 h-1 bg-cyan-400 rounded-full opacity-60" style={{animation:'float 7s ease-in-out infinite 2s'}}></div>
        <div className="absolute top-[60%] right-[30%] w-2.5 h-2.5 bg-pink-400 rounded-full opacity-30" style={{animation:'float 9s ease-in-out infinite 0.5s'}}></div>
        <div className="absolute bottom-[40%] left-[60%] w-1 h-1 bg-emerald-400 rounded-full opacity-50" style={{animation:'float 6.5s ease-in-out infinite 3s'}}></div>
        <div className="absolute top-[15%] left-[55%] w-1.5 h-1.5 bg-amber-400 rounded-full opacity-40" style={{animation:'float 7.5s ease-in-out infinite 1.5s'}}></div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0) scale(1);opacity:0.6}50%{transform:translateY(-20px) scale(1.5);opacity:1}}`}</style>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / En-tête */}
        <div className="text-center mb-8 animate-slideUp">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30 mb-4 relative bling-pulse">
            <Monitor className="w-8 h-8 text-white" />
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestion Équipements IT</h1>
          <p className="text-blue-300/60 mt-1.5 text-sm">Identifiez-vous pour accéder à l'application</p>
        </div>

        {/* Carte login */}
        <div className="bling-glass rounded-2xl shadow-2xl shadow-black/20 p-8 bling-shine animate-slideUp" style={{animationDelay:'0.1s'}}>

          {/* Bannière bloquée */}
          {blocked && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200/60 p-4 flex items-start gap-3 animate-slideDown">
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Identifiant</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Votre identifiant"
                  autoComplete="username"
                  autoFocus
                  disabled={blocked}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400 bling-focus"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  disabled={blocked}
                  className="w-full pl-11 pr-11 py-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400 bling-focus"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erreur + tentatives restantes */}
            {error && !blocked && (
              <div className="rounded-xl bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700 flex items-start gap-2 animate-slideDown">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>{error}</p>
                  {remaining !== null && remaining > 0 && (
                    <p className="mt-1 text-xs font-medium text-red-500">
                      {remaining} tentative{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''} avant blocage temporaire.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Bouton */}
            <button type="submit" disabled={loading || blocked}
              className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/40 flex items-center justify-center gap-2 text-sm bling-bounce">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connexion…</>
              ) : blocked ? (
                <><Clock className="w-4 h-4" /> Accès bloqué</>
              ) : (
                <>Se connecter <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Pied de carte */}
          <div className="mt-6 pt-4 border-t border-white/20 flex items-center gap-2 text-xs text-gray-400">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Accès réservé au personnel autorisé. Toute tentative non autorisée est enregistrée.
          </div>
        </div>

        <p className="text-center text-xs text-blue-300/40 mt-4">
          {minutesLeft > 0 ? '' : 'Système sécurisé · Authentification requise'}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
