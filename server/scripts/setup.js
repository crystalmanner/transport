// Creates the database, the tables, the default settings and the first admin account.
// Safe to run again: it never drops or overwrites anything.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { dbConfig } from '../src/db.js';
import { hashPassword } from '../src/lib/auth.js';
import { FEATURE_DEFAULTS, SETTING_DEFAULTS } from '../src/lib/settings.js';

const adminPhone = process.env.ADMIN_PHONE ?? '000000';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

const { database, ...server } = dbConfig;
const conn = await mysql.createConnection({ ...server, multipleStatements: true });

try {
  await conn.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [database]);
  await conn.query('USE ??', [database]);
  await conn.query(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));

  await conn.query('INSERT IGNORE INTO settings (name, value) VALUES ?', [
    Object.entries(SETTING_DEFAULTS).map(([name, value]) => [name, String(value)]),
  ]);
  await conn.query('INSERT IGNORE INTO feature_permissions (feature, label, normal_allowed, special_allowed) VALUES ?', [FEATURE_DEFAULTS]);

  const [[admin]] = await conn.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (admin) {
    console.log(`Database "${database}" is ready. An admin account already exists.`);
  } else {
    await conn.query("INSERT INTO users (name, phone, password_hash, role) VALUES ('Administrator', ?, ?, 'admin')", [
      adminPhone,
      await hashPassword(adminPassword),
    ]);
    console.log(`Database "${database}" is ready.`);
    console.log(`Admin login -> phone: ${adminPhone}  password: ${adminPassword}  (change the password after the first login)`);
  }
} finally {
  await conn.end();
}
