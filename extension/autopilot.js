// FA Vision Autopilot: runs on facebook.com, but only in a tab the FA Vision
// admin opened with a job. The admin hands the job to the add-on's background
// script, which keeps it for this tab (so Facebook's www → web redirect can't
// lose it). Older admins put it in the address (#favauto=…); that still works. Jobs:
//   post   – post today's listing into each queued group, pausing between groups
//   renew  – renew each queued Marketplace listing, in batches with a pause
//   import – read the list of groups you've joined
// When the job ends (or Facebook shows any warning) it returns to the admin
// with what happened, and the admin saves it.
(async () => {
  const KEY = "favauto";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => Math.round(a + Math.random() * (b - a));

  // ------------------------------------------------------------- job (kept by the background script, per tab)
  const bg = msg => new Promise(res => { try { chrome.runtime.sendMessage(msg, r => res(r || {})); } catch (e) { res({}); } });
  let job = null;
  const m = location.hash.match(/favauto=([^&]+)/);
  try {
    const fresh = m ? JSON.parse(decodeURIComponent(m[1])) : null;
    const stored = (await bg({ type: "getJob" })).job || null;
    if (fresh && !(stored && stored.id === fresh.id)) { job = fresh; job.navFor = 0; }   // already on the first page
    else job = stored;
  } catch (e) { job = null; }
  if (!job || !job.kind) return;                       // not an autopilot tab: do nothing
  if (m) history.replaceState(history.state, "", location.pathname + location.search);
  job.i = job.i || 0;
  job.res = job.res || [];
  const save = () => bg({ type: "saveJob", job });
  await save();

  // ------------------------------------------------------------- status box with a Stop button
  let stopAsked = false;
  function box(msg, bad) {
    let d = document.getElementById("favautobox");
    if (!d) {
      d = document.createElement("div");
      d.id = "favautobox";
      d.style.cssText = "position:fixed;z-index:2147483647;left:16px;bottom:16px;max-width:400px;padding:14px 16px;border-radius:12px;font:600 14px/1.45 system-ui,sans-serif;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;gap:12px;align-items:flex-start";
      const t = document.createElement("span"); t.id = "favautomsg"; t.style.flex = "1";
      const b = document.createElement("button");
      b.textContent = "Stop";
      b.style.cssText = "flex:0 0 auto;border:0;border-radius:8px;padding:6px 12px;font:700 13px system-ui;background:#fff;color:#c62828;cursor:pointer";
      b.onclick = () => { stopAsked = true; finish("Stopped by you."); };
      d.append(t, b);
      document.body.appendChild(d);
    }
    d.style.background = bad ? "#c62828" : "#0d55af";
    document.getElementById("favautomsg").textContent = "FA Vision autopilot · " + msg;
  }

  async function finish(stopped) {
    const out = { kind: job.kind, id: job.id, res: job.res, stopped: stopped || null, then: job.then || null, groups: job.groups || null, dry: !!job.dry, snapshot: job.snapshot || null };
    await bg({ type: "clearJob" });
    location.href = job.back + "#favauto-done=" + encodeURIComponent(JSON.stringify(out));
  }

  // Any of these on screen means Facebook is limiting the account: stop at once.
  const WARN = /temporarily blocked|temporarily restricted|you('|’)re restricted|your account (has been |is )?restricted|we limit how often|you can('|’)t use this feature|you can('|’)t post right now|try again later|suspicious activity|confirm your identity/i;
  function warning() {
    const t = (document.querySelector("[role=dialog]") || document.body).innerText || "";
    const hit = t.match(WARN);
    return hit ? hit[0] : null;
  }

  const visible = el => !!el && el.getClientRects().length > 0;
  const matches = (el, re) => re.test((el.getAttribute("aria-label") || "").trim()) || re.test((el.innerText || "").trim());
  function findBtn(re, root) {
    return [...(root || document).querySelectorAll('[role=button],button,[role=menuitem],[role=link]')]
      .find(b => visible(b) && matches(b, re));
  }
  // The photo comes through the add-on's background script (Facebook's page blocks downloads from other sites).
  function getImage(url) {
    return new Promise((res, rej) => chrome.runtime.sendMessage({ type: "image", url }, r => (r && r.dataUrl ? res(r.dataUrl) : rej(new Error((r && r.error) || "no image")))));
  }
  async function waitFor(fn, ms) {
    for (let t = 0; t < ms; t += 250) {
      if (stopAsked) return null;
      const v = fn();
      if (v) return v;
      await sleep(250);
    }
    return null;
  }
  async function countdown(secs, text) {
    for (let s = secs; s > 0 && !stopAsked; s--) { box(`${text} ${s >= 60 ? Math.ceil(s / 60) + " min" : s + " s"}…`); await sleep(1000); }
  }
  // Navigate to `url` once for the current item, then carry on when that page loads.
  async function arrive(url) {
    if (job.navFor === job.i) return true;
    job.navFor = job.i;
    await save();
    location.href = url;
    return false;
  }

  await sleep(1500);
  box("Starting…");

  // ============================================================= post into groups
  if (job.kind === "post") {
    if (job.i >= job.q.length) return finish();
    const it = job.q[job.i];
    if (!(await arrive(it.url))) return;
    const record = (ok, why) => { job.res.push({ g: it.g, p: it.p, ok, why: why || "", t: new Date().toISOString() }); job.i++; save(); };
    const next = async ok => {
      if (job.i >= job.q.length) { box("All done. Going back to your admin…"); await sleep(1500); return finish(); }
      if (ok) await countdown(rand(job.min || 60, job.max || 180), `Posted ✓ (${job.res.filter(r => r.ok).length} so far). Next group in`);
      else await sleep(4000);
      if (stopAsked) return;
      await arrive(job.q[job.i].url);
    };
    const n = `Group ${job.i + 1} of ${job.q.length}`;
    box(`${n}: opening ${it.name}…`);
    await sleep(rand(2500, 4500));
    let w = warning(); if (w) return finish(`Facebook showed "${w}". Nothing more was posted.`);

    const opener = await waitFor(() =>
      findBtn(/^(write something|start discussion|create a public post|what('|’)s on your mind|create post)/i), 15000);
    if (!opener) {
      const why = findBtn(/^join group$/i) ? "Not a member of this group" : "Couldn't find the post box";
      record(false, why); box(`${n}: ${why}. Skipping…`, true); return next(false);
    }
    opener.click();
    const editor = await waitFor(() => [...document.querySelectorAll('[role=dialog] [contenteditable=true][role=textbox]')].find(visible), 12000);
    if (!editor) { record(false, "Post box didn't open"); box(`${n}: post box didn't open. Skipping…`, true); return next(false); }
    const dialog = editor.closest("[role=dialog]");
    editor.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    await sleep(300);
    box(`${n}: typing the caption…`);
    const dt = new DataTransfer();
    dt.setData("text/plain", it.text);
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    await sleep(900);
    if (!editor.innerText.trim()) { document.execCommand("insertText", false, it.text); await sleep(600); }
    if (!editor.innerText.trim()) { record(false, "Couldn't type the caption"); box(`${n}: couldn't type. Skipping…`, true); return next(false); }

    // Photo: paste it into the post box; if that doesn't attach, use the Photo/video file picker.
    let photoNote = "";
    try {
      box(`${n}: adding the photo…`);
      const blob = await fetch(await getImage(it.img)).then(r => r.blob());
      const file = new File([blob], "fa-vision.jpg", { type: blob.type || "image/jpeg" });
      const hasPhoto = () => [...dialog.querySelectorAll("img")].some(i => /^blob:|scontent|fbcdn/.test(i.src) && i.naturalWidth > 60);
      const ft = new DataTransfer(); ft.items.add(file);
      editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: ft, bubbles: true, cancelable: true }));
      if (!(await waitFor(hasPhoto, 6000))) {
        const pv = findBtn(/photo\/video|^photo$/i, dialog);
        if (pv) { pv.click(); await sleep(800); }
        const input = [...dialog.querySelectorAll('input[type=file]')].find(i => /image/.test(i.accept || "image")) || document.querySelector('[role=dialog] input[type=file]');
        if (input) {
          const ft2 = new DataTransfer(); ft2.items.add(file);
          input.files = ft2.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (!(await waitFor(hasPhoto, 10000))) photoNote = "Posted without photo";
      }
    } catch (e) { photoNote = "Posted without photo"; }

    w = warning(); if (w) return finish(`Facebook showed "${w}". Nothing more was posted.`);
    const post = await waitFor(() => { const b = findBtn(/^post$/i, dialog); return b && b.getAttribute("aria-disabled") !== "true" ? b : null; }, 30000);
    if (!post) { record(false, "Post button stayed off"); box(`${n}: Post button stayed off. Skipping…`, true); return next(false); }
    await sleep(rand(800, 1600));
    if (job.dry) {
      // Test mode: everything worked up to the Post button. Close without posting.
      box(`${n}: test passed ✓ (caption typed${photoNote ? ", photo NOT attached" : ", photo attached"}, Post button ready). Not posting.`);
      await sleep(2500);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      const close = findBtn(/^close composer dialog$|^close$/i, dialog);
      if (close) { close.click(); await sleep(1200); const discard = findBtn(/^discard$/i); if (discard) discard.click(); }
      record(true, "Test only, not posted" + (photoNote ? " · photo didn't attach" : ""));
      return next(false);
    }
    post.click();
    box(`${n}: posting…`);
    const closed = await waitFor(() => !document.contains(editor) || !visible(editor), 60000);
    await sleep(1500);
    w = warning(); if (w) { record(false, w); return finish(`Facebook showed "${w}". Nothing more was posted.`); }
    if (!closed) { record(false, "Facebook didn't confirm the post"); return next(false); }
    const pending = /pending|admin approval|submitted|will be reviewed/i.test(document.body.innerText.slice(0, 5000));
    record(true, [pending && "Waiting for admin approval", photoNote].filter(Boolean).join(" · "));
    return next(true);
  }

  // ============================================================= renew Marketplace listings
  // Works on "Your listings" (marketplace/you/selling): each card's "More options"
  // menu has "Renew listing" once the listing is old enough.
  if (job.kind === "renew") {
    if (!/\/marketplace\/you\/selling/.test(location.pathname) && !(await arrive("https://www.facebook.com/marketplace/you/selling"))) return;
    await sleep(rand(3000, 4500));
    let w = warning(); if (w) return finish(`Facebook showed "${w}". Renewing stopped.`);
    if (/\/marketplace\/ineligible/.test(location.pathname) || /pages can('|’)t use marketplace/i.test(document.body.innerText.slice(0, 3000))) {
      return finish("Facebook is using your F.A Vision Page, and Pages can't use Marketplace. Switch to your personal profile in Facebook, then tap Renew again.");
    }
    job.done = job.done || [];
    const today = new Date().toLocaleDateString("en-CA");
    const parseListed = s => {
      const now = new Date(); let d;
      const m1 = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (m1) {
        const y = m1[3] ? (+m1[3] < 100 ? 2000 + +m1[3] : +m1[3]) : now.getFullYear();
        d = new Date(y, +m1[1] - 1, +m1[2]);
        if (!m1[3] && d > now) d.setFullYear(y - 1);
      } else if (/today|hour|minute|just now/i.test(s)) d = now;
      else if (/yesterday/i.test(s)) d = new Date(now - 864e5);
      else {
        d = new Date(s.replace(/,/g, "") + " " + now.getFullYear());
        if (isNaN(d)) return null;
        if (d > now) d.setFullYear(d.getFullYear() - 1);
      }
      return d.toLocaleDateString("en-CA");
    };
    const MORE = '[role=button][aria-label^="More options for"]';
    function cards() {
      const seen = {};
      return [...document.querySelectorAll(MORE)].filter(visible).map(more => {
        let c = more;
        for (let i = 0; i < 14 && c; i++) { c = c.parentElement; if (c && /(Listed|Renewed) on/.test(c.innerText || "") && c.querySelectorAll(MORE).length === 1) break; }
        const text = (c && c.innerText) || "";
        const title = more.getAttribute("aria-label").replace(/^More options for /, "").trim();
        const lm = text.match(/(?:Listed|Renewed) on ([^\n·|]+)/);
        const listed = lm ? parseListed(lm[1].trim()) : null;
        const status = (text.match(/\n(Active|In stock|Pending|Sold|Out of stock)\n/) || [])[1] || "";
        const base = title + "|" + (listed || "");
        seen[base] = (seen[base] || 0) + 1;
        return { key: base + "|" + seen[base], title, listed, status, more };
      });
    }
    async function loadAll() {
      let last = -1;
      for (let t = 0; t < 20 && !stopAsked; t++) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await sleep(1500);
        const n = document.querySelectorAll(MORE).length;
        if (n === last) break;
        last = n;
      }
      window.scrollTo(0, 0);
    }
    box("Reading your listings…");
    await loadAll();
    if (!job.snapshot) { job.snapshot = cards().map(c => ({ t: c.title, listed: c.listed, status: c.status })); await save(); }
    if (!job.snapshot.length) return finish("No listings found on Your listings. Make sure Facebook is on your personal profile.");
    // Facebook keeps the original "Listed on" date after a renewal, so the menu decides:
    // "Renew listing" = ready now; "Renew (N days)" (greyed out) = ready again in N days.
    const plusDays = n => new Date(Date.parse(today) + n * 864e5).toISOString().slice(0, 10);
    let renewed = job.res.filter(r => r.ok).length;
    while (!stopAsked) {
      w = warning(); if (w) return finish(`Facebook showed "${w}". Renewing stopped.`);
      const c = cards().find(x => !job.done.includes(x.key) && !/sold|pending|out of stock/i.test(x.status));
      if (!c) break;
      if (renewed > 0 && renewed % (job.batch || 20) === 0 && job.pausedAt !== renewed) {
        job.pausedAt = renewed; await save();
        await countdown(job.pause || 120, `Batch done (${renewed} renewed). Next batch in`);
        if (stopAsked) return;
        continue;
      }
      job.done.push(c.key);
      box(`Checking "${c.title}"…`);
      c.more.scrollIntoView({ block: "center" });
      await sleep(rand(600, 1200));
      c.more.click();
      const item = await waitFor(() => [...document.querySelectorAll('[role=menuitem]')]
        .find(x => visible(x) && /^renew/i.test((x.innerText || "").trim())), 3500);
      const label = item ? (item.innerText || "").trim() : "";
      const ready = item && /^renew listing$/i.test(label) && item.getAttribute("aria-disabled") !== "true";
      if (!ready) {
        c.more.click();                                   // close the menu again
        const wait = label.match(/\((\d+)\s*day/i);
        job.res.push({ t: c.title, listed: c.listed, ok: false, next: wait ? plusDays(+wait[1]) : null, why: wait ? `Next renewal in ${wait[1]} days` : "No Renew option" });
        await save();
        await sleep(rand(800, 1400));
        continue;
      }
      item.click();
      await sleep(1500);
      const confirm = await waitFor(() => findBtn(/^renew( listing)?$/i, document.querySelector("[role=dialog]") || undefined), 2500);
      if (confirm) { confirm.click(); await sleep(1500); }
      w = warning(); if (w) { job.res.push({ t: c.title, listed: c.listed, ok: false, why: w }); return finish(`Facebook showed "${w}". Renewing stopped.`); }
      job.res.push({ t: c.title, listed: c.listed, ok: true, next: plusDays(7), why: "" });
      renewed++;
      await save();
      box(`Renewed ✓ "${c.title}" (${renewed} so far)`);
      await sleep(rand(2500, 5000));
    }
    if (stopAsked) return;
    box(`Done: ${renewed} renewed. Going back to your admin…`);
    await sleep(1500);
    return finish();
  }

  // ============================================================= import joined groups
  if (job.kind === "import") {
    if (!/^\/groups\/joins/.test(location.pathname) && !(await arrive("https://www.facebook.com/groups/joins/?nav_source=tab"))) return;
    const SKIP = /^(joins|feed|discover|create|notifications|search|you|categories|membership_requests)$/i;
    const seen = new Map();
    const collect = () => {
      for (const a of (document.querySelector("[role=main]") || document).querySelectorAll('a[href*="/groups/"]')) {
        let u; try { u = new URL(a.href, location.origin); } catch (e) { continue; }
        const mm = u.pathname.match(/^\/groups\/([^/]+)\/?$/);
        if (!mm || SKIP.test(mm[1])) continue;
        const id = mm[1];
        const text = (a.innerText || a.getAttribute("aria-label") || "").trim().split("\n")[0];
        const name = /^(view group|see group|visit group)$/i.test(text) ? "" : text;
        const have = seen.get(id);
        if (!have) seen.set(id, { id, name, url: `https://www.facebook.com/groups/${id}/` });
        else if (!have.name && name) have.name = name;
      }
    };
    let last = -1, still = 0;
    for (let t = 0; t < 120 && still < 5 && !stopAsked; t++) {
      collect();
      box(`Reading your groups… ${seen.size} found`);
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1600);
      still = seen.size === last ? still + 1 : 0;
      last = seen.size;
    }
    if (stopAsked) return;
    job.groups = [...seen.values()].filter(g => g.name);
    save();
    box(`Found ${job.groups.length} groups. Going back to your admin…`);
    await sleep(1200);
    return finish();
  }
})();
