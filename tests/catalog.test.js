const test = require("node:test");
const assert = require("node:assert/strict");
const { CATALOG, FAMILIES } = require("../src/catalog/genres.js");
const match = require("../src/engine/match.js");
const render = require("../src/engine/render-text.js");

const post = (body, headline = "Head of Ops at Northwind") =>
  `Sam Rivera\n• 3rd+\n${headline}\n4h\n\n${body}`;

const classify = (body, native, headline) =>
  render.render(match.classify(post(body, headline), native || {}));

// ── catalog integrity ────────────────────────────────────────────────────

test("every genre id is unique", () => {
  const ids = CATALOG.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every genre declares a known family", () => {
  for (const g of CATALOG) {
    assert.ok(FAMILIES[g.family], `${g.id} has unknown family ${g.family}`);
  }
});

// ── the sensitive rail ───────────────────────────────────────────────────

test("rail posts are trimmed from the top, never filtered", () => {
  // A short factual rail post is left alone; only a long one needs trimming,
  // and when it is trimmed the opening survives verbatim. Dropping a sentence
  // for scoring badly is not a judgement worth making about an obituary.
  const body =
    "It is with a heavy heart that I share that my colleague Sam Ito died on Tuesday morning. " +
    "He was 41. He had been with us for nine years and built most of what our platform runs on today. " +
    "He interviewed me. He argued with me about database indexes for most of 2019 and he was right. " +
    "Details of the service will follow later this week once the family has decided. " +
    "Please keep them in your thoughts, and please be gentle with his team this week.";
  const out = classify(body);
  assert.equal(out.rail, true);
  assert.equal(out.passthrough, false);
  assert.ok(out.text.startsWith("It is with a heavy heart"), out.text);
  assert.ok(out.text.length <= 280);
});

test("a short rail post is left completely alone", () => {
  const out = classify("It is with a heavy heart that I share my colleague Sam Ito died on Tuesday.");
  assert.equal(out.rail, true);
  assert.equal(out.passthrough, true);
});

test("the rail outranks every other match", () => {
  const r = match.classify(post("Kobe Bryant's passing taught me three things about leadership."));
  for (const m of r.matches) {
    assert.equal(m.genre.rail, true, `${m.id} survived alongside a rail match`);
  }
});

test("among rail matches the lowest-precedence family wins", () => {
  const r = match.classify(post(
    "It is with a heavy heart that I share Sam Ito died on Tuesday. He taught me everything about leadership."
  ));
  assert.equal(r.primary.id, "bereavement");
  assert.equal(FAMILIES[r.primary.family].precedence, 0);
});

test("business metaphors about death are not railed", () => {
  for (const body of [
    "Our Q3 roadmap died a slow death in committee. Three lessons on decision hygiene for the leadership team.",
    "I killed our biggest feature yesterday. It had 4% adoption and 30% of the support load.",
    "Churn is the silent killer of seed-stage SaaS. We cut ours from 6.1% to 2.4% monthly.",
  ]) {
    assert.notEqual(classify(body).rail, true, body);
  }
});

// ── the card is the post, rewritten ──────────────────────────────────────

test("cards never exceed 280 characters", () => {
  for (const g of CATALOG) {
    for (const example of g.examples || []) {
      const out = classify(example);
      if (out.passthrough) continue;
      assert.ok(out.text.length <= 280, `${g.id}: ${out.text.length} chars`);
    }
  }
});

test("card text contains only the author's own words", () => {
  const body = "We raised a $12M Series A led by Sequoia and grew from 40 to 90 people this year.\n\nFollow me for more insights.";
  const out = classify(body);
  // Every sentence kept must appear verbatim in the post.
  for (const sentence of out.text.split(/(?<=[.!?]) /)) {
    const stripped = sentence.replace(/[.!?]+$/, "").trim();
    assert.ok(body.includes(stripped), `invented text: ${stripped}`);
  }
});

test("no genre label or intent leaks onto the card", () => {
  const out = classify("Comment SYSTEM below and I will send you the 12-step outbound sequence we use to book 40 meetings a month.");
  assert.equal(out.tldr, undefined);
  assert.equal(out.intent, undefined);
  assert.equal(out.tags, undefined);
  assert.ok(!/reads like/i.test(out.text), out.text);
});

test("a post that barely compresses is left alone", () => {
  assert.equal(classify("Back in the office this week. Coffee is bad, people are great.").passthrough, true);
});

// ── the hiring distinction that motivates Layer A ────────────────────────

test("headline company decides hiring manager vs referral farming", () => {
  const own = classify("We are hiring two senior platform engineers at Northwind.", {}, "Engineering Manager at Northwind");
  const ref = classify("A company I know, Halcyon Labs, is looking for a Head of Data.", {}, "Engineering Manager at Northwind");
  assert.equal(own.genreId, "we_are_hiring");
  assert.equal(ref.genreId, "third_party_referral");
});
