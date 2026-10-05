import mysql from 'mysql2/promise';

export const dbConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'thisone',
  // Dates stay as 'YYYY-MM-DD HH:MM:SS' text in the server's local time, so nothing shifts by time zone.
  dateStrings: true,
  decimalNumbers: true,
};

export const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
});

// `conn` is a transaction connection from tx(); without it the query runs on the pool.
export async function q(sql, params, conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

export async function one(sql, params, conn = pool) {
  const rows = await q(sql, params, conn);
  return rows[0] ?? null;
}

export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
