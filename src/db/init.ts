import { readFileSync } from 'node:fs';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing required environment variable: DATABASE_URL');

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const pool = new pg.Pool({ connectionString: databaseUrl });
await pool.query(sql);
await pool.end();
console.log('Schema applied.');
