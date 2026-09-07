const test = require("node:test");
const assert = require("node:assert/strict");
const layout = require("../src/layout.js");

// cssPath only touches tagName, parentElement and children, so a handful of
// plain objects is enough to exercise it without a DOM.
function el(tag, children) {
  const node = { tagName: tag.toUpperCase(), children: children || [], parentElement: null };
  node.children.forEach((c) => { c.parentElement = node; });
  return node;
}

test("cssPath addresses one element by structural position", () => {
  const target = el("div");
  const body = el("body", [el("div"), el("div", [el("span"), el("main", [el("div"), target])])]);
  assert.equal(
    layout.cssPath(target),
    "body > div:nth-child(2) > main:nth-child(2) > div:nth-child(2)"
  );
});

test("cssPath stops at body and never includes it as a step", () => {
  const target = el("main");
  el("body", [target]);
  assert.equal(layout.cssPath(target), "body > main:nth-child(1)");
});

test("cssPath gives up on an absurdly deep chain rather than emitting junk", () => {
  let node = el("div");
  const deep = node;
  for (let i = 0; i < 20; i++) node = el("div", [node]);
  el("body", [node]);
  assert.equal(layout.cssPath(deep), null);
});

test("cssPath returns null for a detached element", () => {
  assert.equal(layout.cssPath(el("div")), null);
});
