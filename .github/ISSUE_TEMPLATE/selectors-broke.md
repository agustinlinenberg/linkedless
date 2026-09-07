---
name: Nothing happens on my feed
about: Cards do not appear, or the feed looks unchanged
labels: selectors
---

LinkedIn changes its feed markup regularly and A/B tests it between accounts,
so this is the most likely thing to break. It is not usually your setup.

**Open the console on linkedin.com/feed and paste the output of:**

```js
(() => {
  const FEED = "[componentkey='container-update-list_mainFeed-lazy-container']";
  return JSON.stringify({
    feedFound: !!document.querySelector(FEED),
    wrappers: document.querySelectorAll(FEED + " > div[data-lazy-mount-id]").length,
    textBoxes: document.querySelectorAll("[data-testid='expandable-text-box']").length,
    overlay: !!document.getElementById("linkedless-overlay"),
    cards: document.querySelectorAll("#linkedless-overlay .ll-card").length,
  });
})();
```

**Also useful:** your Chrome version, your LinkedIn interface language, and
whether `[LinkedLess]` prints any warning in the console.

The selectors live in one place, `src/scanner.js`, and are dated in a comment.
