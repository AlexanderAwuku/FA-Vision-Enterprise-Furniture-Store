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
  let ap;
  try { ap = await getJson("data/facebook-autopilot.json"); }
  catch (e) { return; }
  const s = Object.assign({ daily_limit: 20, renew_after_days: 7, auto_run: false, auto_time: "09:00" }, ap.settings || {});
  const d = today();

  // Renewals: from what the add-on last read on Facebook's "Your listings" page.
  const sel = ap.selling && ap.selling.cards;
  const needsCheck = !sel;
  const due = sel ? sel.filter(c => !/sold|pending|out of stock/i.test(c.status || "") && (c.next ? c.next <= d : (c.listed && days(c.listed, d) >= s.renew_after_days)) && c.none !== d).length : 0;
  const groups = (ap.groups || []).filter(g => g.active !== false).length;
  const postsToday = (ap.posts || []).filter(x => x.d === d).length;
  const postsWaiting = groups > 0 && postsToday < s.daily_limit;
  const n = (needsCheck ? 1 : due) + (postsWaiting ? 1 : 0);

  chrome.action.setBadgeBackgroundColor({ color: "#e0245e" });
  chrome.action.setBadgeText({ text: n ? String(n) : "" });
  chrome.action.setTitle({ title: n ? `FA Vision: ${[needsCheck ? "listings not checked yet" : due && due + " to renew", postsWaiting && "group posts waiting"].filter(Boolean).join(", ")}` : "FA Vision: all done for today" });

  const st = await chrome.storage.local.get(["notified", "autorun"]);
  const now = new Date().toTimeString().slice(0, 5);
  if (s.auto_run && (needsCheck || due || postsWaiting) && now >= s.auto_time && st.autorun !== d) {
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
      message: [needsCheck ? "Your Marketplace listings haven't been checked for renewal yet." : due && `${due} Marketplace listing${due === 1 ? " is" : "s are"} ready to renew.`, postsWaiting && "Today's group posts haven't run yet."].filter(Boolean).join(" ") + " Tap to open."
    });
  }
}

// Photos for group posts: fetched here (this script may read your site) and handed to the Facebook tab.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "image" || !String(msg.url).startsWith(SITE)) return;
  fetch(msg.url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
    .then(b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }))
    .then(dataUrl => reply({ dataUrl }), err => reply({ error: String(err) }));
  return true;   // reply comes later
});

// Jobs from the admin: kept per tab here, so a redirect (www → web.facebook.com) can't lose them.
const FB = /^https:\/\/(www|web|m)\.facebook\.com\//;
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab && sender.tab.id;
  if (!msg || tabId == null) return;
  const key = "job" + tabId;
  if (msg.type === "start") {
    if (!FB.test(String(msg.url)) || !msg.job || !msg.job.kind) { reply({ ok: false }); return; }
    chrome.storage.session.set({ [key]: msg.job })
      .then(() => chrome.tabs.update(tabId, { url: msg.url }))
      .then(() => reply({ ok: true }), err => reply({ ok: false, error: String(err) }));
    return true;
  }
  if (msg.type === "getJob") { chrome.storage.session.get(key).then(o => reply({ job: o[key] || null })); return true; }
  if (msg.type === "saveJob") { chrome.storage.session.set({ [key]: msg.job }).then(() => reply({ ok: true })); return true; }
  if (msg.type === "clearJob") { chrome.storage.session.remove(key).then(() => reply({ ok: true })); return true; }
});
chrome.tabs.onRemoved.addListener(tabId => chrome.storage.session.remove("job" + tabId));
