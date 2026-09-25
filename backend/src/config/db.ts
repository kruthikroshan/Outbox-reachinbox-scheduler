import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on("error", (err: Error) => {
  console.error("[postgres] unexpected error on idle client", err);
});
