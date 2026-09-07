/**
 * LinkedLess — popup
 *
 * Shows the session counters the content script writes to chrome.storage.local
 * and exposes the single on/off switch. Coverage is surfaced here on purpose:
 * it is the number that tells you whether the catalog is keeping up with the
 * feed, and burying it in a dev tool would mean nobody ever looks at it.
 */

const $ = (id) => document.getElementById(id);

function paint(stats) {
  const scanned = stats?.scanned ?? 0;
  const translated = stats?.translated ?? 0;
  const passthrough = stats?.passthrough ?? 0;

  $("scanned").textContent = scanned;
  $("translated").textContent = translated;
  $("passthrough").textContent = passthrough;
  $("coverage").textContent = scanned ? `${Math.round((translated / scanned) * 100)}%` : "—";
}

chrome.storage.local.get("stats", ({ stats }) => paint(stats));
chrome.storage.sync.get("enabled", ({ enabled }) => {
  $("enabled").checked = enabled !== false;
});

$("enabled").addEventListener("change", (e) => {
  chrome.storage.sync.set({ enabled: e.target.checked });
});

$("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
