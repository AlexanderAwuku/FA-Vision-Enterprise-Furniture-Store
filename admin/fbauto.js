// Facebook autopilot: Marketplace renewals and the daily group-posting rotation.
//
// Facebook has no API for either job, so the FA Vision browser add-on does the
// clicking (extension/autopilot.js). This screen decides what to do, sends the
// add-on a queue, and saves what came back to data/facebook-autopilot.json.
//
// Group rotation: one listing per day, posted into up to `daily_limit` groups
// it has never been posted into (groups rested longest go first). The next day
// the next listing takes its turn. When a listing has been in every group, it
// starts a fresh round.
(function () {
  const C = window.FAV_CONFIG;
  const A = window.FAV_ADMIN;
  if (!A) return;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const FILE = "data/facebook-autopilot.json";
  const EMPTY = {
    settings: { daily_limit: 20, renew_after_days: 7, renew_batch: 20, pause_min_s: 60, pause_max_s: 180, auto_run: false, auto_time: "09:00" },
    groups: [], posts: [], resets: {}, today: null, renewals: {}
  };
  const screen = $("#screen-fbauto");
  const today = () => new Date().toLocaleDateString("en-CA");
  const days = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 864e5);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const ext = () => document.documentElement.dataset.favautoExt;
  let S = null;

  function normalise(s) {
    s = s || JSON.parse(JSON.stringify(EMPTY));
    s.settings = { ...EMPTY.settings, ...(s.settings || {}) };
    for (const k of ["groups", "posts"]) s[k] = s[k] || [];
    for (const k of ["resets", "renewals"]) s[k] = s[k] || {};
    return s;
  }
  async function load(force) {
    if (!S || force) S = normalise(await A.readJsonFile(FILE, EMPTY));
    return S;
  }
  async function save(mutate, message) {
    S = normalise(await A.saveJson(FILE, s => mutate(normalise(s)), message, EMPTY));
  }

  // ------------------------------------------------------------------ renewals
  // S.selling is what the add-on last read on Facebook's "Your listings" page:
  // { d: date checked, cards: [{ t, listed, status, none? }] }. Before the first
  // check we don't know the listing dates, so dueList() returns null.
  // `next` = the date Facebook will offer Renew again (read from its "Renew (N days)" menu item).
  // Facebook never changes "Listed on" after a renewal, so `next` decides when it's known.
  const sellable = c => !/sold|pending|out of stock/i.test(c.status || "");
  const isDue = c => sellable(c) && (c.next ? c.next <= today() : (c.listed && days(c.listed, today()) >= S.settings.renew_after_days)) && c.none !== today();
  function dueList() {
    if (!S.selling || !S.selling.cards) return null;
    return S.selling.cards.filter(isDue)
      .map(c => ({ ...c, age: c.listed ? days(c.listed, today()) : 0 }))
      .sort((a, b) => b.age - a.age);
  }
  const nextRenewal = () => (S.selling && S.selling.cards || []).filter(c => sellable(c) && c.next && c.next > today()).map(c => c.next).sort()[0];

  // ------------------------------------------------------------------ group rotation
  const postable = () => A.products()
    .filter(p => !p.placeholder && p.in_stock !== false && !p.seller && (p.images || []).length && p.price_ghs)
    .sort((a, b) => a.id.localeCompare(b.id));
  const activeGroups = () => S.groups.filter(g => g.active !== false);
  const attemptsToday = () => S.posts.filter(x => x.d === today()).length;

  function todaysListing() {
    const list = postable();
    if (!list.length) return null;
    if (S.today && S.today.d === today()) {
      const p = list.find(x => x.id === S.today.p);
      if (p) return p;
    }
    if (!S.today) return list[0];
    const next = list.find(x => x.id > S.today.p);   // the listing after the last one that had a turn
    return next || list[0];
  }

  function coverage(p) {
    const since = S.resets[p.id] || "";
    const groups = activeGroups();
    const tried = new Set(S.posts.filter(x => x.p === p.id && (x.t || x.d) > since).map(x => x.g));
    const ids = new Set(groups.map(g => g.id));
    const done = [...tried].filter(g => ids.has(g)).length;
    return { done, total: groups.length, tried, fresh: groups.length > 0 && done >= groups.length };
  }

  function plan() {
    const p = todaysListing();
    if (!p) return { p: null, groups: [], room: 0 };
    const room = Math.max(0, S.settings.daily_limit - attemptsToday());
    const cov = coverage(p);
    const usedToday = new Set(S.posts.filter(x => x.d === today()).map(x => x.g));
    const lastUse = {};
    for (const x of S.posts) if (!lastUse[x.g] || (x.t || x.d) > lastUse[x.g]) lastUse[x.g] = x.t || x.d;
    const groups = activeGroups()
      .filter(g => !usedToday.has(g.id) && (cov.fresh || !cov.tried.has(g.id)))
      .sort((a, b) => (lastUse[a.id] || "").localeCompare(lastUse[b.id] || ""))
      .slice(0, room);
    return { p, groups, room, cov };
  }

  // ------------------------------------------------------------------ captions (3 variants, rotated)
  function caption(p, v) {
    const B = A.business();
    const wa = C.localPhone(B.whatsapp);
    const url = A.productUrl(p);
    const price = C.formatPrice(p.price_ghs) + (p.negotiable ? " (negotiable)" : "");
    const hl = (p.highlights || []).slice(0, 3);
    const name = String(p.name).split(" — ")[0];
    const first = String(p.description || "").split("\n")[0];
    const tags = (B.hashtags || []).slice(0, 3).join(" ");
    const variants = [
      `🛋️ ${name} available now!\n${hl.map(h => "• " + h).join("\n")}\n💰 ${price}\n📍 Odorkor, Accra · delivery available\n📞 WhatsApp ${wa}\n👉 ${url}\n${tags}`,
      `NEW IN STOCK: ${name}\n\n${first}\n\nPrice: ${price}\nPay 50% now and the rest on delivery. MoMo, GhanaPay or card.\n\nWhatsApp ${wa} or see all the photos here: ${url}`,
      `Looking for a ${name.toLowerCase()}? We have it in stock at ${price}.\n${hl.map(h => "✔ " + h).join("\n")}\nShowroom: Tarazzo Road, Odorkor (opposite Pacific), Accra. Delivery across Accra and beyond.\nCall or WhatsApp ${wa} · ${url}`
    ];
    return variants[v % variants.length].replace(/\n{3,}/g, "\n\n").trim();
  }

  // ------------------------------------------------------------------ jobs for the add-on
  function launch(url, job) {
    job.id = Date.now().toString(36);
    job.back = location.origin + location.pathname;
    if (Number(ext()) >= 3) {
      job.navFor = 0;                                   // the add-on opens the first page itself
      window.postMessage({ type: "favauto-start", url, job }, location.origin);
      return;
    }
    location.href = url.replace(/#.*$/, "") + "#favauto=" + encodeURIComponent(JSON.stringify(job));
  }
  function needExt() {
    if (ext()) return false;
    A.toast("Install or update the FA Vision add-on first (steps at the bottom of this screen).", true);
    return true;
  }

  function startRenew(then) {
    if (needExt()) return;
    if (Number(ext()) < 3) return A.toast("Update the add-on first (steps at the bottom of this screen).", true);
    launch("https://www.facebook.com/marketplace/you/selling", {
      kind: "renew", batch: S.settings.renew_batch, pause: 120, after: S.settings.renew_after_days, then: then || null
    });
  }

  // Test: runs every step in the first queued group except tapping Post.
  function startTest() {
    if (needExt()) return;
    if (Number(ext()) < 3) return A.toast("Update the add-on first (steps at the bottom of this screen), then test.", true);
    const pl = plan();
    const g = (pl.groups[0] || activeGroups()[0]);
    if (!pl.p || !g) return A.toast("Nothing to test: needs a listing and at least one group switched on.", true);
    const p = pl.p, img = location.origin + "/" + p.images[0];
    launch(g.url, { kind: "post", dry: true, q: [{ g: g.id, name: g.name, url: g.url, p: p.id, text: caption(p, 0), img }], min: 5, max: 5 });
  }

  async function startPosting(auto) {
    if (needExt()) return;
    const pl = plan();
    if (!activeGroups().length) return A.toast("Import your groups first.", true);
    if (!pl.p) return A.toast("No listing is ready to post (needs a price, a photo and to be in stock).", true);
    if (!pl.groups.length) return A.toast(pl.room ? "No new groups left for today's listing." : `Today's ${S.settings.daily_limit} group posts are done. Come back tomorrow.`);
    A.busy("Preparing today's posts…");
    try {
      const pid = pl.p.id, fresh = pl.cov.fresh, d = today();
      await save(s => {
        if (fresh) s.resets[pid] = new Date().toISOString();
        s.today = { d, p: pid };
        return s;
      }, `Autopilot: ${pid} is today's group listing`);
    } catch (err) { A.busy(null); return A.toast(A.friendly(err), true); }
    A.busy(null);
    const p = pl.p, start = S.posts.filter(x => x.p === p.id).length;
    const img = location.origin + "/" + p.images[0];
    const q = pl.groups.map((g, i) => ({ g: g.id, name: g.name, url: g.url, p: p.id, text: caption(p, start + i), img }));
    launch(q[0].url, { kind: "post", q, min: S.settings.pause_min_s, max: S.settings.pause_max_s, auto: !!auto });
  }

  function startImport() {
    if (needExt()) return;
    launch("https://www.facebook.com/groups/joins/?nav_source=tab", { kind: "import" });
  }

  // ------------------------------------------------------------------ results coming back from the add-on
  const groupName = id => ((S.groups.find(g => g.id === id) || {}).name || id);
  async function receive(out) {
    const d = today();
    A.busy("Saving what the add-on did…");
    try {
      if (out.kind === "renew") {
        const ok = out.res.filter(r => r.ok).length;
        await save(s => {
          if (out.snapshot) {
            const cards = out.snapshot.map(c => ({ ...c }));
            for (const r of out.res) {
              const c = cards.find(x => x.t === r.t && x.listed === r.listed && !x._seen);
              if (!c) continue;
              c._seen = true;
              if (r.next) c.next = r.next;
              if (!r.ok && !r.next) c.none = d;
            }
            cards.forEach(c => delete c._seen);
            s.selling = { d, cards };
          }
          s.renewLog = (s.renewLog || []).concat(out.res.map(r => ({ d, t: r.t, listed: r.listed, ok: r.ok, ...(r.why ? { why: r.why } : {}) }))).slice(-200);
          return s;
        }, `Autopilot: renewed ${ok} of ${out.res.length} Marketplace listings`);
        A.toast(`Renewed ${plural(ok, "listing")}${out.res.length - ok ? `, ${out.res.length - ok} not ready yet` : ""}.${out.stopped ? " Stopped: " + out.stopped : ""}`, !!out.stopped);
      } else if (out.kind === "post" && out.dry) {
        const r = out.res[0];
        A.busy(null);
        if (!r) A.toast("Test stopped before it reached a group." + (out.stopped ? " " + out.stopped : ""), true);
        else A.toast(r.ok ? `Test passed in ${groupName(r.g)}: ${r.why}. Nothing was posted.` : `Test failed in ${groupName(r.g)}: ${r.why}`, !r.ok || /didn't attach/.test(r.why));
        return;
      } else if (out.kind === "post") {
        const ok = out.res.filter(r => r.ok).length;
        await save(s => {
          for (const r of out.res) s.posts.push({ d, t: r.t, p: r.p, g: r.g, ok: r.ok, ...(r.why ? { why: r.why } : {}) });
          // a group that failed 3 times in a row is switched off
          for (const r of out.res.filter(x => !x.ok)) {
            const last3 = s.posts.filter(x => x.g === r.g).slice(-3);
            if (last3.length === 3 && last3.every(x => !x.ok)) { const g = s.groups.find(x => x.id === r.g); if (g) { g.active = false; g.off_why = r.why; } }
          }
          return s;
        }, `Autopilot: posted in ${ok} of ${out.res.length} groups`);
        A.toast(`Posted in ${plural(ok, "group")}${out.res.length - ok ? `, ${out.res.length - ok} skipped` : ""}.${out.stopped ? " Stopped: " + out.stopped : ""}`, !!out.stopped);
      } else if (out.kind === "import") {
        const found = (out.groups || []).filter(g => g.id && g.name);
        let added = 0;
        await save(s => {
          for (const g of found) {
            const have = s.groups.find(x => x.id === g.id);
            if (have) have.name = g.name;
            else { s.groups.push({ id: g.id, name: g.name, url: g.url, active: true, added: d }); added++; }
          }
          return s;
        }, `Autopilot: imported ${found.length} Facebook groups`);
        A.toast(found.length ? `Found ${plural(found.length, "group")} (${added} new).` : "No groups found. Make sure you're logged in to Facebook and try again.", !found.length);
      }
    } catch (err) {
      A.toast(A.friendly(err), true);
    } finally { A.busy(null); }
    render();
    updateBadge();
    if (out.then === "post" && !out.stopped) setTimeout(() => startPosting(true), 1500);
  }

  // ------------------------------------------------------------------ rendering
  function render() {
    if (!S) return;
    const dl = dueList(), due = dl || [], pl = plan(), groups = S.groups;
    const sell = S.selling;
    const doneToday = attemptsToday(), limit = S.settings.daily_limit;
    const recent = S.posts.slice(-25).reverse();
    const gname = id => (S.groups.find(g => g.id === id) || {}).name || id;
    const pname = id => (A.products().find(p => p.id === id) || {}).name || id;
    const order = postable();
    const cur = pl.p ? order.findIndex(p => p.id === pl.p.id) : -1;
    const recentRenew = (S.renewLog || []).slice(-10).reverse();
    $("#fa-body").innerHTML = `
      <p class="fa-ext ${ext() ? "ok" : "bad"}">${!ext() ? "✗ The FA Vision add-on isn't installed in this browser yet. See the steps at the bottom." : Number(ext()) < 3 ? "✗ Your FA Vision add-on is out of date and can't start runs. Update it (steps at the bottom), then reload this page." : "✓ FA Vision add-on is installed and up to date."}</p>

      <section class="fa-card">
        <header><h2>Marketplace renewals</h2><span class="fa-big ${dl === null || due.length ? "hot" : ""}">${dl === null ? "?" : due.length}</span></header>
        <p class="muted">Renewing pushes a listing back to the top. Facebook offers it ${S.settings.renew_after_days} days after a listing was posted or last renewed. Make sure Facebook is on your personal profile (Pages can't use Marketplace).</p>
        ${sell ? `<p class="muted fa-small">Last checked ${esc(sell.d)}: ${plural(sell.cards.length, "listing")} on Your listings.</p>` : `<p class="fa-empty">Your listings haven't been checked yet. Tap the button to read them on Facebook and renew any that are due.</p>`}
        <div class="fa-actions">
          <button class="btn btn-sell" data-fa="renew">${dl === null ? "Check & renew now" : due.length ? `Renew all ${due.length} due (${S.settings.renew_batch} at a time)` : "Check again"}</button>
        </div>
        ${due.length ? `<details class="fa-more"><summary>See the ${plural(due.length, "listing")} due</summary><ul class="fa-list">${due.map(c => `<li><span>${esc(c.t)}</span><small>listed ${esc(c.listed || "?")}${c.next ? " · ready since " + esc(c.next) : ""}</small></li>`).join("")}</ul></details>` : dl ? `<p class="fa-empty">Nothing to renew right now.${nextRenewal() ? ` Next renewals are ready on ${esc(nextRenewal())}.` : ""}</p>` : ""}
        ${recentRenew.length ? `<details class="fa-more"><summary>Recent renewals</summary><ul class="fa-list">${recentRenew.map(r => `<li class="${r.ok ? "" : "bad"}"><span>${r.ok ? "✓" : "–"} ${esc(r.t)}</span><small>${esc(r.d)}${r.why ? " · " + esc(r.why) : ""}</small></li>`).join("")}</ul></details>` : ""}
      </section>

      <section class="fa-card">
        <header><h2>Group posting</h2><span class="fa-big ${pl.groups.length && groups.length ? "hot" : ""}">${doneToday}/${limit}</span></header>
        ${!groups.length ? `<p class="fa-empty">No groups yet. Tap <b>Import my groups from Facebook</b> below first.</p>` : pl.p ? `
          <div class="fa-today">
            <img src="../${esc(pl.p.images[0])}" alt="" width="64" height="48">
            <div><small>Today's listing</small><b>${esc(pl.p.name)}</b>
            <span class="muted">${pl.groups.length ? `${plural(pl.groups.length, "new group")} queued` : doneToday >= limit ? "Done for today ✓" : "No new groups left today"} · been in ${pl.cov.done} of ${pl.cov.total} groups${pl.cov.fresh ? " (starting a new round)" : ""}</span></div>
          </div>
          <div class="fa-actions"><button class="btn btn-sell" data-fa="post" ${pl.groups.length ? "" : "disabled"}>Start today's ${pl.groups.length || limit} group posts</button><button class="btn btn-ghost" data-fa="test">Test without posting</button></div>
          <p class="muted fa-small" ${pl.groups.length ? "" : "hidden"}>Runs by itself in a Facebook tab, ${S.settings.pause_min_s / 60}–${S.settings.pause_max_s / 60} minutes between groups (about ${Math.round(pl.groups.length * (S.settings.pause_min_s + S.settings.pause_max_s) / 120)} minutes). Keep that tab open and in front (Chrome slows background tabs a lot). It stops at once if Facebook shows any warning.</p>
          <details class="fa-more"><summary>Rotation order (${order.length} listings, one a day)</summary><ol class="fa-list">${order.map((p, i) => { const c = coverage(p); return `<li class="${i === cur ? "now" : ""}"><span>${i === cur ? "▶ " : ""}${esc(p.name)}</span><small>${c.done}/${c.total} groups</small></li>`; }).join("")}</ol></details>`
        : `<p class="fa-empty">No listing is ready (each needs a price, a photo and to be in stock).</p>`}
      </section>

      <section class="fa-card">
        <header><h2>Your groups</h2><span class="fa-big">${activeGroups().length}</span></header>
        <div class="fa-actions">
          <button class="btn btn-primary" data-fa="import">Import my groups from Facebook</button>
        </div>
        ${groups.length ? `<details class="fa-more"><summary>Show all ${groups.length} groups</summary><ul class="fa-list fa-groups">${groups.map(g => `<li class="${g.active === false ? "off" : ""}">
          <label><input type="checkbox" data-fa-group="${esc(g.id)}" ${g.active === false ? "" : "checked"}> <a href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.name)}</a></label>
          <small>${g.active === false && g.off_why ? esc("Off: " + g.off_why) : ""}</small></li>`).join("")}</ul></details>` : ""}
      </section>

      <section class="fa-card">
        <header><h2>Settings</h2></header>
        <form class="fa-settings" id="fa-settings">
          <label>Group posts a day <input id="fa-daily" name="daily_limit" type="number" min="1" max="50" value="${limit}"></label>
          <label>Renew in batches of <input id="fa-batch" name="renew_batch" type="number" min="1" max="50" value="${S.settings.renew_batch}"></label>
          <label class="fa-check"><input id="fa-auto" name="auto_run" type="checkbox" ${S.settings.auto_run ? "checked" : ""}> Run every day by itself at <input id="fa-time" name="auto_time" type="time" value="${esc(S.settings.auto_time)}"></label>
          <p class="muted fa-small">The daily run needs this computer on with Chrome open. It renews anything due, then posts today's listing into its next groups.</p>
          <button class="btn btn-ghost btn-sm" type="submit">Save settings</button>
        </form>
      </section>

      ${recent.length ? `<section class="fa-card"><header><h2>Recent group posts</h2></header><ul class="fa-list">${recent.map(x => `<li class="${x.ok ? "" : "bad"}"><span>${x.ok ? "✓" : "✗"} ${esc(gname(x.g))}</span><small>${esc(String(pname(x.p)).split(" — ")[0])} · ${esc(x.d)}${x.why ? " · " + esc(x.why) : ""}</small></li>`).join("")}</ul></section>` : ""}

      <details class="fa-card fa-help"><summary><b>Install or update the FA Vision add-on</b></summary>
        <ol>
          <li>Download the <code>extension</code> folder from your GitHub repo (Code → Download ZIP, then unzip).</li>
          <li>In Chrome open <code>chrome://extensions</code>, turn on <b>Developer mode</b>, click <b>Load unpacked</b> and pick the <code>extension</code> folder. If an older FA Vision add-on is there, remove it first.</li>
          <li>Pin it from the puzzle-piece menu. Its red number shows what's waiting, and it sends a reminder once a day.</li>
          <li>Stay logged in to Facebook in this Chrome, as your personal profile (Pages can't use Marketplace).</li>
          <li><b>To update:</b> download the ZIP again, replace your old <code>extension</code> folder with the new one, then click reload ↻ on FA Vision Autopilot in <code>chrome://extensions</code> and reload this page.</li>
        </ol></details>`;
  }

  function updateBadge() {
    const b = $("#fa-badge"), alert = $("#fa-alert");
    if (!S) return;
    const dl = dueList(), due = dl ? dl.length : 0;
    const postsWaiting = activeGroups().length > 0 && plan().groups.length > 0;
    const n = (dl === null ? 1 : due) + (postsWaiting ? 1 : 0);
    if (b) { b.hidden = !n; b.textContent = n; }
    if (alert) {
      const bits = [dl === null ? `<b>Your Marketplace listings haven't been checked for renewal yet.</b>` : due && `<b>${plural(due, "Marketplace listing")} ready to renew.</b>`, postsWaiting && `<b>Today's group posts haven't run yet.</b>`].filter(Boolean);
      alert.hidden = !bits.length;
      alert.innerHTML = bits.join(" ") + " Open Facebook autopilot →";
    }
  }

  // ------------------------------------------------------------------ events
  screen.addEventListener("click", e => {
    const b = e.target.closest("[data-fa]");
    if (!b) return;
    const k = b.dataset.fa;
    if (k === "renew") startRenew();
    else if (k === "post") startPosting(false);
    else if (k === "test") startTest();
    else if (k === "import") startImport();
  });
  screen.addEventListener("change", async e => {
    const c = e.target.closest("[data-fa-group]");
    if (!c) return;
    const id = c.dataset.faGroup, on = c.checked;
    try {
      await save(s => { const g = s.groups.find(x => x.id === id); if (g) { g.active = on; delete g.off_why; } return s; }, `Autopilot: group ${on ? "on" : "off"}`);
      A.toast(on ? "Group switched on" : "Group switched off");
      updateBadge();
    } catch (err) { A.toast(A.friendly(err), true); c.checked = !on; }
  });
  screen.addEventListener("submit", async e => {
    if (e.target.id !== "fa-settings") return;
    e.preventDefault();
    const f = e.target.elements;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, parseInt(v, 10) || lo));
    const next = { daily_limit: clamp(f.daily_limit.value, 1, 50), renew_batch: clamp(f.renew_batch.value, 1, 50), auto_run: f.auto_run.checked, auto_time: f.auto_time.value || "09:00" };
    A.busy("Saving settings…");
    try { await save(s => { Object.assign(s.settings, next); return s; }, "Autopilot: settings"); A.toast("Settings saved"); render(); updateBadge(); }
    catch (err) { A.toast(A.friendly(err), true); }
    finally { A.busy(null); }
  });

  async function open() {
    if (!A.signedIn()) return A.show("login");
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s !== screen; });
    $("#top-actions").hidden = false;
    window.scrollTo(0, 0);
    if (location.hash !== "#fbauto") history.replaceState(null, "", "#fbauto");
    if (!S) { $("#fa-body").innerHTML = `<p class="muted">Loading…</p>`; await load().catch(err => A.toast(A.friendly(err), true)); }
    render();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-fbauto]");
    if (!b) return;
    e.preventDefault();
    open();
  });

  // ------------------------------------------------------------------ start-up: badge, results and the daily run
  const hash = location.hash;
  const wait = setInterval(async () => {
    if (!A.signedIn() || !A.products().length) return;
    clearInterval(wait);
    try { await load(); } catch (err) { return; }
    updateBadge();
    const m = hash.match(/^#favauto-done=(.+)$/);
    if (m) {
      let out = null;
      try { out = JSON.parse(decodeURIComponent(m[1])); } catch (e) { /* ignore */ }
      await open();
      if (out) await receive(out);
    } else if (hash === "#fbauto") {
      open();
    } else if (hash === "#fbauto-run") {
      await open();
      if (!S.settings.auto_run) return;
      const dl = dueList(), renew = dl === null || dl.length > 0;
      if (!renew && !plan().groups.length) return A.toast("Daily run: nothing to do today ✓");
      A.toast("Daily run starts in 15 seconds…");
      setTimeout(() => (renew ? startRenew("post") : startPosting(true)), 15000);
    }
  }, 300);
  setTimeout(() => clearInterval(wait), 60000);

  window.addEventListener("message", e => {
    if (e.source === window && e.data && e.data.type === "favauto-start-failed") A.toast("The add-on couldn't start the run. Reload the add-on in chrome://extensions and try again.", true);
  });
  window.FAV_FBAUTO = { open, _test: { set: s => { S = normalise(s); }, dueList, plan, caption, receive, state: () => S } };
})();
