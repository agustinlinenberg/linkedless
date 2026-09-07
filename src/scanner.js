/**
 * LinkedLess — feed scanner
 *
 * Finds posts, identifies them, reads their Layer A DOM signals, and runs
 * them through the catalog. Owns the hash → card map that the renderer draws
 * from each frame.
 *
 * Post identity is a hash of innerText, never an element reference: LinkedIn
 * virtualises the feed, so the DOM node backing a post is destroyed and
 * recreated as you scroll. Approach adapted from LinkedIn Detox (MIT), which
 * documents the six approaches that fail before this one.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  // Verified against the live feed on 2026-09-04.
  //
  // LinkedIn wraps every feed entry in a chain of `display: contents` divs, so
  // the wrapper itself always measures zero height. Selecting a fixed depth
  // below it is what broke last time — they went from
  // `div[data-display-contents="true"] > div` to `div[data-lazy-mount-id]`
  // with an extra layer. So we select the wrapper and *walk down* to the first
  // element that actually occupies space. That survives layers being added or
  // removed, which is the failure mode this selector keeps hitting.
  var FEED_SELECTOR = "[componentkey='container-update-list_mainFeed-lazy-container']";
  var POST_SELECTOR = FEED_SELECTOR + " > div[data-lazy-mount-id], " +
                      FEED_SELECTOR + " > div[data-display-contents='true']";

  var MIN_POST_HEIGHT = 40;   // anything smaller is a spacer or a separator
  var MAX_UNWRAP_DEPTH = 8;
  var MIN_POST_BUTTONS = 3;   // see isRealPost()

  /**
   * Tell a real post from the "Start a post" composer, which also sits in the
   * feed and also resolves to a sized element.
   *
   * Counting buttons rather than matching an aria-label is deliberate: the
   * composer carries none, every post carries at least seven (react, comment,
   * repost, send, overflow…), and a count survives translation. Matching
   * "Like" would break the moment the interface is in Spanish.
   *
   * @param {Element} el
   * @returns {boolean}
   */
  function isRealPost(el) {
    return el.querySelectorAll("button").length >= MIN_POST_BUTTONS;
  }

  /**
   * Descend from a feed-entry wrapper to the element that actually has a box.
   * Returns null for spacers, which render as an empty zero-height chain, and
   * for the composer.
   *
   * @param {Element} wrapper
   * @returns {Element|null}
   */
  function resolvePost(wrapper) {
    var el = wrapper;
    for (var depth = 0; depth < MAX_UNWRAP_DEPTH && el; depth++) {
      if (el.getBoundingClientRect().height >= MIN_POST_HEIGHT) {
        return isRealPost(el) ? el : null;
      }
      el = el.firstElementChild;
    }
    return null;
  }

  // LinkedIn wraps the author's actual words in this, and nothing else.
  // post.innerText also carries the job card, the reaction list, the comment
  // count, the action-bar labels and, on a popular post, several thousand
  // characters of other people's comments. Compressing that produced cards
  // like "Greater Buenos Aires (Hybrid). Gabriel and 15 others reacted."
  var TEXT_SELECTOR = "[data-testid='expandable-text-box']";

  var cards = new Map();        // hash -> render result
  var analyzed = new Set();     // hash -> already classified
  var dismissed = new Set();    // hash -> user asked for the original
  var dismissedEls = new WeakSet();
  var ANALYZED_MAX = 2000;

  var stats = { scanned: 0, translated: 0, passthrough: 0 };

  /**
   * Pull the parts of a post we actually use, keeping the author's words
   * apart from LinkedIn's furniture.
   *
   * @param {Element} post
   * @returns {{header: string, body: string, hashSource: string}|null}
   */
  function readPost(post) {
    var header = (post.innerText || "").trim();
    if (!header) return null;

    var textBox = post.querySelector(TEXT_SELECTOR);
    var body = textBox ? (textBox.innerText || "").trim() : "";

    // When the text box is missing — a markup change, or a post type that
    // doesn't use it — fall back to the header-stripped innerText with the
    // footer cut off. Skipping instead, as an earlier version did, meant any
    // post LinkedIn rendered differently silently got no card at all.
    if (!body) {
      body = ns.stripFooter(ns.extractBody(header));
    }
    if (!body || body.length < 20) return null;

    return {
      header: header,
      body: body,
      // Identity comes from the author line plus the body. Hashing the whole
      // innerText meant the hash changed every time a reaction or comment
      // count ticked, which re-analysed the post and rebuilt its card.
      hashSource: ns.extractAuthor(header) + "\u0000" + body,
    };
  }

  /**
   * Cheap non-cryptographic hash of post text. Collisions are harmless: the
   * worst case is one post briefly showing another's card.
   */
  function hashText(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return h + ":" + text.length;
  }

  /**
   * Read Layer A signals off the post element.
   *
   * Every probe has a text fallback because LinkedIn's class names are
   * obfuscated and its attributes change without notice — a missing flag
   * degrades one genre, a thrown exception would break the feed.
   *
   * @param {Element} post
   * @param {string} text post.innerText
   * @returns {object} flags consumed by `{ native: ... }` predicates
   */
  function readNative(post, text) {
    var head = text.slice(0, 220);
    var flags = {};

    try {
      flags.promoted = /\b(Promoted|Sponsored)\b/.test(head);
      flags.injection = /\b(commented on this|reposted this|likes this|celebrates this|finds this)\b/.test(head);
      flags.video = !!post.querySelector("video, [data-test-id*='video'], [class*='video-player']");
      flags.document = !!post.querySelector("[data-test-id*='document'], [class*='document-s-container'], [aria-label*='document' i]");
      flags.poll = !!post.querySelector("[data-test-id*='poll'], [class*='poll-'], [aria-label*='poll' i]") ||
        /\b\d+\s+votes?\b/i.test(text);
      flags.event = !!post.querySelector("a[href*='/events/']");
      flags.job = !!post.querySelector("a[href*='/jobs/view/'], a[href*='/jobs/collections/']");
      flags.newsletter = !!post.querySelector("a[href*='/newsletters/'], a[href*='/pulse/']");
      flags.celebration = !!post.querySelector("[data-test-id*='occasion'], [class*='celebration']");
      // A reshare nests a second post header inside the outer one.
      flags.reshare = !!post.querySelector("[class*='reshared'], [data-test-id*='reshare']") ||
        /\breposted this\b/i.test(head);
    } catch (err) {
      // A selector LinkedIn no longer supports must not take the feed with it.
      console.warn("[LinkedLess] native probe failed:", err);
    }

    return flags;
  }

  /**
   * Scan the feed, classify anything new, and populate the card map.
   *
   * @param {object} config { enabled, mutedFamilies, whitelistedAuthors }
   * @param {object} callbacks { render, log, isContextValid }
   * @returns {number} count of newly analysed posts
   */
  function scanFeed(config, callbacks) {
    if (!config.enabled || !callbacks.isContextValid()) return 0;

    var posts = document.querySelectorAll(POST_SELECTOR);
    var fresh = 0;

    for (var i = 0; i < posts.length; i++) {
      var post = resolvePost(posts[i]);
      if (!post) continue;                                  // spacer, not a post
      if (dismissedEls.has(post)) continue;

      var parsed = readPost(post);
      if (!parsed) continue;                                // React hasn't rendered yet

      var hash = hashText(parsed.hashSource);
      if (dismissed.has(hash) || analyzed.has(hash)) continue;

      analyzed.add(hash);
      if (analyzed.size > ANALYZED_MAX) {
        analyzed.delete(analyzed.values().next().value);
      }
      fresh++;
      stats.scanned++;

      var author = ns.extractAuthor(parsed.header);
      if (config.whitelistedAuthors && ns.isWhitelistedAuthor(author, config.whitelistedAuthors)) {
        continue;
      }

      var card;
      try {
        card = ns.renderText.render(
          ns.match.classify(parsed.header, readNative(post, parsed.header), parsed.body)
        );
      } catch (err) {
        console.warn("[LinkedLess] classification failed:", err);
        continue;
      }

      if (card.passthrough) { stats.passthrough++; continue; }
      if (config.mutedFamilies && config.mutedFamilies.has(card.family)) {
        stats.passthrough++;
        continue;
      }

      card.author = author;
      cards.set(hash, card);
      stats.translated++;
    }

    if (fresh > 0) {
      callbacks.log("scanned " + fresh + " new posts (" + stats.translated + " translated, " +
        stats.passthrough + " left alone)");
      callbacks.render();
    }

    return fresh;
  }

  /**
   * Reveal the original post: drop its card and remember not to re-render it.
   */
  function dismiss(hash, element) {
    dismissed.add(hash);
    cards.delete(hash);
    if (element) dismissedEls.add(element);
  }

  function reset() {
    cards.clear();
    analyzed.clear();
    dismissed.clear();
    stats.scanned = 0;
    stats.translated = 0;
    stats.passthrough = 0;
  }

  ns.scanner = {
    FEED_SELECTOR: FEED_SELECTOR,
    POST_SELECTOR: POST_SELECTOR,
    cards: cards,
    stats: stats,
    hashText: hashText,
    readNative: readNative,
    resolvePost: resolvePost,
    readPost: readPost,
    TEXT_SELECTOR: TEXT_SELECTOR,
    isRealPost: isRealPost,
    MIN_POST_HEIGHT: MIN_POST_HEIGHT,
    scanFeed: scanFeed,
    dismiss: dismiss,
    reset: reset,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.scanner;
  }
})();
