// Copies public/ into dist/ and stamps the manifest version from package.json.
import { cpSync, readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
cpSync("public", "dist", { recursive: true });

const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8"));
manifest.version = version;
writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
