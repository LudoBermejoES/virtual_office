import { openDb } from "../src/infra/db/sqlite.js";
import { runMigrations } from "../src/infra/db/migrations.js";
import { promoteToAdmin } from "../src/infra/repos/users.js";
import { parseEnv } from "../src/config/env.js";

const email = process.argv[2];
if (!email) {
  console.error("Uso: pnpm bootstrap:admin <email>");
  process.exit(1);
}

const env = parseEnv(process.env);
const db = openDb(env.DB_PATH);
runMigrations(db);
promoteToAdmin(db, email);
db.close();
console.log(`Usuario ${email} promovido a super-admin.`);
