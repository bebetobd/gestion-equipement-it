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

  initialized = true;
}

export async function query(text, params) {
  await initDB();
  return pool.query(text, params);
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
    interventionDetails: row.intervention_details
  };
}
