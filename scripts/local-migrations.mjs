import { readdir, readFile } from 'node:fs/promises';

// Track migrations so restarting Astro never reapplies a future ALTER TABLE.
export async function migrateLocal(database) {
  database.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for (const name of (await readdir('migrations')).filter(n => n.endsWith('.sql')).sort()) {
    if (database.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)) continue;
    const sql = await readFile(`migrations/${name}`, 'utf8');
    database.exec('BEGIN');
    try {
      database.exec(sql);
      database.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}
