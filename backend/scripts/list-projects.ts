import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://docflow:docflow@localhost:5432/docflow';
const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  const rows = await sql`
    SELECT id, user_id, name, page_count, length(project_data::text) as data_len, created_at, updated_at
    FROM projects
    ORDER BY user_id, name, updated_at DESC
  `;
  console.log('Total:', rows.length);
  for (const r of rows) {
    console.log(r.id, r.user_id, JSON.stringify(r.name), 'pages=' + r.page_count, 'dataLen=' + r.data_len, r.updated_at);
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
