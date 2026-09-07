#!/usr/bin/env node
/**
 * LinkedLess — coverage report
 *
 * The number that decides whether this project ships. Coverage is the share
 * of real feed posts that match a named genre; below ~80% the feed fills with
 * generic labels and the extension feels dumb.
 *
 * Reads corpus/posts.jsonl (real posts, the number that counts) and falls
 * back to corpus/posts.seed.jsonl when no real corpus exists yet. Seed-only
 * runs are labelled as such, because a catalog scoring 100% against its own
 * examples has proved nothing.
 *
 *   npm run coverage
 *   npm run coverage:verbose    # list every miss and misclassification
 */

const fs = require("fs");
const path = require("path");

const match = require("../src/engine/match.js");
const renderText = require("../src/engine/render-text.js");
const { CATALOG } = require("../src/catalog/genres.js");

const VERBOSE = process.argv.includes("--verbose");
const UNCLASSIFIED = new Set(["fallback_short", "fallback_long"]);
const RAIL_IDS = new Set(CATALOG.filter((g) => g.rail).map((g) => g.id));

/**
 * Load every corpus file present and tag each row with its source.
 *
 *   posts.jsonl       real posts copied from a live feed — the number that counts
 *   posts.hard.jsonl  hand-authored adversarial cases, worded to break the catalog
 *   posts.seed.jsonl  generated from the catalog's own examples — proves only
 *                     internal consistency, so it is reported separately and
 *                     excluded from the headline figure
 */
const SOURCES = [
  { file: "posts.jsonl", source: "real", headline: true },
  { file: "posts.hard.jsonl", source: "hard", headline: true },
  { file: "posts.seed.jsonl", source: "seed", headline: false },
];

function loadCorpus() {
  const loaded = [];
  const rows = [];
  for (const spec of SOURCES) {
    const full = path.join(__dirname, spec.file);
    if (!fs.existsSync(full) || fs.statSync(full).size === 0) continue;
    const parsed = fs
      .readFileSync(full, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l, i) => {
        try { return JSON.parse(l); }
        catch { console.error(`${spec.file} line ${i + 1} is not valid JSON`); process.exit(1); }
      });
    parsed.forEach((r) => rows.push({ ...r, source: spec.source, headline: spec.headline }));
    loaded.push(`${spec.file} (${parsed.length})`);
  }
  if (!rows.length) {
    console.error("No corpus found. Run `node corpus/seed.js` first.");
    process.exit(1);
  }
  return { rows, loaded, hasReal: rows.some((r) => r.source === "real") };
}

function pct(n, d) {
  return d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`;
}

function main() {
  const { rows, loaded, hasReal } = loadCorpus();

  const stats = () => ({
    total: 0, classified: 0, passthrough: 0, correct: 0, labelled: 0,
    sensExpected: 0, sensCaught: 0, sensFalsePositive: 0,
    rewritten: 0, bodyChars: 0, cardChars: 0,
  });
  const overall = stats();
  const headline = stats();
  const bySource = new Map();
  const byLang = new Map();

  const perGenre = new Map();
  const misses = [];
  const wrong = [];
  const railMisses = [];

  for (const row of rows) {
    const result = match.classify(row.text, row.native || {});
    const card = renderText.render(result);
    // A card can classify a post and still decline to draw over it, so
    // "which genre matched" and "did we cover it" are separate questions now.
    const predicted = card.genreId || null;
    const named = predicted != null && !UNCLASSIFIED.has(predicted);

    if (!bySource.has(row.source)) bySource.set(row.source, stats());
    // Language comes from the detector, not the label, so a mislabelled or
    // undetectable post shows up under the language the engine actually used.
    const lang = result.context.lang;
    if (!byLang.has(lang)) byLang.set(lang, stats());
    const targets = [overall, bySource.get(row.source), byLang.get(lang)];
    if (row.headline) targets.push(headline);

    const body = result.context.body || "";
    for (const t of targets) {
      t.total++;
      if (named) t.classified++;
      if (card.passthrough) {
        t.passthrough++;
      } else {
        t.rewritten++;
        t.bodyChars += body.length;
        t.cardChars += card.text.length;
      }
    }

    const bucket = (id) => {
      if (!perGenre.has(id)) perGenre.set(id, { predicted: 0, correct: 0, expected: 0 });
      return perGenre.get(id);
    };
    if (predicted) bucket(predicted).predicted++;

    // expect:null means "this post should be left alone" — passthrough is correct.
    const hasLabel = Object.prototype.hasOwnProperty.call(row, "expect");
    if (hasLabel) {
      const want = row.expect;
      if (want) bucket(want).expected++;
      for (const t of targets) t.labelled++;
      const got = want === null ? (named ? predicted : null) : predicted;
      const ok = want === null ? !named : predicted === want;
      if (ok) {
        for (const t of targets) t.correct++;
        if (predicted) bucket(predicted).correct++;
      } else if (want !== null && !named) {
        misses.push({ expect: want, got: predicted || "passthrough", text: row.text, note: row.note });
      } else {
        wrong.push({ expect: want === null ? "(untouched)" : want, got: got || "passthrough", text: row.text, note: row.note });
      }
    }

    const isSensitive = row.sensitive === true;
    const predictedSensitive = predicted != null && RAIL_IDS.has(predicted);
    for (const t of targets) {
      if (isSensitive) { t.sensExpected++; if (predictedSensitive) t.sensCaught++; }
      else if (predictedSensitive) t.sensFalsePositive++;
    }
    if (isSensitive && !predictedSensitive) {
      railMisses.push({ got: predicted || "passthrough", text: row.text, note: row.note });
    }
  }

  console.log("");
  console.log("corpus        " + loaded.join("  ·  "));
  if (!hasReal) {
    console.log("              ⚠  no corpus/posts.jsonl yet — headline numbers come from");
    console.log("                 hand-authored adversarial cases only. Real feed posts");
    console.log("                 are the number that actually decides whether this ships.");
  }

  const block = (title, s) => {
    console.log("");
    console.log(`── ${title} ${"─".repeat(Math.max(0, 48 - title.length))}`);
    // The number that describes the product: how much of a post survives.
    console.log(`rewritten     ${pct(s.rewritten, s.total)}   (${s.rewritten}/${s.total} posts got a card)`);
    console.log(`reduction     ${s.bodyChars ? Math.round((1 - s.cardChars / s.bodyChars) * 100) + "%" : "n/a"}   (${s.bodyChars} chars in, ${s.cardChars} out)`);
    console.log(`left alone    ${pct(s.passthrough, s.total)}   (${s.passthrough}/${s.total} already plain)`);
    // Classification is a means, not the output. It gates the sensitive rail
    // and the family mutes, and nothing else — a genre no longer contributes
    // a single word to a card.
    console.log(`classified    ${pct(s.classified, s.total)}   (genre matched; gates the rail and mute settings only)`);
    console.log(`label match   ${pct(s.correct, s.labelled)}   (${s.correct}/${s.labelled} matched their expected genre)`);
  };

  block("headline (real + hard cases)", headline);
  for (const [lang, s] of [...byLang.entries()].sort()) block(`language: ${lang}`, s);
  for (const [src, s] of bySource) block(`source: ${src}`, s);

  console.log("");
  console.log("── sensitive rail ───────────────────────────────────────");
  console.log(`recall        ${pct(overall.sensCaught, overall.sensExpected)}   (${overall.sensCaught}/${overall.sensExpected})   MUST be 100% in every language`);
  for (const [lang, s] of [...byLang.entries()].sort()) {
    const bad = s.sensExpected > 0 && s.sensCaught < s.sensExpected ? "   ← GAP" : "";
    console.log(`  ${lang}          ${pct(s.sensCaught, s.sensExpected).padStart(6)}   (${s.sensCaught}/${s.sensExpected})${bad}`);
  }
  console.log(`false pos     ${pct(overall.sensFalsePositive, overall.total - overall.sensExpected)}   (${overall.sensFalsePositive} ordinary posts railed)   target <5%`);

  const railFail = overall.sensExpected > 0 && overall.sensCaught < overall.sensExpected;

  console.log("");
  console.log("── per-genre precision (predicted ≥1 time) ──────────────");
  const lines = [...perGenre.entries()]
    .filter(([, v]) => v.predicted > 0)
    .sort((a, b) => b[1].predicted - a[1].predicted || a[0].localeCompare(b[0]));
  for (const [id, v] of lines) {
    const p = v.predicted ? v.correct / v.predicted : 0;
    const flag = v.predicted >= 3 && p < 0.9 ? "  ← below 90%" : "";
    console.log(`  ${id.padEnd(26)} predicted ${String(v.predicted).padStart(3)}  correct ${String(v.correct).padStart(3)}  ${pct(v.correct, v.predicted).padStart(6)}${flag}`);
  }

  const unused = CATALOG.filter((g) => !perGenre.has(g.id) || perGenre.get(g.id).predicted === 0);
  console.log("");
  console.log(`── never fired (${unused.length}/${CATALOG.length} genres) ─────────────────────────`);
  console.log("  " + (unused.map((g) => g.id).join(", ") || "none"));

  const preview = (t) => t.split("\n").filter(Boolean).slice(3).join(" ").slice(0, 88);
  if (railMisses.length) {
    console.log("");
    console.log(`── RAIL MISSES (${railMisses.length}) — release blockers ──────────────`);
    for (const r of railMisses) console.log(`  got ${r.got.padEnd(22)} :: ${preview(r.text)}`);
  }

  if (VERBOSE) {
    console.log("");
    console.log(`── missed (${misses.length}) — expected a genre, got nothing ─────`);
    for (const m of misses) console.log(`  want ${m.expect.padEnd(24)} got ${m.got.padEnd(16)} :: ${preview(m.text)}`);
    console.log("");
    console.log(`── misclassified (${wrong.length}) ──────────────────────────────`);
    for (const w of wrong) console.log(`  want ${w.expect.padEnd(24)} got ${w.got.padEnd(24)} :: ${preview(w.text)}`);
  } else if (misses.length || wrong.length) {
    console.log("");
    console.log(`  ${misses.length} missed, ${wrong.length} misclassified — run \`npm run coverage:verbose\` for detail`);
  }

  console.log("");
  if (railFail) {
    console.log("FAIL — sensitive rail recall is below 100%.");
    process.exit(1);
  }
}

main();
