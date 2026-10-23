/**
 * C1: Inspect projects table for stale/duplicate/garbled entries.
 * Run with: npx tsx scripts/inspect-projects.ts
 */
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://docflow:docflow@localhost:5432/docflow';
const sql = postgres(databaseUrl, { max: 1 });

function looksGarbled(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const nonAscii = text.replace(/[\x20-\x7E\u0980-\u09FF\u200C-\u200D]/g, '');
  return nonAscii.length > text.length * 0.15;
}

async function main() {
  const rows = await sql`
    SELECT id, user_id, name, page_count, created_at, updated_at,
           length(project_data::text) as data_len,
           project_data
    FROM projects
    ORDER BY user_id, name, created_at
  `;

  console.log(`Total projects: ${rows.length}\n`);

  // Group by (userId, name) to find duplicates
  const groups = new Map<string, typeof rows[number][]>();
  for (const row of rows) {
    const key = `${row.user_id}::${row.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  console.log('=== Duplicate groups (same user + name) ===');
  let dupCount = 0;
  for (const [key, group] of groups) {
    if (group.length > 1) {
      dupCount += group.length - 1;
      console.log(`\n"${key}" — ${group.length} entries:`);
      for (const r of group) {
        console.log(`  id=${r.id} pages=${r.page_count} dataLen=${r.data_len} created=${r.created_at} updated=${r.updated_at}`);
      }
    }
  }
  console.log(`\nTotal duplicate rows (excluding most recent per group): ${dupCount}`);

  console.log('\n=== Garbled / empty projects ===');
  let garbledCount = 0;
  for (const row of rows) {
    let text = '';
    try {
      const pd = row.project_data as any;
      if (pd?.pages) {
        for (const page of pd.pages) {
          for (const el of page.elements ?? []) {
            if (el.type === 'text') {
              for (const p of el.paragraphs ?? []) {
                for (const r of p.runs ?? []) {
                  text += r.text ?? '';
                }
              }
            }
          }
        }
      }
    } catch { /* ignore parse errors */ }

    const isEmpty = !row.data_len || row.data_len < 50;
    const isGarbled = looksGarbled(text);
    if (isEmpty || isGarbled) {
      garbledCount++;
      console.log(`  id=${row.id} name="${row.name}" dataLen=${row.data_len} empty=${isEmpty} garbled=${isGarbled}`);
    }
  }
  console.log(`\nTotal empty/garbled projects: ${garbledCount}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
