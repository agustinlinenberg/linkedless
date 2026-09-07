/**
 * LinkedLess — extractive compression
 *
 * Turns a post into the ≤280 characters it would have been if the author had
 * written it without the performance.
 *
 * Every word on a card comes out of the post itself. Nothing is paraphrased,
 * nothing is interpreted, no motive is assigned. The work is deciding which
 * of the author's own sentences carry information and which are scaffolding:
 * the cliffhanger hook, the one-line suspense beats, the tidy aphorism at the
 * end, the call to action, the hashtag row.
 *
 * Drop those and what is left reads like a person stating what happened.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  function need(fromNamespace, path) {
    if (fromNamespace) return fromNamespace;
    if (typeof require === "function") return require(path);
    throw new Error("LinkedLess: missing dependency " + path);
  }

  var utils = need(ns.normalizeText ? ns : null, "../shared/utils.js");
  var lexicon = need(ns.lexicon, "../catalog/signal-words.js");

  var MAX = 280;

  // Calls to action. The ask is scaffolding: it tells you what the author
  // wants but nothing about what happened.
  // Boundaries matter here: without them "tag" matches inside "heritage" and
  // penalises the most informative sentence in a hiring post. \b is not enough
  // either, since it is ASCII-only and these alternatives include accents.
  var CTA_RE = new RegExp(
    "(?:^|[^\\wÀ-ÿ])(?:comment|drop|type|reply|tag|repost|share this|follow me|follow for|dm me|" +
    "send me|link in (the )?comments|sign up|register|book a call|apply (through|here|below|via)|" +
    "check it out|read more|full (post|article) (in|below)|save this|" +
    "unlock the|preview the|see how|learn how|discover how|find out how|get the (full )?report|" +
    "coment[aá]|comenta|etiquet[aá]|etiqueta|compart[ií]|comparte|segu[ií]me|s[ií]gueme|" +
    "escribime|escríbeme|mandame|mándame|te lo mando|te lo paso|link en (los )?comentarios|" +
    "inscribite|inscríbete|reserv[aá] tu lugar|agend[aá] una llamada|post[uú]late|" +
    "descubr[ií] c[oó]mo|conoc[eé] m[aá]s|mir[aá] c[oó]mo|ped[ií] el informe)(?![\\wÀ-ÿ])",
    "i"
  );

  // Aphorisms and sign-offs. Portable to any post, so they carry nothing.
  var APHORISM_RE = new RegExp(
    "^(be kind|never give up|keep going|trust the process|stay humble|stay hungry|" +
    "let that sink in|read that again|think about it|you got this|dream big|" +
    "consistency beats|culture (beats|eats)|hard work (beats|pays)|" +
    "the lesson( is|:)|moral of the story|takeaway|lo importante es|" +
    "la lecci[oó]n|nunca te rindas|segu[ií] adelante|conf[ií]a en el proceso|" +
    "s[eé] amable|todo llega|el esfuerzo)",
    "i"
  );

  // Engagement questions used to close a post.
  var ENGAGEMENT_Q_RE = /^(thoughts|agree|am i wrong|what would you do|what do you think|who else|right\?|qué opinás|que opinas|coincidís|coinciden|estoy equivocad)/i;

  var HASHTAG_ONLY_RE = /^[#@\s\p{Extended_Pictographic}\p{Emoji_Presentation}·•→▪✅👉]+$/u;
  var ENTITY_RE = /[$€£]\s?\d|\b\d+([.,]\d+)?\s?%|\b\d{2,}\b|\b(19|20)\d{2}\b|\bseries?\s+[a-j]\b|\bserie\s+[a-j]\b/i;
  var ENTITY_RE_G = new RegExp(ENTITY_RE.source, "gi");
  var PROPER_NOUN_RE_G = /\b[A-ZÀ-Þ][a-zà-ÿ]{2,}(?:\s+[A-ZÀ-Þ][a-zà-ÿ]{2,})*/g;

  /**
   * Split a post into candidate units. Lines first, because broetry is written
   * one beat per line and its line breaks carry the structure; long lines are
   * then split into sentences so a wall of prose is not all-or-nothing.
   *
   * @param {string} body
   * @returns {string[]}
   */
  // A sentence opening this way completes the one before it. Scoring them
  // separately let the pair "Una buena experiencia no es la que te llena de
  // atención. Es la que entiende qué necesitás." be split, keeping a fragment
  // with nothing to refer back to.
  var CONTINUATION_RE = /^(?:it'?s|it is|that'?s|that is|this is|they'?re|they are|which|whose|es|son|eso es|esto es|la que|el que|lo que hace)\s+(?=[\wÀ-ÿ])/i;
  var MERGED_MAX = 250;

  function units(body) {
    var out = [];
    String(body || "").split("\n").forEach(function (rawLine) {
      var line = utils.normalizeText(rawLine);
      if (!line) return;
      // Always split into sentences, never only long lines. Broetry writes one
      // sentence per line so splitting is a no-op there, but a normal
      // paragraph packs several sentences onto one line and only splitting
      // long ones let "Qué orgullo enorme." ride along with the facts beside
      // it, immune to scoring.
      utils.splitSentences(line, { minLength: 2 }).forEach(function (sentence) {
        var s = utils.normalizeText(sentence);
        if (!s) return;
        s = /[.!?]$/.test(s) ? s : s + ".";

        var previous = out.length ? out[out.length - 1] : null;
        if (previous && CONTINUATION_RE.test(s) && previous.length + s.length <= MERGED_MAX) {
          out[out.length - 1] = previous + " " + s;
          return;
        }
        out.push(s);
      });
    });
    return out;
  }

  /**
   * Score one unit for how much it tells you. Positive keeps it.
   *
   * @param {string} unit
   * @param {number} index position in the post
   * @param {number} total
   * @returns {number}
   */
  function score(unit, index, total, post) {
    var words = unit.split(/\s+/).filter(Boolean).length;
    if (words < 2) return -10;
    if (HASHTAG_ONLY_RE.test(unit)) return -10;
    if (/^(…|\.\.\.|more|ver más|see more|show translation|ver traducción|hide)$/i.test(unit)) return -10;

    var s = 0;

    // Count rather than test. A sentence naming three places and a number is
    // carrying more than one naming a single brand, and a boolean cannot see
    // the difference — which let "a unique opportunity to help shape the
    // physical expression of the brand" outrank the sentence with the cities
    // and the showrooms in it.
    var entityHits = (unit.match(ENTITY_RE_G) || []).length;
    var properHits = (unit.slice(1).match(PROPER_NOUN_RE_G) || []).length;

    s += Math.min(6, entityHits * 3);
    // Capped lower than entities: three names in a sentence of feelings should
    // not outrank one sentence carrying a number and a fact.
    s += Math.min(4, properHits * 2);
    if (words >= 8 && words <= 40) s += 2;
    else if (words >= 5) s += 1;

    if (THESIS_RE.test(unit)) s += 3;

    // A post carrying no facts anywhere is a reflection, and reflections build
    // to their point rather than opening with it. Only applied when there is
    // nothing better to rank on, so fact-carrying posts keep reading order.
    if (post && !post.hasEntities && total >= 4) {
      s += Math.round((index / (total - 1)) * 2);
    }

    if (CTA_RE.test(unit)) s -= 5;
    // Heavier than it looks: a sentence of pure feeling still scores well on
    // length and on any names it drops, so the penalty has to be enough to
    // push it under the keep threshold rather than merely rank it lower.
    if (SENTIMENT_RE.test(unit) && entityHits === 0) s -= 4;
    if (APHORISM_RE.test(unit)) s -= 5;
    if (ENGAGEMENT_Q_RE.test(unit)) s -= 5;

    // Buzzwords without any fact attached are the definition of filler.
    var slop = lexicon.signalWordScore(unit).score;
    if (slop >= 40 && entityHits === 0) s -= 3;

    // The last line of a broetry post is nearly always the moral. Requires a
    // ladder to be present: without the length check this fired on the second
    // sentence of any two-sentence post, so "Coffee is bad, people are great"
    // was treated as an aphorism and stripped.
    if (index === total - 1 && total >= 4 && words <= 10 && entityHits === 0) s -= 2;

    return s;
  }

  /**
   * Compress a post to at most 280 characters of its own sentences.
   *
   * @param {string} body post body, header stripped
   * @param {object} [opts] { rail: boolean }
   * @returns {string}
   */
  /**
   * Compress and report whether anything was actually stripped.
   *
   * "Did this get shorter" is the wrong question: a plain post gets shorter
   * too once a sentence is dropped to fit the budget, and covering it with a
   * truncated copy of itself helps nobody. The right question is whether we
   * removed packaging — a call to action, an aphorism, a sentiment line, a
   * hashtag row — or rewrote an opener. If we only trimmed to fit, there was
   * no bullshit to remove and the post should be left alone.
   *
   * @param {string} body
   * @param {object} [opts] { rail: boolean }
   * @returns {{text: string, stripped: boolean}}
   */
  function analyze(body, opts) {
    var original = String(body || "");
    var transformed = debullshit(original);
    var rewritten = transformed.replace(/\s+/g, "") !== original.replace(/\s+/g, "");

    var all = units(transformed);
    var kept = all.filter(function (u) { return !isFiller(u); });
    var removedFiller = kept.length !== all.length;

    var text = compress(body, opts);

    // A sentence left out while there was still room for it was left out for
    // scoring as packaging, not for want of space. Checking only for a
    // negative score missed the commonest case: filler that scores zero and
    // loses to the threshold, like "Cerrando una etapa" beside the sentence
    // naming the company and the role.
    var droppedWithRoomToSpare = units(text).length < kept.length && text.length < MAX;

    return {
      text: text,
      stripped: rewritten || removedFiller || droppedWithRoomToSpare,
    };
  }

  function compress(body, opts) {
    var list = units(debullshit(body)).filter(function (u) { return !isFiller(u); });
    if (!list.length) return "";

    // Sensitive posts are trimmed, never filtered. Cutting a sentence for
    // being "unhelpful" is not a judgement worth making about someone's
    // obituary, so the rail just takes the opening verbatim.
    if (opts && opts.rail) {
      return utils.truncate(join(list, MAX), MAX);
    }

    var hasEntities = list.some(function (u) { return ENTITY_RE.test(u); });
    var post = { hasEntities: hasEntities };

    var scored = list.map(function (unit, i) {
      return { unit: unit, index: i, score: score(unit, i, list.length, post) };
    });

    // Keep by relative strength, not by an absolute floor. A post whose every
    // line technically scores above zero still has a best line, and filler
    // like "Closing a chapter, ready for what comes next" should lose to the
    // sentence naming the company and the role even when both would fit.
    var best = scored.reduce(function (max, u) { return Math.max(max, u.score); }, 0);
    var threshold = Math.max(1, best * 0.45);

    var kept = scored.filter(function (u) { return u.score >= threshold; });
    // A post where nothing clears the bar is usually all feeling and no news.
    // Keep the single best line rather than the whole thing: there is nothing
    // to report, and saying so briefly beats repeating the post.
    if (!kept.length) {
      var top = scored.slice().sort(function (a, b) { return b.score - a.score || a.index - b.index; })[0];
      kept = top ? [top] : scored;
    }

    // Fill the budget best-information-first, then put what survived back in
    // the order the author wrote it. Taking them in reading order instead
    // lets a fluffy opening sentence crowd out the one with the facts.
    var ranked = kept.slice().sort(function (a, b) {
      return b.score - a.score || a.index - b.index;
    });

    var chosen = [];
    var used = 0;
    for (var r = 0; r < ranked.length; r++) {
      var len = ranked[r].unit.length + (chosen.length ? 1 : 0);
      if (used + len > MAX) continue;
      chosen.push(ranked[r]);
      used += len;
    }
    if (!chosen.length) chosen = [ranked[0]];

    chosen.sort(function (a, b) { return a.index - b.index; });

    return utils.truncate(join(chosen.map(function (u) { return u.unit; }), MAX), MAX);
  }

  // Scaffolding that wraps a claim without adding to it. Stripping the wrapper
  // leaves the claim, which is the whole point: a short post is not exempt
  // from being mostly performance.
  // A short salutation can sit in front of an announcement opener — "Friends:
  // I'm really excited to share that…" — and anchoring to the very start let
  // the whole opener through untouched. Kept tight (three words, must end in a
  // colon or comma) so it cannot eat real content.
  var SALUTATION = "(?:[\\wÀ-ÿ]+(?:\\s+[\\wÀ-ÿ]+){0,2}\\s*[:,]\\s+)?";

  var OPENERS = [
    // One pattern for the whole family. The subject and the trailing "that"
    // are both optional, because "We are proud to announce Swish III" and
    // "Thrilled to share that I've joined" are the same construction.
    new RegExp("^" + SALUTATION + "(?:(?:i'?m|i am|we'?re|we are|our team is)\\s+)?(?:so|very|really|incredibly|super|truly|genuinely|extremely|beyond|absolutely|more than)?\\s*(?:humbled|thrilled|excited|delighted|proud|honou?red|happy|pleased|grateful|chuffed)\\s+to\\s+(?:announce|share|reveal|say|report)\\s+(?:that\\s+)?", "i"),
    /^(?:unpopular opinion|hot take|controversial take|spicy take|psa|real talk|plot twist)\s*[:,]\s*/i,
    /^(?:let me be clear|here'?s the thing|here'?s what nobody tells you|i'?ll be honest|to be honest|the truth is|here'?s the kicker)\s*[:,]\s*/i,
    /^(?:feliz|contento|contenta|orgulloso|orgullosa|emocionado|emocionada|encantado|encantada)\s+de\s+(?:compartir|anunciar|contar)\s+que\s+/i,
    /^con\s+(?:mucha\s+)?(?:alegr[ií]a|humildad|orgullo|emoci[oó]n)\s+(?:les\s+)?(?:comparto|anuncio|cuento)\s+que\s+/i,
    /^(?:opini[oó]n impopular|opini[oó]n pol[eé]mica|sin vueltas|voy a ser honesto|voy a ser honesta|la verdad es que)\s*[:,]\s*/i,
  ];

  // Sentences that exist only to add gravity.
  var FILLER_SENTENCE = /^(?:let that sink in|read that again|think about it|i'?ll say it again|full stop|period|and that'?s ok(?:ay)?|le[eé]lo de nuevo|que lo lean de nuevo|pi[eé]nsenlo|as[ií] de simple)[.!?]?$/i;

  // "X isn't about A. It's about B." carries one claim wearing two sentences.
  var FALSE_DICHOTOMY_EN = /\b([A-Za-z][\w\s'-]{2,40}?)\s+(?:isn'?t|is not|are not|aren'?t)\s+about\s+[^.!?]+[.!?]\s*(?:it'?s|it is|they'?re|they are)\s+about\s+([^.!?]+)[.!?]/i;
  var FALSE_DICHOTOMY_ES = /\b([A-Za-zÀ-ÿ][\wÀ-ÿ\s'-]{2,40}?)\s+no\s+(?:se\s+trata\s+de|es\s+sobre|va\s+de)\s+[^.!?]+[.!?]\s*(?:se\s+trata\s+de|es\s+sobre|va\s+de)\s+([^.!?]+)[.!?]/i;

  var SENTIMENT_RE = new RegExp(
    "(?:^|[^\\wÀ-ÿ])(?:felt like|feels like|feels? (?:different|amazing|surreal|special|good)|" +
    "means (?:a lot|the world|so much)|i'?m (?:so |very )?(?:grateful|humbled|proud|honou?red|thrilled|blessed)|" +
    "so (?:grateful|humbled|proud|blessed)|couldn'?t be (?:more )?(?:prouder|proud|happier)|" +
    "what an? (?:honou?r|privilege|incredible|amazing)|dream come true|forever grateful|" +
    "no puedo estar m[aá]s (?:feliz|orgullos)|qu[eé] orgullo|se siente|me llena de|" +
    "estoy (?:muy )?(?:feliz|orgullos|agradecid)|una alegr[ií]a enorme|" +
    "gracias a [A-ZÀ-Þ][\\wÀ-ÿ]*|gracias por (?:confiar|acompa[nñ]ar|el apoyo|todo)|" +
    "thanks to [A-ZÀ-Þ][\\wÀ-ÿ]*|thank you to|huge thanks)(?![\\wÀ-ÿ])",
    "i"
  );

  // Definitional and contrastive constructions. On a post with no numbers in
  // it these are where the point lives, and without them the scoring has
  // nothing to go on but proper nouns, so it keeps the scene-setting and
  // throws away the thesis.
  var THESIS_RE = new RegExp(
    "(?:^|[^\\wÀ-ÿ])(?:" +
    "the (?:point|lesson|real|thing) is|what matters is|it turns out|" +
    "the difference is|which means|in practice|the result was|" +
    "lo que importa|lo que más|la clave es|en realidad|resulta que|" +
    "es la que|no es la que|la diferencia es|en la práctica|" +
    "me di cuenta|aprend[ií] que|termina siendo" +
    ")(?![\\wÀ-ÿ])",
    "i"
  );

  var EMOJI_SENTENCE_BREAK_RE = /\s*[\p{Extended_Pictographic}\uFE0F]+\s+(?=[A-ZÀ-Þ¡¿])/gu;
  var EMOJI_RE = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu;
  var TRAILING_HASHTAGS_RE = /(?:\s*#[\wÀ-ÿ]+)+\s*[.!?]?\s*$/gm;

  /**
   * Remove the packaging from a line without touching the claim inside it.
   *
   * Every edit here deletes or reorders the author's own words. Nothing is
   * substituted, so the result is still a thing they wrote.
   *
   * @param {string} text
   * @returns {string}
   */
  function debullshit(text) {
    var out = String(text);

    // An emoji standing where a full stop should be is a sentence boundary.
    // Stripping it outright glued "…publicado por Libros Tucumán Ediciones 🌱
    // Gracias a Constanza Toro…" into a single unit, so the thanks could never
    // be scored separately from the announcement.
    out = out
      .replace(EMOJI_SENTENCE_BREAK_RE, ". ")
      .replace(EMOJI_RE, "")
      .replace(TRAILING_HASHTAGS_RE, "");

    var dichotomy = out.match(FALSE_DICHOTOMY_EN);
    if (dichotomy) {
      out = out.replace(FALSE_DICHOTOMY_EN, dichotomy[1] + " is about " + dichotomy[2].trim() + ".");
    } else {
      var dichotomyEs = out.match(FALSE_DICHOTOMY_ES);
      if (dichotomyEs) {
        out = out.replace(FALSE_DICHOTOMY_ES, dichotomyEs[1] + " se trata de " + dichotomyEs[2].trim() + ".");
      }
    }

    for (var i = 0; i < OPENERS.length; i++) {
      var stripped = out.replace(OPENERS[i], "");
      if (stripped !== out) {
        // Restore the capital the opener was carrying.
        out = stripped.charAt(0).toUpperCase() + stripped.slice(1);
        break;
      }
    }

    // normalizeText would flatten the line breaks that units() depends on,
    // so only collapse spaces within each line.
    return out
      .split("\n")
      .map(function (line) { return utils.normalizeText(line).replace(/\s+([.,;:!?])/g, "$1"); })
      .join("\n");
  }

  /**
   * @param {string} unit
   * @returns {boolean} true when the line exists only for emphasis
   */
  function isFiller(unit) {
    return FILLER_SENTENCE.test(unit.trim());
  }

  /**
   * Join units in order, sentence-punctuating as we go so the result reads as
   * prose rather than as a pile of fragments.
   */
  // Leading connectives point back at a sentence we may have dropped, which
  // leaves a dangling reference: "Y me di cuenta de que eso..." reads as a
  // fragment once the sentence it answers is gone.
  var LEADING_CONNECTIVE_RE = /^(?:and|but|so|also|plus|then|yet|however|therefore|y|pero|así que|asi que|entonces|además|ademas|sin embargo|por eso|porque)\s+(?=[\wÀ-ÿ])/i;

  function join(list, max) {
    var out = "";
    for (var i = 0; i < list.length; i++) {
      var piece = list[i].replace(/\s+$/, "").replace(LEADING_CONNECTIVE_RE, "");
      if (!piece) continue;
      piece = piece.charAt(0).toUpperCase() + piece.slice(1);
      if (!/[.!?…:;]$/.test(piece)) piece += ".";
      if (!out) { out = piece; continue; }
      if (out.length + 1 + piece.length > max) break;
      out += " " + piece;
    }
    return utils.truncate(out, max);
  }

  ns.compress = { compress: compress, analyze: analyze, units: units, score: score, debullshit: debullshit };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.compress;
  }
})();
