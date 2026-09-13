import { readFile, writeFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../src/core/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("presets.manifest.json", root), "utf8"),
);
const ids = new Set(),
  files = new Set();
const imports = [];
for (const [index, entry] of manifest.entries()) {
  if (
    !/^[a-zA-Z0-9_-]{1,160}$/.test(entry.id) ||
    !/^[a-z0-9_-]+\.json$/.test(entry.file) ||
    ids.has(entry.id) ||
    files.has(entry.file)
  )
    throw new Error("Invalid or duplicate preset manifest entry");
  const path = new URL(`researched/${entry.file}`, root);
  if ((await realpath(path)) !== fileURLToPath(path))
    throw new Error("Preset symlinks are not allowed");
  const doc = JSON.parse(await readFile(path, "utf8"));
  if (doc.id !== entry.id || doc.visibility === "private")
    throw new Error(`Preset ${entry.id} is private or has a different ID`);
  ids.add(entry.id);
  files.add(entry.file);
  imports.push(`import preset${index} from "./researched/${entry.file}";`);
}
const output = `// Generated from presets.manifest.json. Only explicitly listed public files are bundled.\n${imports.join("\n")}\nexport const presetDocuments = [${manifest.map((_, i) => `preset${i}`).join(", ")}];\n`;
await writeFile(new URL("presets.generated.ts", root), output);
