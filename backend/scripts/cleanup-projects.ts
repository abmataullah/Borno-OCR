/**
 * C1: Clean stale/duplicate/empty projects from the backend DB.
 *
 * Rules:
 *  1. Delete projects with NULL project_data (never-saved placeholder rows —
 *     these were created by the old client bug that created a backend row
 *     on every "New Project" click without ever syncing content).
 *  2. For duplicate groups (same user_id + name, all with real data), keep
 *     only the most recently updated row and delete the rest.
 *
 * Usage:
 *   npx tsx scripts/cleanup-projects.ts          # dry run (prints what would be deleted)
 *   npx tsx scripts/cleanup-projects.ts --apply  # actually deletes
 */
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://docflow:docflow@localhost:5432/docflow';
const sql = postgres(databaseUrl, { max: 1 });
const apply = process.argv.includes('--apply');

async function main() {
  const rows = await sql`
    SELECT id, user_id, name, page_count, length(project_data::text) as data_len, updated_at
    FROM projects
    ORDER BY user_id, name, updated_at DESC
  `;

  const toDelete: string[] = [];

  // Rule 1: null project_data (empty placeholder projects)
  for (const row of rows) {
    if (row.data_len === null) {
      toDelete.push(row.id);
    }
  }

  // Rule 2: duplicate groups among rows WITH data — keep most recent
  const withData = rows.filter((r) => r.data_len !== null);
  const groups = new Map<string, typeof withData>();
  for (const row of withData) {
    const key = `${row.user_id}::${row.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    // group is already ordered by updated_at DESC (from the query order)
    const [, ...rest] = group;
    for (const r of rest) toDelete.push(r.id);
  }

  console.log(`Total projects: ${rows.length}`);
  console.log(`Marked for deletion: ${toDelete.length}`);
  console.log(`Will remain: ${rows.length - toDelete.length}`);

  if (!apply) {
    console.log('\nDry run — no changes made. Re-run with --apply to delete.');
    console.log('IDs to delete:', toDelete);
  } else {
    if (toDelete.length > 0) {
      await sql`DELETE FROM projects WHERE id = ANY(${toDelete})`;
      console.log(`\nDeleted ${toDelete.length} projects.`);
    } else {
      console.log('\nNothing to delete.');
    }
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
