// Copies pipeline outputs (../outputs) into public/demo so the app works without a backend.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
const src = new URL("../outputs/", import.meta.url);
const dst = new URL("./public/demo/", import.meta.url);
if (!existsSync(src)) {
  console.warn("outputs/ not found: run backend/scripts/make_mock_data.py first");
  process.exit(0);
}
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true, filter: (p) => !/\.db(-wal|-shm)?$/.test(p) });
console.log("demo data synced -> public/demo");
