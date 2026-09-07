#!/usr/bin/env node
/**
 * Regenerate corpus/posts.seed.jsonl from the `examples` field of every
 * catalog entry.
 *
 * These are seeds, not evidence: they were written alongside the patterns
 * that match them, so they prove the catalog is internally consistent and
 * nothing more. Real coverage numbers only come from corpus/posts.jsonl,
 * which holds posts copied out of an actual feed.
 */

const fs = require("fs");
const path = require("path");
const { CATALOG } = require("../src/catalog/genres.js");

/**
 * Collect the Layer A DOM flags a genre's own detect block asks for, so
 * DOM-driven genres (polls, carousels, reshares) are exercised with the
 * signal they actually depend on rather than failing for want of it.
 */
function requiredNative(genre) {
  const flags = {};
  const walk = (list) => (list || []).forEach((p) => { if (p && p.native) flags[p.native] = true; });
  const d = genre.detect || {};
  walk(d.all);
  walk(d.any);
  return flags;
}

const rows = [];
for (const genre of CATALOG) {
  const native = requiredNative(genre);
  for (const text of genre.examples || []) {
    rows.push({
      text: `Example Author\nSome Title at Somewhere\n2h\n\n${text}`,
      expect: genre.id,
      sensitive: genre.rail === true,
      ...(Object.keys(native).length ? { native } : {}),
      source: "seed",
    });
  }
}

const out = path.join(__dirname, "posts.seed.jsonl");
fs.writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`wrote ${rows.length} seed posts to ${path.relative(process.cwd(), out)}`);
