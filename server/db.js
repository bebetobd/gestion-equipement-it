import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error('⚠️  DATABASE_URL non définie. Voir .env.example');
}

const isLocal = !process.env.VERCEL_ENV && !process.env.DATABASE_URL?.includes('neon');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

let initialized = false;

async function initDB() {
  if (initialized) return;

  // Don't let initDB failures break the app (tables already exist from prior runs)
  if (process.env.VERCEL_ENV) {
    try {
      await _initDB();
    } catch (e) {
      console.error('initDB error (non-fatal):', e?.message || e);
    }
    initialized = true;
    return;
  }
  await _initDB();
  initialized = true;
}

async function _initDB() {
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

  // Migration: add quantity
  await pool.query(`ALTER TABLE equipments ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`);

  // Migration: add min_quantity (stock threshold for accessories)
  await pool.query(`ALTER TABLE equipments ADD COLUMN IF NOT EXISTS min_quantity INTEGER NOT NULL DEFAULT 0`);

  // Migration: add blocked and allowed_site_ids columns to users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_site_ids INTEGER[] DEFAULT NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMP DEFAULT NULL`);

  // Seed default users (passwords hashed at runtime)
  const defaultUsers = [
    { username:'admin',       password:'admin2024',       role:'admin',       name:'Administrateur',  permissions:['administration','modification','lecture'] },
    { username:'technicien',  password:'technicien2024',  role:'technicien', name:'Technicien IT',   permissions:['modification','lecture'] },
    { username:'utilisateur', password:'utilisateur2024', role:'user',       name:'Utilisateur',     permissions:['lecture'] }
  ];
  for (const u of defaultUsers) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query('DELETE FROM users WHERE username = $1', [u.username]);
    await pool.query(
      `INSERT INTO users (username, password, name, role, permissions) VALUES ($1,$2,$3,$4,$5)`,
      [u.username, hash, u.name, u.role, u.permissions]
    );
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
  await pool.query(`ALTER TABLE equipment_events ADD COLUMN IF NOT EXISTS transfer_requester VARCHAR(200) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE equipment_events ADD COLUMN IF NOT EXISTS transfer_responsible VARCHAR(200) NOT NULL DEFAULT ''`);

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

  // Migration: add allowed_site_ids to users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_site_ids INTEGER[] NOT NULL DEFAULT '{}'`);

  // Migration: add blocked flag to users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE`);
  // Débloquer les comptes edem, pasca, piteur s'ils étaient bloqués
  await pool.query(`UPDATE users SET blocked = FALSE WHERE username IN ('edem', 'pasca', 'piteur') AND blocked = TRUE`);

  // Migration: add notes to maintenance_records
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`);

  // Chat tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id               SERIAL PRIMARY KEY,
      sender_id        INTEGER NOT NULL,
      sender_name      VARCHAR(255) NOT NULL,
      sender_username  VARCHAR(255) NOT NULL,
      recipient_id     INTEGER DEFAULT NULL,
      group_id         INTEGER DEFAULT NULL,
      content          TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS group_id INTEGER DEFAULT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_created   ON chat_messages(created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages(recipient_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_group     ON chat_messages(group_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_read_markers (
      user_id          INTEGER NOT NULL,
      conversation_key VARCHAR(100) NOT NULL,
      last_read_id     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, conversation_key)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_groups (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_group_members (
      group_id INTEGER NOT NULL,
      user_id  INTEGER NOT NULL,
      PRIMARY KEY (group_id, user_id)
    )
  `);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id               SERIAL PRIMARY KEY,
      site_id          INTEGER NOT NULL,
      site_name        VARCHAR(200) NOT NULL DEFAULT '',
      scheduled_date   DATE NOT NULL,
      scheduled_time   VARCHAR(10) NOT NULL DEFAULT '',
      technician       VARCHAR(200) NOT NULL DEFAULT '',
      purpose          TEXT NOT NULL DEFAULT '',
      status           VARCHAR(20) NOT NULL DEFAULT 'planifié',
      notes            TEXT NOT NULL DEFAULT '',
      created_by       VARCHAR(200) NOT NULL DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      with_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
      equipment_ids    INTEGER[] NOT NULL DEFAULT '{}',
      maintenance_desc TEXT NOT NULL DEFAULT ''
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_site_visits_site_id ON site_visits(site_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_site_visits_date    ON site_visits(scheduled_date)`);
  await pool.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS validation_comment TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS validated_by VARCHAR(200) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS rescheduled_date DATE`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS visit_id INTEGER REFERENCES site_visits(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS site_name VARCHAR(200) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) NOT NULL DEFAULT 'maintenance'`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS assigned_tech_id INTEGER DEFAULT NULL`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS user_confirmed BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS tech_confirmed BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT NULL`);
  await pool.query(`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS review_comment TEXT NOT NULL DEFAULT ''`);

  // Licences logicielles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(200) NOT NULL DEFAULT '',
      vendor        VARCHAR(200) NOT NULL DEFAULT '',
      license_key   TEXT         NOT NULL DEFAULT '',
      seats         INTEGER      NOT NULL DEFAULT 1,
      used_seats    INTEGER      NOT NULL DEFAULT 0,
      equipment_id  INTEGER      REFERENCES equipments(id) ON DELETE SET NULL,
      purchase_date DATE,
      expiry_date   DATE,
      notes         TEXT         NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON licenses(expiry_date)`);

  // Coordonnées géographiques des sites (pour la carte)
  await pool.query(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`);
  await pool.query(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`);

  // Contrats de maintenance
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_contracts (
      id             SERIAL PRIMARY KEY,
      title          VARCHAR(300) NOT NULL DEFAULT '',
      vendor         VARCHAR(200) NOT NULL DEFAULT '',
      contract_number VARCHAR(100) NOT NULL DEFAULT '',
      site_id        INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      equipment_ids  INTEGER[] NOT NULL DEFAULT '{}',
      start_date     DATE,
      end_date       DATE,
      amount         NUMERIC(12,2),
      currency       VARCHAR(10) NOT NULL DEFAULT 'XOF',
      scope          TEXT NOT NULL DEFAULT '',
      contact_name   VARCHAR(200) NOT NULL DEFAULT '',
      contact_email  VARCHAR(200) NOT NULL DEFAULT '',
      contact_phone  VARCHAR(50)  NOT NULL DEFAULT '',
      status         VARCHAR(20)  NOT NULL DEFAULT 'actif',
      notes          TEXT NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON maintenance_contracts(end_date)`);

  // Demandes d'achat
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id              SERIAL PRIMARY KEY,
      title           VARCHAR(300) NOT NULL DEFAULT '',
      equipment_type  VARCHAR(50)  NOT NULL DEFAULT 'ordinateur',
      quantity        INTEGER      NOT NULL DEFAULT 1,
      estimated_cost  NUMERIC(12,2),
      currency        VARCHAR(10)  NOT NULL DEFAULT 'XOF',
      priority        VARCHAR(20)  NOT NULL DEFAULT 'normale',
      justification   TEXT NOT NULL DEFAULT '',
      requested_by    VARCHAR(200) NOT NULL DEFAULT '',
      department      VARCHAR(200) NOT NULL DEFAULT '',
      site_id         INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      status          VARCHAR(20)  NOT NULL DEFAULT 'en_attente',
      approved_by     VARCHAR(200) NOT NULL DEFAULT '',
      approved_at     TIMESTAMPTZ,
      rejection_reason TEXT NOT NULL DEFAULT '',
      notes           TEXT NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase_requests(status)`);

  // Demandes RMA (retour garantie)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rma_requests (
      id               SERIAL PRIMARY KEY,
      equipment_id     INTEGER REFERENCES equipments(id) ON DELETE SET NULL,
      equipment_name   VARCHAR(200) NOT NULL DEFAULT '',
      serial_number    VARCHAR(100) NOT NULL DEFAULT '',
      vendor           VARCHAR(200) NOT NULL DEFAULT '',
      rma_number       VARCHAR(100) NOT NULL DEFAULT '',
      reason           TEXT NOT NULL DEFAULT '',
      shipped_date     DATE,
      received_date    DATE,
      resolution       TEXT NOT NULL DEFAULT '',
      status           VARCHAR(20)  NOT NULL DEFAULT 'ouvert',
      technician       VARCHAR(200) NOT NULL DEFAULT '',
      notes            TEXT NOT NULL DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Webhook Slack/Teams
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_webhook TEXT NOT NULL DEFAULT ''`);
}

export async function query(text, params) {
  await initDB();
  return pool.query(text, params);
}

export async function logEquipmentEvent({ equipmentId, equipmentName, equipmentType, department, action, details, changes = [], technician = '', userId, username, userName, ip, transferRequester = '', transferResponsible = '' }) {
  await initDB();
  return pool.query(
    `INSERT INTO equipment_events
       (equipment_id, equipment_name, equipment_type, department, action, details, changes, technician, user_id, username, user_name, ip, transfer_requester, transfer_responsible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [equipmentId, equipmentName, equipmentType, department, action, details, JSON.stringify(changes), technician, userId, username, userName, ip, transferRequester, transferResponsible]
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
  const { equipmentId, equipmentName, equipmentType, department, failureDesc, diagnosis, solution, partsReplaced, technician, openedBy, priority, status, visitId, siteName, requestType } = data;
  const { rows } = await pool.query(
    `INSERT INTO maintenance_records
       (equipment_id, equipment_name, equipment_type, department, failure_desc, diagnosis, solution, parts_replaced, technician, opened_by, priority, status, visit_id, site_name, request_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [equipmentId ?? null, equipmentName || '', equipmentType || '', department || '', failureDesc || '', diagnosis || '', solution || '', partsReplaced || '', technician || '', openedBy || '', priority || 'normale', status || 'ouvert', visitId ?? null, siteName || '', requestType || 'maintenance']
  );
  return rowToMaintenance(rows[0]);
}

export async function updateMaintenance(id, data) {
  await initDB();
  const fields = [];
  const params = [];
  let i = 1;
  const map = { failureDesc: 'failure_desc', diagnosis: 'diagnosis', solution: 'solution', partsReplaced: 'parts_replaced', technician: 'technician', status: 'status', priority: 'priority', startedAt: 'started_at', closedAt: 'closed_at', notes: 'notes', visitId: 'visit_id', siteName: 'site_name', requestType: 'request_type', assignedTechId: 'assigned_tech_id', userConfirmed: 'user_confirmed', techConfirmed: 'tech_confirmed', rating: 'rating', reviewComment: 'review_comment' };
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

export async function appendMaintenanceNote(id, noteEntry) {
  await initDB();
  const { rows: cur } = await pool.query('SELECT notes FROM maintenance_records WHERE id=$1', [id]);
  if (!cur[0]) return null;
  const merged = cur[0].notes ? `${noteEntry}\n\n---\n\n${cur[0].notes}` : noteEntry;
  const { rows } = await pool.query('UPDATE maintenance_records SET notes=$1 WHERE id=$2 RETURNING *', [merged, id]);
  return rows[0] ? rowToMaintenance(rows[0]) : null;
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
    notes: row.notes || '',
    visitId: row.visit_id ?? null,
    siteName: row.site_name || '',
    requestType: row.request_type || 'maintenance',
    assignedTechId: row.assigned_tech_id ?? null,
    userConfirmed: row.user_confirmed ?? false,
    techConfirmed: row.tech_confirmed ?? false,
    rating: row.rating ?? null,
    reviewComment: row.review_comment || '',
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
    transferRequester: row.transfer_requester || '',
    transferResponsible: row.transfer_responsible || '',
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
    quantity: row.quantity ?? 1,
    minQuantity: row.min_quantity ?? 0,
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

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function getChatMessages({ isGlobal, withUserId, groupId, currentUserId, sinceId, limit = 80 }) {
  await initDB();
  let sql, params;
  if (groupId) {
    // Verify membership
    const { rows: check } = await pool.query(
      'SELECT 1 FROM chat_group_members WHERE group_id=$1 AND user_id=$2', [groupId, currentUserId]
    );
    if (!check.length) throw Object.assign(new Error('Accès refusé'), { status: 403 });
    const conds = ['group_id=$1'];
    params = [groupId];
    let i = 2;
    if (sinceId) { conds.push(`id > $${i++}`); params.push(sinceId); }
    params.push(limit);
    sql = `SELECT * FROM chat_messages WHERE ${conds.join(' AND ')} ORDER BY created_at ASC LIMIT $${i}`;
  } else if (isGlobal) {
    const conds = ['recipient_id IS NULL', 'group_id IS NULL'];
    params = [];
    let i = 1;
    if (sinceId) { conds.push(`id > $${i++}`); params.push(sinceId); }
    params.push(limit);
    sql = `SELECT * FROM chat_messages WHERE ${conds.join(' AND ')} ORDER BY created_at ASC LIMIT $${i}`;
  } else {
    const conds = ['((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1))', 'group_id IS NULL'];
    params = [currentUserId, withUserId];
    let i = 3;
    if (sinceId) { conds.push(`id > $${i++}`); params.push(sinceId); }
    params.push(limit);
    sql = `SELECT * FROM chat_messages WHERE ${conds.join(' AND ')} ORDER BY created_at ASC LIMIT $${i}`;
  }
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function createChatGroup({ name, createdBy, memberIds }) {
  await initDB();
  const { rows } = await pool.query(
    'INSERT INTO chat_groups (name, created_by) VALUES ($1,$2) RETURNING *',
    [name, createdBy]
  );
  const group = rows[0];
  const allMembers = [...new Set([createdBy, ...memberIds])];
  for (const uid of allMembers) {
    await pool.query(
      'INSERT INTO chat_group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [group.id, uid]
    );
  }
  return { ...group, member_ids: allMembers };
}

export async function getUserGroups(userId) {
  await initDB();
  const { rows } = await pool.query(`
    SELECT g.*, array_agg(DISTINCT gm2.user_id) AS member_ids
    FROM chat_groups g
    JOIN chat_group_members gm  ON gm.group_id  = g.id AND gm.user_id = $1
    JOIN chat_group_members gm2 ON gm2.group_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `, [userId]);
  return rows;
}

export async function sendChatMessage({ senderId, senderName, senderUsername, recipientId, groupId, content }) {
  await initDB();
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (sender_id, sender_name, sender_username, recipient_id, group_id, content)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [senderId, senderName, senderUsername, recipientId || null, groupId || null, content]
  );
  return rows[0];
}

export async function markChatRead({ userId, conversationKey, lastReadId }) {
  await initDB();
  await pool.query(
    `INSERT INTO chat_read_markers (user_id, conversation_key, last_read_id)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, conversation_key)
     DO UPDATE SET last_read_id = GREATEST(chat_read_markers.last_read_id, EXCLUDED.last_read_id)`,
    [userId, conversationKey, lastReadId]
  );
}

export async function getChatUnread(userId) {
  await initDB();
  const { rows: g } = await pool.query(
    `SELECT COUNT(*) AS unread FROM chat_messages m
     LEFT JOIN chat_read_markers r ON r.user_id=$1 AND r.conversation_key='global'
     WHERE m.recipient_id IS NULL AND m.group_id IS NULL AND m.sender_id!=$1
       AND m.id > COALESCE(r.last_read_id,0)`,
    [userId]
  );
  const { rows: d } = await pool.query(
    `SELECT m.sender_id,
            'dm:' || LEAST(m.sender_id,$1) || ':' || GREATEST(m.sender_id,$1) AS dm_key,
            COUNT(*) AS unread
     FROM chat_messages m
     LEFT JOIN chat_read_markers r
       ON r.user_id=$1
      AND r.conversation_key = 'dm:' || LEAST(m.sender_id,$1) || ':' || GREATEST(m.sender_id,$1)
     WHERE m.recipient_id=$1 AND m.group_id IS NULL AND m.id > COALESCE(r.last_read_id,0)
     GROUP BY m.sender_id`,
    [userId]
  );
  const { rows: gr } = await pool.query(
    `SELECT m.group_id, COUNT(*) AS unread
     FROM chat_messages m
     JOIN chat_group_members gm ON gm.group_id = m.group_id AND gm.user_id = $1
     LEFT JOIN chat_read_markers r
       ON r.user_id=$1 AND r.conversation_key = 'group:' || m.group_id
     WHERE m.group_id IS NOT NULL AND m.sender_id != $1
       AND m.id > COALESCE(r.last_read_id,0)
     GROUP BY m.group_id`,
    [userId]
  );
  return {
    global: Number(g[0]?.unread || 0),
    dms: d.reduce((acc, r) => { acc[r.sender_id] = Number(r.unread); return acc; }, {}),
    groups: gr.reduce((acc, r) => { acc[r.group_id] = Number(r.unread); return acc; }, {}),
  };
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

// ─── Site Visits ──────────────────────────────────────────────────────────────

export async function getVisits({ siteId, status, from, to } = {}) {
  await initDB();
  let q = 'SELECT * FROM site_visits WHERE 1=1';
  const params = [];
  if (siteId) { params.push(siteId); q += ` AND site_id = $${params.length}`; }
  if (status) { params.push(status); q += ` AND status = $${params.length}`; }
  if (from)   { params.push(from);   q += ` AND scheduled_date >= $${params.length}`; }
  if (to)     { params.push(to);     q += ` AND scheduled_date <= $${params.length}`; }
  q += ' ORDER BY scheduled_date ASC, scheduled_time ASC';
  const { rows } = await pool.query(q, params);
  return rows.map(r => ({
    id: r.id, siteId: r.site_id, siteName: r.site_name,
    scheduledDate: r.scheduled_date?.toISOString?.()?.slice(0,10) ?? r.scheduled_date,
    scheduledTime: r.scheduled_time, technician: r.technician,
    purpose: r.purpose, status: r.status, notes: r.notes,
    createdBy: r.created_by, createdAt: r.created_at,
    withMaintenance: r.with_maintenance,
    equipmentIds: r.equipment_ids ?? [],
    maintenanceDesc: r.maintenance_desc,
    validationComment: r.validation_comment ?? '',
    validatedAt: r.validated_at ?? null,
    validatedBy: r.validated_by ?? '',
    rescheduledDate: r.rescheduled_date?.toISOString?.()?.slice(0,10) ?? r.rescheduled_date ?? null
  }));
}

export async function createVisit({ siteId, siteName, scheduledDate, scheduledTime, technician, purpose, status, notes, createdBy, withMaintenance, equipmentIds, maintenanceDesc }) {
  await initDB();
  const { rows } = await pool.query(
    `INSERT INTO site_visits (site_id, site_name, scheduled_date, scheduled_time, technician, purpose, status, notes, created_by, with_maintenance, equipment_ids, maintenance_desc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [siteId, siteName, scheduledDate, scheduledTime||'', technician, purpose, status||'planifié', notes||'', createdBy||'', withMaintenance||false, equipmentIds||[], maintenanceDesc||'']
  );
  const r = rows[0];
  return { id: r.id, siteId: r.site_id, siteName: r.site_name,
    scheduledDate: r.scheduled_date?.toISOString?.()?.slice(0,10) ?? r.scheduled_date,
    scheduledTime: r.scheduled_time, technician: r.technician,
    purpose: r.purpose, status: r.status, notes: r.notes,
    createdBy: r.created_by, createdAt: r.created_at,
    withMaintenance: r.with_maintenance, equipmentIds: r.equipment_ids ?? [], maintenanceDesc: r.maintenance_desc };
}

export async function updateVisit(id, { siteId, siteName, scheduledDate, scheduledTime, technician, purpose, status, notes, withMaintenance, equipmentIds, maintenanceDesc, validationComment, validatedAt, validatedBy, rescheduledDate }) {
  await initDB();
  const { rows } = await pool.query(
    `UPDATE site_visits SET site_id=$1,site_name=$2,scheduled_date=$3,scheduled_time=$4,technician=$5,purpose=$6,status=$7,notes=$8,with_maintenance=$9,equipment_ids=$10,maintenance_desc=$11,validation_comment=$12,validated_at=$13,validated_by=$14,rescheduled_date=$15 WHERE id=$16 RETURNING *`,
    [siteId, siteName, scheduledDate, scheduledTime||'', technician, purpose, status, notes||'', withMaintenance||false, equipmentIds||[], maintenanceDesc||'', validationComment||'', validatedAt||null, validatedBy||'', rescheduledDate||null, id]
  );
  const r = rows[0];
  return { id: r.id, siteId: r.site_id, siteName: r.site_name,
    scheduledDate: r.scheduled_date?.toISOString?.()?.slice(0,10) ?? r.scheduled_date,
    scheduledTime: r.scheduled_time, technician: r.technician,
    purpose: r.purpose, status: r.status, notes: r.notes,
    createdBy: r.created_by, createdAt: r.created_at,
    withMaintenance: r.with_maintenance, equipmentIds: r.equipment_ids ?? [], maintenanceDesc: r.maintenance_desc,
    validationComment: r.validation_comment ?? '', validatedAt: r.validated_at ?? null,
    validatedBy: r.validated_by ?? '', rescheduledDate: r.rescheduled_date?.toISOString?.()?.slice(0,10) ?? r.rescheduled_date ?? null };
}

export async function deleteVisit(id) {
  await initDB();
  return pool.query('DELETE FROM site_visits WHERE id=$1', [id]);
}
