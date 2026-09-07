# Privacy policy

**LinkedLess collects nothing.**

Last updated: 7 September 2026

## What the extension does

LinkedLess reads the text of posts already displayed on your LinkedIn feed and
draws a shortened version over them, in your browser. That is the whole of it.

## Data collection

None. Specifically:

- No personal or sensitive user data is collected.
- No browsing history, page content, or post text is transmitted anywhere.
- No analytics, telemetry, cookies, tracking pixels, or identifiers.
- No user accounts, and no sign-in of any kind.
- Nothing is sold or shared with third parties, because nothing is gathered.

## Network activity

The extension makes **no network requests**. It contains no remote code, calls
no API, and reaches no server, including any operated by the developer. It
ships no model and performs no inference off-device. Post text never leaves the
browser tab it was already in.

You can verify this: the source is public at
https://github.com/agustinlinenberg/linkedless and contains no `fetch`,
`XMLHttpRequest`, or remote script load.

## What is stored, and where

Your settings only. These are:

- whether the extension is on
- whether LinkedIn's sidebars are hidden, and the feed column width
- which post families you have muted
- the list of authors you have chosen never to touch
- whether debug logging is on

They are held in `chrome.storage.sync`, which is Chrome's own settings storage.
If you are signed in to Chrome they sync between your devices through Google,
under Google's terms, and they are never sent to the developer. Session counts
such as "posts rewritten" are held in `chrome.storage.local` and never leave
your machine.

Uninstalling the extension removes all of it.

## Permissions, and why each is needed

| Permission | Why |
|---|---|
| `storage` | To remember your settings between visits. Nothing else is written to it. |
| Host access to `linkedin.com` | LinkedIn is the site the extension modifies. Without it there is nothing to read or draw on. Access is limited to that domain; the extension does not run on any other site. |

## Children

The extension is not directed at children and collects no data from anyone,
including children.

## Changes

Any change to this policy will be committed to the repository above, where the
full history is public.

## Contact

Open an issue at https://github.com/agustinlinenberg/linkedless/issues
