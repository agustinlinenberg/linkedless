/**
 * LinkedLess — Shared utilities
 *
 * Text normalisation and post-header parsing. Runs in the content script and
 * in Node (for tests and the coverage report), so everything here is plain
 * synchronous JS with no DOM or browser dependency.
 *
 * normalizeText/splitSentences/extractAuthor are adapted from LinkedIn Detox
 * (https://github.com/OdinMB/linkedin-detox), MIT.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  /**
   * Escape HTML special characters before any innerHTML assignment.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Collapse the Unicode noise LinkedIn injects into rendered text:
   * non-breaking spaces, zero-width characters, and the various dashes.
   * @param {string} str
   * @returns {string}
   */
  function normalizeText(str) {
    return String(str)
      .replace(/[   ⁠]/g, " ")
      .replace(/[​‌‍﻿]/g, "")
      .replace(/[‐‑‒–—―]/g, "-")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  /**
   * Split text into sentences. Line breaks count as boundaries because
   * broetry has no terminal punctuation.
   * @param {string} text
   * @param {{minLength?: number}} [opts]
   * @returns {string[]}
   */
  function splitSentences(text, opts) {
    var minLength = (opts && opts.minLength) || 0;
    return String(text)
      .split(/[.!?\n]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > minLength; });
  }

  // Relative timestamps LinkedIn renders immediately above the post body:
  // "2h", "1d", "3w", "2mo", optionally followed by " • Edited".
  var TIMESTAMP_RE = /^\d+\s?(s|m|h|d|w|mo|y|mos|hr|hrs|min|mins|sem|me|a|mes|meses|d[ií]as?|horas?|semanas?|a[nñ]os?)\.?(\s*[•·]\s*[^\n]*)?$/i;
  // Everything else LinkedIn stacks into the header.
  var BOILERPLATE_RE = /^([•·]\s*)?(\+?\s*follow(ing)?|\+?\s*seguir|siguiendo|connect|conectar|message|enviar mensaje|premium|[•·]|\d+(st|nd|rd|th)\+?|\d+(ro|do|to|mo|vo|no|er)\.?\+?|\d+\.º\+?|edited|editado|promoted|promocionado|sponsored|patrocinado|suggested|sugerido|feed post|publicaci[oó]n( del feed)?|visible (to anyone|para cualquiera).*)$/i;

  function isHeaderNoise(line) {
    if (!line) return true;
    return BOILERPLATE_RE.test(line) || TIMESTAMP_RE.test(line) || SKIP_ENGAGEMENT.test(line);
  }

  // Accessibility boilerplate LinkedIn puts above the author name.
  var SKIP_EXACT = /^(feed post|publicaci[oó]n( del feed)?|suggested|sugerido|promoted|promocionado|sponsored|patrocinado|following|siguiendo|follow|seguir|•|\d+(st|nd|rd|th)|\d+(ro|do|to|mo|vo|no|er)\.?)$/i;

  // "{Name} commented on this" — describes another user's interaction,
  // not the post author.
  var SKIP_ENGAGEMENT = /\b(finds this \w+|loves this|likes this|liked this|celebrated this|commented on this|reposted this|shared this|replied to this|recomienda esto|le gusta esto|comentó esto|coment[oó] esto|compartió esto|comparti[oó] esto|celebra esto)$/i;

  /**
   * Extract the author name from a post's innerText: the first line that
   * isn't LinkedIn boilerplate or an engagement-context line.
   * @param {string} text
   * @returns {string} name, or "" when nothing plausible is found
   */
  function extractAuthor(text) {
    var lines = String(text).split("\n");
    var limit = Math.min(lines.length, 5);
    for (var i = 0; i < limit; i++) {
      var line = normalizeText(lines[i]);
      if (!line || SKIP_EXACT.test(line) || SKIP_ENGAGEMENT.test(line)) continue;
      return line.length <= 120 ? line : "";
    }
    return "";
  }

  /**
   * Extract the author's headline — the line directly below their name,
   * e.g. "VP Sales at Acme | Helping teams scale".
   *
   * Layer A of the pipeline: this is what lets us tell `we_are_hiring` from
   * `third_party_referral` without a model, by comparing the company in the
   * headline against the company named in the post body.
   *
   * @param {string} text
   * @returns {string} headline, or "" when not found
   */
  function extractHeadline(text) {
    var lines = String(text).split("\n");
    var limit = Math.min(lines.length, 8);
    var seenAuthor = false;
    for (var i = 0; i < limit; i++) {
      var line = normalizeText(lines[i]);
      if (!line || SKIP_EXACT.test(line) || SKIP_ENGAGEMENT.test(line)) continue;
      if (!seenAuthor) { seenAuthor = true; continue; }
      // Connection degree and timestamps sit between the name and headline.
      if (isHeaderNoise(line)) continue;
      return line.length <= 220 ? line : "";
    }
    return "";
  }

  /**
   * Strip the header block (name, headline, connection degree, timestamp,
   * "Follow") so downstream matching only ever sees the post body.
   *
   * Primary rule: LinkedIn always renders a relative timestamp directly above
   * the body, so the body is everything after the last timestamp line in the
   * header region. That is far more reliable than trying to recognise where
   * the body "looks like it starts" — an earlier version of this function
   * required the first body line to be long or end in punctuation, and
   * silently swallowed every post that opened with a short hook.
   *
   * Fallback, when no timestamp is present: consume leading noise, one name
   * line, and at most one headline line.
   *
   * @param {string} text
   * @returns {string}
   */
  function extractBody(text) {
    var lines = String(text).split("\n");
    var scanTo = Math.min(lines.length, 10);

    var lastTimestamp = -1;
    for (var i = 0; i < scanTo; i++) {
      if (TIMESTAMP_RE.test(normalizeText(lines[i]))) lastTimestamp = i;
    }
    if (lastTimestamp !== -1) {
      return lines.slice(lastTimestamp + 1).join("\n").trim();
    }

    var j = 0;
    while (j < lines.length && isHeaderNoise(normalizeText(lines[j]))) j++;
    if (j < lines.length) j++;                                    // author name
    while (j < lines.length && isHeaderNoise(normalizeText(lines[j]))) j++;
    var next = normalizeText(lines[j] || "");
    // A headline sits directly under the name and reads like a job title,
    // not like a sentence.
    if (next && next.length < 160 && / at | \| |·/.test(next) && !/[.!?]$/.test(next)) j++;
    while (j < lines.length && isHeaderNoise(normalizeText(lines[j]))) j++;

    return lines.slice(j).join("\n").trim();
  }

  // Everything LinkedIn stacks under a post: the reaction rail, the counts,
  // the action-bar labels, the translation link, the comment thread.
  var FOOTER_RE = new RegExp(
    "^(?:" +
    "like|comment|repost|send|follow|following|" +
    "recomendar|comentar|compartir|enviar|seguir|" +
    "show translation|ver traducci[oó]n|see translation|" +
    "activate to view larger image|" +
    "\\d[\\d.,]*\\s*(?:comments?|reposts?|reactions?|likes?|comentarios?|reacciones?|veces compartido)|" +
    "see (?:more|\\d+ more) comments?|ver (?:m[aá]s|\\d+ m[aá]s) comentarios?|" +
    "load more comments|cargar m[aá]s comentarios|" +
    "and \\d+ others?|y \\d+ (?:personas|m[aá]s)|" +
    "[•·]|\\d+" +
    ")\\s*$",
    "i"
  );

  /**
   * Cut a post's text at the first line that belongs to LinkedIn's footer.
   *
   * Only used when the post body cannot be read directly. post.innerText
   * carries the job card, the reaction list, the counts and, on a popular
   * post, the whole comment thread, and compressing that produced cards like
   * "Greater Buenos Aires (Hybrid). Gabriel and 15 others reacted."
   *
   * @param {string} text
   * @returns {string}
   */
  function stripFooter(text) {
    var lines = String(text || "").split("\n");
    for (var i = 0; i < lines.length; i++) {
      if (FOOTER_RE.test(normalizeText(lines[i]))) {
        return lines.slice(0, i).join("\n").trim();
      }
    }
    return String(text || "").trim();
  }

  /**
   * First sentence carrying actual content — skips one-word hooks and
   * ALL-CAPS shouting so templates get something readable.
   * @param {string} text
   * @param {number} [minWords=6]
   * @returns {string}
   */
  function firstMeaningfulSentence(text, minWords) {
    var min = minWords || 6;
    // Unlike splitSentences, this keeps the terminator: a poll rendered as
    // "Poll: what matters most." instead of "…most?" reads wrong.
    var sentences = String(text).match(/[^.!?\n]+[.!?]?/g) || [];
    for (var i = 0; i < sentences.length; i++) {
      var s = normalizeText(sentences[i]);
      var words = s.replace(/[.!?]+$/, "").split(/\s+/).filter(Boolean);
      if (words.length >= min) return s;
    }
    // Nothing long enough — fall back to the longest fragment we have.
    var longest = "";
    for (var j = 0; j < sentences.length; j++) {
      if (sentences[j].length > longest.length) longest = sentences[j];
    }
    return normalizeText(longest);
  }

  /**
   * Truncate on a word boundary, appending an ellipsis when cut.
   * @param {string} str
   * @param {number} max
   * @returns {string}
   */
  function truncate(str, max) {
    var s = normalizeText(str);
    if (s.length <= max) return s;
    var cut = s.slice(0, max - 1);
    var lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
    return cut.replace(/[,;:\-\s]+$/, "") + "…";
  }

  /**
   * Case-insensitive substring match of an author line against a whitelist.
   * @param {string|null|undefined} authorLine
   * @param {Set<string>} whitelistSet lowercased names
   * @returns {boolean}
   */
  function isWhitelistedAuthor(authorLine, whitelistSet) {
    if (!authorLine || !whitelistSet || whitelistSet.size === 0) return false;
    var lower = normalizeText(authorLine).toLowerCase();
    for (var name of whitelistSet) {
      if (name && lower.includes(name)) return true;
    }
    return false;
  }

  ns.escapeHtml = escapeHtml;
  ns.normalizeText = normalizeText;
  ns.splitSentences = splitSentences;
  ns.extractAuthor = extractAuthor;
  ns.extractHeadline = extractHeadline;
  ns.extractBody = extractBody;
  ns.stripFooter = stripFooter;
  ns.firstMeaningfulSentence = firstMeaningfulSentence;
  ns.truncate = truncate;
  ns.isWhitelistedAuthor = isWhitelistedAuthor;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      escapeHtml: escapeHtml,
      normalizeText: normalizeText,
      splitSentences: splitSentences,
      extractAuthor: extractAuthor,
      extractHeadline: extractHeadline,
      extractBody: extractBody,
      stripFooter: stripFooter,
      firstMeaningfulSentence: firstMeaningfulSentence,
      truncate: truncate,
      isWhitelistedAuthor: isWhitelistedAuthor,
    };
  }
})();
