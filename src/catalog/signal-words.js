/**
 * LinkedLess — Layer C: lexical banks
 *
 * The signal-word list and co-occurrence templates are adapted from
 * LinkedIn Detox (https://github.com/OdinMB/linkedin-detox), MIT. They exist
 * here to score one genre — `ai_generated` — and to supply a generic
 * "no specifics" signal the catalog can reference.
 *
 * Pure data plus two small scorers. Add words freely; the scorers normalise
 * by length so the list can grow without shifting thresholds.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  var SIGNAL_WORDS = [
    "leverag(?:e|ed|es|ing)", "journey(?:s)?", "game[- ]?chang(?:e|er|ing)",
    "mindset(?:s)?", "synerg(?:y|ies|istic)", "unlock(?:s|ed|ing)?",
    "scal(?:e|ed|es|ing|able)", "disrupt(?:s|ed|ing|ive|ion)?",
    "actionable", "framework(?:s)?", "eco[- ]?system(?:s)?",
    "resonate[ds]?", "impactful", "transformative", "thought ?leader(?:ship)?",
    "delv(?:e|ed|es|ing)", "tapestr(?:y|ies)", "realm(?:s)?", "beacon(?:s)?",
    "intricate(?:ly)?", "robust(?:ly|ness)?", "seamless(?:ly)?",
    "pivotal(?:ly)?", "foster(?:s|ed|ing)?", "harness(?:es|ed|ing)?",
    "holistic(?:ally)?", "vibrant(?:ly)?", "embark(?:s|ed|ing)?",
    "unprecedented", "groundbreaking", "testament(?:s)?",
    "navigat(?:e|ed|es|ing)", "elevat(?:e|ed|es|ing)",
    "empower(?:s|ed|ing|ment)?", "comprehensive(?:ly)?",
    "curat(?:e|ed|es|ing)", "streamlin(?:e|ed|es|ing)",
    "revolutioniz(?:e|ed|es|ing)", "cutting[- ]?edge", "spearhead(?:s|ed|ing)?",
    "landscape(?:s)?", "ever[- ]?evolving", "paradigm(?:s)?",
    "supercharg(?:e|ed|es|ing)", "double[- ]?down", "north star",
  ];

  var SIGNAL_WORDS_RE = new RegExp("\\b(?:" + SIGNAL_WORDS.join("|") + ")\\b", "gi");
  var EM_DASH_RE = /—|--(?!-)/g;
  var ELLIPSIS_RE = /\.{3,}|…/g;

  /**
   * Buzzword density, normalised per 100 words and capped at 100.
   * @param {string} text
   * @param {object} [metrics] structure.analyze() result, to avoid recounting
   * @returns {{score: number, matches: string[]}}
   */
  function signalWordScore(text, metrics) {
    var words = metrics ? metrics.wordCount : String(text).split(/\s+/).filter(Boolean).length;
    if (!words) return { score: 0, matches: [] };
    SIGNAL_WORDS_RE.lastIndex = 0;
    var found = String(text).match(SIGNAL_WORDS_RE) || [];
    if (!found.length) return { score: 0, matches: [] };
    var per100 = (found.length / words) * 100;
    return {
      score: Math.min(100, Math.round(per100 * 25)),
      matches: Array.from(new Set(found.map(function (f) { return f.toLowerCase(); }))),
    };
  }

  /**
   * Em dash and ellipsis density per sentence — the most reliable single
   * tell for unedited LLM output.
   * @param {string} text
   * @param {object} [metrics]
   * @returns {{score: number, matches: string[]}}
   */
  function punctuationScore(text, metrics) {
    var sentences = metrics ? metrics.sentenceCount : String(text).split(/[.!?\n]+/).filter(Boolean).length;
    if (!sentences) return { score: 0, matches: [] };
    var dashes = (String(text).match(EM_DASH_RE) || []).length;
    var ellipses = (String(text).match(ELLIPSIS_RE) || []).length;
    var total = dashes + ellipses;
    if (!total) return { score: 0, matches: [] };
    var matches = [];
    if (dashes) matches.push(dashes + " em dashes");
    if (ellipses) matches.push(ellipses + " ellipses");
    return { score: Math.min(100, Math.round((total / sentences) * 50)), matches: matches };
  }

  /**
   * Thought-leader sentence templates. Each pattern fires only when every
   * group matches inside the same window of sentences, which keeps precision
   * high. `span` widens that window for templates that deliberately break
   * across a line — the false dichotomy is always "X isn't about Y." followed
   * by "It's about Z." on the next line.
   */
  var COOCCURRENCE_PATTERNS = [
    { label: "humbled to share", groups: [["humbled", "thrilled", "excited", "honored", "honoured", "delighted", "proud"], ["share", "announce", "reveal"]] },
    { label: "false dichotomy", span: 2, groups: [["isn't about", "is not about", "not about"], ["it's about", "its about", "it is about"]] },
    { label: "nobody talks about", groups: [["nobody", "no one", "most people", "nobody's"], ["talking", "talks", "miss", "realize", "realise", "understand", "tells you"]] },
    { label: "if you're not", groups: [["if you're not", "if you are not", "if your team isn't"], ["behind", "losing", "wrong", "you're", "you are"]] },
    { label: "interesting thing", groups: [["interesting", "fascinating", "intriguing", "wild"], ["here", "thing", "part", "where", "what"]] },
    { label: "let that sink in", groups: [["let that sink in", "read that again", "think about it"]] },
    { label: "here's the kicker", span: 2, groups: [["here's the", "heres the"], ["kicker", "thing", "twist", "lesson", "takeaway"]] },
  ];

  /**
   * @param {string} text
   * @returns {{score: number, matches: string[]}}
   */
  function cooccurrenceScore(text) {
    var sentences = String(text).split(/[.!?\n]+/).map(function (s) { return s.toLowerCase(); });
    var matches = [];
    for (var i = 0; i < COOCCURRENCE_PATTERNS.length; i++) {
      var p = COOCCURRENCE_PATTERNS[i];
      var span = p.span || 1;
      for (var j = 0; j < sentences.length; j++) {
        var window = sentences.slice(j, j + span).join(" ");
        var hit = p.groups.every(function (group) {
          return group.some(function (w) { return window.indexOf(w) !== -1; });
        });
        if (hit) { matches.push(p.label); break; }
      }
    }
    return { score: Math.min(100, matches.length * 30), matches: matches };
  }

  /**
   * Combined "reads as machine-written" score. Max of the three scorers —
   * one strong signal is enough.
   * @param {string} text
   * @param {object} [metrics]
   * @returns {{score: number, matches: string[]}}
   */
  function slopScore(text, metrics) {
    var results = [
      signalWordScore(text, metrics),
      punctuationScore(text, metrics),
      cooccurrenceScore(text),
    ];
    return {
      score: Math.max.apply(null, results.map(function (r) { return r.score; })),
      matches: results.reduce(function (a, r) { return a.concat(r.matches); }, []),
    };
  }

  ns.lexicon = {
    SIGNAL_WORDS: SIGNAL_WORDS,
    COOCCURRENCE_PATTERNS: COOCCURRENCE_PATTERNS,
    signalWordScore: signalWordScore,
    punctuationScore: punctuationScore,
    cooccurrenceScore: cooccurrenceScore,
    slopScore: slopScore,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.lexicon;
  }
})();
