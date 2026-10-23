import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const url = process.env.DATABASE_URL ?? 'postgresql://docflow:docflow@localhost:5432/docflow';
const sql = postgres(url, { max: 1 });

const sqlFile = join(import.meta.dirname, '..', 'drizzle', 'restore-indexes.sql');
const raw = readFileSync(sqlFile, 'utf-8');

// Strip comment lines, then split on semicolons
const stripped = raw
  .split('\n')
  .filter(l => !l.trim().startsWith('--'))
  .join('\n');
const statements = stripped
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Executing ${statements.length} index restoration statements...\n`);
for (const stmt of statements) {
  const firstLine = stmt.split('\n')[0].slice(0, 80);
  try {
    await sql.unsafe(stmt);
    console.log(`  ✓ ${firstLine}`);
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log(`  ⊙ ${firstLine} (already exists)`);
    } else {
      console.error(`  ✗ ${firstLine} — ${err.message}`);
    }
  }
}

console.log('\nDone.');
await sql.end();
