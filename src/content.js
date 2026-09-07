/**
 * LinkedLess — content script entry point
 *
 * Wires the scanner and renderer to LinkedIn's feed lifecycle.
 *
 * Three details here are not optional, and each one cost someone a day to
 * discover (see linkedin-detox's .context/linkedin-dom-challenges.md):
 *
 *  1. The scroll listener needs `capture: true`. LinkedIn scrolls an inner
 *     container, not the window, so a bubbling listener never fires.
 *  2. The MutationObserver must watch document.body, not the feed container.
 *     Observing the container alone misses React's async content render.
 *  3. Post wrappers exist in the DOM before their text does, so the first
 *     scan finds empty shells. Retry scans catch them once React fills in.
 */

(function () {
  var ns = window._ll;
  if (!ns || !ns.scanner) return;
  if (window.__linkedlessLoaded) return;   // SPA navigation can re-inject us
  window.__linkedlessLoaded = true;

  var RETRY_SCAN_DELAYS_MS = [1000, 3000, 6000];
  var SCAN_DEBOUNCE_MS = 150;

  var config = {
    enabled: true,
    hideFurniture: true,
    feedWidth: 860,
    mutedFamilies: new Set(),
    whitelistedAuthors: new Set(),
    debug: false,
  };

  var FOCUS_CLASS = "ll-focus";

  /**
   * Toggle the class that hides LinkedIn's sidebars. A class on <body> rather
   * than inline styles, so the rules live in content.css and React never sees
   * an attribute it wants to reconcile away.
   */
  function applyFocus() {
    var on = config.enabled && config.hideFurniture;
    document.body.classList.toggle(FOCUS_CLASS, on);
    if (on) {
      // Runs after the class lands so the rails are already out of the
      // layout when we measure.
      requestAnimationFrame(function () {
        ns.layout.widen(ns.scanner.FEED_SELECTOR, config.feedWidth);
      });
    } else {
      ns.layout.reset();
    }
  }

  /**
   * Publish the sticky header's height so the overlay can clip itself below
   * it. Measured rather than hardcoded because LinkedIn changes it, and set on
   * <html>, which React does not manage.
   */
  function measureNav() {
    var nav = document.querySelector("header");
    var height = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
    if (height > 0 && height < 200) {
      document.documentElement.style.setProperty("--ll-nav-height", height + "px");
    }
  }

  var scanQueued = false;
  var renderQueued = false;
  var selectorWarned = false;

  function log() {
    if (!config.debug) return;
    console.log.apply(console, ["[LinkedLess]"].concat(Array.prototype.slice.call(arguments)));
  }

  /**
   * The extension context dies when the user reloads or updates the
   * extension; every chrome.* call after that throws.
   */
  function isContextValid() {
    try { return !!(chrome.runtime && chrome.runtime.id); }
    catch (err) { return false; }
  }

  /**
   * @param {Node} node
   * @returns {boolean} true when the node is part of our own overlay
   */
  function isOurs(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    return !!(el && el.closest && el.closest("#linkedless-overlay"));
  }

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      if (!config.enabled) return;
      try {
        ns.renderer.render(
          ns.scanner.cards,
          ns.scanner.hashText,
          ns.scanner.POST_SELECTOR,
          onDismiss,
          ns.scanner.resolvePost,
          ns.scanner.FEED_SELECTOR,
          ns.scanner.readPost
        );
      } catch (err) {
        console.warn("[LinkedLess] render failed:", err);
      }
    });
  }

  function onDismiss(hash) {
    ns.scanner.dismiss(hash);
    requestRender();
  }

  function scan() {
    if (!isContextValid()) return;
    try {
      ns.scanner.scanFeed(config, {
        render: requestRender,
        log: log,
        isContextValid: isContextValid,
      });
    } catch (err) {
      console.warn("[LinkedLess] scan failed:", err);
      return;
    }
    warnOnStaleSelectors();
    persistStats();
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(function () { scanQueued = false; scan(); }, SCAN_DEBOUNCE_MS);
  }

  /**
   * If the feed container is present but no post matches, LinkedIn has almost
   * certainly changed its DOM and the selectors in scanner.js need updating.
   * Warn once, loudly, rather than silently doing nothing forever.
   */
  function warnOnStaleSelectors() {
    if (selectorWarned || ns.scanner.stats.scanned > 0) return;
    if (!document.querySelector(ns.scanner.FEED_SELECTOR)) return;
    if (document.querySelectorAll(ns.scanner.POST_SELECTOR).length > 0) return;
    selectorWarned = true;
    console.warn(
      "[LinkedLess] Found the feed container but zero posts — LinkedIn has likely " +
      "changed its DOM. POST_SELECTOR in src/scanner.js needs updating. " +
      "Please open an issue: https://github.com/linkedless/linkedless/issues"
    );
  }

  function persistStats() {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set({ stats: {
        scanned: ns.scanner.stats.scanned,
        translated: ns.scanner.stats.translated,
        passthrough: ns.scanner.stats.passthrough,
      } });
    } catch (err) { /* storage is best-effort; never block the feed on it */ }
  }

  function applySettings(stored) {
    if (!stored) return;
    if (typeof stored.enabled === "boolean") config.enabled = stored.enabled;
    if (typeof stored.hideFurniture === "boolean") config.hideFurniture = stored.hideFurniture;
    if (typeof stored.feedWidth === "number") config.feedWidth = stored.feedWidth;
    config.debug = stored.debug === true;
    config.mutedFamilies = new Set(stored.mutedFamilies || []);
    config.whitelistedAuthors = new Set(
      (stored.whitelistedAuthors || []).map(function (n) { return String(n).toLowerCase(); })
    );
    if (!config.enabled) { ns.renderer.teardown(); ns.layout.reset(); }
    applyFocus();
  }

  function start() {
    applyFocus();
    measureNav();

    // Reposition on scroll. capture:true is mandatory — see note 1 above.
    window.addEventListener("scroll", requestRender, { passive: true, capture: true });
    window.addEventListener("resize", function () {
      measureNav();
      ns.layout.reset();
      applyFocus();
      requestRender();
    }, { passive: true });

    // Watch the whole body — see note 2 above.
    //
    // Our own cards live in document.body, so appending one is a mutation that
    // would schedule another scan, which renders another card. It settles, but
    // during a scroll it means a scan per card per frame. Ignoring mutations
    // that only touch our overlay breaks that loop.
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (!isOurs(records[i].target)) { queueScan(); return; }
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    scan();
    RETRY_SCAN_DELAYS_MS.forEach(function (ms) { setTimeout(scan, ms); });   // note 3

    // SPA navigation swaps the feed without a page load.
    var lastPath = location.pathname;
    setInterval(function () {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      ns.scanner.reset();
      ns.renderer.teardown();
      RETRY_SCAN_DELAYS_MS.forEach(function (ms) { setTimeout(scan, ms); });
    }, 800);
  }

  try {
    chrome.storage.sync.get(null, function (stored) {
      applySettings(stored);
      start();
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "sync") return;
      chrome.storage.sync.get(null, function (stored) {
        applySettings(stored);
        ns.scanner.reset();
        ns.renderer.teardown();
        scan();
      });
    });
  } catch (err) {
    // No storage (or a dead context) shouldn't stop the extension working
    // with defaults.
    start();
  }
})();
