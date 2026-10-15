// Zips dist/ into release/<name>-<version>.zip for upload to the Chrome Web Store.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
const out = resolve("release", `${name}-${version}.zip`);
mkdirSync("release", { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-qr", out, "."], { cwd: "dist", stdio: "inherit" });
console.log(`Packaged ${out}`);
