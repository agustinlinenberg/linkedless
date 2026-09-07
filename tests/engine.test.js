const test = require("node:test");
const assert = require("node:assert/strict");
const structure = require("../src/engine/structure.js");
const entities = require("../src/engine/entities.js");
const lexicon = require("../src/catalog/signal-words.js");

test("broetry scores high and ordinary prose scores zero", () => {
  const broetry = "I fired my best client.\n\nHe paid us well.\n\nHe screamed at my team.\n\nSo I let him go.\n\nCulture wins.";
  const prose = "We replaced the Redis session store with an in-process LRU cache and cut p99 latency by roughly 80 percent across every region.";
  assert.ok(structure.analyze(broetry).broetryScore > 70);
  assert.equal(structure.analyze(prose).broetryScore, 0);
});

test("a two-line quip is never broetry", () => {
  assert.equal(structure.analyze("Short.\n\nPunchy.").broetryScore, 0);
});

test("structure counts numeral-led lines for list detection", () => {
  const m = structure.analyze("Tools:\n1. A\n2. B\n3. C\n4. D");
  assert.equal(m.numeralLedLineCount, 4);
});

test("entities capture funding round components", () => {
  const e = entities.extract("We closed our $12M Series A led by Sequoia Capital.", "");
  assert.equal(e.MONEY, "$12M");
  assert.equal(e.ROUND, "Series A");
  assert.equal(e.INVESTOR, "Sequoia Capital");
});

test("companyMismatch separates a referral from a real hiring manager", () => {
  const referral = entities.extract("My friend's team at Globex is hiring.", "VP Sales at Acme");
  const own = entities.extract("We are hiring at Acme.", "VP Sales at Acme");
  assert.equal(entities.companyMismatch(referral), true);
  assert.equal(entities.companyMismatch(own), false);
});

test("companyMismatch is false when either side is unknown", () => {
  assert.equal(entities.companyMismatch(entities.extract("We are hiring.", "")), false);
});

test("proper nouns drop trailing sentence punctuation", () => {
  assert.equal(entities.companyFromBody("I am joining Stripe."), "Stripe");
});

test("baitKeyword finds the token only inside the instruction sentence", () => {
  assert.equal(entities.baitKeyword("Our API is great. Comment GUIDE and I'll DM it."), "GUIDE");
  assert.equal(entities.baitKeyword("We use AWS and GCP heavily."), null);
});

test("baitKeyword ignores common acronyms", () => {
  assert.equal(entities.baitKeyword("Comment below and I'll DM you."), null);
});

test("slop scoring separates buzzword soup from real engineering", () => {
  const slop = "In this ever-evolving landscape we must leverage synergies to unlock transformative growth and foster holistic ecosystems.";
  const real = "We cut p99 latency from 840ms to 120ms by moving session lookups into a local cache.";
  assert.ok(lexicon.slopScore(slop).score >= 70);
  assert.equal(lexicon.slopScore(real).score, 0);
});

test("co-occurrence spans the line break a false dichotomy always uses", () => {
  const r = lexicon.cooccurrenceScore("Leadership isn't about titles.\nIt's about service.");
  assert.ok(r.matches.includes("false dichotomy"));
});
