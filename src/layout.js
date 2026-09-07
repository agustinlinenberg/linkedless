/**
 * LinkedLess — feed widening
 *
 * Hiding the sidebars leaves LinkedIn's ~555px feed column stranded in the
 * middle of a wide screen, which reads as the mobile layout. Widening it from
 * a stylesheet turned out to be guesswork: `main` is a grid whose track widths
 * come from the panes, several wrappers in between are `display: contents`
 * where width does nothing, and a blanket rule over the subtree collapsed the
 * column instead of widening it — twice.
 *
 * So this measures instead of guessing. It walks up from the feed container,
 * finds the ancestors that are actually narrower than the space available,
 * and widens only those. Then it checks whether the feed actually got wider
 * and removes everything if it did not.
 *
 * Self-verifying because the failure mode matters: a feed that is too narrow
 * is a complaint, a feed that collapsed to 300px is unusable.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  var STYLE_ID = "linkedless-layout";
  var SIDE_MARGIN = 48;     // breathing room either side of the column
  var TOLERANCE = 4;        // px, to ignore sub-pixel noise

  var styleEl = null;
  var lastSignature = "";

  function ensureStyle() {
    if (styleEl && document.head.contains(styleEl)) return styleEl;
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
    return styleEl;
  }

  /**
   * Build a selector that addresses exactly one element.
   *
   * Structural nth-child rather than class names: LinkedIn's classes are
   * obfuscated and change between deploys, while the wrapper chain around the
   * feed is stable within a session.
   *
   * @param {Element} el
   * @returns {string|null}
   */
  function cssPath(el) {
    var parts = [];
    var node = el;
    while (node && node.tagName && node.tagName !== "BODY") {
      var parent = node.parentElement;
      if (!parent) return null;
      var index = Array.prototype.indexOf.call(parent.children, node) + 1;
      parts.unshift(node.tagName.toLowerCase() + ":nth-child(" + index + ")");
      node = parent;
      if (parts.length > 14) return null;      // absurdly deep, give up
    }
    return parts.length ? "body > " + parts.join(" > ") : null;
  }

  /**
   * Widen the feed column to `target` px, or as close as the page allows.
   *
   * @param {string} feedSelector
   * @param {number} maxWidth desired column width
   * @returns {void}
   */
  function widen(feedSelector, maxWidth) {
    var feed = document.querySelector(feedSelector);
    if (!feed) return;

    var target = Math.min(maxWidth, window.innerWidth - SIDE_MARGIN * 2);
    var before = feed.getBoundingClientRect().width;
    if (before >= target - TOLERANCE) return;

    var rules = [];
    var node = feed;
    while (node && node.tagName && node.tagName !== "BODY") {
      var style = getComputedStyle(node);
      // Width has no meaning on display:contents, and setting it there was
      // one half of why the stylesheet attempts failed.
      if (style.display !== "contents") {
        var width = node.getBoundingClientRect().width;
        if (width > 0 && width < target - TOLERANCE) {
          var path = cssPath(node);
          if (path) {
            rules.push(
              path + "{max-width:none !important;width:" + target + "px !important;" +
              "margin-left:auto !important;margin-right:auto !important;}"
            );
          }
        }
      }
      node = node.parentElement;
    }

    if (!rules.length) return;

    var css = rules.join("\n");
    if (css === lastSignature) return;
    lastSignature = css;
    ensureStyle().textContent = css;

    // Verify on the next frame. Deliberately no `min-width: 0` anywhere above:
    // removing the automatic minimum size of a grid or flex item is what let
    // the column collapse rather than grow.
    requestAnimationFrame(function () {
      var after = feed.getBoundingClientRect().width;
      if (after <= before + TOLERANCE) {
        // It did not help, or it made things worse. Leave the page as we
        // found it rather than shipping a broken layout.
        ensureStyle().textContent = "";
        lastSignature = "";
        console.warn(
          "[LinkedLess] Could not widen the feed (" + Math.round(before) + "px -> " +
          Math.round(after) + "px). Reverted; the layout is unchanged."
        );
      }
    });
  }

  function reset() {
    lastSignature = "";
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    styleEl = null;
  }

  ns.layout = { widen: widen, reset: reset, cssPath: cssPath };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.layout;
  }
})();
