import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { config } from '../config/env';

const client = postgres(config.databaseUrl, { max: 10 });

export const db = drizzle(client, { schema });
export { schema };
