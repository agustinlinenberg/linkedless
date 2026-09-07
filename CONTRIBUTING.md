# Contributing

No build step and no dependencies. Clone it, load it unpacked, edit a file,
hit reload on the extension card.

```sh
npm test           # unit tests
npm run coverage   # corpus report
```

Both run in CI on every pull request.

## The one rule

**Sensitive-rail recall must stay at 100% in every language.**

Posts about death, illness, job loss and disaster take a separate path: they
are trimmed from the top, keeping the author's opening sentences verbatim, and
never filtered by score. Deciding that a sentence in someone's obituary scores
badly is not a judgement worth making.

`npm run coverage` exits non-zero if recall drops, so CI will catch it. Please
don't route around that. It is easier to break than it looks, because
broadening a phrase list elsewhere can let a non-rail genre match first.

## Where things live

| I want to… | Edit |
|---|---|
| change what a card says | `src/engine/compress.js` |
| add a call to action, aphorism or filler pattern | `src/engine/compress.js` |
| add a post type or fix the rail | `src/catalog/genres.js` |
| add Spanish phrases | `src/catalog/genres.es.js` |
| fix "nothing happens on my feed" | `src/scanner.js` (selectors, dated in a comment) |
| change the card's look | `src/renderer.js`, `src/content.css` |

A genre does **not** decide what a card says. Card text comes from
`compress.js`, out of the post's own sentences. A genre decides whether the
sensitive rail applies and which family the post is muted under, and nothing
else. If you are trying to change wording, `genres.js` is the wrong file.

## Adding a genre

One object, plus an example:

```js
{
  id: "comment_bait", family: "F4", intent: "reach", substance: 0,
  detect: {
    all: [
      { phrase: ["comment", "drop a", "type "] },
      { phrase: ["i'll dm", "i'll send", "and i'll"] },
    ],
  },
  examples: ["Comment GUIDE and I'll DM you my 47-page playbook."],
}
```

Predicates: `phrase`, `regex`, `capture`, `native`, `flag`, `structure`,
`score`, plus `and` / `or` to compose them. Full reference in the header of
`genres.js`.

Then `node corpus/seed.js` to regenerate the example corpus, and run the two
checks above.

## Two traps worth knowing

**JavaScript's `\b` is ASCII-only.** `/\bcomentá\b/` never matches, because
"á" is not a word character and the boundary assertion fails right where the
verb ends. Use `(?:^|[^\wÀ-ÿ])` and `(?![\wÀ-ÿ])`. This silently disabled
several Spanish genres before the corpus caught it.

**Word boundaries in general.** A phrase list without them matches inside
other words: `tag` matched inside `heritage` and penalised the most
informative sentence in a hiring post.

## Testing against real posts

`corpus/posts.jsonl` is gitignored on purpose. It holds posts from your own
feed, which is other people's writing, and it should never land in a public
repo. Build your own:

```json
{"text": "Author Name\nTheir headline\n2h\n\nThe post body.", "native": {}}
```

`corpus/posts.hard.jsonl` is the shared set: hand-authored adversarial cases in
both languages, written specifically to break the catalog. Additions there are
very welcome, especially ones that currently fail.

## Scope

This is a reading tool. It deletes and reorders the author's own words and
never substitutes them, so a card is always something the author actually
wrote. Changes that generate text, call a model, or send any part of a feed
over the network are out of scope. Not because they would not work, but
because "runs entirely on your machine and cannot make anything up" is the
whole design.
