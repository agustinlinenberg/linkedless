const test = require("node:test");
const assert = require("node:assert/strict");

// scanner.js expects the shared namespace the manifest builds up in the
// browser, so load its dependency first the same way.
global.window = {};
require("../src/shared/utils.js");
const scanner = require("../src/scanner.js");

/**
 * Minimal stand-in for a feed element: readPost only reads innerText and
 * queries for the text box, so a real DOM is not needed.
 */
function fakePost(innerText, textBoxContent) {
  return {
    innerText,
    querySelector: (sel) =>
      sel.includes("expandable-text-box") && textBoxContent != null
        ? { innerText: textBoxContent }
        : null,
  };
}

test("a post with a text box is read from the text box, not innerText", () => {
  const post = fakePost(
    "Feed post\nJane Doe\nVP Sales at Acme\n2h\n\nThe body.\n\n12 comments\nLike\nComment",
    "We are hiring a Senior Backend Engineer at Acme. Remote across the EU."
  );
  const parsed = scanner.readPost(post);
  assert.equal(parsed.body, "We are hiring a Senior Backend Engineer at Acme. Remote across the EU.");
  // Identity is author plus body, so a ticking comment count cannot change it.
  assert.ok(!parsed.hashSource.includes("12 comments"));
});

test("an element with no text box is not a post", () => {
  // A "people you may know" carousel clears the height and button-count
  // checks easily, and one of them got a card in the wild when this returned
  // a body from innerText instead of null.
  const suggestions = fakePost(
    "Tomás Escobar\nTech Entrepreneur\nSeguido por 42 contactos en común\nSeguir\n" +
    "Agustina Rocio Gonzalez\nIT Talent Acquisition\nSeguir\nMostrar más"
  );
  assert.equal(scanner.readPost(suggestions), null);
});

test("a post whose text box is too short to be worth reading is skipped", () => {
  assert.equal(scanner.readPost(fakePost("Feed post\nJane\n2h\n\nok", "Nice one")), null);
});

test("post identity ignores engagement counts", () => {
  const body = "We raised a $12M Series A led by Sequoia this quarter.";
  const before = scanner.readPost(fakePost("Feed post\nAna Lee\nFounder\n2h\n\n" + body + "\n3 comments", body));
  const after = scanner.readPost(fakePost("Feed post\nAna Lee\nFounder\n3h\n\n" + body + "\n41 comments", body));
  assert.equal(scanner.hashText(before.hashSource), scanner.hashText(after.hashSource));
});
