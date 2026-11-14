import { readFile, writeFile, access } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "index.html");
const cssPath = resolve(root, "styles.css");
const scriptPath = resolve(root, "app.js");
const outputs = [
  resolve(root, "47-team-studio-end-to-end-demo.html"),
  resolve(root, "team-47-studio-end-to-end-demo.html")
];

const mimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".gif", "image/gif"]
]);

let html = await readFile(sourcePath, "utf8");
const [css, script] = await Promise.all([
  readFile(cssPath, "utf8"),
  readFile(scriptPath, "utf8")
]);

html = html
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`)
  .replace('<script src="app.js"></script>', `<script>${script}</script>`);

const localSources = [...html.matchAll(/\bsrc="([^"#?]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !/^(?:data:|https?:|\/\/)/i.test(value));

for (const source of new Set(localSources)) {
  const filePath = resolve(root, source.replaceAll("/", "\\"));
  const mime = mimeByExtension.get(extname(filePath).toLowerCase());
  if (!mime) continue;
  try {
    await access(filePath);
  } catch {
    throw new Error(`Standalone demo asset is missing: ${source}`);
  }
  const encoded = (await readFile(filePath)).toString("base64");
  html = html.replaceAll(`src="${source}"`, `src="data:${mime};base64,${encoded}"`);
}

await Promise.all(outputs.map((output) => writeFile(output, html, "utf8")));
console.log(`Built ${outputs.length} standalone Team 47 Studio demos (${Buffer.byteLength(html)} bytes each).`);
