/**
 * LinkedLess — card text
 *
 * One line of output: the post, at most 280 characters, in the author's own
 * words with the performance removed.
 *
 * No genre label and no statement of intent appear on the card. Reading
 * "farming reach" next to a post asks you to decode a second layer on top of
 * the first, when the point is that there is nothing left to decode.
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
  var compressor = need(ns.compress, "./compress.js");

  var MAX = 280;

  // Short posts still get rewritten: a 90-character post can be almost
  // entirely packaging, and stripping it is the point. A post is only left
  // alone when nothing was stripped from it — see compress.analyze().
  function unchanged(a, b) {
    var norm = function (t) { return String(t).toLowerCase().replace(/[^\wÀ-ÿ]+/g, ""); };
    return norm(a) === norm(b);
  }

  /**
   * Build the card for a classified post.
   *
   * The card is the post, rewritten as the author would have written it
   * without the performance. No genre label, no motive, no commentary: those
   * make the reader decode a second layer on top of the first. Genre is still
   * computed, because it decides what counts as scaffolding and it drives the
   * sensitive rail, but it does not appear on screen.
   *
   * @param {object} classification result of match.classify()
   * @returns {{passthrough: boolean, text?: string, rail?: boolean,
   *            genreId?: string, family?: string, lang?: string}}
   */
  function render(classification) {
    var primary = classification && classification.primary;
    var ctx = classification && classification.context;
    if (!primary || !ctx) return { passthrough: true };

    // Genre no longer decides what the card says, only whether the sensitive
    // rail applies. So it must not gate rendering either: a hiring post that
    // matches no genre still compresses from 395 characters to 205, and that
    // is worth showing whatever we did or did not manage to label it.
    var genre = primary.genre;

    var body = ctx.body;
    if (!body) return { passthrough: true };

    // Classification is reported even when we decline to draw, so stats and
    // the coverage report can tell "no genre matched" apart from "matched but
    // not worth covering".
    var meta = {
      genreId: genre.id,
      family: genre.family,
      rail: genre.rail === true,
      lang: ctx.lang,
    };

    var result;
    try {
      result = compressor.analyze(body, { rail: genre.rail === true });
    } catch (err) {
      return Object.assign({ passthrough: true }, meta);
    }
    if (!result.text) return Object.assign({ passthrough: true }, meta);

    var text = utils.truncate(result.text, MAX);

    // Rail posts are trimmed, not filtered, so "was anything stripped" never
    // becomes true for them. They are shown when they were long enough to
    // need trimming, and left alone when they were already short.
    var worthShowing = genre.rail
      ? text.length < body.length * 0.75
      : result.stripped;

    if (!worthShowing || unchanged(text, body)) {
      return Object.assign({ passthrough: true, reason: "nothing to strip" }, meta);
    }

    return {
      passthrough: false,
      text: text,
      rail: genre.rail === true,
      genreId: genre.id,
      family: genre.family,
      lang: ctx.lang,
    };
  }

  ns.renderText = { render: render, MAX: MAX };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.renderText;
  }
})();
