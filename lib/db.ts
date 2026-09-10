import postgres, { Sql } from "postgres";
import { AppError } from "@/lib/core";

let sqlClient: Sql | undefined;

export function db() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new AppError("The app database is not configured yet.", 503);
  }

  if (!sqlClient) {
    sqlClient = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false
    });
  }

  return sqlClient;
}
