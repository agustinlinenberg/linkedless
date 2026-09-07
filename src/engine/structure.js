/**
 * LinkedLess — Layer B: structural metrics
 *
 * Arithmetic over the shape of a post, with no word matching at all. This is
 * where broetry is caught: a tall narrow column of one-line beats separated by
 * blank lines has a signature that survives any change in vocabulary, so it
 * ages far better than a phrase list.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});
  var utils = ns.splitSentences
    ? ns
    : (typeof require !== "undefined" ? require("../shared/utils.js") : null);

  // Pictographic ranges — emoji proper, not punctuation or dingbat arrows.
  var EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F2FF}]/gu;
  // Glyphs used as list bullets in LinkedIn posts.
  var BULLET_RE = /[→▪️✅✔️👉🔹🔸➡️•·▶️★☑️]/gu;
  var HASHTAG_RE = /(^|\s)#[\wÀ-ɏ]+/g;
  var MENTION_RE = /(^|\s)@[\wÀ-ɏ]+/g;
  var ALLCAPS_RE = /\b[A-Z]{3,}\b/g;
  var NUMERAL_LED_RE = /^\s*(\d+[.):\-]|\d+\/|[①-⑳])\s+/;

  function median(nums) {
    if (nums.length === 0) return 0;
    var sorted = nums.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function count(text, re) {
    var m = String(text).match(re);
    return m ? m.length : 0;
  }

  /**
   * Compute every structural metric for a post body.
   * @param {string} body post text with the header already stripped
   * @returns {object} metrics consumed by catalog `structure` predicates
   */
  function analyze(body) {
    var text = String(body || "");
    var rawLines = text.split("\n");
    var lines = rawLines.map(function (l) { return l.trim(); });
    var nonEmpty = lines.filter(function (l) { return l.length > 0; });
    var words = text.split(/\s+/).filter(Boolean);
    var sentences = utils ? utils.splitSentences(text) : text.split(/[.!?\n]+/).filter(Boolean);

    var lineLengths = nonEmpty.map(function (l) { return l.length; });
    var wordsPerLine = nonEmpty.map(function (l) {
      return l.split(/\s+/).filter(Boolean).length;
    });

    var blankLines = lines.length - nonEmpty.length;
    var shortLines = nonEmpty.filter(function (l) { return l.length <= 60; }).length;

    var m = {
      charCount: text.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      lineCount: nonEmpty.length,
      blankLineRatio: lines.length ? blankLines / lines.length : 0,
      shortLineRatio: nonEmpty.length ? shortLines / nonEmpty.length : 0,
      medianLineLength: median(lineLengths),
      avgWordsPerLine: wordsPerLine.length
        ? wordsPerLine.reduce(function (a, b) { return a + b; }, 0) / wordsPerLine.length
        : 0,
      emojiCount: count(text, EMOJI_RE),
      bulletGlyphCount: count(text, BULLET_RE),
      hashtagCount: count(text, HASHTAG_RE),
      mentionCount: count(text, MENTION_RE),
      allCapsWordCount: count(text, ALLCAPS_RE),
      numeralLedLineCount: nonEmpty.filter(function (l) { return NUMERAL_LED_RE.test(l); }).length,
      endsWithQuestion: /\?\s*(#\S+\s*)*$/.test(text.trim()),
      questionCount: count(text, /\?/g),
      // Bilingual on purpose. This flag gates most of the sensitive rail, so
      // an English-only version silently disables the rail in Spanish — which
      // is exactly what it did until the Spanish corpus caught it.
      firstPerson: /\b(i|i'm|i've|my|me|we|we're|our)\b/i.test(text) ||
        /(?:^|[^\wÀ-ÿ])(yo|mi|mis|me|nos|nuestr[oa]s?|conmigo|estoy|estuve|tuve|tengo|fui|soy|hice|siento|comparto|quiero|vuelvo|paso|dej[eé]|viv[ií])(?![\wÀ-ÿ])/i.test(text),
    };

    m.broetryScore = broetryScore(m);
    return m;
  }

  /**
   * 0–100 confidence that a post is formatted as broetry: many short lines,
   * heavy blank-line padding, few words per line.
   *
   * Deliberately requires 4+ lines so that a two-line quip never qualifies.
   *
   * @param {object} m metrics from analyze()
   * @returns {number}
   */
  function broetryScore(m) {
    if (m.lineCount < 4) return 0;

    // Blank line between every beat is the strongest single tell.
    var padding = Math.min(1, m.blankLineRatio / 0.4);
    // One idea per line.
    var brevity = Math.min(1, Math.max(0, (12 - m.avgWordsPerLine) / 8));
    // Tall column.
    var height = Math.min(1, m.lineCount / 12);
    // Narrow column.
    var narrow = m.medianLineLength > 0 ? Math.min(1, Math.max(0, (90 - m.medianLineLength) / 60)) : 0;

    var score = (padding * 0.35 + brevity * 0.3 + height * 0.2 + narrow * 0.15) * 100;
    return Math.round(score);
  }

  ns.structure = { analyze: analyze, broetryScore: broetryScore };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { analyze: analyze, broetryScore: broetryScore };
  }
})();
