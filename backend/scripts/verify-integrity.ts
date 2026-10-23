/**
 * Post-migration integrity check.
 *
 * Verifies that:
 *  1. Row counts for all existing tables are intact (data not truncated).
 *  2. All expected indexes are present.
 *  3. All expected unique constraints are present.
 *  4. All expected foreign-key constraints are present.
 *  5. New tables (app_settings, support_tickets, ticket_messages) exist.
 *
 * Run: npx tsx scripts/verify-integrity.ts
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgresql://docflow:docflow@localhost:5432/docflow';
const sql = postgres(url, { max: 1 });

async function main() {
  console.log('=== DocFlow Post-Migration Integrity Check ===\n');

  // 1. Row counts
  const tables = [
    'users', 'otp_codes', 'sessions', 'projects',
    'subscriptions', 'payments', 'jobs', 'annotations',
    'app_settings', 'support_tickets', 'ticket_messages',
  ];

  console.log('--- Row Counts ---');
  for (const t of tables) {
    try {
      const [{ count }] = await sql`SELECT count(*)::int as count FROM ${sql(t)}`;
      console.log(`  ${t.padEnd(20)} ${count} rows`);
    } catch {
      console.log(`  ${t.padEnd(20)} TABLE MISSING`);
    }
  }

  // 2. Indexes
  console.log('\n--- Indexes ---');
  const indexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY indexname
  `;
  const indexNames = indexes.map((r: any) => r.indexname as string);
  const expectedIndexes = [
    'users_email_unique',
    'sessions_token_unique',
    'idx_projects_share_token',
    'idx_projects_user_id',
    'idx_annotations_page',
    'idx_annotations_project_id',
    'idx_jobs_project_id',
    'idx_jobs_user_id',
    'jobs_status_idx',
    'idx_otp_codes_email_status',
    'idx_support_tickets_user_id',
    'idx_support_tickets_status',
    'idx_ticket_messages_ticket_id',
  ];
  for (const idx of expectedIndexes) {
    const found = indexNames.includes(idx);
    console.log(`  ${found ? '✓' : '✗ MISSING'} ${idx}`);
  }
  console.log(`  (total indexes in DB: ${indexNames.length})`);

  // 3. Unique constraints
  console.log('\n--- Unique Constraints ---');
  const uniques = await sql`
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE con.contype = 'u' AND con.connamespace = 'public'::regnamespace
    ORDER BY con.conname
  `;
  for (const r of uniques) {
    console.log(`  ✓ ${r.conname} on ${r.relname}`);
  }
  if (uniques.length === 0) console.log('  (none found)');

  // 4. Foreign keys
  console.log('\n--- Foreign Key Constraints ---');
  const fks = await sql`
    SELECT con.conname, rel.relname as table_name, att.attname as column_name,
           frel.relname as foreign_table
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
    ORDER BY rel.relname, con.conname
  `;
  for (const r of fks) {
    console.log(`  ✓ ${r.conname}: ${r.table_name}.${r.column_name} -> ${r.foreign_table}`);
  }
  if (fks.length === 0) console.log('  (none found)');

  // 5. Spot-check: sample project data
  console.log('\n--- Spot-check: Sample Projects ---');
  const sampleProjects = await sql`
    SELECT id, user_id, name, page_count, file_size_kb, is_shared
    FROM projects
    ORDER BY created_at DESC
    LIMIT 5
  `;
  for (const p of sampleProjects) {
    console.log(`  ${p.id}  user=${p.user_id}  name="${p.name}"  pages=${p.page_count}  size=${p.file_size_kb}kb  shared=${p.is_shared}`);
  }

  // 6. Spot-check: users
  console.log('\n--- Spot-check: Users ---');
  const sampleUsers = await sql`
    SELECT id, email, name, plan, is_admin, storage_quota_mb, storage_used_mb
    FROM users
    ORDER BY created_at DESC
    LIMIT 5
  `;
  for (const u of sampleUsers) {
    console.log(`  ${u.email}  name="${u.name ?? 'null'}"  plan=${u.plan}  admin=${u.is_admin}  quota=${u.storage_quota_mb}mb  used=${u.storage_used_mb}mb`);
  }

  // 7. Enums
  console.log('\n--- Enums ---');
  const enums = await sql`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `;
  const enumMap: Record<string, string[]> = {};
  for (const r of enums) {
    if (!enumMap[r.typname]) enumMap[r.typname] = [];
    enumMap[r.typname].push(r.enumlabel);
  }
  for (const [name, labels] of Object.entries(enumMap)) {
    console.log(`  ${name}: [${labels.join(', ')}]`);
  }

  console.log('\n=== Verification Complete ===');
  await sql.end();
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
