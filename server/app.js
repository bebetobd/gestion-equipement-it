import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, rowToEquipment } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'gestion-it-secret-2024';

export const app = express();

app.use(cors());
app.use(express.json());

// ─── In-memory monitoring stores ─────────────────────────────────────────────

const activeSessions = new Map();  // userId  → session info
const tokenToUserId  = new Map();  // token   → userId
const activityLog    = [];
let   activityCounter = 0;

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

// ─── Auth middleware ──────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant. Veuillez vous connecter.' });

  try {
    req.user  = jwt.verify(token, JWT_SECRET);
    req.token = token;
    if (activeSessions.has(req.user.id)) {
      activeSessions.get(req.user.id).lastSeen = new Date().toISOString();
    }
    next();
  } catch {
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

  try {
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });

    const permissions = user.permissions ?? [];
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, permissions },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const ip  = getClientIp(req);
    const now = new Date().toISOString();

    for (const [t, uid] of tokenToUserId.entries()) {
      if (uid === user.id) tokenToUserId.delete(t);
    }

    activeSessions.set(user.id, {
      userId: user.id, username: user.username, name: user.name,
      role: user.role, permissions, loginAt: now, lastSeen: now, ip
    });
    tokenToUserId.set(token, user.id);
    logActivity(user.id, user.username, user.name, 'Connexion', `Connexion depuis ${ip}`, ip);

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, permissions }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
  }
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
  const limit  = Math.min(parseInt(req.query.limit) || 100, 500);
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const filtered = userId ? activityLog.filter((a) => a.userId === userId) : activityLog;
  res.json(filtered.slice(0, limit));
});

// ─── User routes (admin only) ─────────────────────────────────────────────────

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, username, name, role, permissions FROM users ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { username, name, role, password, permissions } = req.body;
  if (!username || !name || !role || !password) {
    return res.status(400).json({ message: 'Tous les champs sont requis.' });
  }
  try {
    const hashed    = await bcrypt.hash(password, 10);
    const safePerms = Array.isArray(permissions) ? permissions : [];
    const { rows } = await query(
      `INSERT INTO users (username, name, role, password, permissions)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, username, name, role, permissions`,
      [username.trim(), name.trim(), role, hashed, safePerms]
    );
    logActivity(req.user.id, req.user.username, req.user.name,
      'Création utilisateur', `Compte "${username}" (${role}) créé`, getClientIp(req));
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la création.' });
  }
});

app.put('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { username, name, role, password, permissions } = req.body;
  try {
    let pwClause = '';
    const params = [
      username, name, role,
      Array.isArray(permissions) ? permissions : null,
      id
    ];
    if (password) {
      pwClause = ', password = $6';
      params.splice(4, 0, await bcrypt.hash(password, 10));
      params[params.length - 1] = id;
    }
    const { rows } = await query(
      `UPDATE users
       SET username    = COALESCE($1, username),
           name        = COALESCE($2, name),
           role        = COALESCE($3, role),
           permissions = COALESCE($4, permissions)
           ${pwClause}
       WHERE id = $5
       RETURNING id, username, name, role, permissions`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    logActivity(req.user.id, req.user.username, req.user.name,
      'Modification utilisateur', `Compte "${rows[0].username}" modifié`, getClientIp(req));
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  }
});

app.delete('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.id === id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  try {
    const { rows } = await query(
      'DELETE FROM users WHERE id = $1 RETURNING username', [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    logActivity(req.user.id, req.user.username, req.user.name,
      'Suppression utilisateur', `Compte "${rows[0].username}" supprimé`, getClientIp(req));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la suppression.' });
  }
});

// ─── Equipment routes ─────────────────────────────────────────────────────────

app.get('/api/equipments', authenticate, requirePermission('lecture'), async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM equipments ORDER BY id');
    res.json(rows.map(rowToEquipment));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération des équipements.' });
  }
});

app.get('/api/equipments/export', authenticate, requirePermission('lecture'), async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM equipments ORDER BY id');
    const equipments = rows.map(rowToEquipment);
    logActivity(req.user.id, req.user.username, req.user.name,
      'Export CSV', `Export de ${equipments.length} équipements`, getClientIp(req));
    const header = [
      'id','name','type','brand','model','serialNumber','ipAddress',
      'location','department','status','purchaseDate','warranty',
      'lastMaintenance','visited','technicianName','visitDate','interventionDetails'
    ];
    const csvRows = equipments.map((e) =>
      header.map((f) => JSON.stringify(e[f] ?? '')).join(',')
    );
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="equipements.csv"');
    res.send([header.join(','), ...csvRows].join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de l\'export.' });
  }
});

app.post('/api/equipments', authenticate, requirePermission('ecriture'), async (req, res) => {
  const e = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO equipments
         (name, type, brand, model, serial_number, ip_address, location, department,
          status, purchase_date, warranty, last_maintenance, visited,
          technician_name, visit_date, intervention_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        e.name, e.type, e.brand??'', e.model??'', e.serialNumber??'',
        e.ipAddress??'', e.location??'', e.department??'', e.status??'actif',
        e.purchaseDate??'', e.warranty??'', e.lastMaintenance??'', e.visited??false,
        e.technicianName??'', e.visitDate??'', e.interventionDetails??''
      ]
    );
    const created = rowToEquipment(rows[0]);
    logActivity(req.user.id, req.user.username, req.user.name,
      'Ajout équipement', `"${created.name}" ajouté (${created.type})`, getClientIp(req));
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la création.' });
  }
});

app.put('/api/equipments/:id', authenticate, requirePermission('modification'), async (req, res) => {
  const id = Number(req.params.id);
  const e  = req.body;
  try {
    const { rows } = await query(
      `UPDATE equipments SET
         name=$1, type=$2, brand=$3, model=$4, serial_number=$5, ip_address=$6,
         location=$7, department=$8, status=$9, purchase_date=$10, warranty=$11,
         last_maintenance=$12, visited=$13, technician_name=$14,
         visit_date=$15, intervention_details=$16
       WHERE id=$17
       RETURNING *`,
      [
        e.name, e.type, e.brand??'', e.model??'', e.serialNumber??'',
        e.ipAddress??'', e.location??'', e.department??'', e.status??'actif',
        e.purchaseDate??'', e.warranty??'', e.lastMaintenance??'', e.visited??false,
        e.technicianName??'', e.visitDate??'', e.interventionDetails??'', id
      ]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Équipement introuvable' });
    const updated = rowToEquipment(rows[0]);
    logActivity(req.user.id, req.user.username, req.user.name,
      'Modification équipement', `"${updated.name}" modifié`, getClientIp(req));
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  }
});

app.delete('/api/equipments/:id', authenticate, requirePermission('modification'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await query(
      'DELETE FROM equipments WHERE id=$1 RETURNING name', [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Équipement introuvable' });
    logActivity(req.user.id, req.user.username, req.user.name,
      'Suppression équipement', `"${rows[0].name}" supprimé`, getClientIp(req));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la suppression.' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
