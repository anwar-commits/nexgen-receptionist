// Bundles the API into a single Vercel function using the Build Output API.
// Run `npm run typecheck` separately for type errors; this step only bundles.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const output = ".vercel/output";
const fn = `${output}/functions/index.func`;

rmSync(output, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["pg-native"],
  // Bundled CommonJS packages still call require() and read __dirname.
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      'import { fileURLToPath as __fileURLToPath } from "node:url";',
      'import { dirname as __pathDirname } from "node:path";',
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __pathDirname(__filename);",
    ].join("\n"),
  },
});

writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs" }),
);
writeFileSync(
  `${output}/config.json`,
  JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }),
);
console.log("Built Vercel function.");
