import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

const connectionString = process.env.DATABASE_URL;
const useLocalPg = isLocalDatabaseUrl(connectionString);

const pool = useLocalPg
  ? new PgPool({ connectionString })
  : new NeonPool({ connectionString });

if (!useLocalPg) {
  neonConfig.webSocketConstructor = ws;
}

export const db = useLocalPg
  ? drizzlePg(pool as PgPool, { schema })
  : drizzleNeon(pool as NeonPool, { schema });
