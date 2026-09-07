/**
 * LinkedLess — overlay renderer
 *
 * Two things happen every frame.
 *
 * 1. A card is drawn over each translated post. Cards live in one fixed
 *    container attached to document.body, outside React's tree, because
 *    anything injected into a post is stripped on the next reconciliation.
 *
 * 2. The post underneath is collapsed to the card's height, using a
 *    stylesheet rather than inline styles. A stylesheet is not part of
 *    React's tree either, so reconciliation cannot undo it, and `nth-child`
 *    targets one post without needing a class on it.
 *
 * The second part is what makes the feed shorter. Without it the card just
 * covers an 800px post with three lines of text and a large white void, and
 * you scroll exactly as far as before.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  var OVERLAY_ID = "linkedless-overlay";
  var STYLE_ID = "linkedless-collapse";
  var CULL_MARGIN = 200;      // px beyond the viewport before we stop drawing
  var MIN_CARD_HEIGHT = 56;
  var CARD_OVERHANG = 4;

  var overlay = null;
  var styleEl = null;
  var nodes = new Map();      // hash -> card element
  var heights = new Map();    // hash -> { width, height }, so we measure once
  var lastCss = "";

  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return overlay;
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);
    return overlay;
  }

  function ensureStyle() {
    if (styleEl && document.head.contains(styleEl)) return styleEl;
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
    return styleEl;
  }

  /**
   * Build one card. Called once per post, not once per frame, so a click
   * cannot land on an element that is about to be replaced.
   *
   * @param {string} hash
   * @param {object} card render-text output, plus `author`
   * @param {function} onDismiss
   * @returns {HTMLElement}
   */
  function buildCard(hash, card, onDismiss) {
    var el = document.createElement("div");
    el.className = "ll-card" + (card.rail ? " ll-rail" : "");
    el.setAttribute("data-ll-hash", hash);

    // No author line. LinkedIn already renders the name, headline and avatar
    // directly above this, and repeating it drew the name twice and made the
    // card look like a second post inside the post.
    var text = document.createElement("p");
    text.className = "ll-text";
    text.textContent = card.text;
    el.appendChild(text);

    // The button sits in its own row rather than floating over the text. It is
    // always in the layout, only its opacity changes on hover, so the card
    // does not resize under the cursor.
    var foot = document.createElement("div");
    foot.className = "ll-foot";

    var reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "ll-reveal";
    reveal.textContent = card.lang === "es" ? "Ver original" : "Show original";
    reveal.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      onDismiss(hash);
    });
    foot.appendChild(reveal);
    el.appendChild(foot);

    return el;
  }

  // LinkedIn wraps every post body in this, and only the body. Collapsing it
  // instead of the whole post leaves the author row, the images, the video and
  // the action bar exactly where they were.
  var TEXT_SELECTOR = "[data-testid='expandable-text-box']";

  /**
   * The element holding the post's words. Falls back to the post itself so a
   * markup change degrades to the old whole-post behaviour rather than to
   * nothing.
   *
   * @param {Element} post
   * @returns {Element}
   */
  function textElement(post) {
    return post.querySelector(TEXT_SELECTOR) || post;
  }

  /**
   * Redraw every visible card and, when it has changed, rewrite the collapse
   * stylesheet.
   *
   * Rewriting the stylesheet on every frame is what made scrolling stutter:
   * each write invalidates style for the whole feed, which forces a layout,
   * which changes the rects the cards are positioned from. Now the rules are
   * only written when their content actually differs, and scroll frames do
   * nothing but move existing cards.
   *
   * @param {Map<string, object>} cards hash -> card
   * @param {function} hashText
   * @param {string} postSelector
   * @param {function} onDismiss
   * @param {function} resolvePost wrapper -> the element that has a box
   * @param {string} feedSelector
   */
  function render(cards, hashText, postSelector, onDismiss, resolvePost, feedSelector, readPost) {
    var root = ensureOverlay();
    var wrappers = document.querySelectorAll(postSelector);
    var feed = feedSelector ? document.querySelector(feedSelector) : null;
    var feedChildren = feed ? Array.prototype.slice.call(feed.children) : [];

    var seen = new Set();
    var visible = [];

    for (var i = 0; i < wrappers.length; i++) {
      var wrapper = wrappers[i];
      var post = resolvePost ? resolvePost(wrapper) : wrapper;
      if (!post) continue;

      var rect = post.getBoundingClientRect();
      if (rect.bottom < -CULL_MARGIN || rect.top > window.innerHeight + CULL_MARGIN) continue;

      var parsed = readPost ? readPost(post) : null;
      if (!parsed) continue;

      var hash = hashText(parsed.hashSource);
      var card = cards.get(hash);
      if (!card) continue;

      seen.add(hash);
      var el = nodes.get(hash);
      if (!el) {
        el = buildCard(hash, card, onDismiss);
        nodes.set(hash, el);
        root.appendChild(el);
      }
      visible.push({ el: el, target: textElement(post), wrapper: wrapper, hash: hash });
    }

    // Measure once per card and cache it. Card content never changes, so its
    // height only moves when the column width does.
    var rules = [];
    for (var v = 0; v < visible.length; v++) {
      var item = visible[v];
      var width = Math.round(item.target.getBoundingClientRect().width);
      if (!width) continue;

      var cached = heights.get(item.hash);
      if (!cached || cached.width !== width) {
        item.el.style.width = width + "px";
        cached = { width: width, height: Math.max(MIN_CARD_HEIGHT, Math.ceil(item.el.getBoundingClientRect().height)) };
        heights.set(item.hash, cached);
      }
      item.height = cached.height;

      var index = feedChildren.indexOf(item.wrapper);
      if (index === -1) continue;
      rules.push(
        feedSelector + " > *:nth-child(" + (index + 1) + ") " + TEXT_SELECTOR + "{" +
        "height:" + cached.height + "px !important;overflow:hidden !important;}"
      );
    }

    var css = rules.join("\n");
    if (css !== lastCss) {
      ensureStyle().textContent = css;
      lastCss = css;
    }

    // Positioning is the only thing that runs on a plain scroll frame.
    // transform keeps it off the layout path.
    for (var p = 0; p < visible.length; p++) {
      var it = visible[p];
      var r = it.target.getBoundingClientRect();
      it.el.style.width = Math.round(r.width) + "px";
      // Overhang the collapsed text box by a few pixels. Matching its height
      // exactly left the top of the next line peeking out along the bottom
      // edge, which read as a row of dashes. The overhang lands on the post's
      // own background, so it is invisible.
      it.el.style.minHeight = (it.height + CARD_OVERHANG) + "px";
      it.el.style.transform = "translate(" + Math.round(r.left) + "px," + Math.round(r.top) + "px)";
    }

    nodes.forEach(function (el, hash) {
      if (seen.has(hash)) return;
      if (el.parentNode) el.parentNode.removeChild(el);
      nodes.delete(hash);
      heights.delete(hash);
    });
  }

  function teardown() {
    nodes.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    nodes.clear();
    heights.clear();
    lastCss = "";
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    styleEl = null;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  ns.renderer = { render: render, teardown: teardown, buildCard: buildCard, textElement: textElement };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.renderer;
  }
})();
