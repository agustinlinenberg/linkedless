/**
 * LinkedLess — language detection
 *
 * Picks the language a post is written in so the catalog can match it with
 * the right phrase bank and render the card in the same language.
 *
 * Rendering in the post's own language is not a preference, it is forced by
 * the design: card text is extractive, so a Spanish post supplies Spanish
 * spans. "Wants you to comment X" wrapped around "Comentá GUÍA y te lo mando"
 * reads like a bug.
 *
 * Detection is stopword counting. No model, no dictionary file, and it only
 * needs to separate two languages, which is a much easier job than general
 * language ID.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  // Function words, chosen to barely overlap between the two languages.
  // "no" and "a" are excluded: both are common in English and Spanish.
  var STOPWORDS = {
    en: ["the", "and", "of", "to", "is", "in", "for", "with", "that", "this",
         "you", "we", "it", "on", "at", "was", "are", "be", "have", "has",
         "from", "they", "our", "your", "about", "what", "how", "but", "not",
         "will", "can", "just", "more", "when", "who", "been", "were"],
    es: ["que", "de", "la", "el", "los", "las", "un", "una", "en", "por",
         "para", "con", "del", "al", "es", "son", "se", "su", "sus", "lo",
         "como", "más", "pero", "porque", "cuando", "sobre", "todo", "todos",
         "muy", "también", "hay", "ser", "estar", "está", "están", "hace",
         "nos", "nuestro", "nuestra", "mi", "yo", "te", "gracias", "años"],
  };

  var SETS = {};
  Object.keys(STOPWORDS).forEach(function (code) {
    SETS[code] = new Set(STOPWORDS[code]);
  });

  // Characters that only appear in Spanish text. Weak on their own (an English
  // post can name "José"), so they count for less than a stopword.
  var SPANISH_CHARS = /[ñ¿¡]|[áéíóúü]/gi;

  var DEFAULT = "en";
  var MIN_WORDS = 5;      // below this, stopword counts are noise
  var MARGIN = 1.25;      // how far ahead the winner must be

  /**
   * @param {string} text post body
   * @returns {{ lang: string, confident: boolean, scores: object }}
   */
  function detect(text) {
    var words = String(text || "")
      .toLowerCase()
      .replace(/[^\wÀ-ÿ\s'’]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    var scores = { en: 0, es: 0 };
    for (var i = 0; i < words.length; i++) {
      if (SETS.en.has(words[i])) scores.en++;
      if (SETS.es.has(words[i])) scores.es++;
    }
    scores.es += Math.min(4, (String(text).match(SPANISH_CHARS) || []).length) * 0.5;

    if (words.length < MIN_WORDS) {
      return { lang: DEFAULT, confident: false, scores: scores };
    }

    var winner = scores.es > scores.en ? "es" : "en";
    var loser = winner === "es" ? "en" : "es";
    var confident = scores[winner] >= 2 && scores[winner] >= scores[loser] * MARGIN;

    return { lang: confident ? winner : DEFAULT, confident: confident, scores: scores };
  }

  /**
   * @param {string} text
   * @returns {string} language code
   */
  function detectLang(text) {
    return detect(text).lang;
  }

  ns.lang = { detect: detect, detectLang: detectLang, STOPWORDS: STOPWORDS, DEFAULT: DEFAULT };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.lang;
  }
})();
