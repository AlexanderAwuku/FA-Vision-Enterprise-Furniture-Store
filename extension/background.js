// FA Vision Autopilot background: once an hour it reads your live site's data,
// shows on the add-on's icon how many things are waiting (listings due for
// renewal, plus 1 if today's group posts haven't run), sends one reminder a day,
// and starts the daily run at the time set in the admin (if switched on).
const SITE = "https://favisionenterprize.github.io/";
const ADMIN = SITE + "admin/";

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
function setup() {
  chrome.alarms.create("check", { delayInMinutes: 1, periodInMinutes: 60 });
  check();
}
chrome.alarms.onAlarm.addListener(a => { if (a.name === "check") check(); });
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: ADMIN + "#fbauto" }));
chrome.notifications.onClicked.addListener(id => { chrome.notifications.clear(id); chrome.tabs.create({ url: ADMIN + "#fbauto" }); });

const today = () => new Date().toLocaleDateString("en-CA");
const days = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 864e5);
const getJson = path => fetch(SITE + path + "?t=" + Date.now(), { cache: "no-store" }).then(r => r.json());

async function check() {
  let ap, products;
  try { [ap, products] = await Promise.all([getJson("data/facebook-autopilot.json"), getJson("data/products.json")]); }
  catch (e) { return; }
  const s = Object.assign({ daily_limit: 20, renew_after_days: 7, auto_run: false, auto_time: "09:00" }, ap.settings || {});
  const d = today();

  let due = 0;
  for (const p of products) {
    if (p.in_stock === false) continue;
    for (const l of p.facebook_listings || []) {
      const r = (ap.renewals || {})[l.id] || {};
      const base = r.d || l.listed || l.synced || l.checked;
      if ((base ? days(base, d) : 99) >= s.renew_after_days && r.chk !== d) due++;
    }
  }
  const groups = (ap.groups || []).filter(g => g.active !== false).length;
  const postsToday = (ap.posts || []).filter(x => x.d === d).length;
  const postsWaiting = groups > 0 && postsToday < s.daily_limit;
  const n = due + (postsWaiting ? 1 : 0);

  chrome.action.setBadgeBackgroundColor({ color: "#e0245e" });
  chrome.action.setBadgeText({ text: n ? String(n) : "" });
  chrome.action.setTitle({ title: n ? `FA Vision: ${[due && due + " to renew", postsWaiting && "group posts waiting"].filter(Boolean).join(", ")}` : "FA Vision: all done for today" });

  const st = await chrome.storage.local.get(["notified", "autorun"]);
  const now = new Date().toTimeString().slice(0, 5);
  if (s.auto_run && (due || postsWaiting) && now >= s.auto_time && st.autorun !== d) {
    await chrome.storage.local.set({ autorun: d, notified: d });
    chrome.tabs.create({ url: ADMIN + "#fbauto-run" });
    return;
  }
  if (n && st.notified !== d && now >= "08:00") {
    await chrome.storage.local.set({ notified: d });
    chrome.notifications.create("fav-" + d, {
      type: "basic",
      iconUrl: "icon128.png",
      title: "FA Vision autopilot",
      message: [due && `${due} Marketplace listing${due === 1 ? " is" : "s are"} ready to renew.`, postsWaiting && "Today's group posts haven't run yet."].filter(Boolean).join(" ") + " Tap to open."
    });
  }
}
