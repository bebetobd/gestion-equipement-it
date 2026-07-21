import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { sendMail, sendMonthlyReport } from './mailer.js';
const execAsync = promisify(exec);
import { query, rowToEquipment, rowToMaintenance, logEquipmentEvent, getEquipmentHistory, getEventsByDateRange, getEventsByDepartment, addDocument, getDocuments, getDocumentData, deleteDocument, getMaintenance, createMaintenance, updateMaintenance, deleteMaintenance, appendMaintenanceNote, getTransferEvents, getSites, createSite, updateSite, deleteSite, queryActivityLog, deleteSession, getChatMessages, sendChatMessage, markChatRead, getChatUnread, createChatGroup, getUserGroups, getVisits, createVisit, updateVisit, deleteVisit, updateSessionLastSeen, getSuppliers, createSupplier, updateSupplier, deleteSupplier, initDB, getWorkLogs, createWorkLog, updateWorkLog, deleteWorkLog, getWorkLogReport } from './db.js';
import {
  authenticate,
  requireAdmin,
  requirePermission,
  handleError,
  asyncHandler,
  requestLogger
} from './middleware.js';
import {
  logActivity,
  getClientIp,
  activeSessions,
  tokenToUserId,
  getActivityLog,
  getActiveSessions,
  createSession,
  clearUserSessions
} from './monitoring.js';
import {
  validateUser,
  validateEquipment,
  validateSite,
  validateLicense,
  validateContract,
  validatePurchase,
  validateRma,
  validateSupplier,
  validators
} from './validation.js';

export const app = express();

await initDB();

// ─── CORS restreint ────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://gestion-equipement-it.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman / server-to-server
    if (allowedOrigins.includes(origin) || /^https:\/\/gestion-equipement-[\w-]+\.vercel\.app$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error('CORS: Origine non autorisée'));
  },
  credentials: true,
}));

// ─── Sécurité (Helmet) ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour les tiles Leaflet et les scripts inline de l'API portal
  crossOriginEmbedderPolicy: false,
}));

// ─── Rate limiting global ───────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes. Veuillez réessayer plus tard.' },
});
app.use('/api', apiLimiter);

// ─── Rate limiting login ───────────────────────────────────────────────────────
const loginAttempts = new Map(); // IP → { count, blockedUntil }
const MAX_ATTEMPTS   = 5;
const BLOCK_MS       = 15 * 60 * 1000; // 15 minutes

// Nettoyer les entrées expirées toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (entry.blockedUntil && now >= entry.blockedUntil) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function getRateLimit(ip) {
  const now   = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { blocked: false, remaining: MAX_ATTEMPTS };
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { blocked: true, minutesLeft: Math.ceil((entry.blockedUntil - now) / 60000) };
  }
  if (entry.blockedUntil && now >= entry.blockedUntil) {
    loginAttempts.delete(ip);
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }
  return { blocked: false, remaining: MAX_ATTEMPTS - entry.count };
}

function recordFailedLogin(ip) {
  const entry = loginAttempts.get(ip) ?? { count: 0, blockedUntil: null };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) entry.blockedUntil = Date.now() + BLOCK_MS;
  loginAttempts.set(ip, entry);
  return entry;
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// ─── API Portal (page HTML d'authentification) ────────────────────────────────

// Simple health check (always works, no DB needed)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get(['/api', '/api/'], (req, res) => {
  // If the client explicitly wants JSON, return a brief info object
  if (req.headers.accept?.includes('application/json')) {
    return res.json({ name: 'Gestion Équipements IT — API', version: '1.0', auth: '/api/auth/login' });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>API · Gestion Équipements IT</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;
       background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#312e81 100%);
       display:flex;align-items:center;justify-content:center;padding:1rem;color:#f1f5f9}
  .card{background:#fff;border-radius:1.25rem;box-shadow:0 25px 50px rgba(0,0,0,.4);
        width:100%;max-width:520px;overflow:hidden}
  .header{background:linear-gradient(135deg,#1e40af,#4338ca);padding:1.5rem 2rem;
          display:flex;align-items:center;gap:.875rem}
  .icon{width:2.75rem;height:2.75rem;background:rgba(255,255,255,.15);border-radius:.75rem;
        display:flex;align-items:center;justify-content:center;font-size:1.375rem;flex-shrink:0}
  .header h1{font-size:1.125rem;font-weight:700;color:#fff}
  .header p{font-size:.75rem;color:#bfdbfe;margin-top:.1rem}
  .body{padding:1.75rem 2rem}
  label{display:block;font-size:.8125rem;font-weight:600;color:#374151;margin-bottom:.375rem}
  .input-wrap{position:relative;margin-bottom:1rem}
  .input-wrap svg{position:absolute;left:.75rem;top:50%;transform:translateY(-50%);
                  width:1rem;height:1rem;color:#9ca3af;pointer-events:none}
  input{width:100%;padding:.625rem .875rem .625rem 2.375rem;border:1.5px solid #d1d5db;
        border-radius:.625rem;font-size:.875rem;outline:none;transition:border .15s,box-shadow .15s;color:#111}
  input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
  .eye{position:absolute;right:.75rem;top:50%;transform:translateY(-50%);
       background:none;border:none;cursor:pointer;color:#9ca3af;padding:.125rem}
  .btn{width:100%;padding:.75rem;background:#2563eb;color:#fff;border:none;
       border-radius:.625rem;font-size:.9375rem;font-weight:600;cursor:pointer;
       transition:background .15s;display:flex;align-items:center;justify-content:center;gap:.5rem}
  .btn:hover:not(:disabled){background:#1d4ed8}
  .btn:disabled{background:#9ca3af;cursor:not-allowed}
  .error{background:#fef2f2;border:1px solid #fecaca;border-radius:.625rem;
         padding:.75rem 1rem;font-size:.8125rem;color:#b91c1c;margin-bottom:1rem}
  .success{display:none;margin-top:1.25rem}
  .success.show{display:block}
  .token-box{background:#0f172a;border-radius:.75rem;padding:1rem;margin-bottom:1rem;
             font-family:'Courier New',monospace;font-size:.6875rem;color:#34d399;
             word-break:break-all;line-height:1.6;position:relative}
  .copy-btn{position:absolute;top:.5rem;right:.5rem;background:#1e3a5f;border:none;
            border-radius:.375rem;color:#93c5fd;font-size:.6875rem;padding:.25rem .625rem;
            cursor:pointer;transition:background .15s}
  .copy-btn:hover{background:#1e40af}
  .user-info{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:.625rem;
             padding:.875rem 1rem;margin-bottom:1rem;font-size:.8125rem}
  .user-info strong{color:#166534;font-size:.875rem;display:block;margin-bottom:.25rem}
  .user-info span{color:#15803d}
  .badge{display:inline-flex;align-items:center;background:#dbeafe;color:#1d4ed8;
         border-radius:999px;padding:.125rem .625rem;font-size:.6875rem;font-weight:600;margin:.125rem}
  .endpoints{margin-top:1rem}
  .endpoints h3{font-size:.8125rem;font-weight:700;color:#6b7280;text-transform:uppercase;
                letter-spacing:.05em;margin-bottom:.625rem}
  .ep{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:.5rem;
      background:#f8fafc;margin-bottom:.375rem;font-size:.75rem}
  .ep .method{font-family:monospace;font-weight:700;min-width:2.75rem;font-size:.6875rem}
  .method.get{color:#059669}.method.post{color:#d97706}.method.put{color:#7c3aed}
  .method.patch{color:#0284c7}.method.delete{color:#dc2626}
  .ep .path{font-family:'Courier New',monospace;color:#374151;flex:1}
  .ep .desc{color:#6b7280;font-size:.6875rem}
  .open-app{display:block;text-align:center;margin-top:1.25rem;padding:.625rem;
            background:#eff6ff;border:1px solid #bfdbfe;border-radius:.625rem;
            color:#1d4ed8;font-size:.8125rem;font-weight:600;text-decoration:none;
            transition:background .15s}
  .open-app:hover{background:#dbeafe}
  .footer{padding:.875rem 2rem;border-top:1px solid #f1f5f9;
          font-size:.6875rem;color:#9ca3af;display:flex;justify-content:space-between;align-items:center}
  .spin{width:1rem;height:1rem;border:2px solid rgba(255,255,255,.3);
        border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}
  .copied{color:#10b981!important;font-weight:700}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="icon">🖥️</div>
    <div>
      <h1>Gestion Équipements IT</h1>
      <p>Portail d'accès à l'API REST</p>
    </div>
  </div>
  <div class="body">
    <div id="loginSection">
      <div id="errMsg" class="error" style="display:none"></div>
      <div class="input-wrap">
        <label for="usr">Identifiant</label>
        <div style="position:relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <input id="usr" type="text" placeholder="Votre identifiant" autocomplete="username" />
        </div>
      </div>
      <div class="input-wrap">
        <label for="pwd">Mot de passe</label>
        <div style="position:relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input id="pwd" type="password" placeholder="Votre mot de passe" autocomplete="current-password" />
          <button class="eye" id="eyeBtn" onclick="togglePwd()" tabindex="-1">
            <svg id="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:1rem;height:1rem"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <button class="btn" id="loginBtn" onclick="doLogin()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:1rem;height:1rem"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Se connecter
      </button>
    </div>
    <div class="success" id="successSection">
      <div class="user-info" id="userInfo"></div>
      <div class="token-box" id="tokenBox">
        <button class="copy-btn" id="copyBtn" onclick="copyToken()">Copier</button>
        <span id="tokenText"></span>
      </div>
      <div class="endpoints">
        <h3>Endpoints disponibles</h3>
        <div class="ep"><span class="method get">GET</span><span class="path">/api/health</span><span class="desc">Statut du serveur</span></div>
        <div class="ep"><span class="method post">POST</span><span class="path">/api/auth/login</span><span class="desc">Authentification</span></div>
        <div class="ep"><span class="method get">GET</span><span class="path">/api/auth/me</span><span class="desc">Profil utilisateur</span></div>
        <div class="ep"><span class="method get">GET</span><span class="path">/api/equipments</span><span class="desc">Liste des équipements</span></div>
        <div class="ep"><span class="method get">GET</span><span class="path">/api/sites</span><span class="desc">Liste des sites</span></div>
        <div class="ep"><span class="method get">GET</span><span class="path">/api/maintenance</span><span class="desc">Fiches de maintenance</span></div>
        <div class="ep"><span class="method get">GET</span><span class="path">/api/visits</span><span class="desc">Visites planifiées</span></div>
        <div class="ep"><span class="method get">GET</span><span class="path">/api/users</span><span class="desc">Utilisateurs (admin)</span></div>
      </div>
      <a class="open-app" href="/">← Ouvrir l'application</a>
      <button class="btn" onclick="doLogout()" style="margin-top:.75rem;background:#dc2626">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:1rem;height:1rem"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Se déconnecter
      </button>
    </div>
  </div>
  <div class="footer">
    <span>API v1.0 · Sécurisée JWT</span>
    <span id="healthStatus">⬤ Vérification…</span>
  </div>
</div>

<script>
  const BASE = '';
  let currentToken = null;

  async function checkHealth() {
    try {
      const r = await fetch(BASE + '/api/health');
      const d = await r.json();
      document.getElementById('healthStatus').textContent = d.status === 'ok' ? '⬤ En ligne' : '⬤ Dégradé';
      document.getElementById('healthStatus').style.color = d.status === 'ok' ? '#10b981' : '#f59e0b';
    } catch {
      document.getElementById('healthStatus').textContent = '⬤ Hors ligne';
      document.getElementById('healthStatus').style.color = '#ef4444';
    }
  }

  function togglePwd() {
    const p = document.getElementById('pwd');
    p.type = p.type === 'password' ? 'text' : 'password';
  }

  function showError(msg) {
    const el = document.getElementById('errMsg');
    el.textContent = msg;
    el.style.display = 'block';
  }
  function hideError() { document.getElementById('errMsg').style.display = 'none'; }

  async function doLogin() {
    const u = document.getElementById('usr').value.trim();
    const p = document.getElementById('pwd').value;
    if (!u || !p) { showError('Veuillez remplir tous les champs.'); return; }
    hideError();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin"></div> Connexion…';
    try {
      const r = await fetch(BASE + '/api/auth/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({username:u, password:p})
      });
      const d = await r.json();
      if (!r.ok) { showError(d.message || 'Identifiants incorrects.'); return; }
      currentToken = d.token;
      document.getElementById('tokenText').textContent = d.token;
      const perms = (d.user.permissions || []).map(p => '<span class="badge">'+p+'</span>').join('');
      document.getElementById('userInfo').innerHTML =
        '<strong>✓ Connecté en tant que ' + d.user.name + '</strong>' +
        '<span>Rôle : <b>' + d.user.role + '</b> &nbsp;|&nbsp; Permissions : ' + (perms || '<em>aucune</em>') + '</span>';
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('successSection').classList.add('show');
    } catch (err) { console.error('Login API error:', err?.message); showError('Impossible de joindre le serveur.'); }
    finally { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:1rem;height:1rem"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Se connecter'; }
  }

  function copyToken() {
    navigator.clipboard.writeText(currentToken || '').then(() => {
      const b = document.getElementById('copyBtn');
      b.textContent = '✓ Copié !';
      b.classList.add('copied');
      setTimeout(() => { b.textContent = 'Copier'; b.classList.remove('copied'); }, 2000);
    });
  }

  async function doLogout() {
    if (currentToken) {
      await fetch(BASE + '/api/auth/logout', {method:'POST', headers:{Authorization:'Bearer '+currentToken}}).catch(()=>{});
    }
    currentToken = null;
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('successSection').classList.remove('show');
    document.getElementById('usr').value = '';
    document.getElementById('pwd').value = '';
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const ls = document.getElementById('loginSection');
      if (ls.style.display !== 'none') doLogin();
    }
  });

  checkHealth();
</script>
</body>
</html>`);
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/api/health', asyncHandler(async (req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
}));

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const ip = getClientIp(req);

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rate = getRateLimit(ip);
  if (rate.blocked) {
    return res.status(429).json({
      message: `Trop de tentatives. Réessayez dans ${rate.minutesLeft} minute(s).`,
      blocked: true,
      minutesLeft: rate.minutesLeft,
    });
  }

  const { username, password } = req.body;

  // Validate inputs
  const usernameVal = validators.username(username);
  if (!usernameVal.valid) {
    return res.status(400).json({ message: usernameVal.error });
  }

  const passwordVal = validators.password(password);
  if (!passwordVal.valid) {
    return res.status(400).json({ message: passwordVal.error });
  }

  try {
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [usernameVal.value]);
    const user = rows[0];

    if (!user) {
      const entry = recordFailedLogin(ip);
      const remaining = Math.max(0, MAX_ATTEMPTS - entry.count);
      return res.status(401).json({
        message: 'Identifiant ou mot de passe incorrect.',
        remaining,
        blocked: entry.blockedUntil != null,
      });
    }

    if (user.blocked) {
      return res.status(403).json({
        message: 'Votre compte a été désactivé. Contactez l\'administrateur.',
        accountBlocked: true,
      });
    }

    const valid = await bcrypt.compare(passwordVal.value, user.password);
    if (!valid) {
      const entry = recordFailedLogin(ip);
      const remaining = Math.max(0, MAX_ATTEMPTS - entry.count);
      return res.status(401).json({
        message: 'Identifiant ou mot de passe incorrect.',
        remaining,
        blocked: entry.blockedUntil != null,
      });
    }

    // Connexion réussie → réinitialiser le compteur
    loginAttempts.delete(ip);

    const permissions = user.permissions ?? [];
    const userModules = user.modules ?? [];
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';

    const allowedSiteIds = user.allowed_site_ids ?? [];
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, permissions, allowedSiteIds, modules: userModules },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    const now = new Date().toISOString();

    // Clear old tokens
    for (const [t, uid] of tokenToUserId.entries()) {
      if (uid === user.id) tokenToUserId.delete(t);
    }

    // Create session
    createSession({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions,
      loginAt: now,
      lastSeen: now,
      ip
    });

    tokenToUserId.set(token, user.id);
    logActivity(user.id, user.username, user.name, 'Connexion', `Connexion depuis ${ip}`, ip);

    res.json({
      token,
      mustChangePassword: user.must_change_password ?? false,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions,
        allowedSiteIds,
        modules: userModules,
        mustChangePassword: user.must_change_password ?? false,
      }
    });
  } catch (err) {
    handleError(err, res, 'Erreur serveur lors de la connexion.');
  }
}));

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json(req.user);
});

app.post('/api/auth/logout', authenticate, asyncHandler(async (req, res) => {
  const ip = getClientIp(req);
  logActivity(req.user.id, req.user.username, req.user.name, 'Déconnexion', 'Déconnexion volontaire', ip);
  activeSessions.delete(req.user.id);
  tokenToUserId.delete(req.token);
  await deleteSession(req.user.id);
  res.status(204).send();
}));

app.post('/api/auth/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Les deux mots de passe sont requis.' });
  }

  const passwordVal = validators.password(newPassword);
  if (!passwordVal.valid) {
    return res.status(400).json({ message: passwordVal.error });
  }

  const { rows } = await query('SELECT password FROM users WHERE id=$1', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  const valid = await bcrypt.compare(currentPassword, rows[0].password);
  if (!valid) return res.status(400).json({ message: 'Mot de passe actuel incorrect.' });

  const hashed = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password=$1, must_change_password=FALSE WHERE id=$2', [hashed, req.user.id]);

  logActivity(req.user.id, req.user.username, req.user.name, 'Changement mot de passe', 'Mot de passe modifié', getClientIp(req));
  res.json({ message: 'Mot de passe modifié avec succès.' });
}));

// ─── Admin monitoring routes ──────────────────────────────────────────────────

app.get('/api/admin/sessions', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await getActiveSessions());
}));

app.get('/api/admin/activities', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const entries = await queryActivityLog({ userId, limit });
  res.json(entries);
}));

app.get('/api/admin/activity-log', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { username, dateFrom, dateTo, action, limit } = req.query;
  const entries = await queryActivityLog({
    username: username || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    action: action || null,
    limit: limit ? Number(limit) : 200
  });
  res.json(entries);
}));


// ─── User routes (admin only) ─────────────────────────────────────────────────

app.get('/api/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, username, name, role, permissions, allowed_site_ids, blocked FROM users ORDER BY id'
    );
    res.json(rows.map(r => ({ ...r, allowedSiteIds: r.allowed_site_ids ?? [], blocked: r.blocked ?? false })));
  } catch (err) {
    handleError(err, res, 'Erreur lors de la récupération des utilisateurs.');
  }
}));

app.post('/api/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  // Validate input
  const validation = validateUser(req.body, true);
  if (!validation.valid) {
    return res.status(400).json({
      message: 'Validation error',
      errors: validation.errors
    });
  }

  try {
    const { username, name, role, password, permissions, allowedSiteIds, modules } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const safePerms = Array.isArray(permissions) ? permissions : ['lecture'];
    const safeSites = Array.isArray(allowedSiteIds) ? allowedSiteIds.map(Number).filter(Boolean) : [];
    const safeModules = Array.isArray(modules) ? modules : [];

    const { rows } = await query(
      `INSERT INTO users (username, name, role, password, permissions, allowed_site_ids, modules, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
       RETURNING id, username, name, role, permissions, allowed_site_ids, modules`,
      [username.trim(), name.trim(), role, hashed, safePerms, safeSites, safeModules]
    );

    logActivity(
      req.user.id,
      req.user.username,
      req.user.name,
      'Création utilisateur',
      `Compte "${username}" (${role}) créé`,
      getClientIp(req)
    );

    res.status(201).json({ ...rows[0], allowedSiteIds: rows[0].allowed_site_ids ?? [], modules: rows[0].modules ?? [] });
  } catch (err) {
    handleError(err, res, 'Erreur lors de la création.');
  }
}));

app.put('/api/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  const { username, name, role, password, permissions } = req.body;

  // Validate if fields are provided
  if (username) {
    const usernameVal = validators.username(username);
    if (!usernameVal.valid) {
      return res.status(400).json({ message: `username: ${usernameVal.error}` });
    }
  }

  if (name) {
    const nameVal = validators.name(name);
    if (!nameVal.valid) {
      return res.status(400).json({ message: `name: ${nameVal.error}` });
    }
  }

  if (role) {
    const roleVal = validators.role(role);
    if (!roleVal.valid) {
      return res.status(400).json({ message: `role: ${roleVal.error}` });
    }
  }

  if (password) {
    const passwordVal = validators.password(password);
    if (!passwordVal.valid) {
      return res.status(400).json({ message: `password: ${passwordVal.error}` });
    }
  }

  if (permissions) {
    const permsVal = validators.permissions(permissions);
    if (!permsVal.valid) {
      return res.status(400).json({ message: `permissions: ${permsVal.error}` });
    }
  }

  const { modules } = req.body;
  if (modules) {
    const modsVal = validators.modules(modules);
    if (!modsVal.valid) {
      return res.status(400).json({ message: `modules: ${modsVal.error}` });
    }
  }

  try {
    let updateFields = [];
    let params = [];
    let paramCount = 1;

    if (username) {
      updateFields.push(`username = $${paramCount++}`);
      params.push(username.trim());
    }
    if (name) {
      updateFields.push(`name = $${paramCount++}`);
      params.push(name.trim());
    }
    if (role) {
      updateFields.push(`role = $${paramCount++}`);
      params.push(role);
    }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updateFields.push(`password = $${paramCount++}`);
      params.push(hashed);
    }
    if (permissions) {
      updateFields.push(`permissions = $${paramCount++}`);
      params.push(permissions);
    }
    if (modules) {
      updateFields.push(`modules = $${paramCount++}`);
      params.push(modules);
    }
    const { allowedSiteIds } = req.body;
    if (allowedSiteIds !== undefined) {
      const safeSites = Array.isArray(allowedSiteIds) ? allowedSiteIds.map(Number).filter(Boolean) : [];
      updateFields.push(`allowed_site_ids = $${paramCount++}`);
      params.push(safeSites);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Audit : récupérer l'état avant modification
    const { rows: before } = await query('SELECT role, permissions, allowed_site_ids, modules, blocked FROM users WHERE id=$1', [id]);
    const oldState = before[0] || {};

    params.push(id);
    const updateSQL = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, username, name, role, permissions, allowed_site_ids, modules`;

    const { rows } = await query(updateSQL, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // Audit : construire le détail des changements
    const changes = [];
    if (role && role !== oldState.role) changes.push(`role: ${oldState.role||'?'} → ${role}`);
    if (permissions) {
      const oldPerms = (oldState.permissions || []).join(', ');
      const newPerms = permissions.join(', ');
      if (oldPerms !== newPerms) changes.push(`permissions: [${oldPerms}] → [${newPerms}]`);
    }
    if (modules) {
      const oldMods = (oldState.modules || []).join(', ');
      const newMods = modules.join(', ');
      if (oldMods !== newMods) changes.push(`modules: [${oldMods}] → [${newMods}]`);
    }
    if (allowedSiteIds !== undefined) {
      const oldSites = (oldState.allowed_site_ids || []).join(', ');
      const newSites = allowedSiteIds.join(', ');
      if (oldSites !== newSites) changes.push(`sites: [${oldSites}] → [${newSites}]`);
    }

    logActivity(
      req.user.id,
      req.user.username,
      req.user.name,
      'Modification utilisateur',
      `Compte "${rows[0].username}" modifié` + (changes.length ? ' — ' + changes.join('; ') : ''),
      getClientIp(req)
    );

    res.json({ ...rows[0], allowedSiteIds: rows[0].allowed_site_ids ?? [], modules: rows[0].modules ?? [] });
  } catch (err) {
    handleError(err, res, 'Erreur lors de la modification.');
  }
}));

app.delete('/api/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  if (req.user.id === id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }

  try {
    const { rows } = await query(
      'DELETE FROM users WHERE id = $1 RETURNING username',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // Clear user sessions
    clearUserSessions(id);

    logActivity(
      req.user.id,
      req.user.username,
      req.user.name,
      'Suppression utilisateur',
      `Compte "${rows[0].username}" supprimé`,
      getClientIp(req)
    );

    res.status(204).send();
  } catch (err) {
    handleError(err, res, 'Erreur lors de la suppression.');
  }
}));


// Toggle block/unblock a user account (admin only)
app.patch('/api/users/:id/block', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  if (req.user.id === id) return res.status(400).json({ message: 'Vous ne pouvez pas bloquer votre propre compte.' });

  const { blocked } = req.body;
  if (typeof blocked !== 'boolean') return res.status(400).json({ message: 'Champ "blocked" (boolean) requis.' });

  const { rows } = await query(
    'UPDATE users SET blocked = $1 WHERE id = $2 RETURNING id, username, name, blocked',
    [blocked, id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  if (blocked) clearUserSessions(id);

  logActivity(
    req.user.id, req.user.username, req.user.name,
    blocked ? 'Blocage compte' : 'Déblocage compte',
    `Compte "${rows[0].username}" ${blocked ? 'bloqué' : 'débloqué'}`,
    getClientIp(req)
  );

  res.json({ id: rows[0].id, username: rows[0].username, name: rows[0].name, blocked: rows[0].blocked });
}));

// ─── Equipment routes ─────────────────────────────────────────────────────────

app.get('/api/equipments', authenticate, requirePermission('lecture'), asyncHandler(async (req, res) => {
  try {
    const allowedSiteIds = req.user.allowedSiteIds ?? [];
    let rows;
    if (req.user.role !== 'admin' && allowedSiteIds.length > 0) {
      ({ rows } = await query(
        'SELECT * FROM equipments WHERE site_id = ANY($1::integer[]) AND deleted_at IS NULL ORDER BY id',
        [allowedSiteIds]
      ));
    } else {
      ({ rows } = await query('SELECT * FROM equipments WHERE deleted_at IS NULL ORDER BY id'));
    }
    res.json(rows.map(rowToEquipment));
  } catch (err) {
    handleError(err, res, 'Erreur lors de la récupération des équipements.');
  }
}));

app.get('/api/equipments/export', authenticate, requirePermission('lecture'), asyncHandler(async (req, res) => {
  try {
    const allowedSiteIds = req.user.allowedSiteIds ?? [];
    let rows;
    if (req.user.role !== 'admin' && allowedSiteIds.length > 0) {
      ({ rows } = await query(
        'SELECT * FROM equipments WHERE site_id = ANY($1::integer[]) AND deleted_at IS NULL ORDER BY id',
        [allowedSiteIds]
      ));
    } else {
      ({ rows } = await query('SELECT * FROM equipments WHERE deleted_at IS NULL ORDER BY id'));
    }
    const equipments = rows.map(rowToEquipment);

    logActivity(
      req.user.id,
      req.user.username,
      req.user.name,
      'Export CSV',
      `Export de ${equipments.length} équipements`,
      getClientIp(req)
    );

    const header = [
      'id', 'name', 'type', 'brand', 'model', 'serialNumber', 'ipAddress',
      'location', 'department', 'status', 'purchaseDate', 'warranty',
      'lastMaintenance', 'visited', 'technicianName', 'visitDate', 'interventionDetails'
    ];

    const csvRows = equipments.map((e) =>
      header.map((f) => JSON.stringify(e[f] ?? '')).join(',')
    );

    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="equipements.csv"');
    res.send([header.join(','), ...csvRows].join('\n'));
  } catch (err) {
    handleError(err, res, 'Erreur lors de l\'export.');
  }
}));

// ─── Sites ────────────────────────────────────────────────────────────────────

app.get('/api/sites', authenticate, asyncHandler(async (req, res) => {
  res.json(await getSites());
}));

app.post('/api/sites', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const validation = validateSite(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const { name, city, country, address, description, latitude, longitude, email, phone } = req.body;
  const site = await createSite({ name: name.trim(), city, country, address, description, latitude, longitude, email, phone });
  logActivity(req.user.id, req.user.username, req.user.name, 'Création site', `Site "${name}" créé`, getClientIp(req));
  res.status(201).json(site);
}));

app.put('/api/sites/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid site ID' });
  const validation = validateSite(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const { name, city, country, address, description, latitude, longitude, email, phone } = req.body;
  const site = await updateSite(id, { name: name.trim(), city, country, address, description, latitude, longitude, email, phone });
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name, 'Modification site', `Site "${name}" modifié`, getClientIp(req));
  res.json(site);
}));

app.delete('/api/sites/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid site ID' });
  try {
    const { rows } = await query('UPDATE sites SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Site introuvable.' });
    logActivity(req.user.id, req.user.username, req.user.name, 'Suppression site', `Site #${id} supprimé`, getClientIp(req));
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}));
app.get('/api/sites/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM sites WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
}));
app.post('/api/sites/:id/restore', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE sites SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Site introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/sites/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM sites WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

// ─── Equipments ───────────────────────────────────────────────────────────────

app.post('/api/equipments', authenticate, requirePermission('ecriture'), asyncHandler(async (req, res) => {
  // Validate equipment data
  const validation = validateEquipment(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      message: 'Validation error',
      errors: validation.errors
    });
  }

  const e = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO equipments
         (reference, name, type, brand, model, serial_number, ip_address, location, department,
          status, purchase_date, warranty, last_maintenance, visited,
          technician_name, visit_date, intervention_details, site_id, quantity, min_quantity, supplier_id, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        e.reference || '', e.name, e.type, e.brand || '', e.model || '', e.serialNumber || '',
        e.ipAddress || '', e.location || '', e.department || '', e.status || 'actif',
        e.purchaseDate || '', e.warranty || '', e.lastMaintenance || '',
        e.visited || false, e.technicianName || '', e.visitDate || '',
        e.interventionDetails || '', e.siteId || null,
        Math.max(1, parseInt(e.quantity) || 1),
        Math.max(0, parseInt(e.minQuantity) || 0),
        e.supplierId || null, e.comment || ''
      ]
    );

    const created = rowToEquipment(rows[0]);
    const ip = getClientIp(req);
    logActivity(req.user.id, req.user.username, req.user.name, 'Ajout équipement', `"${created.name}" (${created.brand || ''} ${created.model || ''} — ${created.type}) ajouté, statut: ${created.status}`, ip);
    logEquipmentEvent({
      equipmentId: created.id, equipmentName: created.name, equipmentType: created.type,
      department: created.department, action: 'Création',
      details: `Équipement "${created.name}" (${created.brand} ${created.model}) ajouté au parc. Statut: ${created.status}`,
      technician: created.technicianName,
      userId: req.user.id, username: req.user.username, userName: req.user.name, ip
    });

    res.status(201).json(created);
  } catch (err) {
    handleError(err, res, 'Erreur lors de la création.');
  }
}));

app.put('/api/equipments/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid equipment ID' });
  }

  // Validate equipment data
  const validation = validateEquipment(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      message: 'Validation error',
      errors: validation.errors
    });
  }

  const e = req.body;
  try {
    // Read old state to compute diff
    const { rows: oldRows } = await query('SELECT * FROM equipments WHERE id=$1', [id]);
    const old = oldRows[0] ? rowToEquipment(oldRows[0]) : null;

    const { rows } = await query(
      `UPDATE equipments SET
         reference=$1, name=$2, type=$3, brand=$4, model=$5, serial_number=$6, ip_address=$7,
         location=$8, department=$9, status=$10, purchase_date=$11, warranty=$12,
         last_maintenance=$13, visited=$14, technician_name=$15,
         visit_date=$16, intervention_details=$17, site_id=$18, quantity=$19, min_quantity=$20, supplier_id=$21, comment=$22
       WHERE id=$23
       RETURNING *`,
      [
        e.reference || '', e.name, e.type, e.brand || '', e.model || '', e.serialNumber || '',
        e.ipAddress || '', e.location || '', e.department || '', e.status || 'actif',
        e.purchaseDate || '', e.warranty || '', e.lastMaintenance || '',
        e.visited || false, e.technicianName || '', e.visitDate || '',
        e.interventionDetails || '', e.siteId || null,
        Math.max(1, parseInt(e.quantity) || 1),
        Math.max(0, parseInt(e.minQuantity) || 0),
        e.supplierId || null, e.comment || '',
        id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Équipement introuvable' });
    }

    const updated = rowToEquipment(rows[0]);
    const ip = getClientIp(req);

    // Compute field-level changes
    const TRACKED = ['name','type','brand','model','serialNumber','ipAddress','location','department','status','purchaseDate','warranty','lastMaintenance','visited','technicianName','visitDate','interventionDetails','supplierId'];
    const changes = old ? TRACKED.filter(f => String(old[f]) !== String(updated[f])).map(f => ({ field: f, from: old[f], to: updated[f] })) : [];

    // Determine action label
    const isIntervention = old && !old.visited && updated.visited && updated.technicianName;
    const actionLabel = isIntervention ? 'Intervention' : 'Modification';
    const FIELD_LABELS = {
      name: 'Nom', type: 'Type', brand: 'Marque', model: 'Modèle', serialNumber: 'N° série',
      ipAddress: 'IP', location: 'Localisation', department: 'Département', status: 'Statut',
      purchaseDate: 'Achat', warranty: 'Garantie', lastMaintenance: 'Dernière maint.',
      visited: 'Visité', technicianName: 'Technicien', visitDate: 'Date visite',
      interventionDetails: 'Détails intervention'
    };
    const changesSummary = changes.map(c => `${FIELD_LABELS[c.field] || c.field}: ${c.from} → ${c.to}`).join(' | ');
    const details = isIntervention
      ? `Intervention de "${updated.technicianName}" le ${updated.visitDate || '–'}. ${updated.interventionDetails || ''}`
      : `"${updated.name}" — ${changesSummary || 'aucun champ modifié'}`;

    logActivity(req.user.id, req.user.username, req.user.name, `${actionLabel} équipement`, details, ip);
    logEquipmentEvent({
      equipmentId: updated.id, equipmentName: updated.name, equipmentType: updated.type,
      department: updated.department, action: actionLabel, details, changes,
      technician: updated.technicianName,
      userId: req.user.id, username: req.user.username, userName: req.user.name, ip
    });

    res.json(updated);
  } catch (err) {
    handleError(err, res, 'Erreur lors de la modification.');
  }
}));

app.patch('/api/equipments/:id/warranty', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });
  const { warranty } = req.body;
  if (!warranty || typeof warranty !== 'string') {
    return res.status(400).json({ message: 'Date de garantie invalide.' });
  }
  try {
    const { rows: oldRows } = await query('SELECT * FROM equipments WHERE id=$1', [id]);
    if (oldRows.length === 0) return res.status(404).json({ message: 'Équipement introuvable' });
    const old = rowToEquipment(oldRows[0]);
    const { rows } = await query('UPDATE equipments SET warranty=$1 WHERE id=$2 RETURNING *', [warranty, id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Équipement introuvable' });
    const updated = rowToEquipment(rows[0]);
    const ip = getClientIp(req);
    const changes = [{ field: 'warranty', from: old.warranty, to: updated.warranty }];
    logActivity(req.user.id, req.user.username, req.user.name, 'Renouvellement garantie', `"${updated.name}" — Garantie: ${old.warranty || 'aucune'} → ${updated.warranty}`, ip);
    logEquipmentEvent({
      equipmentId: updated.id, equipmentName: updated.name, equipmentType: updated.type,
      department: updated.department, action: 'Renouvellement garantie',
      details: `Garantie prolongée jusqu'au ${new Date(warranty).toLocaleDateString('fr-FR')}`,
      changes, userId: req.user.id, username: req.user.username, userName: req.user.name, ip
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res, 'Erreur lors du renouvellement de garantie.');
  }
}));

app.delete('/api/equipments/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid equipment ID' });
  }

  try {
    const { rows } = await query(
      'UPDATE equipments SET deleted_at = NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING name',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Équipement introuvable ou déjà supprimé' });
    }

    const ip = getClientIp(req);
    logActivity(req.user.id, req.user.username, req.user.name, 'Suppression équipement', `"${rows[0].name}" mis à la corbeille`, ip);
    logEquipmentEvent({
      equipmentId: id, equipmentName: rows[0].name, equipmentType: '', department: '',
      action: 'Suppression', details: `Équipement "${rows[0].name}" mis à la corbeille`,
      userId: req.user.id, username: req.user.username, userName: req.user.name, ip
    });

    res.json({ message: 'Équipement mis à la corbeille' });
  } catch (err) {
    handleError(err, res, 'Erreur lors de la suppression.');
  }
}));

// ─── Corbeille : lister, restaurer, supprimer définitivement ──────────────────
app.get('/api/equipments/deleted', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM equipments WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows.map(rowToEquipment));
}));

app.post('/api/equipments/:id/restore', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide' });
  const { rows } = await query('UPDATE equipments SET deleted_at = NULL WHERE id=$1 AND deleted_at IS NOT NULL RETURNING *', [id]);
  if (!rows[0]) return res.status(404).json({ message: 'Équipement introuvable dans la corbeille' });
  const ip = getClientIp(req);
  logActivity(req.user.id, req.user.username, req.user.name, 'Restauration équipement', `"${rows[0].name}" restauré`, ip);
  res.json(rowToEquipment(rows[0]));
}));

app.delete('/api/equipments/:id/hard', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide' });
  const { rows } = await query('DELETE FROM equipments WHERE id=$1 AND deleted_at IS NOT NULL RETURNING name', [id]);
  if (!rows[0]) return res.status(404).json({ message: 'Équipement introuvable' });
  const ip = getClientIp(req);
  logActivity(req.user.id, req.user.username, req.user.name, 'Suppression définitive', `"${rows[0].name}" supprimé définitivement`, ip);
  res.status(204).send();
}));

// ─── Transfer ────────────────────────────────────────────────────────────────

app.post('/api/equipments/:id/transfer', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });

  const { toLocation, toDepartment, toSiteId, reason, technicianName, notes, transferQty, transferRequester, transferResponsible } = req.body;
  if (!toLocation || !toDepartment) {
    return res.status(400).json({ message: 'Nouvelle localisation et département requis.' });
  }

  const { rows: current } = await query('SELECT * FROM equipments WHERE id=$1', [id]);
  if (!current[0]) return res.status(404).json({ message: 'Équipement introuvable.' });

  const old = rowToEquipment(current[0]);
  const newSiteId = toSiteId !== undefined ? (toSiteId || null) : old.siteId;
  const qty = Math.min(Math.max(1, parseInt(transferQty) || old.quantity), old.quantity);
  const ip = getClientIp(req);

  // Resolve site names
  let fromSiteName = '', toSiteName = '';
  if (old.siteId) {
    const { rows: sr } = await query('SELECT name FROM sites WHERE id=$1', [old.siteId]);
    fromSiteName = sr[0]?.name || `Site #${old.siteId}`;
  }
  if (newSiteId && newSiteId !== old.siteId) {
    const { rows: sr } = await query('SELECT name FROM sites WHERE id=$1', [newSiteId]);
    toSiteName = sr[0]?.name || `Site #${newSiteId}`;
  }

  const siteChanged = newSiteId !== old.siteId;
  const locationChanged = toLocation !== old.location;
  const deptChanged = toDepartment !== old.department;
  const isPartial = qty < old.quantity;

  let updated;
  if (isPartial) {
    // Reduce source quantity
    const { rows: srcRows } = await query(
      'UPDATE equipments SET quantity=$1 WHERE id=$2 RETURNING *',
      [old.quantity - qty, id]
    );
    updated = rowToEquipment(srcRows[0]);
    // Create new record at destination
    await query(
      `INSERT INTO equipments
         (name, type, brand, model, serial_number, ip_address, location, department,
          status, purchase_date, warranty, last_maintenance, visited,
          technician_name, visit_date, intervention_details, site_id, quantity, min_quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        old.name, old.type, old.brand || '', old.model || '', '', // Nouvel actif : pas de serial (ne pas dupliquer)
        old.ipAddress || '', toLocation, toDepartment, old.status,
        old.purchaseDate || '', old.warranty || '', old.lastMaintenance || '',
        old.visited, old.technicianName || '', old.visitDate || '',
        old.interventionDetails || '', newSiteId, qty, old.minQuantity ?? 0
      ]
    );
  } else {
    const { rows } = await query(
      'UPDATE equipments SET location=$1, department=$2, site_id=$3 WHERE id=$4 RETURNING *',
      [toLocation, toDepartment, newSiteId, id]
    );
    updated = rowToEquipment(rows[0]);
  }

  let detailParts = [];
  if (isPartial) detailParts.push(`Quantité: ${qty} sur ${old.quantity}`);
  if (locationChanged || deptChanged)
    detailParts.push(`Bureau: "${old.location}" (${old.department}) → "${toLocation}" (${toDepartment})`);
  if (siteChanged)
    detailParts.push(`Site: "${fromSiteName || 'Aucun'}" → "${toSiteName || 'Aucun'}"`);

  const changes = [];
  if (locationChanged) changes.push({ field: 'location', from: old.location, to: toLocation });
  if (deptChanged) changes.push({ field: 'department', from: old.department, to: toDepartment });
  if (siteChanged) changes.push({ field: 'siteId', from: old.siteId, to: newSiteId, fromName: fromSiteName, toName: toSiteName });

  await logEquipmentEvent({
    equipmentId: id, equipmentName: old.name, equipmentType: old.type,
    department: toDepartment, action: 'Transfert',
    details: `${detailParts.join(' | ')}. Raison: ${reason || 'Non précisée'}${notes ? '. Notes: ' + notes : ''}.`,
    changes,
    technician: technicianName || req.user.name,
    userId: req.user.id, username: req.user.username, userName: req.user.name, ip,
    transferRequester: transferRequester || '',
    transferResponsible: transferResponsible || '',
  });
  logActivity(req.user.id, req.user.username, req.user.name,
    'Transfert équipement', `"${old.name}"${isPartial ? ` (×${qty})` : ''} transféré vers "${toLocation}"${siteChanged ? ` (${toSiteName})` : ''}`, ip);

  res.json(updated);
}));

// ─── Opérations groupées ───────────────────────────────────────────────────────
app.post('/api/equipments/bulk/delete', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Liste d\'IDs requise.' });
  const { rowCount } = await query(`UPDATE equipments SET deleted_at = NOW() WHERE id = ANY($1::integer[]) AND deleted_at IS NULL`, [ids]);
  logActivity(req.user.id, req.user.username, req.user.name, 'Suppression groupée', `${rowCount} équipements supprimés (IDs: ${ids.join(',')})`, getClientIp(req));
  res.json({ deleted: rowCount });
}));

app.post('/api/equipments/bulk/status', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Liste d\'IDs requise.' });
  if (!status) return res.status(400).json({ message: 'Statut requis.' });
  const { rowCount } = await query(`UPDATE equipments SET status = $1 WHERE id = ANY($2::integer[])`, [status, ids]);
  logActivity(req.user.id, req.user.username, req.user.name, 'Statut groupé', `${rowCount} équipements passés en "${status}"`, getClientIp(req));
  res.json({ updated: rowCount });
}));

app.post('/api/equipments/bulk/transfer', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { ids, siteId, siteName } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Liste d\'IDs requise.' });
  if (!siteId) return res.status(400).json({ message: 'Site de destination requis.' });
  const siteLabel = siteName || `#${siteId}`;
  const { rowCount } = await query(`UPDATE equipments SET site_id = $1 WHERE id = ANY($2::integer[])`, [siteId, ids]);
  logActivity(req.user.id, req.user.username, req.user.name, 'Transfert groupé', `${rowCount} équipements transférés vers ${siteLabel}`, getClientIp(req));
  res.json({ transferred: rowCount });
}));

// ─── Documents ────────────────────────────────────────────────────────────────

app.post('/api/equipments/:id/documents', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });

  const { filename, fileType, fileSize, fileData, description } = req.body;
  if (!filename || !fileData) return res.status(400).json({ message: 'filename et fileData requis.' });
  if (fileData.length > 4_200_000) return res.status(400).json({ message: 'Fichier trop volumineux (max 3 Mo).' });

  const doc = await addDocument({
    equipmentId: id, filename, fileType: fileType || '', fileSize: fileSize || 0,
    fileData, description: description || '', uploadedBy: req.user.name
  });
  logActivity(req.user.id, req.user.username, req.user.name,
    'Ajout document', `"${filename}" ajouté à l'équipement #${id}`, getClientIp(req));
  res.status(201).json(doc);
}));

app.get('/api/equipments/:id/documents', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });
  res.json(await getDocuments(id));
}));

app.get('/api/documents/:id/download', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid document ID' });
  const doc = await getDocumentData(id);
  if (!doc) return res.status(404).json({ message: 'Document introuvable.' });
  res.json({ filename: doc.filename, fileType: doc.file_type, fileData: doc.file_data });
}));

app.delete('/api/documents/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid document ID' });
  const deleted = await deleteDocument(id);
  if (!deleted) return res.status(404).json({ message: 'Document introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name,
    'Suppression document', `"${deleted.filename}" supprimé`, getClientIp(req));
  res.status(204).send();
}));

// ─── Maintenance ─────────────────────────────────────────────────────────────

app.get('/api/maintenance', authenticate, asyncHandler(async (req, res) => {
  const { status, equipmentId } = req.query;
  res.json(await getMaintenance({ status, equipmentId: equipmentId ? Number(equipmentId) : null }));
}));

app.post('/api/maintenance', authenticate, asyncHandler(async (req, res) => {
  const { equipmentId, equipmentIds, failureDesc, priority, technician, diagnosis, solution, partsReplaced, status, visitId, siteName, requestType, callerName, callerPhone, callerReport, photos } = req.body;
  if (!failureDesc?.trim()) return res.status(400).json({ message: 'Description de la panne requise.' });

  // Multi-equipment: create one record per equipment
  const eqIds = (equipmentIds && equipmentIds.length > 0) ? equipmentIds : (equipmentId ? [equipmentId] : []);
  const createdRecords = [];

  if (eqIds.length > 0) {
    for (const eqId of eqIds) {
      const record = await createMaintenance({
        equipmentId: eqId, equipmentIds: eqIds,
        failureDesc, diagnosis: diagnosis || '', solution: solution || '',
        partsReplaced: partsReplaced || '', technician: technician || '',
        openedBy: req.user.name, priority: priority || 'normale',
        status: requestType === 'assistance' ? 'en_attente' : (status || 'ouvert'),
        visitId: visitId || null, siteName: siteName || '',
        requestType: requestType || 'maintenance',
        callerName: callerName || '', callerPhone: callerPhone || '', callerReport: callerReport || '',
        photos: photos || [],
      });
      const { rows } = await query('SELECT name, type, department FROM equipments WHERE id=$1', [eqId]);
      if (rows[0]) {
        await query('UPDATE maintenance_records SET equipment_name=$1, equipment_type=$2, department=$3 WHERE id=$4', [rows[0].name, rows[0].type, rows[0].department, record.id]);
        record.equipmentName = rows[0].name;
        record.equipmentType = rows[0].type;
        record.department = rows[0].department;
        await query("UPDATE equipments SET status='maintenance' WHERE id=$1", [eqId]);
        await logEquipmentEvent({
          equipmentId: eqId, equipmentName: rows[0].name, equipmentType: rows[0].type,
          department: rows[0].department, action: 'Maintenance',
          details: `Ticket de maintenance ouvert — Panne: ${failureDesc}`,
          technician: technician || '', userId: req.user.id,
          username: req.user.username, userName: req.user.name, ip: getClientIp(req)
        });
      }
      createdRecords.push(record);
    }
  } else {
    const record = await createMaintenance({
      equipmentId: null, equipmentIds: [],
      failureDesc, diagnosis: diagnosis || '', solution: solution || '',
      partsReplaced: partsReplaced || '', technician: technician || '',
      openedBy: req.user.name, priority: priority || 'normale',
      status: requestType === 'assistance' ? 'en_attente' : (status || 'ouvert'),
      visitId: visitId || null, siteName: siteName || '',
      requestType: requestType || 'maintenance',
      callerName: callerName || '', callerPhone: callerPhone || '', callerReport: callerReport || '',
      photos: photos || [],
    });
    createdRecords.push(record);
  }

  const record = createdRecords[0];

  logActivity(req.user.id, req.user.username, req.user.name,
    requestType === 'assistance' ? 'Demande assistance' : 'Ticket maintenance',
    `${requestType === 'assistance' ? 'Demande d\'assistance' : 'Ticket'} ouvert: ${failureDesc.substring(0, 60)}`, getClientIp(req));

  if (requestType === 'assistance') {
    const { rows: techUsers } = await query("SELECT name, username FROM users WHERE role IN ('admin','technicien') AND blocked = FALSE");
    const notifyEmails = process.env.REPORT_EMAIL ? [process.env.REPORT_EMAIL] : [];
    for (const u of techUsers) {
      const mailRes = await sendMail({
        to: notifyEmails.length ? notifyEmails.join(',') : null,
        subject: `[Assistance] Nouvelle demande de ${req.user.name}`,
        html: `<h2>Nouvelle demande d'assistance</h2>
<p><strong>De :</strong> ${req.user.name} (${req.user.username})</p>
<p><strong>Description :</strong> ${failureDesc}</p>
${record.equipmentName ? `<p><strong>Équipement :</strong> ${record.equipmentName}</p>` : ''}
<p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
<p>Connectez-vous pour prendre en charge cette demande.</p>`
      }).catch(() => {});
    }
  }

  res.status(201).json(record);
}));

app.put('/api/maintenance/:id', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ID' });

  // Block modification of resolved tickets
  const { rows: current } = await query('SELECT status FROM maintenance_records WHERE id=$1', [id]);
  if (!current[0]) return res.status(404).json({ message: 'Ticket introuvable.' });
  if (current[0].status === 'résolu') {
    return res.status(403).json({ message: 'Un ticket résolu ne peut plus être modifié.' });
  }

  const { status, diagnosis, solution, partsReplaced, technician, priority, failureDesc, callerName, callerPhone, callerReport, photos } = req.body;

  const updates = { failureDesc, diagnosis, solution, partsReplaced, technician, priority, callerName, callerPhone, callerReport, photos };
  if (status) {
    updates.status = status;
    if (status === 'en_cours' && req.body.startedAt === undefined) updates.startedAt = new Date().toISOString();
    if (status === 'résolu') {
      updates.closedAt = new Date().toISOString();
      // Get ticket to update equipment status
      const { rows: ticket } = await query('SELECT equipment_id, equipment_name, equipment_type, department FROM maintenance_records WHERE id=$1', [id]);
      if (ticket[0]?.equipment_id) {
        await query("UPDATE equipments SET status='actif', last_maintenance=$1 WHERE id=$2",
          [new Date().toISOString().split('T')[0], ticket[0].equipment_id]);
        await logEquipmentEvent({
          equipmentId: ticket[0].equipment_id, equipmentName: ticket[0].equipment_name,
          equipmentType: ticket[0].equipment_type, department: ticket[0].department,
          action: 'Maintenance', details: `Ticket #${id} résolu — Solution: ${solution || 'Non précisée'}`,
          technician: technician || '', userId: req.user.id,
          username: req.user.username, userName: req.user.name, ip: getClientIp(req)
        });
      }
    }
  }

  const updated = await updateMaintenance(id, updates);
  if (!updated) return res.status(404).json({ message: 'Ticket introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name,
    'MAJ maintenance', `Ticket #${id} mis à jour (${status || 'modification'})`, getClientIp(req));
  res.json(updated);
}));

app.delete('/api/maintenance/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ID' });
  const { rows: cur } = await query('SELECT status FROM maintenance_records WHERE id=$1', [id]);
  if (!cur[0]) return res.status(404).json({ message: 'Ticket introuvable.' });
  if (cur[0].status === 'résolu') return res.status(403).json({ message: 'Un ticket résolu ne peut pas être supprimé.' });
  const deleted = await deleteMaintenance(id);
  if (!deleted) return res.status(404).json({ message: 'Ticket introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name, 'Suppression ticket', `Ticket #${id} supprimé`, getClientIp(req));
  res.status(204).send();
}));
app.get('/api/maintenance/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM maintenance_records WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows.map(row => ({...row, deletedAt: row.deleted_at})));
}));
app.post('/api/maintenance/:id/restore', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE maintenance_records SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Ticket introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/maintenance/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM maintenance_records WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

app.patch('/api/maintenance/:id/note', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ID' });
  const { rows: cur } = await query('SELECT status FROM maintenance_records WHERE id=$1', [id]);
  if (!cur[0]) return res.status(404).json({ message: 'Ticket introuvable.' });
  if (cur[0].status === 'résolu') return res.status(403).json({ message: 'Ticket résolu — ajout d\'informations impossible.' });
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Texte requis.' });
  const date = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const noteEntry = `[${date}] ${req.user.name} :\n${text.trim()}`;
  const updated = await appendMaintenanceNote(id, noteEntry);
  if (!updated) return res.status(404).json({ message: 'Ticket introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name, 'Info maintenance', `Note ajoutée au ticket #${id}`, getClientIp(req));
  res.json(updated);
}));

// ─── Assistance: assigner un technicien ────────────────────────────────────────
app.patch('/api/maintenance/:id/assign', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  const { rows: cur } = await query('SELECT status, assigned_tech_id FROM maintenance_records WHERE id=$1', [id]);
  if (!cur[0]) return res.status(404).json({ message: 'Ticket introuvable.' });
  if (cur[0].status === 'résolu') return res.status(403).json({ message: 'Ticket déjà résolu.' });
  const updated = await updateMaintenance(id, { assignedTechId: req.user.id, technician: req.user.name, status: 'en_cours', startedAt: new Date().toISOString() });
  logActivity(req.user.id, req.user.username, req.user.name, 'Prise en charge', `Technicien "${req.user.name}" a pris en charge le ticket #${id}`, getClientIp(req));
  res.json(updated);
}));

// ─── Assistance: confirmer résolution (utilisateur) ────────────────────────────
app.patch('/api/maintenance/:id/confirm-user', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  // Atomique : évite la race condition où user+tech confirment simultanément
  const { rows } = await query(`
    UPDATE maintenance_records
    SET user_confirmed = TRUE,
        status = CASE WHEN tech_confirmed = TRUE THEN 'résolu' ELSE status END,
        closed_at = CASE WHEN tech_confirmed = TRUE THEN NOW() ELSE closed_at END
    WHERE id = $1
    RETURNING *
  `, [id]);
  if (!rows[0]) return res.status(404).json({ message: 'Ticket introuvable.' });
  const updated = rowToMaintenance(rows[0]);
  if (updated.status === 'résolu') {
    logActivity(req.user.id, req.user.username, req.user.name, 'Clôture ticket', `Ticket #${id} clôturé — confirmé par l'utilisateur et le technicien`, getClientIp(req));
    return res.json(updated);
  }
  logActivity(req.user.id, req.user.username, req.user.name, 'Confirmation utilisateur', `Ticket #${id} confirmé par l'utilisateur`, getClientIp(req));
  res.json(updated);
}));

// ─── Assistance: confirmer résolution (technicien) ─────────────────────────────
app.patch('/api/maintenance/:id/confirm-tech', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  const { rows } = await query(`
    UPDATE maintenance_records
    SET tech_confirmed = TRUE,
        status = CASE WHEN user_confirmed = TRUE THEN 'résolu' ELSE status END,
        closed_at = CASE WHEN user_confirmed = TRUE THEN NOW() ELSE closed_at END
    WHERE id = $1
    RETURNING *
  `, [id]);
  if (!rows[0]) return res.status(404).json({ message: 'Ticket introuvable.' });
  const updated = rowToMaintenance(rows[0]);
  if (updated.status === 'résolu') {
    logActivity(req.user.id, req.user.username, req.user.name, 'Clôture ticket', `Ticket #${id} clôturé — confirmé par l'utilisateur et le technicien`, getClientIp(req));
    return res.json(updated);
  }
  logActivity(req.user.id, req.user.username, req.user.name, 'Confirmation technicien', `Ticket #${id} confirmé par le technicien`, getClientIp(req));
  res.json(updated);
}));

// ─── Assistance: noter le technicien ───────────────────────────────────────────
app.patch('/api/maintenance/:id/rate', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide.' });
  const { rating, reviewComment } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Note entre 1 et 5.' });
  const updated = await updateMaintenance(id, { rating, reviewComment: reviewComment || '' });
  if (!updated) return res.status(404).json({ message: 'Ticket introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name, 'Évaluation', `Ticket #${id} noté ${rating}/5`, getClientIp(req));
  res.json(updated);
}));

// ─── Transfers list ───────────────────────────────────────────────────────────

app.get('/api/transfers', authenticate, asyncHandler(async (req, res) => {
  const { department, from, to } = req.query;
  const events = await getTransferEvents({
    from: from || null,
    to: to ? new Date(new Date(to).getTime() + 86399999).toISOString() : null,
    department: department || null,
  });
  res.json(events);
}));

// ─── Reform (mise au rebut) ───────────────────────────────────────────────────

app.post('/api/equipments/:id/reform', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });

  const { reason, replacedById, notes, reformQty } = req.body;
  if (!reason?.trim()) return res.status(400).json({ message: 'La raison de la réforme est requise.' });

  const { rows: current } = await query('SELECT * FROM equipments WHERE id=$1', [id]);
  if (!current[0]) return res.status(404).json({ message: 'Équipement introuvable.' });
  const old = rowToEquipment(current[0]);
  const qty = Math.min(Math.max(1, parseInt(reformQty) || old.quantity), old.quantity);
  const isPartial = qty < old.quantity;

  let replacedByName = '';
  if (replacedById) {
    const { rows: newEq } = await query('SELECT name FROM equipments WHERE id=$1', [Number(replacedById)]);
    if (newEq[0]) replacedByName = newEq[0].name;
  }

  let result;
  if (isPartial) {
    const { rows } = await query(
      'UPDATE equipments SET quantity=$1 WHERE id=$2 RETURNING *',
      [old.quantity - qty, id]
    );
    result = rowToEquipment(rows[0]);
  } else {
    const { rows } = await query(
      'UPDATE equipments SET status=$1, replaced_by_id=$2 WHERE id=$3 RETURNING *',
      ['réformé', replacedById ? Number(replacedById) : null, id]
    );
    result = rowToEquipment(rows[0]);
  }

  const ip = getClientIp(req);
  await logEquipmentEvent({
    equipmentId: id, equipmentName: old.name, equipmentType: old.type,
    department: old.department, action: 'Réforme',
    details: `${isPartial ? `${qty} sur ${old.quantity} unité(s) réformée(s)` : 'Équipement réformé (mis au rebut)'}. Raison : ${reason}${replacedByName ? `. Remplacé par : ${replacedByName} (#${replacedById})` : ''}${notes ? `. Notes : ${notes}` : ''}.`,
    changes: [],
    technician: req.user.name,
    userId: req.user.id, username: req.user.username, userName: req.user.name, ip,
  });
  logActivity(req.user.id, req.user.username, req.user.name,
    'Réforme équipement', `"${old.name}"${isPartial ? ` (×${qty} réformé(s))` : ' réformé'}`, ip);

  res.json(result);
}));

// ─── Feuille de temps (Work Logs) ──────────────────────────────────────────────
app.get('/api/worklogs', authenticate, asyncHandler(async (req, res) => {
  const { userId, from, to, type, equipmentId, siteId, page = 1, limit = 50 } = req.query;
  const isAdmin = req.user.role === 'admin';
  const result = await getWorkLogs({
    userId: isAdmin && userId ? Number(userId) : (isAdmin ? undefined : req.user.id),
    fromDate: from,
    toDate: to,
    type,
    equipmentId: equipmentId ? Number(equipmentId) : undefined,
    siteId: siteId ? Number(siteId) : undefined,
    page: Number(page),
    limit: Math.min(Number(limit), 100)
  });
  res.json(result);
}));

app.post('/api/worklogs', authenticate, asyncHandler(async (req, res) => {
  const { workDate, startTime, endTime, durationMinutes, type, equipmentId, siteId, description, status } = req.body;
  if (!workDate) return res.status(400).json({ message: 'Date de travail requise' });
  const wl = await createWorkLog({ userId: req.user.id, workDate, startTime, endTime, durationMinutes, type, equipmentId, siteId, description, status });
  res.status(201).json(wl);
}));

app.put('/api/worklogs/:id', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide' });
  const updated = await updateWorkLog(id, req.body);
  if (!updated) return res.status(404).json({ message: 'Entrée introuvable' });
  res.json(updated);
}));

app.delete('/api/worklogs/:id', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'ID invalide' });
  const deleted = await deleteWorkLog(id);
  if (!deleted) return res.status(404).json({ message: 'Entrée introuvable' });
  res.status(204).send();
}));

app.get('/api/worklogs/report', authenticate, asyncHandler(async (req, res) => {
  const { from, to, type, siteId, groupBy = 'day' } = req.query;
  const isAdmin = req.user.role === 'admin';
  const report = await getWorkLogReport({
    userId: isAdmin && req.query.userId ? Number(req.query.userId) : (isAdmin ? undefined : req.user.id),
    fromDate: from,
    toDate: to,
    type,
    siteId: siteId ? Number(siteId) : undefined,
    groupBy
  });
  res.json(report);
}));

// ─── Reports ─────────────────────────────────────────────────────────────────

app.get('/api/reports/equipment/:id', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });
  const history = await getEquipmentHistory(id);
  res.json(history);
}));

app.get('/api/reports/by-date', authenticate, asyncHandler(async (req, res) => {
  const { from, to, department, type } = req.query;
  const isAdmin = req.user.role === 'admin';
  const siteIds = req.user.allowedSiteIds || [];

  const conditions = ['1=1'];
  const params = [];
  let i = 1;
  if (from)       { conditions.push(`ev.created_at >= $${i++}`); params.push(from); }
  if (to)         { conditions.push(`ev.created_at <= $${i++}`); params.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (department) { conditions.push(`ev.department = $${i++}`); params.push(department); }
  if (type)       { conditions.push(`ev.equipment_type = $${i++}`); params.push(type); }
  if (!isAdmin && siteIds.length > 0) { conditions.push(`e.site_id = ANY($${i++})`); params.push(siteIds); }
  params.push(500);

  // LEFT JOIN preserves events even if equipment was later deleted (admin sees all)
  const { rows } = await query(`
    SELECT ev.*
    FROM equipment_events ev
    LEFT JOIN equipments e ON e.id = ev.equipment_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ev.created_at DESC LIMIT $${i}
  `, params);

  res.json(rows.map(row => {
    let changes = [];
    try { changes = JSON.parse(row.changes || '[]'); } catch (err) { console.error('JSON.parse(changes) failed:', err?.message); }
    return {
      id: row.id, equipmentId: row.equipment_id, equipmentName: row.equipment_name,
      equipmentType: row.equipment_type, department: row.department, action: row.action,
      details: row.details, changes, technician: row.technician, userId: row.user_id,
      username: row.username, userName: row.user_name, ip: row.ip, createdAt: row.created_at,
    };
  }));
}));

app.get('/api/reports/by-department', authenticate, asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const siteIds = req.user.allowedSiteIds || [];

  const conditions = ["ev.department != ''"];
  const params = [];
  let i = 1;
  if (!isAdmin && siteIds.length > 0) { conditions.push(`e.site_id = ANY($${i++})`); params.push(siteIds); }

  const { rows } = await query(`
    SELECT
      ev.department,
      COUNT(*) AS total_events,
      COUNT(DISTINCT ev.equipment_id) AS equipment_count,
      COUNT(*) FILTER (WHERE ev.action = 'Création')     AS creations,
      COUNT(*) FILTER (WHERE ev.action = 'Modification') AS modifications,
      COUNT(*) FILTER (WHERE ev.action = 'Intervention') AS interventions,
      COUNT(*) FILTER (WHERE ev.action = 'Suppression')  AS suppressions,
      MAX(ev.created_at) AS last_activity
    FROM equipment_events ev
    LEFT JOIN equipments e ON e.id = ev.equipment_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY ev.department
    ORDER BY total_events DESC
  `, params);
  res.json(rows);
}));

app.get('/api/reports/by-user', authenticate, asyncHandler(async (req, res) => {
  const { from, to, department } = req.query;
  const isAdmin = req.user.role === 'admin';
  const siteIds = req.user.allowedSiteIds || [];

  const conditions = ["ev.user_name != ''"];
  const params = [];
  let i = 1;
  if (!isAdmin) { conditions.push(`ev.username = $${i++}`); params.push(req.user.username); }
  if (from)       { conditions.push(`ev.created_at >= $${i++}`); params.push(from); }
  if (to)         { conditions.push(`ev.created_at <= $${i++}`); params.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (department) { conditions.push(`ev.department = $${i++}`); params.push(department); }
  if (!isAdmin && siteIds.length > 0) { conditions.push(`e.site_id = ANY($${i++})`); params.push(siteIds); }

  const { rows } = await query(`
    SELECT
      ev.user_name, ev.username,
      COUNT(*) AS total_actions,
      COUNT(*) FILTER (WHERE ev.action = 'Création')     AS creations,
      COUNT(*) FILTER (WHERE ev.action = 'Modification') AS modifications,
      COUNT(*) FILTER (WHERE ev.action = 'Intervention') AS interventions,
      COUNT(*) FILTER (WHERE ev.action = 'Transfert')    AS transferts,
      COUNT(*) FILTER (WHERE ev.action = 'Suppression')  AS suppressions,
      COUNT(*) FILTER (WHERE ev.action = 'Maintenance')  AS maintenances,
      COUNT(*) FILTER (WHERE ev.action = 'Réforme')      AS reformes,
      COUNT(DISTINCT ev.equipment_id)                     AS equipment_count,
      COUNT(DISTINCT ev.department)                       AS dept_count,
      MAX(ev.created_at)                                  AS last_action
    FROM equipment_events ev
    LEFT JOIN equipments e ON e.id = ev.equipment_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY ev.user_name, ev.username
    ORDER BY total_actions DESC
  `, params);
  res.json(rows);
}));

app.get('/api/reports/user-detail', authenticate, asyncHandler(async (req, res) => {
  const { username, from, to, department } = req.query;
  if (!username) return res.status(400).json({ message: 'username requis' });
  const isAdmin = req.user.role === 'admin';
  const siteIds = req.user.allowedSiteIds || [];
  if (!isAdmin && username !== req.user.username) return res.status(403).json({ message: 'Accès refusé' });

  const conditions = ['ev.username = $1'];
  const params = [username];
  let i = 2;
  if (from)       { conditions.push(`ev.created_at >= $${i++}`); params.push(from); }
  if (to)         { conditions.push(`ev.created_at <= $${i++}`); params.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (department) { conditions.push(`ev.department = $${i++}`); params.push(department); }
  if (!isAdmin && siteIds.length > 0) { conditions.push(`e.site_id = ANY($${i++})`); params.push(siteIds); }
  params.push(300);
  const { rows } = await query(
    `SELECT ev.* FROM equipment_events ev LEFT JOIN equipments e ON e.id = ev.equipment_id WHERE ${conditions.join(' AND ')} ORDER BY ev.created_at DESC LIMIT $${i}`,
    params
  );
  res.json(rows.map(row => {
    let changes = [];
    try { changes = JSON.parse(row.changes || '[]'); } catch (err) { console.error('JSON.parse(changes) failed:', err?.message); }
    return {
      id: row.id, equipmentId: row.equipment_id, equipmentName: row.equipment_name,
      equipmentType: row.equipment_type, department: row.department, action: row.action,
      details: row.details, changes, technician: row.technician, userId: row.user_id,
      username: row.username, userName: row.user_name, ip: row.ip, createdAt: row.created_at,
    };
  }));
}));

// ─── Reports by site ─────────────────────────────────────────────────────────

app.get('/api/reports/by-site', authenticate, asyncHandler(async (req, res) => {
  const { from, to, type } = req.query;
  const isAdmin = req.user.role === 'admin';
  const siteIds = req.user.allowedSiteIds || [];

  const baseParams = isAdmin ? [] : [siteIds];
  let i = baseParams.length + 1;

  const evConditions = [];
  const evParams = [...baseParams];
  if (from) { evConditions.push(`ev.created_at >= $${i++}`); evParams.push(from); }
  if (to)   { evConditions.push(`ev.created_at <= $${i++}`); evParams.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (type) { evConditions.push(`ev.equipment_type = $${i++}`); evParams.push(type); }

  // For non-admin: filter in WHERE to limit which sites appear in the list
  const siteWhere = isAdmin ? '' : 'WHERE s.id = ANY($1)';

  const { rows } = await query(`
    SELECT
      s.id                                                    AS site_id,
      s.name                                                  AS site_name,
      s.city, s.country,
      COUNT(DISTINCT e.id)::int                               AS equipment_count,
      COUNT(ev.id)::int                                       AS total_events,
      COUNT(ev.id) FILTER (WHERE ev.action = 'Création')::int     AS creations,
      COUNT(ev.id) FILTER (WHERE ev.action = 'Modification')::int AS modifications,
      COUNT(ev.id) FILTER (WHERE ev.action = 'Transfert')::int    AS transferts,
      COUNT(ev.id) FILTER (WHERE ev.action = 'Intervention')::int AS interventions,
      COUNT(ev.id) FILTER (WHERE ev.action = 'Réforme')::int      AS reformes,
      COUNT(ev.id) FILTER (WHERE ev.action = 'Suppression')::int  AS suppressions,
      MAX(ev.created_at)                                      AS last_activity
    FROM sites s
    LEFT JOIN equipments e  ON e.site_id = s.id
    LEFT JOIN equipment_events ev ON ev.equipment_id = e.id
      ${evConditions.length ? 'AND ' + evConditions.join(' AND ') : ''}
    ${siteWhere}
    GROUP BY s.id, s.name, s.city, s.country
    ORDER BY total_events DESC
  `, evParams);
  res.json(rows);
}));

app.get('/api/reports/site-detail', authenticate, asyncHandler(async (req, res) => {
  const { siteId, from, to, type } = req.query;
  if (!siteId) return res.status(400).json({ message: 'siteId requis' });
  const isAdmin = req.user.role === 'admin';
  const siteIds = req.user.allowedSiteIds || [];
  if (!isAdmin && siteIds.length > 0 && !siteIds.includes(Number(siteId))) {
    return res.status(403).json({ message: 'Accès refusé à ce site' });
  }

  const conditions = ['e.site_id = $1'];
  const params = [Number(siteId)];
  let i = 2;
  if (from) { conditions.push(`ev.created_at >= $${i++}`); params.push(from); }
  if (to)   { conditions.push(`ev.created_at <= $${i++}`); params.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (type) { conditions.push(`ev.equipment_type = $${i++}`); params.push(type); }
  params.push(400);

  const { rows } = await query(`
    SELECT ev.*
    FROM equipment_events ev
    JOIN equipments e ON e.id = ev.equipment_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ev.created_at DESC
    LIMIT $${i}
  `, params);

  res.json(rows.map(row => {
    let changes = [];
    try { changes = JSON.parse(row.changes || '[]'); } catch (err) { console.error('JSON.parse(changes) failed:', err?.message); }
    return {
      id: row.id, equipmentId: row.equipment_id, equipmentName: row.equipment_name,
      equipmentType: row.equipment_type, department: row.department, action: row.action,
      details: row.details, changes, technician: row.technician, userId: row.user_id,
      username: row.username, userName: row.user_name, ip: row.ip, createdAt: row.created_at,
    };
  }));
}));

// ─── Chat ─────────────────────────────────────────────────────────────────────

const mapMsg = m => ({
  id: m.id, senderId: m.sender_id, senderName: m.sender_name,
  senderUsername: m.sender_username, recipientId: m.recipient_id,
  groupId: m.group_id, content: m.content, createdAt: m.created_at,
});

// List of users available for DM (excluding self)
app.get('/api/chat/users', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, username, name FROM users WHERE id != $1 ORDER BY name',
    [req.user.id]
  );
  res.json(rows);
}));

// Fetch messages for a conversation
app.get('/api/chat/messages', authenticate, asyncHandler(async (req, res) => {
  const { channel, withUser, groupId, sinceId } = req.query;
  const isGlobal = channel === 'global';
  const msgs = await getChatMessages({
    isGlobal,
    withUserId: withUser ? Number(withUser) : null,
    groupId: groupId ? Number(groupId) : null,
    currentUserId: req.user.id,
    sinceId: sinceId ? Number(sinceId) : null,
  });
  res.json(msgs.map(mapMsg));
}));

// Send a message
app.post('/api/chat/messages', authenticate, asyncHandler(async (req, res) => {
  const { content, recipientId, groupId } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: 'Message vide.' });
  const msg = await sendChatMessage({
    senderId: req.user.id,
    senderName: req.user.name,
    senderUsername: req.user.username,
    recipientId: recipientId ? Number(recipientId) : null,
    groupId: groupId ? Number(groupId) : null,
    content: content.trim(),
  });
  res.status(201).json(mapMsg(msg));
}));

// Mark conversation as read
app.patch('/api/chat/read', authenticate, asyncHandler(async (req, res) => {
  const { conversationKey, lastReadId } = req.body;
  if (!conversationKey || !lastReadId) return res.status(400).json({ message: 'Params manquants.' });
  await markChatRead({ userId: req.user.id, conversationKey, lastReadId: Number(lastReadId) });
  res.json({ ok: true });
}));

// Unread counts
app.get('/api/chat/unread', authenticate, asyncHandler(async (req, res) => {
  const counts = await getChatUnread(req.user.id);
  res.json(counts);
}));

// Create a group (admin only)
app.post('/api/chat/groups', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, memberIds } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Nom du groupe requis.' });
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ message: 'Au moins un membre requis.' });
  }
  const group = await createChatGroup({ name: name.trim(), createdBy: req.user.id, memberIds: memberIds.map(Number) });
  res.status(201).json(group);
}));

// List user's groups
app.get('/api/chat/groups', authenticate, asyncHandler(async (req, res) => {
  const groups = await getUserGroups(req.user.id);
  res.json(groups);
}));

// ─── Site Visits ──────────────────────────────────────────────────────────────

app.get('/api/visits', authenticate, asyncHandler(async (req, res) => {
  const { siteId, status, from, to } = req.query;
  const visits = await getVisits({
    siteId: siteId ? Number(siteId) : undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined
  });
  res.json(visits);
}));

app.post('/api/visits', authenticate, requirePermission('ecriture'), asyncHandler(async (req, res) => {
  const { siteId, siteName, visitSiteId, visitSiteName, scheduledDate, scheduledTime, technician, purpose, status, notes, withMaintenance, equipmentIds, maintenanceDesc } = req.body;
  if (!siteId || !scheduledDate || !technician?.trim() || !purpose?.trim()) {
    return res.status(400).json({ message: 'Site, date, technicien et objet sont obligatoires.' });
  }
  const visit = await createVisit({ siteId: Number(siteId), siteName: siteName||'', visitSiteId: visitSiteId ? Number(visitSiteId) : null, visitSiteName: visitSiteName||'', scheduledDate, scheduledTime: scheduledTime||'', technician: technician.trim(), purpose: purpose.trim(), status: status||'planifié', notes: notes||'', createdBy: req.user.name, withMaintenance: !!withMaintenance, equipmentIds: equipmentIds||[], maintenanceDesc: maintenanceDesc||'' });
  logActivity(req.user.id, req.user.username, req.user.name, 'Visite programmée', `Visite sur ${siteName} le ${scheduledDate}`, getClientIp(req));
  res.status(201).json(visit);
}));

app.patch('/api/visits/:id', authenticate, requirePermission('ecriture'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { siteId, siteName, visitSiteId, visitSiteName, scheduledDate, scheduledTime, technician, purpose, status, notes, withMaintenance, equipmentIds, maintenanceDesc, validationComment, validatedAt, validatedBy, rescheduledDate } = req.body;
  if (!siteId || !scheduledDate || !technician?.trim() || !purpose?.trim()) {
    return res.status(400).json({ message: 'Site, date, technicien et objet sont obligatoires.' });
  }
  const visit = await updateVisit(id, { siteId: Number(siteId), siteName: siteName||'', visitSiteId: visitSiteId ? Number(visitSiteId) : null, visitSiteName: visitSiteName||'', scheduledDate, scheduledTime: scheduledTime||'', technician: technician.trim(), purpose: purpose.trim(), status, notes: notes||'', withMaintenance: !!withMaintenance, equipmentIds: equipmentIds||[], maintenanceDesc: maintenanceDesc||'', validationComment: validationComment||'', validatedAt: validatedAt||null, validatedBy: validatedBy||req.user.name, rescheduledDate: rescheduledDate||null });
  if (!visit) return res.status(404).json({ message: 'Visite introuvable.' });
  res.json(visit);
}));

app.delete('/api/visits/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const visit = await query('SELECT status FROM site_visits WHERE id=$1', [id]);
  if (visit.rows.length > 0 && (visit.rows[0].status === 'en_cours' || visit.rows[0].status === 'terminé' || visit.rows[0].status === 'annulé')) {
    return res.status(400).json({ message: 'Impossible de supprimer une visite en cours, terminée ou annulée.' });
  }
  await deleteVisit(id);
  res.status(204).end();
}));
app.get('/api/visits/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM site_visits WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
}));
app.post('/api/visits/:id/restore', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE site_visits SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Visite introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/visits/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM site_visits WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

// ─── Heartbeat ────────────────────────────────────────────────────────────────

app.post('/api/heartbeat', authenticate, asyncHandler(async (req, res) => {
  await updateSessionLastSeen(req.user.id);
  // Also update in-memory cache
  const session = activeSessions.get(req.user.id);
  if (session) session.lastSeen = new Date().toISOString();
  res.json({ ok: true, ts: new Date().toISOString() });
}));

// ─── Tendances 12 mois ───────────────────────────────────────────────────────

app.get('/api/reports/trends', authenticate, asyncHandler(async (req, res) => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  const results = await Promise.all(months.map(async ({ year, month }) => {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const to = new Date(year, month, 0).toISOString().slice(0, 10);
    const [events, maint] = await Promise.all([
      query(`SELECT COUNT(*) as cnt FROM equipment_events WHERE created_at >= $1 AND created_at <= $2 AND (action ILIKE '%panne%' OR action ILIKE '%maintenance%')`, [from, to + ' 23:59:59']).catch(() => ({ rows: [{ cnt: '0' }] })),
      query(`SELECT COUNT(*) as cnt, AVG(EXTRACT(EPOCH FROM (closed_at - opened_at))/3600)::numeric(10,1) as avg_hours FROM maintenance_records WHERE opened_at >= $1 AND opened_at <= $2`, [from, to + ' 23:59:59']).catch(() => ({ rows: [{ cnt: '0', avg_hours: null }] })),
    ]);
    return {
      label: `${String(month).padStart(2,'0')}/${year}`,
      month, year,
      pannes: parseInt(events.rows[0].cnt) || 0,
      tickets: parseInt(maint.rows[0].cnt) || 0,
      mttr: parseFloat(maint.rows[0].avg_hours) || 0,
    };
  }));
  res.json(results);
}));

// ─── Backup BDD ────────────────────────────────────────────────────────────────
app.get('/api/backup', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const tables = ['users','equipments','sites','equipment_events','equipment_documents','maintenance_records','user_activity_log','chat_messages','chat_read_markers','chat_groups','chat_group_members','user_sessions','site_visits','licenses','maintenance_contracts','purchase_requests','rma_requests','suppliers','notifications'];
  const data = {};
  for (const table of tables) {
    try {
      const { rows } = await query(`SELECT * FROM ${table} ORDER BY id`);
      data[table] = rows;
    } catch { data[table] = []; }
  }
  data._meta = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    tableCount: tables.length,
    recordCount: Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-gestion-it-${new Date().toISOString().slice(0,10)}.json"`);
  res.json(data);
}));

// ─── Import CSV template ──────────────────────────────────────────────────────

app.get('/api/equipments/csv-template', authenticate, (req, res) => {
  const headers = ['name','type','brand','model','serialNumber','ipAddress','location','department','status','purchaseDate','warranty','quantity'];
  const example = ['PC-Bureau-001','ordinateur','Dell','OptiPlex 7090','SN12345','192.168.1.101','Bureau 101','Informatique','actif','2024-01-15','2027-01-15','1'];
  const csv = [headers.join(','), example.join(',')].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="template-import-equipements.csv"');
  res.send(csv);
});

// ─── Licences logicielles ─────────────────────────────────────────────────────

app.get('/api/licenses', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM licenses WHERE deleted_at IS NULL ORDER BY expiry_date ASC NULLS LAST');
  res.json(rows);
}));

app.post('/api/licenses', authenticate, requirePermission('ecriture'), asyncHandler(async (req, res) => {
  const validation = validateLicense(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const { name, vendor, licenseKey, seats, usedSeats, equipmentId, purchaseDate, expiryDate, notes } = req.body;
  const { rows } = await query(
    `INSERT INTO licenses (name, vendor, license_key, seats, used_seats, equipment_id, purchase_date, expiry_date, notes, supplier_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [name || '', vendor || '', licenseKey || '', seats || 1, usedSeats || 0, equipmentId || null, purchaseDate || null, expiryDate || null, notes || '', req.body.supplierId || null]
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/licenses/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, vendor, licenseKey, seats, usedSeats, equipmentId, purchaseDate, expiryDate, notes } = req.body;
  const { rows } = await query(
    `UPDATE licenses SET name=$1, vendor=$2, license_key=$3, seats=$4, used_seats=$5, equipment_id=$6, purchase_date=$7, expiry_date=$8, notes=$9, supplier_id=$10 WHERE id=$11 RETURNING *`,
    [name || '', vendor || '', licenseKey || '', seats || 1, usedSeats || 0, equipmentId || null, purchaseDate || null, expiryDate || null, notes || '', req.body.supplierId || null, id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Licence introuvable' });
  res.json(rows[0]);
}));

app.delete('/api/licenses/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  await query('UPDATE licenses SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  res.status(204).end();
}));
app.get('/api/licenses/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM licenses WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
}));
app.post('/api/licenses/:id/restore', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE licenses SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Licence introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/licenses/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM licenses WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

// ─── Email — test + rapport mensuel manuel ─────────────────────────────────────

app.post('/api/email/test', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ message: 'Destinataire requis' });
  if (!process.env.SMTP_HOST) return res.status(503).json({ message: 'SMTP non configuré (SMTP_HOST manquant)' });
  const ok = await sendMail({ to, subject: '✅ Test Gestion IT', html: '<p>Connexion SMTP opérationnelle.</p>' });
  res.json({ sent: ok });
}));

app.post('/api/email/monthly-report', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ message: 'Destinataire requis' });
  const [equip, maint, visits] = await Promise.all([
    query('SELECT status FROM equipments'),
    query("SELECT status, priority FROM maintenance_records WHERE status != 'résolu'"),
    query("SELECT status FROM site_visits WHERE status = 'planifié'"),
  ]);
  const stats = {
    total: equip.rows.length,
    actifs: equip.rows.filter(e => e.status === 'actif').length,
    defaillants: equip.rows.filter(e => e.status === 'defaillant' || e.status === 'maintenance').length,
    ticketsOuverts: maint.rows.length,
    ticketsCritiques: maint.rows.filter(m => m.priority === 'critique').length,
    garantiesExpirees: 0,
    visitesPlannifiees: visits.rows.length,
  };
  const ok = await sendMonthlyReport(stats, [to]);
  res.json({ sent: ok });
}));

// ─── Ping réseau ──────────────────────────────────────────────────────────────

app.get('/api/ping/:ip', authenticate, asyncHandler(async (req, res) => {
  const ip = req.params.ip;
  if (!/^[\d.]+$/.test(ip) && !/^[a-zA-Z0-9.-]+$/.test(ip)) {
    return res.status(400).json({ reachable: false, error: 'IP invalide' });
  }
  try {
    const cmd = process.platform === 'win32' ? `ping -n 1 -w 1000 ${ip}` : `ping -c 1 -W 1 ${ip}`;
    await execAsync(cmd, { timeout: 3000 });
    res.json({ reachable: true, ip });
  } catch {
    res.json({ reachable: false, ip });
  }
}));

// ─── Surveillance réseau batch ─────────────────────────────────────────────────
app.post('/api/network-monitor', authenticate, asyncHandler(async (req, res) => {
  try {
    const allowedSiteIds = req.user.allowedSiteIds ?? [];

    // 1. Récupère les équipements de la base avec IP
    let dbEquipments;
    if (req.user.role !== 'admin' && allowedSiteIds.length > 0) {
      ({ rows: dbEquipments } = await query(
        "SELECT id, name, ip_address, type, location, department FROM equipments WHERE ip_address != '' AND ip_address IS NOT NULL AND site_id = ANY($1::integer[]) AND deleted_at IS NULL ORDER BY id",
        [allowedSiteIds]
      ));
    } else {
      ({ rows: dbEquipments } = await query(
        "SELECT id, name, ip_address, type, location, department FROM equipments WHERE ip_address != '' AND ip_address IS NOT NULL AND deleted_at IS NULL ORDER BY id"
      ));
    }

    // 2. Découverte réseau : ARP + ping sweep
    const discoveredIps = new Set<string>();
    const discoveredDevices: { ip: string; mac: string; hostname: string; reachable: boolean }[] = [];

    // 2a. Lecture ARP table
    try {
      const arpCmd = process.platform === 'win32' ? 'arp -a' : 'arp -n';
      const { stdout: arpOut } = await execAsync(arpCmd, { timeout: 5000 });
      const arpLines = arpOut.split('\n');
      for (const line of arpLines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const ip = parts[0];
          const mac = parts[1];
          if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) && /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac.replace(/-/g, ':').toUpperCase())) {
            if (ip.startsWith('192.') || ip.startsWith('10.') || ip.startsWith('172.')) {
              discoveredIps.add(ip);
              discoveredDevices.push({ ip, mac: mac.replace(/-/g, ':').toUpperCase(), hostname: '', reachable: false });
            }
          }
        }
      }
    } catch { /* ARP non disponible */ }

    // 2b. Ping sweep des IPs découvertes
    const pingResults = new Map<string, boolean>();
    await Promise.allSettled([...discoveredIps].map(async (ip) => {
      const cmd = process.platform === 'win32' ? `ping -n 1 -w 800 ${ip}` : `ping -c 1 -W 1 ${ip}`;
      try {
        await execAsync(cmd, { timeout: 2000 });
        pingResults.set(ip, true);
      } catch {
        pingResults.set(ip, false);
      }
    }));

    for (const d of discoveredDevices) {
      d.reachable = pingResults.get(d.ip) ?? false;
    }

    // 2c. Résolution hostname via ping -a
    await Promise.allSettled(discoveredDevices.filter(d => d.reachable).slice(0, 20).map(async (d) => {
      if (process.platform === 'win32') {
        try {
          const { stdout } = await execAsync(`ping -a -n 1 -w 500 ${d.ip}`, { timeout: 2000 });
          const match = stdout.match(/Pinging\s+(\S+)/);
          if (match) d.hostname = match[1];
        } catch { /* */ }
      }
    }));

    // 3. Ping des équipements base de données
    const dbResults = await Promise.allSettled(dbEquipments.map(eq => {
      const cmd = process.platform === 'win32' ? `ping -n 1 -w 1000 ${eq.ip_address}` : `ping -c 1 -W 1 ${eq.ip_address}`;
      return execAsync(cmd, { timeout: 3000 }).then(() => ({ ...eq, reachable: true })).catch(() => ({ ...eq, reachable: false }));
    }));
    const dbMapped = dbResults.map(r => r.status === 'fulfilled' ? r.value : { id: null, name: 'Erreur', ip_address: '', reachable: false, type: '', location: '', department: '' });

    res.json({
      db: dbMapped,
      discovered: discoveredDevices,
      stats: { dbTotal: dbMapped.length, dbOnline: dbMapped.filter(e => e.reachable).length, discoveredTotal: discoveredDevices.length, discoveredOnline: discoveredDevices.filter(d => d.reachable).length }
    });
  } catch (err) {
    handleError(err, res, 'Erreur lors du monitoring réseau.');
  }
}));

// ─── Notifications ──────────────────────────────────────────────────────────────
app.get('/api/notifications', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [req.user.id]
  );
  res.json(rows);
}));

app.get('/api/notifications/unread-count', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [req.user.id]
  );
  res.json({ count: rows[0].count });
}));

app.patch('/api/notifications/:id/read', authenticate, asyncHandler(async (req, res) => {
  await query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.status(204).end();
}));

app.post('/api/notifications/read-all', authenticate, asyncHandler(async (req, res) => {
  await query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
    [req.user.id]
  );
  res.status(204).end();
}));

app.post('/api/notifications', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { userId, type, title, message, relatedId, relatedType } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'Titre requis' });
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId || null, type || 'info', title.trim(), message || '', relatedId || null, relatedType || '']
  );
  res.status(201).json(rows[0]);
}));

// ─── Slack / Teams webhook ────────────────────────────────────────────────────
app.post('/api/notify/webhook', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { webhookUrl, message } = req.body;
  if (!webhookUrl || !message) return res.status(400).json({ message: 'webhookUrl et message requis' });
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    res.json({ sent: r.ok, status: r.status });
  } catch (e) {
    res.json({ sent: false, error: e.message });
  }
}));

// ─── Contrats de maintenance ──────────────────────────────────────────────────
app.get('/api/contracts', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM maintenance_contracts WHERE deleted_at IS NULL ORDER BY end_date ASC NULLS LAST');
  res.json(rows);
}));
app.post('/api/contracts', authenticate, requirePermission('ecriture'), asyncHandler(async (req, res) => {
  const validation = validateContract(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const f = req.body;
  const { rows } = await query(
    `INSERT INTO maintenance_contracts (title,vendor,contract_number,site_id,equipment_ids,start_date,end_date,amount,currency,scope,contact_name,contact_email,contact_phone,status,notes,supplier_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [f.title||'',f.vendor||'',f.contractNumber||'',f.siteId||null,f.equipmentIds||[],f.startDate||null,f.endDate||null,f.amount||null,f.currency||'XOF',f.scope||'',f.contactName||'',f.contactEmail||'',f.contactPhone||'',f.status||'actif',f.notes||'',f.supplierId||null]
  );
  res.status(201).json(rows[0]);
}));
app.put('/api/contracts/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const f = req.body;
  const { rows } = await query(
    `UPDATE maintenance_contracts SET title=$1,vendor=$2,contract_number=$3,site_id=$4,equipment_ids=$5,start_date=$6,end_date=$7,amount=$8,currency=$9,scope=$10,contact_name=$11,contact_email=$12,contact_phone=$13,status=$14,notes=$15,supplier_id=$16 WHERE id=$17 RETURNING *`,
    [f.title||'',f.vendor||'',f.contractNumber||'',f.siteId||null,f.equipmentIds||[],f.startDate||null,f.endDate||null,f.amount||null,f.currency||'XOF',f.scope||'',f.contactName||'',f.contactEmail||'',f.contactPhone||'',f.status||'actif',f.notes||'',f.supplierId||null,req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Contrat introuvable' });
  res.json(rows[0]);
}));
app.delete('/api/contracts/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  await query('UPDATE maintenance_contracts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  res.status(204).end();
}));
app.get('/api/contracts/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM maintenance_contracts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
}));
app.post('/api/contracts/:id/restore', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE maintenance_contracts SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Contrat introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/contracts/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM maintenance_contracts WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

// ─── Demandes d'achat ─────────────────────────────────────────────────────────
app.get('/api/purchases', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM purchase_requests WHERE deleted_at IS NULL ORDER BY created_at DESC');
  res.json(rows);
}));
app.post('/api/purchases', authenticate, asyncHandler(async (req, res) => {
  const validation = validatePurchase(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const f = req.body;
  const { rows } = await query(
    `INSERT INTO purchase_requests (title,equipment_type,quantity,estimated_cost,currency,priority,justification,requested_by,department,site_id,notes,supplier_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [f.title||'',f.equipmentType||'ordinateur',f.quantity||1,f.estimatedCost||null,f.currency||'XOF',f.priority||'normale',f.justification||'',f.requestedBy||req.user.name,f.department||'',f.siteId||null,f.notes||'',f.supplierId||null]
  );
  res.status(201).json(rows[0]);
}));
app.patch('/api/purchases/:id/approve', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE purchase_requests SET status='approuvé', approved_by=$1, approved_at=NOW() WHERE id=$2 RETURNING *`,
    [req.user.name, req.params.id]
  );
  res.json(rows[0]);
}));
app.patch('/api/purchases/:id/reject', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE purchase_requests SET status='rejeté', rejection_reason=$1, approved_by=$2 WHERE id=$3 RETURNING *`,
    [req.body.reason||'', req.user.name, req.params.id]
  );
  res.json(rows[0]);
}));
app.delete('/api/purchases/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('UPDATE purchase_requests SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  res.status(204).end();
}));
app.get('/api/purchases/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM purchase_requests WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
}));
app.post('/api/purchases/:id/restore', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE purchase_requests SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Demande introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/purchases/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM purchase_requests WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

// ─── RMA ──────────────────────────────────────────────────────────────────────
app.get('/api/rma', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM rma_requests WHERE deleted_at IS NULL ORDER BY created_at DESC');
  res.json(rows);
}));
app.post('/api/rma', authenticate, requirePermission('ecriture'), asyncHandler(async (req, res) => {
  const validation = validateRma(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const f = req.body;
  const { rows } = await query(
    `INSERT INTO rma_requests (equipment_id,equipment_name,serial_number,vendor,rma_number,reason,shipped_date,received_date,resolution,status,technician,notes,supplier_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [f.equipmentId||null,f.equipmentName||'',f.serialNumber||'',f.vendor||'',f.rmaNumber||'',f.reason||'',f.shippedDate||null,f.receivedDate||null,f.resolution||'',f.status||'ouvert',f.technician||'',f.notes||'',f.supplierId||null]
  );
  res.status(201).json(rows[0]);
}));
app.put('/api/rma/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const f = req.body;
  const { rows } = await query(
    `UPDATE rma_requests SET equipment_id=$1,equipment_name=$2,serial_number=$3,vendor=$4,rma_number=$5,reason=$6,shipped_date=$7,received_date=$8,resolution=$9,status=$10,technician=$11,notes=$12,supplier_id=$13 WHERE id=$14 RETURNING *`,
    [f.equipmentId||null,f.equipmentName||'',f.serialNumber||'',f.vendor||'',f.rmaNumber||'',f.reason||'',f.shippedDate||null,f.receivedDate||null,f.resolution||'',f.status||'ouvert',f.technician||'',f.notes||'',f.supplierId||null,req.params.id]
  );
  res.json(rows[0]);
}));
app.delete('/api/rma/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  await query('UPDATE rma_requests SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  res.status(204).end();
}));
app.get('/api/rma/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM rma_requests WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
}));
app.post('/api/rma/:id/restore', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE rma_requests SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Demande RMA introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/rma/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM rma_requests WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

// ─── Sites — mise à jour coordonnées GPS ──────────────────────────────────────
app.patch('/api/sites/:id/coords', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const { rows } = await query(
    'UPDATE sites SET latitude=$1, longitude=$2 WHERE id=$3 RETURNING *',
    [latitude, longitude, req.params.id]
  );
  res.json(rows[0]);
}));

// ─── Détection anomalies ──────────────────────────────────────────────────────
app.get('/api/anomalies', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT e.id, e.name, e.type, e.department, e.location,
           COUNT(m.id)::int AS ticket_count,
           MAX(m.opened_at) AS last_ticket
    FROM equipments e
    JOIN maintenance_records m ON m.equipment_id = e.id
    WHERE m.opened_at >= NOW() - INTERVAL '6 months'
    GROUP BY e.id, e.name, e.type, e.department, e.location
    HAVING COUNT(m.id) >= 3
    ORDER BY ticket_count DESC
    LIMIT 20
  `);
  res.json(rows);
}));

// ─── Suppliers ─────────────────────────────────────────────────────────────────
app.get('/api/suppliers', authenticate, asyncHandler(async (req, res) => {
  const suppliers = await getSuppliers();
  res.json(suppliers);
}));
app.post('/api/suppliers', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const validation = validateSupplier(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const supplier = await createSupplier(req.body);
  res.status(201).json(supplier);
}));
app.put('/api/suppliers/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const validation = validateSupplier(req.body);
  if (!validation.valid) return res.status(400).json({ message: validation.errors.join('; ') });
  const supplier = await updateSupplier(Number(req.params.id), req.body);
  if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable.' });
  res.json(supplier);
}));
app.delete('/api/suppliers/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('UPDATE suppliers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  res.status(204).end();
}));
app.get('/api/suppliers/deleted', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM suppliers WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
}));
app.post('/api/suppliers/:id/restore', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE suppliers SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Fournisseur introuvable dans la corbeille.' });
  res.json(rows[0]);
}));
app.delete('/api/suppliers/:id/hard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM suppliers WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
  res.status(204).end();
}));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler (must be after all routes) ─────────────────────────

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});
