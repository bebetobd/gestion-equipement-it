import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error('⚠️  DATABASE_URL non définie. Voir .env.example');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

let initialized = false;

async function initDB() {
  if (initialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id        SERIAL PRIMARY KEY,
      username  VARCHAR(100) UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      name      VARCHAR(200) NOT NULL,
      role      VARCHAR(50)  NOT NULL DEFAULT 'user',
      permissions TEXT[] NOT NULL DEFAULT ARRAY['lecture']::TEXT[]
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipments (
      id                   SERIAL PRIMARY KEY,
      name                 VARCHAR(200) NOT NULL DEFAULT '',
      type                 VARCHAR(50)  NOT NULL DEFAULT 'ordinateur',
      brand                VARCHAR(100) NOT NULL DEFAULT '',
      model                VARCHAR(100) NOT NULL DEFAULT '',
      serial_number        VARCHAR(100) NOT NULL DEFAULT '',
      ip_address           VARCHAR(50)  NOT NULL DEFAULT '',
      location             VARCHAR(200) NOT NULL DEFAULT '',
      department           VARCHAR(200) NOT NULL DEFAULT '',
      status               VARCHAR(50)  NOT NULL DEFAULT 'actif',
      purchase_date        VARCHAR(20)  NOT NULL DEFAULT '',
      warranty             VARCHAR(20)  NOT NULL DEFAULT '',
      last_maintenance     VARCHAR(20)  NOT NULL DEFAULT '',
      visited              BOOLEAN      NOT NULL DEFAULT FALSE,
      technician_name      VARCHAR(200) NOT NULL DEFAULT '',
      visit_date           VARCHAR(50)  NOT NULL DEFAULT '',
      intervention_details TEXT         NOT NULL DEFAULT ''
    )
  `);

  // Migration: add replaced_by_id if missing
  await pool.query(`ALTER TABLE equipments ADD COLUMN IF NOT EXISTS replaced_by_id INTEGER DEFAULT NULL`);

  // Seed users from JSON if table is empty
  const { rows: uCount } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(uCount[0].count, 10) === 0) {
    try {
      const data = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data', 'users.json'), 'utf-8')
      );
      for (const u of data) {
        await pool.query(
          `INSERT INTO users (id, username, password, name, role, permissions)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [u.id, u.username, u.password, u.name, u.role, u.permissions ?? ['lecture']]
        );
      }
      await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
    } catch (e) {
      console.error('Seeding users failed:', e.message);
    }
  }

  // Seed equipments from JSON if table is empty
  const { rows: eCount } = await pool.query('SELECT COUNT(*) FROM equipments');
  if (parseInt(eCount[0].count, 10) === 0) {
    try {
      const data = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data', 'equipments.json'), 'utf-8')
      );
      for (const e of data) {
        await pool.query(
          `INSERT INTO equipments
             (id, name, type, brand, model, serial_number, ip_address, location,
              department, status, purchase_date, warranty, last_maintenance,
              visited, technician_name, visit_date, intervention_details)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT DO NOTHING`,
          [
            e.id, e.name, e.type,
            e.brand ?? '', e.model ?? '', e.serialNumber ?? '',
            e.ipAddress ?? '', e.location ?? '', e.department ?? '',
            e.status ?? 'actif', e.purchaseDate ?? '', e.warranty ?? '',
            e.lastMaintenance ?? '', e.visited ?? false,
            e.technicianName ?? '', e.visitDate ?? '', e.interventionDetails ?? ''
          ]
        );
      }
      await pool.query("SELECT setval('equipments_id_seq', (SELECT MAX(id) FROM equipments))");
    } catch (e) {
      console.error('Seeding equipments failed:', e.message);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      city        VARCHAR(100) NOT NULL DEFAULT '',
      country     VARCHAR(100) NOT NULL DEFAULT '',
      address     TEXT         NOT NULL DEFAULT '',
      description TEXT         NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // Migration: add site_id to equipments
  await pool.query(`ALTER TABLE equipments ADD COLUMN IF NOT EXISTS site_id INTEGER DEFAULT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipment_events (
      id              SERIAL PRIMARY KEY,
      equipment_id    INTEGER,
      equipment_name  VARCHAR(200) NOT NULL DEFAULT '',
      equipment_type  VARCHAR(50)  NOT NULL DEFAULT '',
      department      VARCHAR(200) NOT NULL DEFAULT '',
      action          VARCHAR(100) NOT NULL,
      details         TEXT         NOT NULL DEFAULT '',
      changes         TEXT         NOT NULL DEFAULT '[]',
      technician      VARCHAR(200) NOT NULL DEFAULT '',
      user_id         INTEGER,
      username        VARCHAR(100) NOT NULL DEFAULT '',
      user_name       VARCHAR(200) NOT NULL DEFAULT '',
      ip              VARCHAR(50)  NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_equipment_events_equipment_id
      ON equipment_events(equipment_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_equipment_events_created_at
      ON equipment_events(created_at)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_equipment_events_department
      ON equipment_events(department)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipment_documents (
      id           SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL,
      filename     VARCHAR(500) NOT NULL,
      file_type    VARCHAR(100) NOT NULL DEFAULT '',
      file_size    INTEGER NOT NULL DEFAULT 0,
      file_data    TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      uploaded_by  VARCHAR(200) NOT NULL DEFAULT '',
      uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_equipment_documents_equipment_id
      ON equipment_documents(equipment_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_records (
      id               SERIAL PRIMARY KEY,
      equipment_id     INTEGER,
      equipment_name   VARCHAR(200) NOT NULL DEFAULT '',
      equipment_type   VARCHAR(50)  NOT NULL DEFAULT '',
      department       VARCHAR(200) NOT NULL DEFAULT '',
      failure_desc     TEXT NOT NULL DEFAULT '',
      diagnosis        TEXT NOT NULL DEFAULT '',
      solution         TEXT NOT NULL DEFAULT '',
      parts_replaced   TEXT NOT NULL DEFAULT '',
      technician       VARCHAR(200) NOT NULL DEFAULT '',
      opened_by        VARCHAR(200) NOT NULL DEFAULT '',
      opened_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      started_at       TIMESTAMPTZ,
      closed_at        TIMESTAMPTZ,
      status           VARCHAR(20)  NOT NULL DEFAULT 'ouvert',
      priority         VARCHAR(20)  NOT NULL DEFAULT 'normale'
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_maintenance_equipment_id ON maintenance_records(equipment_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_activity_log (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER,
      username   VARCHAR(100) NOT NULL DEFAULT '',
      user_name  VARCHAR(200) NOT NULL DEFAULT '',
      action     VARCHAR(200) NOT NULL DEFAULT '',
      details    TEXT         NOT NULL DEFAULT '',
      ip         VARCHAR(50)  NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ual_username   ON user_activity_log(username)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ual_created_at ON user_activity_log(created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ual_action     ON user_activity_log(action)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      user_id   INTEGER PRIMARY KEY,
      username  VARCHAR(100) NOT NULL,
      name      VARCHAR(200) NOT NULL DEFAULT '',
      role      VARCHAR(50)  NOT NULL DEFAULT 'user',
      ip        VARCHAR(50)  NOT NULL DEFAULT '',
      login_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  initialized = true;
}

export async function query(text, params) {
  await initDB();
  return pool.query(text, params);
}

export async function logEquipmentEvent({ equipmentId, equipmentName, equipmentType, department, action, details, changes = [], technician = '', userId, username, userName, ip }) {
  await initDB();
  return pool.query(
    `INSERT INTO equipment_events
       (equipment_id, equipment_name, equipment_type, department, action, details, changes, technician, user_id, username, user_name, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [equipmentId, equipmentName, equipmentType, department, action, details, JSON.stringify(changes), technician, userId, username, userName, ip]
  );
}

export async function getEquipmentHistory(equipmentId) {
  await initDB();
  const { rows } = await pool.query(
    `SELECT * FROM equipment_events WHERE equipment_id = $1 ORDER BY created_at ASC`,
    [equipmentId]
  );
  return rows.map(rowToEvent);
}

export async function getEventsByDateRange({ from, to, department, type, limit = 500 }) {
  await initDB();
  const conditions = ['1=1'];
  const params = [];
  let i = 1;

  if (from) { conditions.push(`created_at >= $${i++}`); params.push(from); }
  if (to)   { conditions.push(`created_at <= $${i++}`); params.push(to); }
  if (department) { conditions.push(`department = $${i++}`); params.push(department); }
  if (type)       { conditions.push(`equipment_type = $${i++}`); params.push(type); }

  params.push(limit);
  const { rows } = await pool.query(
    `SELECT * FROM equipment_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${i}`,
    params
  );
  return rows.map(rowToEvent);
}

export async function getEventsByDepartment() {
  await initDB();
  const { rows } = await pool.query(`
    SELECT
      department,
      COUNT(*) AS total_events,
      COUNT(DISTINCT equipment_id) AS equipment_count,
      COUNT(*) FILTER (WHERE action = 'Création') AS creations,
      COUNT(*) FILTER (WHERE action = 'Modification') AS modifications,
      COUNT(*) FILTER (WHERE action = 'Intervention') AS interventions,
      COUNT(*) FILTER (WHERE action = 'Suppression') AS suppressions,
      MAX(created_at) AS last_activity
    FROM equipment_events
    WHERE department != ''
    GROUP BY department
    ORDER BY total_events DESC
  `);
  return rows;
}

export async function addDocument({ equipmentId, filename, fileType, fileSize, fileData, description, uploadedBy }) {
  await initDB();
  const { rows } = await pool.query(
    `INSERT INTO equipment_documents (equipment_id, filename, file_type, file_size, file_data, description, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, equipment_id, filename, file_type, file_size, description, uploaded_by, uploaded_at`,
    [equipmentId, filename, fileType || '', fileSize || 0, fileData, description || '', uploadedBy || '']
  );
  return rowToDoc(rows[0]);
}

export async function getDocuments(equipmentId) {
  await initDB();
  const { rows } = await pool.query(
    `SELECT id, equipment_id, filename, file_type, file_size, description, uploaded_by, uploaded_at
     FROM equipment_documents WHERE equipment_id = $1 ORDER BY uploaded_at ASC`,
    [equipmentId]
  );
  return rows.map(rowToDoc);
}

export async function getDocumentData(id) {
  await initDB();
  const { rows } = await pool.query(
    'SELECT id, filename, file_type, file_data FROM equipment_documents WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function deleteDocument(id) {
  await initDB();
  const { rows } = await pool.query(
    'DELETE FROM equipment_documents WHERE id = $1 RETURNING id, filename',
    [id]
  );
  return rows[0] || null;
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

export async function getMaintenance({ status, equipmentId, limit = 200 } = {}) {
  await initDB();
  const conditions = ['1=1'];
  const params = [];
  let i = 1;
  if (status && status !== 'all') { conditions.push(`status = $${i++}`); params.push(status); }
  if (equipmentId)               { conditions.push(`equipment_id = $${i++}`); params.push(equipmentId); }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT * FROM maintenance_records WHERE ${conditions.join(' AND ')} ORDER BY opened_at DESC LIMIT $${i}`,
    params
  );
  return rows.map(rowToMaintenance);
}

export async function createMaintenance(data) {
  await initDB();
  const { equipmentId, equipmentName, equipmentType, department, failureDesc, diagnosis, solution, partsReplaced, technician, openedBy, priority } = data;
  const { rows } = await pool.query(
    `INSERT INTO maintenance_records
       (equipment_id, equipment_name, equipment_type, department, failure_desc, diagnosis, solution, parts_replaced, technician, opened_by, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [equipmentId, equipmentName || '', equipmentType || '', department || '', failureDesc || '', diagnosis || '', solution || '', partsReplaced || '', technician || '', openedBy || '', priority || 'normale']
  );
  return rowToMaintenance(rows[0]);
}

export async function updateMaintenance(id, data) {
  await initDB();
  const fields = [];
  const params = [];
  let i = 1;
  const map = { failureDesc: 'failure_desc', diagnosis: 'diagnosis', solution: 'solution', partsReplaced: 'parts_replaced', technician: 'technician', status: 'status', priority: 'priority', startedAt: 'started_at', closedAt: 'closed_at' };
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) { fields.push(`${col} = $${i++}`); params.push(data[key]); }
  }
  if (fields.length === 0) return null;
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  return rows[0] ? rowToMaintenance(rows[0]) : null;
}

export async function deleteMaintenance(id) {
  await initDB();
  const { rows } = await pool.query('DELETE FROM maintenance_records WHERE id=$1 RETURNING id', [id]);
  return rows[0] || null;
}

function rowToMaintenance(row) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentType: row.equipment_type,
    department: row.department,
    failureDesc: row.failure_desc,
    diagnosis: row.diagnosis,
    solution: row.solution,
    partsReplaced: row.parts_replaced,
    technician: row.technician,
    openedBy: row.opened_by,
    openedAt: row.opened_at,
    startedAt: row.started_at,
    closedAt: row.closed_at,
    status: row.status,
    priority: row.priority,
  };
}

function rowToDoc(row) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    filename: row.filename,
    fileType: row.file_type,
    fileSize: row.file_size,
    description: row.description,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

function rowToEvent(row) {
  let changes = [];
  try { changes = JSON.parse(row.changes || '[]'); } catch {}
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentType: row.equipment_type,
    department: row.department,
    action: row.action,
    details: row.details,
    changes,
    technician: row.technician,
    userId: row.user_id,
    username: row.username,
    userName: row.user_name,
    ip: row.ip,
    createdAt: row.created_at,
  };
}

// Maps a PostgreSQL row (snake_case) → Equipment JS object (camelCase)
export function rowToEquipment(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    ipAddress: row.ip_address,
    location: row.location,
    department: row.department,
    status: row.status,
    purchaseDate: row.purchase_date,
    warranty: row.warranty,
    lastMaintenance: row.last_maintenance,
    visited: row.visited,
    technicianName: row.technician_name,
    visitDate: row.visit_date,
    interventionDetails: row.intervention_details,
    replacedById: row.replaced_by_id ?? null,
    siteId: row.site_id ?? null,
  };
}

// ─── Sites ────────────────────────────────────────────────────────────────────

export async function getSites() {
  await initDB();
  const { rows } = await pool.query(`
    SELECT s.*, COUNT(e.id)::int AS equipment_count
    FROM sites s
    LEFT JOIN equipments e ON e.site_id = s.id
    GROUP BY s.id
    ORDER BY s.country, s.city, s.name
  `);
  return rows.map(r => ({
    id: r.id, name: r.name, city: r.city, country: r.country,
    address: r.address, description: r.description,
    createdAt: r.created_at, equipmentCount: r.equipment_count,
  }));
}

export async function createSite({ name, city, country, address, description }) {
  await initDB();
  const { rows } = await pool.query(
    `INSERT INTO sites (name, city, country, address, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, city || '', country || '', address || '', description || '']
  );
  return { ...rows[0], equipmentCount: 0 };
}

export async function updateSite(id, { name, city, country, address, description }) {
  await initDB();
  const { rows } = await pool.query(
    `UPDATE sites SET name=$1, city=$2, country=$3, address=$4, description=$5 WHERE id=$6 RETURNING *`,
    [name, city || '', country || '', address || '', description || '', id]
  );
  return rows[0] || null;
}

export async function deleteSite(id) {
  await initDB();
  const { rows: linked } = await pool.query('SELECT COUNT(*) FROM equipments WHERE site_id=$1', [id]);
  if (parseInt(linked[0].count, 10) > 0) {
    throw Object.assign(new Error('Ce site possède des équipements. Réaffectez-les avant de supprimer le site.'), { status: 409 });
  }
  const { rows } = await pool.query('DELETE FROM sites WHERE id=$1 RETURNING id', [id]);
  return rows[0] || null;
}

export async function getTransferEvents({ department, from, to, limit = 500 } = {}) {
  await initDB();
  const conditions = ["action = 'Transfert'"];
  const params = [];
  let i = 1;
  if (from)       { conditions.push(`created_at >= $${i++}`); params.push(from); }
  if (to)         { conditions.push(`created_at <= $${i++}`); params.push(to); }
  if (department) { conditions.push(`changes::text ILIKE $${i++}`); params.push(`%${department}%`); }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT * FROM equipment_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows.map(rowToEvent);
}

export async function insertActivityLog({ userId, username, userName, action, details, ip }) {
  await initDB();
  await pool.query(
    `INSERT INTO user_activity_log (user_id, username, user_name, action, details, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId ?? null, username || '', userName || '', action || '', details || '', ip || '']
  );
}

export async function upsertSession({ userId, username, name, role, ip, loginAt, lastSeen }) {
  await initDB();
  await pool.query(
    `INSERT INTO user_sessions (user_id, username, name, role, ip, login_at, last_seen)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username, name = EXCLUDED.name, role = EXCLUDED.role,
       ip = EXCLUDED.ip, login_at = EXCLUDED.login_at, last_seen = EXCLUDED.last_seen`,
    [userId, username || '', name || '', role || 'user', ip || '',
     loginAt || new Date().toISOString(), lastSeen || new Date().toISOString()]
  );
}

export async function deleteSession(userId) {
  await initDB();
  await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}

export async function updateSessionLastSeen(userId) {
  await initDB();
  await pool.query('UPDATE user_sessions SET last_seen = NOW() WHERE user_id = $1', [userId]);
}

export async function queryActiveSessions() {
  await initDB();
  const { rows } = await pool.query('SELECT * FROM user_sessions ORDER BY last_seen DESC');
  return rows.map(r => ({
    userId: r.user_id, username: r.username, name: r.name,
    role: r.role, ip: r.ip, loginAt: r.login_at, lastSeen: r.last_seen,
  }));
}

export async function queryActivityLog({ userId, username, dateFrom, dateTo, action, limit = 200 } = {}) {
  await initDB();
  const conditions = [];
  const params = [];
  let i = 1;
  if (userId)   { conditions.push(`user_id = $${i++}`); params.push(userId); }
  if (username) { conditions.push(`username = $${i++}`); params.push(username); }
  if (action)   { conditions.push(`action ILIKE $${i++}`); params.push(`%${action}%`); }
  if (dateFrom) { conditions.push(`created_at >= $${i++}`); params.push(dateFrom); }
  if (dateTo)   { conditions.push(`created_at < $${i++}`); params.push(dateTo + 'T23:59:59.999Z'); }
  params.push(Math.min(Number(limit) || 200, 500));
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM user_activity_log ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows.map(r => ({
    id: r.id, userId: r.user_id, username: r.username,
    name: r.user_name, userName: r.user_name,
    action: r.action, details: r.details, ip: r.ip,
    timestamp: r.created_at, createdAt: r.created_at
  }));
}
