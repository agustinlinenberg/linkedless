/**
 * LinkedLess — catalog interpreter
 *
 * Evaluates every catalog entry against one post and returns the matches,
 * ranked. This file contains no knowledge of any specific genre: all of that
 * lives in src/catalog/genres.js. Adding a genre never requires touching
 * this file — only adding a new *kind* of predicate does.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  /**
   * Resolve a dependency from the shared namespace, falling back to require()
   * under Node for tests. Guarded because `require` is not defined in a
   * content script: without this, a script that failed to load would surface
   * as a bare ReferenceError instead of naming the missing file.
   */
  function need(fromNamespace, path) {
    if (fromNamespace) return fromNamespace;
    if (typeof require === "function") return require(path);
    throw new Error("LinkedLess: missing dependency " + path + " — check content_scripts order in manifest.json");
  }

  var utils = need(ns.normalizeText ? ns : null, "../shared/utils.js");
  var structure = need(ns.structure, "./structure.js");
  var entities = need(ns.entities, "./entities.js");
  var lexicon = need(ns.lexicon, "../catalog/signal-words.js");
  var catalogModule = need(ns.catalog, "../catalog/genres.js");
  var lang = need(ns.lang, "../shared/lang.js");
  // The Spanish overlay is optional at load time so the engine still works if
  // a locale file is removed.
  var overlays = {
    es: (ns.catalogEs || (typeof require === "function" ? require("../catalog/genres.es.js") : null) || {}).OVERLAY || {},
  };

  var CATALOG = catalogModule.CATALOG;
  var FAMILIES = catalogModule.FAMILIES;

  // Compiled regexes are cached across posts — the catalog is static, and
  // recompiling ~30 patterns per post during a scroll is wasteful.
  var localeCatalogs = Object.create(null);

  /**
   * Build the genre list for one language.
   *
   * Every genre exists in every language. A locale overlay only replaces the
   * `detect` block where that language needs a different phrase bank; genres
   * detected from DOM flags or post shape need no overlay at all, and genres
   * with no overlay simply keep the English phrases, which rarely match
   * foreign text and cost nothing when they don't.
   *
   * Genre no longer carries any output text. The card is written by
   * compress.js from the post's own sentences, so all a genre decides is the
   * sensitive rail and which family the post is muted under.
   *
   * @param {string} locale
   * @returns {object[]}
   */
  function catalogFor(locale) {
    if (localeCatalogs[locale]) return localeCatalogs[locale];

    var overlay = overlays[locale];
    if (locale === "en" || !overlay) {
      localeCatalogs[locale] = CATALOG;
      return CATALOG;
    }

    var list = CATALOG.map(function (genre) {
      var patch = overlay[genre.id];
      if (!patch || !patch.detect) return genre;
      return {
        id: genre.id,
        family: genre.family,
        intent: genre.intent,
        substance: genre.substance,
        rail: genre.rail,
        passthrough: genre.passthrough,
        detect: patch.detect,
        examples: patch.examples || [],
      };
    });

    localeCatalogs[locale] = list;
    return list;
  }

  var regexCache = Object.create(null);
  function cachedRegex(src) {
    if (!regexCache[src]) regexCache[src] = new RegExp(src, "i");
    return regexCache[src];
  }

  /**
   * Build everything the predicates need, once per post.
   * @param {string} rawText post innerText, header included
   * @param {object} [native] Layer A DOM flags, e.g. { poll: true }
   * @returns {object} evaluation context
   */
  function buildContext(rawText, native, bodyOverride) {
    var text = utils.normalizeText(String(rawText || ""));
    var headline = utils.extractHeadline(rawText);
    // The caller can hand us the post body directly when it has a better
    // source than the header-stripping heuristic — in the browser it does,
    // because LinkedIn marks the body up explicitly.
    var body = bodyOverride ? utils.normalizeText(String(bodyOverride)) : utils.extractBody(rawText);
    var metrics = structure.analyze(body);
    var captures = entities.extract(body, headline);
    var detected = lang.detect(body);

    return {
      lang: detected.lang,
      langConfident: detected.confident,
      raw: rawText,
      body: body,
      lower: body.toLowerCase(),
      author: utils.extractAuthor(rawText),
      headline: headline,
      metrics: metrics,
      captures: captures,
      native: native || {},
      flags: { companyMismatch: entities.companyMismatch(captures) },
      scores: {
        slop: lexicon.slopScore(body, metrics).score,
        cooccurrence: lexicon.cooccurrenceScore(body).score,
        signalWords: lexicon.signalWordScore(body, metrics).score,
        punctuation: lexicon.punctuationScore(body, metrics).score,
      },
      _text: text,
    };
  }

  /**
   * Compare a metric against a bound: a bare value means equality,
   * an object means { min?, max? } inclusive.
   */
  function withinBound(value, bound) {
    if (bound === null || typeof bound !== "object") return value === bound;
    if (bound.min !== undefined && !(value >= bound.min)) return false;
    if (bound.max !== undefined && !(value <= bound.max)) return false;
    return true;
  }

  /**
   * Evaluate one predicate against the context.
   * Unknown predicate kinds return false rather than throwing, so a catalog
   * typo degrades to "this genre never fires" instead of breaking the feed.
   * @returns {boolean}
   */
  function testPredicate(p, ctx) {
    if (!p || typeof p !== "object") return false;

    // Compound predicates let a genre express "either this strong phrase, or
    // this weak signal backed by corroboration" without splitting into two
    // near-duplicate entries. The sensitive rail needs exactly this: "passed
    // away" alone is conclusive, "died" alone is not.
    if (p.and) {
      for (var a = 0; a < p.and.length; a++) {
        if (!testPredicate(p.and[a], ctx)) return false;
      }
      return true;
    }
    if (p.or) {
      for (var o = 0; o < p.or.length; o++) {
        if (testPredicate(p.or[o], ctx)) return true;
      }
      return false;
    }

    if (p.phrase) {
      for (var i = 0; i < p.phrase.length; i++) {
        if (ctx.lower.indexOf(String(p.phrase[i]).toLowerCase()) !== -1) return true;
      }
      return false;
    }
    if (p.regex) return cachedRegex(p.regex).test(ctx.body);
    if (p.capture) return ctx.captures[p.capture] != null && ctx.captures[p.capture] !== "";
    if (p.native) return ctx.native[p.native] === true;
    if (p.flag) return ctx.flags[p.flag] === true;
    if (p.structure) {
      for (var key in p.structure) {
        if (!withinBound(ctx.metrics[key], p.structure[key])) return false;
      }
      return true;
    }
    if (p.score) {
      for (var s in p.score) {
        if (!withinBound(ctx.scores[s], p.score[s])) return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Evaluate one catalog entry.
   * @returns {{matched: boolean, specificity: number}}
   */
  function testGenre(genre, ctx) {
    var d = genre.detect || {};
    var specificity = 0;

    var all = d.all || [];
    for (var i = 0; i < all.length; i++) {
      if (!testPredicate(all[i], ctx)) return { matched: false, specificity: 0 };
      specificity += 2;
    }

    if (d.any && d.any.length) {
      var anyHit = false;
      for (var j = 0; j < d.any.length; j++) {
        if (testPredicate(d.any[j], ctx)) { anyHit = true; specificity += 1; }
      }
      if (!anyHit) return { matched: false, specificity: 0 };
    }

    if (d.none && d.none.length) {
      for (var k = 0; k < d.none.length; k++) {
        if (testPredicate(d.none[k], ctx)) return { matched: false, specificity: 0 };
      }
    }

    return { matched: true, specificity: specificity };
  }

  /**
   * Classify a post.
   *
   * Returns the primary genre plus any secondary matches. Ranking is by
   * family precedence first — the sensitive rail always wins, the fallback
   * always loses — then by specificity, so a genre that had to satisfy four
   * predicates outranks one that satisfied a single loose phrase.
   *
   * @param {string} rawText post innerText
   * @param {object} [native] Layer A DOM flags
   * @param {string} [bodyOverride] the post body, when the caller can isolate it
   * @returns {{primary: object, matches: object[], context: object}}
   */
  function classify(rawText, native, bodyOverride) {
    var ctx = buildContext(rawText, native, bodyOverride);

    // When the language is uncertain — short posts, or a post that mixes both
    // — match against every catalog rather than committing to a guess.
    // Guessing wrong on a three-word post about a death is the worst failure
    // this extension has, so uncertainty widens the net instead of narrowing
    // it. Duplicate ids are collapsed below, keeping the better match.
    var catalog;
    if (ctx.langConfident) {
      catalog = catalogFor(ctx.lang);
    } else {
      catalog = catalogFor(ctx.lang).slice();
      Object.keys(overlays).forEach(function (other) {
        if (other !== ctx.lang) catalog = catalog.concat(catalogFor(other));
      });
    }

    var matches = [];

    for (var i = 0; i < catalog.length; i++) {
      var genre = catalog[i];
      var result = testGenre(genre, ctx);
      if (!result.matched) continue;
      matches.push({
        id: genre.id,
        family: genre.family,
        genre: genre,
        precedence: FAMILIES[genre.family].precedence,
        specificity: result.specificity,
      });
    }

    matches.sort(function (a, b) {
      if (a.precedence !== b.precedence) return a.precedence - b.precedence;
      return b.specificity - a.specificity;
    });

    // Collapse the duplicates the multi-locale pass can produce, keeping the
    // first of each id — which the sort has already made the best one.
    var seenIds = Object.create(null);
    matches = matches.filter(function (m) {
      if (seenIds[m.id]) return false;
      seenIds[m.id] = true;
      return true;
    });

    // The rail is absolute: if any rail genre matched, nothing else is
    // allowed to describe the post.
    var rail = matches.filter(function (m) { return m.genre.rail; });
    if (rail.length) matches = rail;

    return {
      primary: matches[0] || null,
      matches: matches,
      context: ctx,
    };
  }

  ns.match = {
    classify: classify,
    catalogFor: catalogFor,
    buildContext: buildContext,
    testGenre: testGenre,
    testPredicate: testPredicate,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.match;
  }
})();
