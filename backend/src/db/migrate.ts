import fs from "fs";
import path from "path";
import { pool } from "../config/db";

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";'); // for gen_random_uuid()
  await pool.query(sql);
  console.log("[migrate] schema applied successfully");
  await pool.end();
}

migrate().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
