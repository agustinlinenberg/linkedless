#!/usr/bin/env node
/**
 * Build the zip for the Chrome Web Store.
 *
 * Ships only what the extension loads: the manifest, src and icons. The
 * corpus, tests, docs and store assets are repository furniture and have no
 * business in a package users install.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const out = path.join(root, "dist", `linkedless-${manifest.version}.zip`);

// Every file the manifest references, plus the manifest itself.
const referenced = [
  "manifest.json",
  ...Object.values(manifest.icons || {}),
  ...Object.values((manifest.action || {}).default_icon || {}),
  ...(manifest.content_scripts || []).flatMap((cs) => [...(cs.js || []), ...(cs.css || [])]),
  manifest.action && manifest.action.default_popup,
  manifest.options_page,
].filter(Boolean);

// The popup and options pages pull their own stylesheet and script, which the
// manifest never names.
const extras = [
  "src/popup/popup.css",
  "src/popup/popup.js",
  "src/options/options.css",
  "src/options/options.js",
];

const files = [...new Set([...referenced, ...extras])].sort();

const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error("Refusing to package, these are missing:\n  " + missing.join("\n  "));
  process.exit(1);
}

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
if (fs.existsSync(out)) fs.unlinkSync(out);
execFileSync("zip", ["-q", "-X", out, ...files], { cwd: root });

const size = fs.statSync(out).size;
console.log(`${path.relative(root, out)}  ${(size / 1024).toFixed(0)} KB  ${files.length} files`);
console.log(files.map((f) => "  " + f).join("\n"));
