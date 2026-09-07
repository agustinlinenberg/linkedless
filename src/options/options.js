/**
 * LinkedLess — settings
 *
 * Family mutes are stored rather than per-genre ones: 79 checkboxes would be
 * a worse experience than 11, and "stop translating my colleagues' job
 * announcements" is a family-shaped preference.
 */

const FAMILIES = [
  ["F0", "Sensitive", "Death, illness, job loss, disaster. Always neutral, never labelled."],
  ["F9", "Substance", "Technical posts, research, case studies with real numbers."],
  ["F1", "Formats", "Polls, carousels, videos, reshares, sponsored posts."],
  ["F3", "Hiring", "Open roles, job hunting, recruiters, referrals."],
  ["F2", "Announcements", "New jobs, funding, awards, launches, milestones."],
  ["F4", "Reach farming", "Comment bait, tag bait, follow bait, list posts."],
  ["F5", "Narrative", "Broetry, parables, rags-to-riches, business lessons from a barista."],
  ["F7", "Newsjacking", "Borrowing a news story or a public figure for reach."],
  ["F6", "Opinion", "Hot takes, contrarian reframes, predictions, frameworks."],
  ["F8", "Promotion", "Product pitches, webinars, courses, client wins."],
  ["F10", "Unclassified", "Machine-written slop and posts nothing else matched."],
];

const $ = (id) => document.getElementById(id);
let saveTimer = null;

function flashSaved() {
  const el = $("saved");
  el.hidden = false;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { el.hidden = true; }, 1400);
}

function save() {
  const mutedFamilies = [...document.querySelectorAll("input[data-family]")]
    .filter((cb) => !cb.checked)
    .map((cb) => cb.dataset.family);
  const whitelistedAuthors = $("whitelist").value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  chrome.storage.sync.set({
    mutedFamilies,
    whitelistedAuthors,
    hideFurniture: $("hideFurniture").checked,
    feedWidth: Number($("feedWidth").value),
    debug: $("debug").checked,
  }, flashSaved);
}

function build(muted) {
  const host = $("families");
  for (const [id, name, blurb] of FAMILIES) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.family = id;
    cb.checked = !muted.includes(id);
    cb.addEventListener("change", save);
    label.append(cb, ` ${name} — `);
    const small = document.createElement("span");
    small.className = "hint";
    small.style.display = "inline";
    small.textContent = blurb;
    label.appendChild(small);
    host.appendChild(label);
  }
}

chrome.storage.sync.get(null, (stored) => {
  build(stored.mutedFamilies || []);
  $("whitelist").value = (stored.whitelistedAuthors || []).join("\n");
  $("debug").checked = stored.debug === true;
  $("hideFurniture").checked = stored.hideFurniture !== false;
  $("feedWidth").value = String(stored.feedWidth || 860);
});

$("whitelist").addEventListener("change", save);
$("debug").addEventListener("change", save);
$("hideFurniture").addEventListener("change", save);
$("feedWidth").addEventListener("change", save);
