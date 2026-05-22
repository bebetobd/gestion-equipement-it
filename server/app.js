import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, rowToEquipment, logEquipmentEvent, getEquipmentHistory, getEventsByDateRange, getEventsByDepartment, addDocument, getDocuments, getDocumentData, deleteDocument, getMaintenance, createMaintenance, updateMaintenance, deleteMaintenance, appendMaintenanceNote, getTransferEvents, getSites, createSite, updateSite, deleteSite, queryActivityLog, deleteSession } from './db.js';
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
  validators
} from './validation.js';

export const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/login', asyncHandler(async (req, res) => {
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
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    const valid = await bcrypt.compare(passwordVal.value, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    const permissions = user.permissions ?? [];
    const jwtSecret = process.env.JWT_SECRET || 'gestion-it-secret-2024';
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';

    const allowedSiteIds = user.allowed_site_ids ?? [];
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, permissions, allowedSiteIds },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    const ip = getClientIp(req);
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
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions,
        allowedSiteIds
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
      'SELECT id, username, name, role, permissions, allowed_site_ids FROM users ORDER BY id'
    );
    res.json(rows.map(r => ({ ...r, allowedSiteIds: r.allowed_site_ids ?? [] })));
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
    const { username, name, role, password, permissions, allowedSiteIds } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const safePerms = Array.isArray(permissions) ? permissions : ['lecture'];
    const safeSites = Array.isArray(allowedSiteIds) ? allowedSiteIds.map(Number).filter(Boolean) : [];

    const { rows } = await query(
      `INSERT INTO users (username, name, role, password, permissions, allowed_site_ids)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, username, name, role, permissions, allowed_site_ids`,
      [username.trim(), name.trim(), role, hashed, safePerms, safeSites]
    );

    logActivity(
      req.user.id,
      req.user.username,
      req.user.name,
      'Création utilisateur',
      `Compte "${username}" (${role}) créé`,
      getClientIp(req)
    );

    res.status(201).json({ ...rows[0], allowedSiteIds: rows[0].allowed_site_ids ?? [] });
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
    const { allowedSiteIds } = req.body;
    if (allowedSiteIds !== undefined) {
      const safeSites = Array.isArray(allowedSiteIds) ? allowedSiteIds.map(Number).filter(Boolean) : [];
      updateFields.push(`allowed_site_ids = $${paramCount++}`);
      params.push(safeSites);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(id);
    const updateSQL = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, username, name, role, permissions, allowed_site_ids`;

    const { rows } = await query(updateSQL, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    logActivity(
      req.user.id,
      req.user.username,
      req.user.name,
      'Modification utilisateur',
      `Compte "${rows[0].username}" modifié`,
      getClientIp(req)
    );

    res.json({ ...rows[0], allowedSiteIds: rows[0].allowed_site_ids ?? [] });
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


// ─── Equipment routes ─────────────────────────────────────────────────────────

app.get('/api/equipments', authenticate, requirePermission('lecture'), asyncHandler(async (req, res) => {
  try {
    const allowedSiteIds = req.user.allowedSiteIds ?? [];
    let rows;
    if (req.user.role !== 'admin' && allowedSiteIds.length > 0) {
      ({ rows } = await query(
        'SELECT * FROM equipments WHERE site_id = ANY($1::integer[]) ORDER BY id',
        [allowedSiteIds]
      ));
    } else {
      ({ rows } = await query('SELECT * FROM equipments ORDER BY id'));
    }
    res.json(rows.map(rowToEquipment));
  } catch (err) {
    handleError(err, res, 'Erreur lors de la récupération des équipements.');
  }
}));

app.get('/api/equipments/export', authenticate, requirePermission('lecture'), asyncHandler(async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM equipments ORDER BY id');
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
  const { name, city, country, address, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Le nom du site est requis.' });
  const site = await createSite({ name: name.trim(), city, country, address, description });
  logActivity(req.user.id, req.user.username, req.user.name, 'Création site', `Site "${name}" créé`, getClientIp(req));
  res.status(201).json(site);
}));

app.put('/api/sites/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid site ID' });
  const { name, city, country, address, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Le nom du site est requis.' });
  const site = await updateSite(id, { name: name.trim(), city, country, address, description });
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name, 'Modification site', `Site "${name}" modifié`, getClientIp(req));
  res.json(site);
}));

app.delete('/api/sites/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid site ID' });
  try {
    const deleted = await deleteSite(id);
    if (!deleted) return res.status(404).json({ message: 'Site introuvable.' });
    logActivity(req.user.id, req.user.username, req.user.name, 'Suppression site', `Site #${id} supprimé`, getClientIp(req));
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
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
         (name, type, brand, model, serial_number, ip_address, location, department,
          status, purchase_date, warranty, last_maintenance, visited,
          technician_name, visit_date, intervention_details, site_id, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        e.name, e.type, e.brand || '', e.model || '', e.serialNumber || '',
        e.ipAddress || '', e.location || '', e.department || '', e.status || 'actif',
        e.purchaseDate || '', e.warranty || '', e.lastMaintenance || '',
        e.visited || false, e.technicianName || '', e.visitDate || '',
        e.interventionDetails || '', e.siteId || null, Math.max(1, parseInt(e.quantity) || 1)
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
         name=$1, type=$2, brand=$3, model=$4, serial_number=$5, ip_address=$6,
         location=$7, department=$8, status=$9, purchase_date=$10, warranty=$11,
         last_maintenance=$12, visited=$13, technician_name=$14,
         visit_date=$15, intervention_details=$16, site_id=$17, quantity=$18
       WHERE id=$19
       RETURNING *`,
      [
        e.name, e.type, e.brand || '', e.model || '', e.serialNumber || '',
        e.ipAddress || '', e.location || '', e.department || '', e.status || 'actif',
        e.purchaseDate || '', e.warranty || '', e.lastMaintenance || '',
        e.visited || false, e.technicianName || '', e.visitDate || '',
        e.interventionDetails || '', e.siteId || null, Math.max(1, parseInt(e.quantity) || 1), id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Équipement introuvable' });
    }

    const updated = rowToEquipment(rows[0]);
    const ip = getClientIp(req);

    // Compute field-level changes
    const TRACKED = ['name','type','brand','model','serialNumber','ipAddress','location','department','status','purchaseDate','warranty','lastMaintenance','visited','technicianName','visitDate','interventionDetails'];
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

app.delete('/api/equipments/:id', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid equipment ID' });
  }

  try {
    const { rows } = await query(
      'DELETE FROM equipments WHERE id=$1 RETURNING name',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Équipement introuvable' });
    }

    const ip = getClientIp(req);
    logActivity(req.user.id, req.user.username, req.user.name, 'Suppression équipement', `"${rows[0].name}" supprimé`, ip);
    logEquipmentEvent({
      equipmentId: id, equipmentName: rows[0].name, equipmentType: '', department: '',
      action: 'Suppression', details: `Équipement "${rows[0].name}" supprimé du parc`,
      userId: req.user.id, username: req.user.username, userName: req.user.name, ip
    });

    res.status(204).send();
  } catch (err) {
    handleError(err, res, 'Erreur lors de la suppression.');
  }
}));

// ─── Transfer ────────────────────────────────────────────────────────────────

app.post('/api/equipments/:id/transfer', authenticate, requirePermission('modification'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });

  const { toLocation, toDepartment, toSiteId, reason, technicianName, notes, transferQty } = req.body;
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
          technician_name, visit_date, intervention_details, site_id, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        old.name, old.type, old.brand || '', old.model || '', old.serialNumber || '',
        old.ipAddress || '', toLocation, toDepartment, old.status,
        old.purchaseDate || '', old.warranty || '', old.lastMaintenance || '',
        old.visited, old.technicianName || '', old.visitDate || '',
        old.interventionDetails || '', newSiteId, qty
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
    userId: req.user.id, username: req.user.username, userName: req.user.name, ip
  });
  logActivity(req.user.id, req.user.username, req.user.name,
    'Transfert équipement', `"${old.name}"${isPartial ? ` (×${qty})` : ''} transféré vers "${toLocation}"${siteChanged ? ` (${toSiteName})` : ''}`, ip);

  res.json(updated);
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
  const { equipmentId, failureDesc, priority, technician, diagnosis, solution, partsReplaced } = req.body;
  if (!failureDesc?.trim()) return res.status(400).json({ message: 'Description de la panne requise.' });

  const record = await createMaintenance({
    equipmentId: equipmentId || null,
    failureDesc, diagnosis: diagnosis || '', solution: solution || '',
    partsReplaced: partsReplaced || '', technician: technician || '',
    openedBy: req.user.name, priority: priority || 'normale',
    ...(equipmentId ? {} : {}),
  });

  // Enrich with equipment info if ID provided
  if (equipmentId) {
    const { rows } = await query('SELECT name, type, department FROM equipments WHERE id=$1', [equipmentId]);
    if (rows[0]) {
      await query(
        'UPDATE maintenance_records SET equipment_name=$1, equipment_type=$2, department=$3 WHERE id=$4',
        [rows[0].name, rows[0].type, rows[0].department, record.id]
      );
      record.equipmentName = rows[0].name;
      record.equipmentType = rows[0].type;
      record.department = rows[0].department;
      // Set equipment status to maintenance
      await query("UPDATE equipments SET status='maintenance' WHERE id=$1", [equipmentId]);
      await logEquipmentEvent({
        equipmentId, equipmentName: rows[0].name, equipmentType: rows[0].type,
        department: rows[0].department, action: 'Maintenance',
        details: `Ticket de maintenance ouvert — Panne: ${failureDesc}`,
        technician: technician || '', userId: req.user.id,
        username: req.user.username, userName: req.user.name, ip: getClientIp(req)
      });
    }
  }

  logActivity(req.user.id, req.user.username, req.user.name,
    'Ticket maintenance', `Ticket ouvert: ${failureDesc.substring(0, 60)}`, getClientIp(req));
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

  const { status, diagnosis, solution, partsReplaced, technician, priority, failureDesc } = req.body;

  const updates = { failureDesc, diagnosis, solution, partsReplaced, technician, priority };
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

app.patch('/api/maintenance/:id/note', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ID' });
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Texte requis.' });
  const date = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const noteEntry = `[${date}] ${req.user.name} :\n${text.trim()}`;
  const updated = await appendMaintenanceNote(id, noteEntry);
  if (!updated) return res.status(404).json({ message: 'Ticket introuvable.' });
  logActivity(req.user.id, req.user.username, req.user.name, 'Info maintenance', `Note ajoutée au ticket #${id}`, getClientIp(req));
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

// ─── Reports ─────────────────────────────────────────────────────────────────

app.get('/api/reports/equipment/:id', authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid equipment ID' });
  const history = await getEquipmentHistory(id);
  res.json(history);
}));

app.get('/api/reports/by-date', authenticate, asyncHandler(async (req, res) => {
  const { from, to, department, type } = req.query;
  const events = await getEventsByDateRange({
    from: from || null,
    to: to ? new Date(new Date(to).getTime() + 86399999).toISOString() : null,
    department: department || null,
    type: type || null,
  });
  res.json(events);
}));

app.get('/api/reports/by-department', authenticate, asyncHandler(async (req, res) => {
  const stats = await getEventsByDepartment();
  res.json(stats);
}));

app.get('/api/reports/by-user', authenticate, asyncHandler(async (req, res) => {
  const { from, to, department } = req.query;
  const conditions = ["user_name != ''"];
  const params = [];
  let i = 1;
  if (from)       { conditions.push(`created_at >= $${i++}`); params.push(from); }
  if (to)         { conditions.push(`created_at <= $${i++}`); params.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (department) { conditions.push(`department = $${i++}`); params.push(department); }

  const { rows } = await query(`
    SELECT
      user_name, username,
      COUNT(*) AS total_actions,
      COUNT(*) FILTER (WHERE action = 'Création')     AS creations,
      COUNT(*) FILTER (WHERE action = 'Modification') AS modifications,
      COUNT(*) FILTER (WHERE action = 'Intervention') AS interventions,
      COUNT(*) FILTER (WHERE action = 'Transfert')    AS transferts,
      COUNT(*) FILTER (WHERE action = 'Suppression')  AS suppressions,
      COUNT(*) FILTER (WHERE action = 'Maintenance')  AS maintenances,
      COUNT(*) FILTER (WHERE action = 'Réforme')      AS reformes,
      COUNT(DISTINCT equipment_id)                     AS equipment_count,
      COUNT(DISTINCT department)                       AS dept_count,
      MAX(created_at)                                  AS last_action
    FROM equipment_events
    WHERE ${conditions.join(' AND ')}
    GROUP BY user_name, username
    ORDER BY total_actions DESC
  `, params);
  res.json(rows);
}));

app.get('/api/reports/user-detail', authenticate, asyncHandler(async (req, res) => {
  const { username, from, to, department } = req.query;
  if (!username) return res.status(400).json({ message: 'username requis' });
  const conditions = ['username = $1'];
  const params = [username];
  let i = 2;
  if (from)       { conditions.push(`created_at >= $${i++}`); params.push(from); }
  if (to)         { conditions.push(`created_at <= $${i++}`); params.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (department) { conditions.push(`department = $${i++}`); params.push(department); }
  params.push(300);
  const { rows } = await query(
    `SELECT * FROM equipment_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${i}`,
    params
  );
  res.json(rows.map(row => {
    let changes = [];
    try { changes = JSON.parse(row.changes || '[]'); } catch {}
    return {
      id: row.id, equipmentId: row.equipment_id, equipmentName: row.equipment_name,
      equipmentType: row.equipment_type, department: row.department, action: row.action,
      details: row.details, changes, technician: row.technician, userId: row.user_id,
      username: row.username, userName: row.user_name, ip: row.ip, createdAt: row.created_at,
    };
  }));
}));

// ─── Reports by site (admin only) ────────────────────────────────────────────

app.get('/api/reports/by-site', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { from, to, type } = req.query;
  const conditions = ['e.site_id IS NOT NULL'];
  const params = [];
  let i = 1;
  if (from) { conditions.push(`ev.created_at >= $${i++}`); params.push(from); }
  if (to)   { conditions.push(`ev.created_at <= $${i++}`); params.push(new Date(new Date(to).getTime() + 86399999).toISOString()); }
  if (type) { conditions.push(`ev.equipment_type = $${i++}`); params.push(type); }

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
      ${conditions.length ? 'AND ' + conditions.join(' AND ') : ''}
    GROUP BY s.id, s.name, s.city, s.country
    ORDER BY total_events DESC
  `, params);
  res.json(rows);
}));

app.get('/api/reports/site-detail', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { siteId, from, to, type } = req.query;
  if (!siteId) return res.status(400).json({ message: 'siteId requis' });

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
    try { changes = JSON.parse(row.changes || '[]'); } catch {}
    return {
      id: row.id, equipmentId: row.equipment_id, equipmentName: row.equipment_name,
      equipmentType: row.equipment_type, department: row.department, action: row.action,
      details: row.details, changes, technician: row.technician, userId: row.user_id,
      username: row.username, userName: row.user_name, ip: row.ip, createdAt: row.created_at,
    };
  }));
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
