/**
 * LinkedLess — Layer D: entity extraction
 *
 * Regex captures that fill the `{SLOT}` placeholders in catalog templates.
 * Everything here is extractive: a capture is a span copied verbatim out of
 * the post. Nothing is ever synthesised, which is what keeps the extension
 * from putting words in anyone's mouth.
 *
 * A capture that fails returns null, and a template with a null slot is
 * rejected downstream rather than rendered with a hole in it.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});
  var utils = ns.normalizeText
    ? ns
    : (typeof require !== "undefined" ? require("../shared/utils.js") : null);

  var MONEY_RE = /(?:[$€£₹]\s?\d[\d.,]*\s?(?:k|m|mm|bn|b|million|billion|thousand)?|\b\d[\d.,]*\s?(?:million|billion|thousand)\s+(?:dollars|euros|pounds|usd|eur))/i;
  var ROUND_RE = /\b(?:pre-?seed|seed|semilla|serie?s?\s+[a-j](?:\s*\+|\s+extensi[oó]n|\s+extension)?|ronda\s+(?:semilla|[a-j])|bridge|puente|angel|[aá]ngel|ipo)\b/i;
  var PERCENT_RE = /\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?x\b/i;
  var DURATION_RE = /\b\d+(?:[.,]\d+)?\s+(?:year|yr|month|week|day|decade|a[nñ]o|mes|semana|d[ií]a|d[eé]cada)(?:s|es)?\b/i;
  var HEADCOUNT_RE = /\b(?:team of \d+|equipo de \d+|\d+\s+(?:people|employees|engineers|folks|humans|hires|personas|empleados|ingenieros|colegas))\b/i;
  var URL_RE = /https?:\/\/([\w.-]+)/i;
  var YEAR_RE = /\b(?:19|20)\d{2}\b/;
  var DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|ene|abr|ago|dic)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:de\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|ene|abr|ago|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[a-z]*\b/i;
  var NUMBER_RE = /\b\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\b/;

  // Words that look like a company but are sentence starts or filler.
  var COMPANY_STOPWORDS = new Set([
    "the", "a", "an", "my", "our", "your", "this", "that", "it", "i", "we",
    "and", "but", "so", "then", "now", "here", "there", "all", "scale",
    "work", "home", "least", "last", "first", "best", "times", "once",
    "linkedin", "google", "school", "university", "college", "night", "heart",
  ]);

  var TITLE_WORDS = "(?:chief|head|vp|vice president|director|senior|staff|principal|lead|junior|associate|global|regional)?\\s*" +
    "(?:software|frontend|front-end|backend|back-end|full-?stack|data|ml|ai|machine learning|product|project|program|" +
    "marketing|growth|sales|account|customer success|customer|people|talent|hr|finance|legal|design|ux|ui|brand|content|" +
    "operations|ops|devops|platform|security|qa|research|business|partnerships|community|solutions)?\\s*" +
    "(?:engineer|developer|designer|manager|director|analyst|scientist|architect|consultant|specialist|lead|officer|" +
    "executive|associate|coordinator|strategist|recruiter|marketer|counsel|controller|accountant|intern|cto|ceo|coo|cfo|cmo|cpo|" +
    "ingenier[oa]|desarrollador[a]?|dise[nñ]ador[a]?|gerente|jefe|jefa|l[ií]der|analista|cient[ií]fic[oa]|arquitect[oa]|" +
    "consultor[a]?|especialista|coordinador[a]?|estrateg[ao]|reclutador[a]?|contador[a]?|abogad[oa]|pasante|becari[oa])";
  var JOB_TITLE_RE = new RegExp("\\b" + TITLE_WORDS + "s?\\b", "i");

  // A title stated right after hiring language is almost always the real one.
  // Falling straight through to the dictionary picks up the verb in
  // "this person will lead the way" and renders "Hiring a lead at Aldergrove".
  var TITLE_CONTEXT_RE = new RegExp(
    "(?:hiring|looking for|we need|join us as|the role of|position of|search for|" +
    "busca|buscamos|buscando|el rol de|el puesto de|la posici[oó]n de|vacante de|b[uú]squeda de)\\s+" +
    "(?:a|an|the|un|una|el|la|nuestro|nuestra)?\\s*" +
    // "of"/"de" continue a title ("Head of Data"); "para"/"for" start the
    // company, so stopping there keeps "Head of Data para Northwind" out.
    "([A-ZÀ-Þ][\\wÀ-ÿ-]*(?:\\s+(?:of|de|del|[A-ZÀ-Þ][\\wÀ-ÿ-]*)){0,4})",
    ""
  );

  // Head nouns too ambiguous to stand alone: "lead" and "associate" are common
  // verbs and adjectives, so they only count inside a longer title.
  var AMBIGUOUS_TITLE = /^(lead|associate|executive|specialist|principal|senior|staff|head)$/i;

  /**
   * @param {string} body
   * @returns {string|null}
   */
  function jobTitle(body) {
    var contextual = String(body).match(TITLE_CONTEXT_RE);
    if (contextual) {
      var t = (utils ? utils.normalizeText(contextual[1]) : contextual[1].trim())
        .replace(/[.,;:!?]+$/, "");
      // A lone seniority word ("Staff", "Senior") is a prefix, not a title;
      // let the dictionary find the head noun instead.
      var lone = t.indexOf(" ") === -1 && AMBIGUOUS_TITLE.test(t);
      if (!lone && t.length >= 3 && t.length <= 60) return t;
    }
    var dict = first(body, JOB_TITLE_RE);
    if (dict && AMBIGUOUS_TITLE.test(dict)) return null;
    return dict;
  }

  function first(text, re) {
    var m = String(text).match(re);
    return m ? (utils ? utils.normalizeText(m[0]) : m[0].trim()) : null;
  }

  function group(text, re, idx) {
    var m = String(text).match(re);
    if (!m || m[idx] === undefined) return null;
    var v = utils ? utils.normalizeText(m[idx]) : String(m[idx]).trim();
    return v.length ? v : null;
  }

  /**
   * Capitalised run of 1–4 words, used for company and person names.
   * Rejects sentence-initial words and known stopwords so "The" and "Here"
   * don't get promoted to company names.
   */
  function properNoun(str) {
    if (!str) return null;
    var cleaned = String(str).replace(/[^\wÀ-ɏ&.\-' ]/g, " ").trim();
    var m = cleaned.match(/\b([A-ZÀ-Þ][\wÀ-ɏ&.\-']*(?:\s+[A-ZÀ-Þ][\wÀ-ɏ&.\-']*){0,3})/);
    if (!m) return null;
    // Trailing sentence punctuation is not part of a name ("Acme." -> "Acme").
    var candidate = m[1].trim().replace(/[.\-'&]+$/, "").trim();
    if (COMPANY_STOPWORDS.has(candidate.toLowerCase())) return null;
    if (candidate.length < 2 || candidate.length > 60) return null;
    return candidate;
  }

  /**
   * Company named in the author's headline — "VP Sales at Acme | ..." -> "Acme".
   * @param {string} headline
   * @returns {string|null}
   */
  function companyFromHeadline(headline) {
    if (!headline) return null;
    var segment = String(headline).split(/[|·•]/)[0];
    var at = segment.match(/\b(?:at|en)\s+(.+)$/i);
    if (at) return properNoun(at[1]);
    var mid = segment.match(/\b@\s*([\wÀ-ɏ&.\-' ]+)$/);
    if (mid) return properNoun(mid[1]);
    return null;
  }

  /**
   * Company named in the post body, preferring an @mention (unambiguous)
   * and otherwise the noun after joining/at/with.
   * @param {string} body
   * @returns {string|null}
   */
  function companyFromBody(body) {
    if (!body) return null;
    var mention = String(body).match(/(?:^|\s)@([\wÀ-ɏ][\wÀ-ɏ&.\-']*(?:\s+[A-ZÀ-Þ][\wÀ-ɏ&.\-']*){0,2})/);
    if (mention) {
      var m = properNoun(mention[1]) || utils.normalizeText(mention[1]);
      if (m) return m;
    }
    var joining = String(body).match(/\b(?:joining|joined|starting at|now at|working at|role at|team at|hiring at|position at|me sumo a|me sumé a|me uno a|me un[ií] a|ingres[eé] a|arranco en|empiezo en|trabajo en|desaf[ií]o en|equipo de|vacante en|puesto en)\s+([A-ZÀ-Þ][\wÀ-ɏ&.\-']*(?:\s+[A-ZÀ-Þ][\wÀ-ɏ&.\-']*){0,3})/);
    if (joining) return properNoun(joining[1]);
    // Appositive form: "A company I know, Halcyon Labs, is looking for …"
    var appositive = String(body).match(/([A-ZÀ-Þ][\wÀ-ɏ&.\-']*(?:\s+[A-ZÀ-Þ][\wÀ-ɏ&.\-']*){0,3})\s*,?\s+(?:is hiring|are hiring|is looking for|are looking for|has an opening|est[aá] buscando|est[aá]n buscando|busca un|busca una|abri[oó] una b[uú]squeda)/);
    if (appositive) {
      var apos = properNoun(appositive[1]);
      if (apos) return apos;
    }
    var at = String(body).match(/\b(?:at|en)\s+([A-ZÀ-Þ][\wÀ-ɏ&.\-']*(?:\s+[A-ZÀ-Þ][\wÀ-ɏ&.\-']*){0,2})/);
    if (at) return properNoun(at[1]);
    return null;
  }

  /**
   * The ALL-CAPS token a comment-bait post asks you to type.
   * Scoped to the sentence containing the instruction so unrelated
   * acronyms elsewhere in the post aren't picked up.
   * @param {string} body
   * @returns {string|null}
   */
  function baitKeyword(body) {
    var sentences = utils ? utils.splitSentences(body) : String(body).split(/[.!?\n]+/);
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      // Unicode-aware boundaries, not \b: JavaScript's \b is ASCII-only, so
      // /\bcomentá\b/ never matches — "á" is not a word character, which
      // kills the boundary assertion right where the Spanish verb ends.
      if (!/(?:^|[^\wÀ-ÿ])(comment|drop|type|reply|write|send me|dm me|coment[aá]|comenta|escrib[ií]|escribe|pon[eé]|respond[eé]|responde|dej[aá]|deja)(?![\wÀ-ÿ])/i.test(s)) continue;
      var quoted = s.match(/["'“”‘’]([A-Za-z][\w\s-]{1,24})["'“”‘’]/);
      if (quoted) return quoted[1].trim().toUpperCase();
      var caps = s.match(/\b([A-Z][A-Z0-9]{2,20})\b/);
      if (caps && !/^(DM|PDF|AI|CEO|CTO|CV|USA|UK|EU|LOL|OK)$/.test(caps[1])) return caps[1];
    }
    return null;
  }

  /**
   * Run every extractor over a post.
   * @param {string} body post body, header stripped
   * @param {string} headline author headline
   * @returns {object} slot name -> captured string or null
   */
  function extract(body, headline) {
    var b = String(body || "");
    var h = String(headline || "");

    var headlineCompany = companyFromHeadline(h);
    var bodyCompany = companyFromBody(b);

    return {
      MONEY: first(b, MONEY_RE),
      ROUND: first(b, ROUND_RE),
      PERCENT: first(b, PERCENT_RE),
      DURATION: first(b, DURATION_RE),
      HEADCOUNT: first(b, HEADCOUNT_RE),
      NUMBER: first(b, NUMBER_RE),
      YEAR: first(b, YEAR_RE),
      DATE: first(b, DATE_RE),
      URL_DOMAIN: group(b, URL_RE, 1),
      JOB_TITLE: jobTitle(b),
      BAIT_KEYWORD: baitKeyword(b),
      COMPANY: bodyCompany || headlineCompany,
      BODY_COMPANY: bodyCompany,
      HEADLINE_COMPANY: headlineCompany,
      INVESTOR: properNoun(group(b, /\b(?:led by|liderada por|liderado por|encabezada por|encabezado por)\s+([^.,\n]+)/i, 1)),
      PUBLICATION: properNoun(group(b, /\b(?:featured in|published in|covered by|interviewed by|salimos en|nota en|publicad[oa] en|entrevist[oó] .{0,12}en)\s+([^.,\n]+)/i, 1)),
      AWARD: group(b, /\b(?:named|awarded|recognised|recognized|won)\s+(?:as\s+)?(?:the\s+|a\s+|an\s+)?([^.,\n]{3,60})/i, 1),
      EVENT: properNoun(group(b, /\b(?:speaking at|keynote at|presenting at|panel at|join me at|see you at|voy a hablar en|doy una charla en|estar[eé] en|nos vemos en)\s+([^.,\n]+)/i, 1)),
      PERSON: properNoun(group(b, /\b(?:congratulations to|congrats to|in memory of|remembering|tribute to|welcome|felicitaciones a|felicidades a|en memoria de|homenaje a|recordando a|bienvenida a|bienvenido a)\s+([^.,\n]+)/i, 1)),
      FIRST_SENTENCE: utils ? utils.firstMeaningfulSentence(b) : null,
      FIRST_LINE: meaningfulLine(b, "first"),
      LAST_LINE: meaningfulLine(b, "last"),
      KEY_FACTS: null,   // assembled in keyFacts(), which needs the whole bag
    };
  }

  /**
   * First or last line carrying real words.
   *
   * Broetry puts its hook on the first line and its lesson on the last, so
   * quoting both describes the post better than any summary a rule could
   * write, and both are verbatim spans.
   *
   * @param {string} body
   * @param {"first"|"last"} which
   * @returns {string|null}
   */
  function meaningfulLine(body, which) {
    var lines = String(body || "")
      .split("\n")
      .map(function (l) { return utils ? utils.normalizeText(l) : l.trim(); })
      .filter(function (l) {
        if (l.length < 12) return false;
        if (/^(…|\.\.\.|more|ver más|see more|show translation|ver traducción)$/i.test(l)) return false;
        if (/^#\S+(\s+#\S+)*$/.test(l)) return false;    // a bare hashtag row
        return /[a-zà-ÿ]{3}/i.test(l);
      });
    if (!lines.length) return null;
    return which === "last" ? lines[lines.length - 1] : lines[0];
  }

  /**
   * The captured facts worth showing, in the order a reader wants them.
   * Returns null when the post carried no numbers, names or dates, which is
   * itself the interesting answer for most of the catalog.
   *
   * @param {object} e extract() result
   * @returns {string|null}
   */
  function keyFacts(e) {
    var parts = [];
    ["MONEY", "ROUND", "PERCENT", "HEADCOUNT", "DURATION", "JOB_TITLE", "COMPANY", "INVESTOR", "DATE"]
      .forEach(function (slot) {
        var v = e[slot];
        if (!v) return;
        if (parts.indexOf(v) !== -1) return;
        parts.push(v);
      });
    return parts.length ? parts.slice(0, 4).join(" · ") : null;
  }

  /**
   * True when the post names a company the author does not work at — the
   * deterministic tell for a referral-bonus post.
   * @param {object} e extract() result
   * @returns {boolean}
   */
  function companyMismatch(e) {
    if (!e.BODY_COMPANY || !e.HEADLINE_COMPANY) return false;
    var a = e.BODY_COMPANY.toLowerCase();
    var b = e.HEADLINE_COMPANY.toLowerCase();
    return !(a.includes(b) || b.includes(a));
  }

  ns.entities = {
    extract: extract,
    companyMismatch: companyMismatch,
    companyFromHeadline: companyFromHeadline,
    companyFromBody: companyFromBody,
    baitKeyword: baitKeyword,
    jobTitle: jobTitle,
    keyFacts: keyFacts,
    meaningfulLine: meaningfulLine,
    properNoun: properNoun,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.entities;
  }
})();
