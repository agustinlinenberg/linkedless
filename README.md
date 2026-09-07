<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.png">
    <img src="assets/wordmark.png" alt="LinkedLess" width="420">
  </picture>
</p>

<p align="center"><b>LinkedIn minus the bullshit.</b><br>
<sub>English and Spanish. Runs entirely on your machine.</sub></p>

LinkedIn has a dialect. You know the one: the parable about helping a stranger who turns out to be the CEO, the humblebrag wearing a lesson, the "unpopular opinion" that everyone already holds, the business takeaway bolted onto someone's death.

LinkedLess rewrites every post in your feed the way its author would have written it without the performance. At most 280 characters, in their own words, with the packaging removed.

```
Before                                    After
─────────────────────────────────────     ─────────────────────────────────
Culture isn't about perks.                Culture is about who you promote.

It's about who you promote.

Let that sink in.
─────────────────────────────────────     ─────────────────────────────────
In today's ever-evolving landscape        We raised a $12M Series A led by
we must leverage synergies to             Sequoia and grew from 40 to 90
unlock transformative growth.             people this year.

We raised a $12M Series A led by
Sequoia and grew from 40 to 90
people this year.

Follow me for more insights.
#growth #startups
```

Cards carry no genre badge and no guess at motive. Reading "farming reach" beside a post hands you a second layer to decode, when removing the first one was the whole job.

## It runs on your machine

It ships without a model and never touches the network, so there is nothing to sign up for and nothing to pay. You install it and it works.

That is possible because LinkedIn cringe is template-generated. An entire industry publishes the templates as swipe files, hook generators and "5 proven viral formats", and people copy them. A post assembled from a published template is matchable by a published pattern.

So the work is deciding which of the author's own sentences carry information and which are scaffolding: the cliffhanger hook, the one-line suspense beats, the tidy aphorism at the end, the call to action, the hashtag row. A catalog of 79 post types drives that, plus a set of transforms that strip packaging without touching the claim inside it.

Every word on a card comes out of the post, so the extension cannot make anything up. It is also instant, and no part of your feed leaves the browser.

## English and Spanish

Cards render in the language of the post. Card text is copied out of the post, so a Spanish post produces a Spanish card and there is nothing to translate.

The genre list is shared across languages. `src/catalog/genres.js` holds the ids, families and intents; `src/catalog/genres.es.js` supplies the Spanish phrase banks. Language is detected by counting function words, which needs no model and only has to separate two languages.

All 8 sensitive-rail genres have Spanish phrase banks, and `npm run coverage` fails the build if recall drops below 100% in either language.

## What it does and does not do

It deletes and reorders the author's own words. It never substitutes them, so what you read is still something they wrote.

It will sometimes cut a sentence that mattered to you. The original is always one click away.

Posts about death, illness, job loss and disaster are trimmed from the top rather than filtered, and short ones are left alone entirely. Deciding that a sentence in someone's obituary scores badly is not a judgement worth making. If one of those ever comes out mangled, that is a bug and we want the report.

## Install

Not on the Chrome Web Store yet. Install from source:

1. Download this repo (green **Code** button, then **Download ZIP**) and unzip it.
2. Open `chrome://extensions/`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and pick the unzipped folder
5. Open [linkedin.com/feed](https://www.linkedin.com/feed/)

After you edit any file, hit the reload arrow on the extension card and refresh LinkedIn.

## Settings

The extension icon gives you an on/off switch and how many posts it rewrote this session. **Settings** adds:

- **Family mutes.** Leave whole categories alone. If you only want the reach-farming posts collapsed, mute the other ten.
- **Author whitelist.** People whose posts are never touched.
- **Debug.** Log scan activity to the console.

## Focus mode

With the cards on, LinkedIn's sidebars are the loudest thing left on the page, so they are hidden by default along with the messaging popup. Media inside posts is never touched, since that is content.

Hiding the rails leaves the feed column stranded at LinkedIn's own ~555px in the middle of a wide screen, which reads as the mobile layout. `main` is a grid whose track widths come from the panes themselves, and several wrappers between it and the feed are `display: contents`, where width has no effect at all. Two attempts to fix that from a stylesheet collapsed the column instead of widening it.

So `src/layout.js` measures the page at runtime instead. It walks up from the feed container, skips the `display: contents` wrappers, widens only the ancestors that are actually narrower than the target, and then checks on the next frame whether the feed really got wider. If it did not, every rule is removed and it logs why. A feed that is too narrow is a complaint; a feed collapsed to 300px is unusable, so the failure mode is "nothing changes".

Both the sidebars and the column width are settings.

## How it works

Six layers, all synchronous, all in the content script.

| Layer | What it does |
|---|---|
| **A. Native signals** | What LinkedIn labels for us: promoted, polls, carousels, video, events, job posts, reshares. Near-100% accurate and immune to wording. Also the author's headline, which is how a real hiring manager gets told apart from someone farming a referral bonus. |
| **B. Structure** | Arithmetic over the shape of a post. Broetry has a signature, tall and narrow with a blank line between every beat, that needs no word matching and ages better than a phrase list. |
| **C. Lexicon** | Buzzword density, em-dash abuse, thought-leader sentence templates. Adapted from [linkedin-detox](https://github.com/OdinMB/linkedin-detox). |
| **D. Entities** | Regex captures used for scoring and for the hiring check: `$12M`, `Series A`, `Sequoia`, company names. |
| **E. Catalog** | 79 genres. Used to detect the sensitive rail and to describe post shapes, not to write the card. |
| **F. Compression** | Scores every sentence for information, drops the scaffolding, strips openers and false dichotomies, and joins what is left back into prose. |

The feed is React with virtualisation, so element references die on scroll and anything injected into a post is stripped on the next render. Posts are identified by a hash of their text, and every card lives in one fixed overlay attached to `document.body`, outside React's tree.

LinkedIn also wraps each entry in `display: contents` divs that measure zero height, so the scanner walks down from the wrapper to the first element that occupies space instead of selecting a fixed depth. Selecting a fixed depth is what broke the first version.

## Contributing a genre

Adding a genre needs no JavaScript. It is one object in `src/catalog/genres.js`:

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

Add the object, add an example, open a PR. For Spanish, add the matching entry to `genres.es.js`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. Then:

```sh
node corpus/seed.js     # regenerate the example corpus
npm run coverage        # did coverage go up, did precision hold
npm test                # invariants still hold
```

Predicates: `phrase`, `regex`, `capture`, `native`, `flag`, `structure`, `score`, plus `and` and `or` to compose them. Full reference in the header of `genres.js`.

One warning for Spanish patterns. JavaScript's `\b` is ASCII-only, so `/\bcomentá\b/` never matches: "á" is not a word character, and the boundary assertion fails right where the verb ends. Use `(?:^|[^\wÀ-ÿ])` and `(?![\wÀ-ÿ])` instead. That bug silently disabled several Spanish genres before the corpus caught it.

## Checking output quality

`npm run coverage` reports how much of a post survives: what share got rewritten, and how many characters came out against how many went in. On real feed posts it currently rewrites 79% of them and cuts about 39% of the text.

It also reports genre classification, which is a means rather than the output. A genre gates the sensitive rail and the family mutes and contributes no words to a card, so that number moving is not the same as the extension getting better.

```sh
npm run coverage
npm run coverage:verbose   # every miss and misclassification
```

Three corpora, reported separately:

- `corpus/posts.jsonl` is real posts from your own feed. **This is the number that counts.** It is gitignored, because your feed is other people's writing and it should not end up in a public repo.
- `corpus/posts.hard.jsonl` is hand-authored adversarial cases in both languages, worded specifically to break the catalog.
- `corpus/posts.seed.jsonl` is generated from the catalog's own examples. Scoring 100% there proves internal consistency and nothing else, so it is excluded from the headline number.

Sensitive-rail recall must be 100% in every language. The coverage script exits non-zero when it is not, so it blocks the build rather than showing up as a number that drifts.

## Building your own corpus

Paste posts from your feed into `corpus/posts.jsonl`, one JSON object per line:

```json
{"text": "Author Name\nTheir headline\n2h\n\nThe post body.", "expect": "comment_bait", "sensitive": false}
```

`expect` is the genre id you think should match, or `null` for posts the extension should leave alone. `sensitive` is `true` for anything about death, illness, job loss or disaster. Then run `npm run coverage` and fix whatever it reports.

## Known limitations

**LinkedIn changes its feed markup, and A/B tests it between accounts.** The
selectors in `src/scanner.js` were verified on 2026-09-04 against one account.
If nothing happens on your feed, that is the most likely cause, and there is an
issue template for it. The scanner logs a warning when it finds the feed
container but no posts.

**English and Spanish only.** Other languages fall back to the English phrase
banks, which will rarely match, so most posts will simply be left alone.

**Compression is extractive.** It deletes and reorders sentences; it never
rewrites them. On a post whose meaning is spread across many short lines it
will sometimes drop something you wanted. The original is one click away.

**Tested by very few people.** It has run on a handful of machines and one
LinkedIn locale pair. Expect rough edges and please report them.

## Terms of service

LinkedIn's [User Agreement](https://www.linkedin.com/legal/user-agreement) §8.2.2 names browser plugins, and §8.2.15 prohibits "inserting elements into the Services". LinkedLess does that, and so does every ad blocker.

The realistic risk is account-level enforcement rather than legal action, and we are not aware of it being applied to individual users running feed modifiers. You should know it exists before you install. Nothing is scraped and nothing is transmitted. The extension changes your view of your own feed.

## Not affiliated with LinkedIn

LinkedLess is an independent open-source project. It is not affiliated with,
endorsed by, or connected to LinkedIn Corporation. "LinkedIn" is a trademark of
LinkedIn Corporation and is used here only to say what the extension works on.

The extension makes no requests to LinkedIn's servers, scrapes nothing, sends
nothing anywhere, and automates no action on your behalf. It changes how your
own browser renders a page you are already logged into, and nothing else.

## Credit

Post identification, the overlay approach, the buzzword and co-occurrence banks, and the terms-of-service analysis all come from **[OdinMB/linkedin-detox](https://github.com/OdinMB/linkedin-detox)** (MIT). Different product, same hard-won DOM knowledge. Go star it.

## Licence

MIT.
