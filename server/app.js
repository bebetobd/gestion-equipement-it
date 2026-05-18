import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync, copyFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersPath = path.join(__dirname, 'data', 'users.json');
const equipmentsSource = path.join(__dirname, 'data', 'equipments.json');

const IS_VERCEL = !!process.env.VERCEL;
const equipmentsPath = IS_VERCEL ? '/tmp/equipments.json' : equipmentsSource;

export const JWT_SECRET = process.env.JWT_SECRET || 'gestion-it-secret-2024';

export const app = express();

app.use(cors());
app.use(express.json());

// ─── In-memory monitoring stores ─────────────────────────────────────────────

// userId -> { userId, username, name, role, loginAt, lastSeen, ip }
const activeSessions = new Map();
// token -> userId  (for logout and expiry cleanup)
const tokenToUserId = new Map();
// activity log — most recent first, capped at 500 entries
const activityLog = [];
let activityCounter = 0;

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'N/A'
  );
}

function logActivity(userId, username, name, action, details, ip) {
  activityCounter++;
  activityLog.unshift({
    id: activityCounter,
    userId,
    username: username || '?',
    name: name || '?',
    action,
    details: details || '',
    timestamp: new Date().toISOString(),
    ip: ip || 'N/A'
  });
  if (activityLog.length > 500) activityLog.pop();
}

// ─── File helpers ─────────────────────────────────────────────────────────────

async function readEquipments() {
  if (IS_VERCEL && !existsSync(equipmentsPath)) {
    copyFileSync(equipmentsSource, equipmentsPath);
  }
  try {
    const content = await fs.readFile(equipmentsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeEquipments(equipments) {
  await fs.writeFile(equipmentsPath, JSON.stringify(equipments, null, 2), 'utf-8');
}

async function readUsers() {
  try {
    const content = await fs.readFile(usersPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  if (IS_VERCEL) throw new Error('User management requires a database on Vercel.');
  await fs.writeFile(usersPath, JSON.stringify(users, null, 2), 'utf-8');
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant. Veuillez vous connecter.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req.token = token;
    // Keep lastSeen fresh
    if (activeSessions.has(req.user.id)) {
      activeSessions.get(req.user.id).lastSeen = new Date().toISOString();
    }
    next();
  } catch {
    // Token expired — clean up session
    const userId = tokenToUserId.get(token);
    if (userId) {
      const s = activeSessions.get(userId);
      logActivity(userId, s?.username, s?.name, 'Déconnexion', 'Session expirée automatiquement', 'N/A');
      activeSessions.delete(userId);
      tokenToUserId.delete(token);
    }
    res.status(401).json({ message: 'Token invalide ou expiré. Veuillez vous reconnecter.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Action réservée aux administrateurs.' });
  }
  next();
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    const perms = req.user?.permissions || [];
    if (!perms.includes(perm)) {
      const labels = { lecture: 'Lecture', ecriture: 'Écriture', modification: 'Modification' };
      return res.status(403).json({ message: `Permission "${labels[perm] || perm}" requise pour cette action.` });
    }
    next();
  };
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
  }

  const users = await readUsers();
  const user = users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });

  const permissions = user.permissions || [];
  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role, permissions },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  const ip = getClientIp(req);
  const now = new Date().toISOString();

  // If user was already logged in with a previous token, revoke it
  for (const [t, uid] of tokenToUserId.entries()) {
    if (uid === user.id) tokenToUserId.delete(t);
  }

  activeSessions.set(user.id, {
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

  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, permissions } });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json(req.user);
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const ip = getClientIp(req);
  logActivity(req.user.id, req.user.username, req.user.name, 'Déconnexion', 'Déconnexion volontaire', ip);
  activeSessions.delete(req.user.id);
  tokenToUserId.delete(req.token);
  res.status(204).send();
});

// ─── Admin monitoring routes ──────────────────────────────────────────────────

app.get('/api/admin/sessions', authenticate, requireAdmin, (req, res) => {
  res.json(Array.from(activeSessions.values()));
});

app.get('/api/admin/activities', authenticate, requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const filtered = userId ? activityLog.filter((a) => a.userId === userId) : activityLog;
  res.json(filtered.slice(0, limit));
});

// ─── User routes (admin only) ─────────────────────────────────────────────────

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  const users = await readUsers();
  res.json(users.map(({ password, ...u }) => ({ ...u, permissions: u.permissions || [] })));
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { username, name, role, password, permissions } = req.body;
  if (!username || !name || !role || !password) {
    return res.status(400).json({ message: 'Tous les champs sont requis.' });
  }
  const users = await readUsers();
  if (users.find((u) => u.username === username)) {
    return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const safePerms = Array.isArray(permissions) ? permissions : [];
  const newUser = { id: Math.max(0, ...users.map((u) => u.id)) + 1, username, name, role, password: hashed, permissions: safePerms };
  users.push(newUser);
  await writeUsers(users);
  const { password: _, ...safeUser } = newUser;
  logActivity(req.user.id, req.user.username, req.user.name, 'Création utilisateur', `Compte "${username}" (${role}) créé`, getClientIp(req));
  res.status(201).json(safeUser);
});

app.put('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const users = await readUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  const { username, name, role, password, permissions } = req.body;
  users[index] = {
    ...users[index],
    username: username || users[index].username,
    name: name || users[index].name,
    role: role || users[index].role,
    permissions: Array.isArray(permissions) ? permissions : (users[index].permissions || []),
    ...(password ? { password: await bcrypt.hash(password, 10) } : {})
  };
  await writeUsers(users);
  const { password: _, ...safeUser } = users[index];
  logActivity(req.user.id, req.user.username, req.user.name, 'Modification utilisateur', `Compte "${safeUser.username}" modifié`, getClientIp(req));
  res.json(safeUser);
});

app.delete('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.id === id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  const users = await readUsers();
  const target = users.find((u) => u.id === id);
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  await writeUsers(filtered);
  logActivity(req.user.id, req.user.username, req.user.name, 'Suppression utilisateur', `Compte "${target?.username}" supprimé`, getClientIp(req));
  res.status(204).send();
});

// ─── Equipment routes ─────────────────────────────────────────────────────────

app.get('/api/equipments', authenticate, requirePermission('lecture'), async (req, res) => {
  const equipments = await readEquipments();
  res.json(equipments);
});

app.get('/api/equipments/export', authenticate, requirePermission('lecture'), async (req, res) => {
  const equipments = await readEquipments();
  logActivity(req.user.id, req.user.username, req.user.name, 'Export CSV', `Export de ${equipments.length} équipements`, getClientIp(req));
  const header = [
    'id', 'name', 'type', 'brand', 'model', 'serialNumber', 'ipAddress',
    'location', 'department', 'status', 'purchaseDate', 'warranty',
    'lastMaintenance', 'visited', 'technicianName', 'visitDate', 'interventionDetails'
  ];
  const csvRows = equipments.map((equipment) =>
    header.map((field) => JSON.stringify(equipment[field] ?? '')).join(',')
  );
  res.setHeader('Content-Type', 'text/csv;charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="equipements.csv"');
  res.send([header.join(','), ...csvRows].join('\n'));
});

app.post('/api/equipments', authenticate, requirePermission('ecriture'), async (req, res) => {
  const equipments = await readEquipments();
  const newEquipment = {
    ...req.body,
    id: Math.max(0, ...equipments.map((item) => item.id)) + 1
  };
  equipments.push(newEquipment);
  await writeEquipments(equipments);
  logActivity(req.user.id, req.user.username, req.user.name, 'Ajout équipement', `"${newEquipment.name}" ajouté (${newEquipment.type})`, getClientIp(req));
  res.status(201).json(newEquipment);
});

app.put('/api/equipments/:id', authenticate, requirePermission('modification'), async (req, res) => {
  const id = Number(req.params.id);
  const equipments = await readEquipments();
  const index = equipments.findIndex((item) => item.id === id);
  if (index === -1) return res.status(404).json({ message: 'Équipement introuvable' });
  const previous = equipments[index];
  equipments[index] = { ...req.body, id };
  await writeEquipments(equipments);
  logActivity(req.user.id, req.user.username, req.user.name, 'Modification équipement', `"${previous.name}" modifié`, getClientIp(req));
  res.json(equipments[index]);
});

app.delete('/api/equipments/:id', authenticate, requirePermission('modification'), async (req, res) => {
  const id = Number(req.params.id);
  const equipments = await readEquipments();
  const target = equipments.find((item) => item.id === id);
  const filtered = equipments.filter((item) => item.id !== id);
  if (filtered.length === equipments.length) return res.status(404).json({ message: 'Équipement introuvable' });
  await writeEquipments(filtered);
  logActivity(req.user.id, req.user.username, req.user.name, 'Suppression équipement', `"${target?.name}" supprimé`, getClientIp(req));
  res.status(204).send();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
