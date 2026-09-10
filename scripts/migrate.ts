import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to apply the database schema.");
}

const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
const sql = postgres(connectionString, { max: 1 });

try {
  await sql.unsafe(schema);
  console.info("Database schema applied.");
} finally {
  await sql.end();
}
