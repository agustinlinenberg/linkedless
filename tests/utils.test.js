const test = require("node:test");
const assert = require("node:assert/strict");
const u = require("../src/shared/utils.js");

const post = (body, headline = "VP Sales at Acme | Helping teams scale") =>
  `Feed post\nJane Doe\n• 3rd+\n${headline}\n2h • Edited\n\n${body}`;

test("extractAuthor skips LinkedIn's accessibility boilerplate", () => {
  assert.equal(u.extractAuthor(post("Body.")), "Jane Doe");
});

test("extractAuthor ignores engagement-context lines about other people", () => {
  assert.equal(u.extractAuthor("Dan Alvarez commented on this\nMaria Cruz\nPM\n5h\n\nBody."), "Maria Cruz");
});

test("extractHeadline returns the line under the name", () => {
  assert.equal(u.extractHeadline(post("Body.")), "VP Sales at Acme | Helping teams scale");
});

test("extractBody strips the header block", () => {
  assert.equal(u.extractBody(post("We are hiring.")), "We are hiring.");
});

test("extractBody keeps a short opening line that has no terminal punctuation", () => {
  // Regression: an earlier version required the first body line to be long or
  // end in punctuation, and silently swallowed every post opening with a hook.
  assert.equal(u.extractBody(post("Tag someone who needs this 👇")), "Tag someone who needs this 👇");
});

test("extractBody preserves internal line breaks", () => {
  assert.equal(u.extractBody(post("One.\n\nTwo.\n\nThree.")), "One.\n\nTwo.\n\nThree.");
});

test("extractBody falls back to name+headline consumption with no timestamp", () => {
  assert.equal(u.extractBody("Jane Doe\nVP Sales at Acme\n\nActual body."), "Actual body.");
});

test("normalizeText collapses LinkedIn's zero-width and non-breaking characters", () => {
  assert.equal(u.normalizeText("Jane Doe​"), "Jane Doe");
});

test("firstMeaningfulSentence skips a one-word hook", () => {
  assert.equal(
    u.firstMeaningfulSentence("Wow.\n\nWe shipped the new billing engine this week."),
    "We shipped the new billing engine this week."
  );
});

test("firstMeaningfulSentence keeps the terminator", () => {
  // Templates embed this directly, so "Poll: what matters most." instead of
  // "…most?" changes the meaning of the card.
  assert.equal(
    u.firstMeaningfulSentence("What matters most in a first engineering hire?"),
    "What matters most in a first engineering hire?"
  );
});

test("truncate cuts on a word boundary", () => {
  const out = u.truncate("alpha beta gamma delta epsilon", 18);
  assert.ok(out.length <= 18, out);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("gam "));
});

test("isWhitelistedAuthor matches despite pronouns and odd spacing", () => {
  assert.equal(u.isWhitelistedAuthor("Jane Doe (She/Her)", new Set(["jane doe"])), true);
  assert.equal(u.isWhitelistedAuthor("John Roe", new Set(["jane doe"])), false);
});
