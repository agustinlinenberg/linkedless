const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../src/engine/compress.js");

// Cases taken from a live feed. Each one is a defect that shipped.

test("announcement openers are stripped, subject and 'that' both optional", () => {
  assert.equal(
    c.compress("We are proud to announce Swish III, a $250M early fund, bringing Swish Ventures to $800M in total AUM."),
    "Swish III, a $250M early fund, bringing Swish Ventures to $800M in total AUM."
  );
  assert.equal(
    c.compress("Thrilled to share that I have joined Stripe as a Staff Product Designer starting in November."),
    "I have joined Stripe as a Staff Product Designer starting in November."
  );
  assert.equal(
    c.compress("Very happy to share that I have been named an Adobe Marketo Engage Champion for 2026."),
    "I have been named an Adobe Marketo Engage Champion for 2026."
  );
});

test("sentiment about an achievement loses to the achievement", () => {
  // Name-dropping used to outscore substance: "becoming a Champion felt like a
  // great recognition" beat the sentence saying what the person actually did.
  const out = c.compress(
    "I have been named an Adobe Marketo Engage Champion.\n\n" +
    "Last year, becoming a Champion felt like a great recognition after many years working in Marketo.\n\n" +
    "Over the past 12 months my work expanded into client strategy, technical presales and AI."
  );
  assert.ok(out.includes("12 months"), out);
  assert.ok(!out.includes("felt like"), out);
});

test("calls to action, aphorisms and hashtags are dropped", () => {
  const out = c.compress(
    "We raised a $12M Series A led by Sequoia.\n\nFollow me for more insights.\n\nNever give up.\n\n#growth #startups"
  );
  assert.equal(out, "We raised a $12M Series A led by Sequoia.");
});

test("word boundaries hold: 'tag' inside 'heritage' is not a call to action", () => {
  assert.ok(c.score("Working with a rich design heritage, Aldergrove comes to life in New York and Atlanta.", 0, 3) > 0);
  assert.ok(c.score("Tag someone who needs to see this.", 0, 3) < 0);
});

test("false dichotomies collapse to the claim, in both languages", () => {
  assert.equal(c.compress("Culture isn't about perks.\n\nIt's about who you promote.\n\nLet that sink in."),
    "Culture is about who you promote.");
  assert.equal(c.compress("La cultura no se trata de beneficios.\n\nSe trata de a quién ascendés.\n\nLeelo de nuevo."),
    "La cultura se trata de a quién ascendés.");
});

test("output never exceeds 280 characters", () => {
  const long = Array.from({ length: 40 }, (_, i) =>
    `Sentence ${i} carries ${i * 7}% growth and names Acme Corporation in Berlin.`).join("\n\n");
  assert.ok(c.compress(long).length <= 280);
});

test("only the author's own words come out", () => {
  const body = "We raised a $12M Series A led by Sequoia and grew from 40 to 90 people.\n\nFollow me for more.";
  const out = c.compress(body);
  for (const part of out.split(/(?<=[.!?]) /)) {
    assert.ok(body.includes(part.replace(/[.!?]+$/, "").trim()), `invented: ${part}`);
  }
});

test("a rail post is trimmed from the top rather than filtered", () => {
  const body =
    "It is with a heavy heart that I share that Sam Ito died on Tuesday. " +
    "He was 41. He built most of what our platform runs on. " +
    "Details of the service will follow. Please keep his family in your thoughts.";
  const out = c.compress(body, { rail: true });
  assert.ok(out.startsWith("It is with a heavy heart"), out);
  assert.ok(out.length <= 280);
});

test("an opener behind a salutation is still stripped", () => {
  // From a live promoted post: "Friends: I'm really excited to share that…"
  // survived because the pattern was anchored to the very start of the text.
  assert.equal(
    c.compress("Friends: I am really excited to share that I am working with Dana Ruiz to bring her story to more organizations and conferences."),
    "I am working with Dana Ruiz to bring her story to more organizations and conferences."
  );
  assert.equal(
    c.compress("Hi all, thrilled to share that I have joined Stripe as a Staff Product Designer in November."),
    "I have joined Stripe as a Staff Product Designer in November."
  );
});

test("the salutation prefix does not eat real content", () => {
  const body = "Yesterday the team shipped a caching layer that cut p99 latency from 840ms to 120ms across every region.";
  assert.equal(c.compress(body), body);
});

test("a link survives, even when it scores far below the rest of the post", () => {
  // "Register here: <url>" is three words and loses badly to a sentence full
  // of numbers, but it is the only place the link lives.
  const out = c.compress(
    "Our annual founders summit is on Oct 14 in Buenos Aires with 400 attendees.\n\n" +
    "Register here: https://lnkd.in/abc123\n\nFollow me for more insights."
  );
  assert.ok(out.includes("https://lnkd.in/abc123"), out);
  assert.ok(!out.includes("Follow me"), out);
});

test("sentence splitting does not shred a URL on its dots", () => {
  const units = c.units("Apply here: https://acme.com/jobs/be-eng");
  assert.equal(units.length, 1, JSON.stringify(units));
  assert.ok(units[0].endsWith("https://acme.com/jobs/be-eng"), units[0]);
});

test("no full stop is appended after an address", () => {
  const out = c.compress("We are hiring a Senior Backend Engineer at Acme. Apply here: https://acme.com/jobs");
  assert.ok(out.endsWith("https://acme.com/jobs"), out);
});
