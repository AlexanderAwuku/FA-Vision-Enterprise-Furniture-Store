// Price sync screen: one place to set a product's price for every platform.
//
// Set the price here once (or tap "Use this price everywhere" on a Facebook
// row). It saves to the website, and every linked Facebook Marketplace listing
// that now differs is queued. Facebook gives personal sellers no API, so the
// queue is pushed by the "FA Vision price sync" bookmark: "Start Facebook sync"
// opens the first listing's edit page, each click of the bookmark types the
// price in, taps Update and moves to the next listing, and the last one brings
// you back here, where the synced listings are recorded in products.json.
(function () {
  const C = window.FAV_CONFIG;
  const A = window.FAV_ADMIN;
  if (!A) return;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const screen = $("#screen-pricesync");
  const FB = "https://www.facebook.com";
  const fbUrl = id => `${FB}/marketplace/item/${encodeURIComponent(id)}/`;
  const fbEdit = id => `${FB}/marketplace/edit/?listing_id=${encodeURIComponent(id)}`;
  const todayStr = () => new Date().toISOString().slice(0, 10);
  let filter = "out";
  const hasAddon = () => document.documentElement.dataset.favsyncExt === "1";
  // Listings sent to Facebook from this tab and not yet confirmed.
  const syncing = new Set((() => { try { return JSON.parse(sessionStorage.getItem("favsync-pending") || "[]"); } catch (e) { return []; } })());
  const keepSyncing = () => { try { sessionStorage.setItem("favsync-pending", JSON.stringify([...syncing])); } catch (e) { /* ignore */ } };
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("favsync") : null;

  // ------------------------------------------------------------------ data
  function rows() {
    const out = [];
    for (const p of A.products()) {
      for (const l of p.facebook_listings || []) {
        let status = "ok", why = "";
        if (!p.price_ghs) { status = "unset"; why = "Set the price above first"; }
        else if (l.currency && l.currency !== "GHS") { status = "out"; why = `Listed in ${l.currency}. Switch the currency to GH₵ on Facebook`; }
        else if (Number(l.price) !== Number(p.price_ghs)) { status = "out"; why = `Facebook shows ${l.price ? C.formatPrice(l.price) : "no price"}`; }
        out.push({ p, l, status, why });
      }
    }
    return out;
  }
  const tally = list => list.reduce((c, r) => (c[r.status]++, c), { ok: 0, out: 0, unset: 0 });
  const queue = () => rows().filter(r => r.status === "out" && !(r.l.currency && r.l.currency !== "GHS"))
    .map(r => ({ id: r.l.id, price: r.p.price_ghs, pid: r.p.id }));

  function updateBadge() {
    const t = tally(rows()), n = t.out + t.unset;
    const badge = $("#ps-badge"), alert = $("#ps-alert");
    if (badge) { badge.hidden = !n; badge.textContent = n; }
    if (alert) {
      alert.hidden = !n;
      alert.innerHTML = `⚠️ <b>${n} Facebook listing${n === 1 ? " has" : "s have"} a price that doesn't match your website.</b> Open Price sync →`;
    }
  }

  // ------------------------------------------------------------------ the bookmark
  // Runs on facebook.com when the owner clicks the "FA Vision price sync" bookmark.
  // Kept self-contained: it is turned into a javascript: link below.
  function helper() {
    (async () => {
      const KEY = "favsync";
      const box = (msg, bad) => {
        let d = document.getElementById("favsyncbox");
        if (!d) {
          d = document.createElement("div");
          d.id = "favsyncbox";
          d.style.cssText = "position:fixed;z-index:2147483647;left:16px;bottom:16px;max-width:380px;padding:14px 18px;border-radius:12px;font:600 15px/1.4 system-ui,sans-serif;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35)";
          document.body.appendChild(d);
        }
        d.style.background = bad ? "#c62828" : "#0d55af";
        d.textContent = msg;
      };
      const m = location.hash.match(/favsync=([^&]+)/);
      let s = null;
      try {
        const stored = JSON.parse(sessionStorage.getItem(KEY) || "null");
        const fresh = m ? JSON.parse(decodeURIComponent(m[1])) : null;
        // A second click on the first page keeps the progress already made.
        s = fresh && !(stored && JSON.stringify(stored.q) === JSON.stringify(fresh.q)) ? fresh : stored;
      } catch (e) { s = null; }
      if (!s || !s.q) { box("Start from FA Vision Admin → Price sync → Start Facebook sync, then click this bookmark.", true); return; }
      s.done = s.done || []; s.skip = s.skip || [];
      const save = () => sessionStorage.setItem(KEY, JSON.stringify(s));
      save();
      const next = () => {
        const n = s.q.find(j => !s.done.includes(j.id) && !s.skip.includes(j.id));
        if (n) { save(); location.href = `${location.origin}/marketplace/edit/?listing_id=${n.id}`; return; }
        const result = { done: s.q.filter(j => s.done.includes(j.id)).map(j => [j.id, j.price]), skip: s.skip };
        sessionStorage.removeItem(KEY);
        location.href = s.back + "#pricesync-done=" + encodeURIComponent(JSON.stringify(result));
      };
      const id = new URLSearchParams(location.search).get("listing_id");
      const job = s.q.find(j => j.id === id);
      if (!job || s.done.includes(id) || s.skip.includes(id)) { box("Opening the next listing…"); next(); return; }
      const nth = s.done.length + s.skip.length + 1;
      box(`Listing ${nth} of ${s.q.length}: setting GH₵${Number(job.price).toLocaleString()}…`);
      let pi = null;
      for (let t = 0; t < 60 && !pi; t++) {
        pi = [...document.querySelectorAll("input[type=text]")].find(i => ((i.closest("label") || {}).innerText || "").trim().startsWith("Price"));
        if (!pi) await new Promise(r => setTimeout(r, 250));
      }
      if (!pi) { box("The price box hasn't loaded yet. Wait a moment and click the bookmark again.", true); return; }
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(pi, String(job.price));
      pi.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      if (pi.value.replace(/\D/g, "") !== String(job.price) || !/^GH/.test(pi.value)) {
        s.skip.push(id); save();
        box(`This listing shows "${pi.value}". Fix its price or currency by hand, then click the bookmark again to carry on.`, true);
        return;
      }
      const btn = [...document.querySelectorAll('[role=button],button')].find(b => (b.innerText || "").trim() === "Update");
      if (!btn) { box("Couldn't find Facebook's Update button on this page.", true); return; }
      btn.click();
      box(`Listing ${nth} of ${s.q.length}: saving…`);
      for (let t = 0; t < 80 && location.pathname.includes("/edit"); t++) await new Promise(r => setTimeout(r, 250));
      if (location.pathname.includes("/edit")) { box("Facebook didn't confirm the save. Check the page, then click the bookmark again.", true); return; }
      s.done.push(id);
      const left = s.q.length - s.done.length - s.skip.length;
      box(left ? `Saved. Opening the next listing (${left} left) — click the bookmark again when it loads.` : "All done. Taking you back to your admin…");
      setTimeout(next, 800);
    })();
  }
  const bookmarkHref = "javascript:" + encodeURIComponent("(" + helper.toString() + ")()");

  // ------------------------------------------------------------------ render
  function render() {
    const all = rows();
    const c = tally(all);
    const q = queue();
    const unlinked = A.products().filter(p => !(p.facebook_listings || []).length);
    const shown = all.filter(r => filter === "all" || r.status === filter || (filter === "out" && r.status === "unset"));
    const byProduct = new Map();
    shown.forEach(r => { if (!byProduct.has(r.p.id)) byProduct.set(r.p.id, []); byProduct.get(r.p.id).push(r); });

    $("#ps-body").innerHTML = `
      <div class="ps-summary">
        <button class="ps-stat bad ${filter === "out" ? "on" : ""}" data-psf="out"><b>${c.out + c.unset}</b><span>Need updating</span></button>
        <button class="ps-stat good ${filter === "ok" ? "on" : ""}" data-psf="ok"><b>${c.ok}</b><span>In sync</span></button>
        <button class="ps-stat ${filter === "all" ? "on" : ""}" data-psf="all"><b>${all.length}</b><span>Linked listings</span></button>
      </div>

      <div class="ps-sync">
        <div>
          <b>${q.length ? `${q.length} Facebook listing${q.length === 1 ? "" : "s"} to update` : "Facebook is up to date"}</b>
          <p class="muted small">${hasAddon()
            ? "Tap <b>Sync</b> on a row, or <b>Sync all</b>. A Facebook tab opens, updates the prices by itself and closes; the rows here turn green."
            : "Install the FA Vision sync add-on once (below) and the Sync buttons will update Facebook for you."}</p>
        </div>
        <button class="btn btn-sell" id="ps-start" ${q.length ? "" : "disabled"}>Sync all${q.length ? ` (${q.length})` : ""}</button>
      </div>
      <details class="ps-setup" ${hasAddon() ? "" : "open"}>
        <summary>${hasAddon() ? "✓ FA Vision sync add-on is installed in this browser" : "One-time setup: install the FA Vision sync add-on"}</summary>
        <ol>
          <li>Open the add-ons page: type <code>edge://extensions</code> (Edge) or <code>chrome://extensions</code> (Chrome) in the address bar and press Enter.</li>
          <li>Turn on <b>Developer mode</b> (a switch on that page).</li>
          <li>Click <b>Load unpacked</b> and choose the folder <b>Downloads → fa-vision-sync-extension</b>.</li>
          <li>Come back here and reload this page. This box then shows a tick.</li>
        </ol>
        <p class="muted small">The add-on only works on your Facebook Marketplace edit pages and only when this admin sends it prices. No add-on on this device? Drag <a class="ps-bookmark" href="${bookmarkHref}" title="Drag me to your bookmarks bar">⟳ FA Vision price sync</a> to your bookmarks bar and click it on each listing that opens, or ask Claude to “sync my Facebook prices”.</p>
      </details>

      ${shown.length ? "" : `<p class="ps-empty">${filter === "out" ? "🎉 Every linked Facebook listing matches your website price." : "Nothing here yet."}</p>`}
      ${[...byProduct.values()].map(list => {
        const p = list[0].p;
        const img = (p.images || [])[0];
        const outN = list.filter(r => r.status === "out").length;
        return `<section class="ps-product">
          <header>
            ${img ? `<img src="../${esc(img)}" alt="" width="64" height="48">` : ""}
            <div class="ps-name"><b>${esc(p.name)}</b><small>${esc(p.id)}${p.placeholder ? ` · <span class="ps-pill unset">Price not confirmed</span>` : ""}</small></div>
            <form class="ps-price" data-ps-price="${esc(p.id)}">
              <label for="ps-in-${esc(p.id)}">Price everywhere</label>
              <span class="ps-cedi">GH₵<input id="ps-in-${esc(p.id)}" name="price" type="number" min="1" step="1" inputmode="numeric" value="${p.price_ghs || ""}" placeholder="e.g. 4500" required></span>
              <button class="btn btn-primary btn-sm" type="submit">Save</button>
            </form>
          </header>
          <div class="ps-scroll"><table class="ps-table">
            <thead><tr><th>Facebook listing</th><th>Facebook price</th><th>Status</th><th></th></tr></thead>
            <tbody>${list.map(({ l, status, why }) => `
              <tr class="ps-${status}">
                <td><a href="${fbUrl(l.id)}" target="_blank" rel="noopener">${esc(l.title || l.id)}</a><small>Checked ${esc(l.checked || "–")}${l.synced ? ` · synced ${esc(l.synced)}` : ""}</small></td>
                <td>${l.price ? (l.currency && l.currency !== "GHS" ? esc(l.currency) + " " + Number(l.price).toLocaleString() : C.formatPrice(l.price)) : "–"}</td>
                <td><span class="ps-pill ${syncing.has(l.id) && status === "out" ? "busy" : status}">${status === "ok" ? "In sync" : status === "unset" ? "No website price" : syncing.has(l.id) ? "Syncing…" : "Out of sync"}</span>${why && status !== "ok" ? `<small>${esc(why)}</small>` : ""}</td>
                <td class="ps-actions">${status !== "ok" ? `
                  ${status === "out" && !(l.currency && l.currency !== "GHS") ? `<button class="btn btn-sell btn-sm" data-ps-sync="${esc(l.id)}" ${syncing.has(l.id) ? "disabled" : ""}>${syncing.has(l.id) ? "Syncing…" : "Sync"}</button>` : ""}
                  ${l.price && (!l.currency || l.currency === "GHS") && Number(l.price) !== Number(p.price_ghs) ? `<button class="btn btn-ghost btn-sm" data-ps-adopt="${esc(p.id)}|${esc(l.price)}">Use ${esc(C.formatPrice(l.price))} everywhere</button>` : ""}
                  <a class="btn btn-ghost btn-sm" href="${fbEdit(l.id)}" target="_blank" rel="noopener">Edit on Facebook ↗</a>
                  ${status === "out" ? `<button class="btn btn-ghost btn-sm" data-ps-mark="${esc(p.id)}|${esc(l.id)}">Mark synced</button>` : ""}` : ""}
                </td>
              </tr>`).join("")}
            </tbody>
          </table></div>
          ${outN > 1 ? `<p class="ps-foot"><button class="link" data-ps-all="${esc(p.id)}">I've updated all ${outN} on Facebook: mark them synced</button></p>` : ""}
        </section>`;
      }).join("")}
      <details class="ps-link">
        <summary>Link another Facebook listing to a product${unlinked.length ? ` (${unlinked.length} product${unlinked.length === 1 ? "" : "s"} not linked yet)` : ""}</summary>
        <form id="ps-link-form" class="ps-link-form">
          <label>Product<select name="pid" required>${A.products().map(p => `<option value="${esc(p.id)}">${esc(p.id)} · ${esc(p.name)}</option>`).join("")}</select></label>
          <label>Facebook listing link or number<input name="url" required placeholder="https://www.facebook.com/marketplace/item/123…"></label>
          <label>Price on Facebook now (GH₵)<input name="price" type="number" min="0" step="1" inputmode="numeric"></label>
          <button class="btn btn-primary btn-sm" type="submit">Link listing</button>
        </form>
      </details>`;
    updateBadge();
  }

  // ------------------------------------------------------------------ saving
  async function save(message, change) {
    await A.commit({ message, mutate: list => list.map(p => change(p)) });
    A.refreshDash();
    render();
  }
  const setPrice = (pid, price) => save(`Price: ${pid} is now GH₵${price.toLocaleString()} on every platform`, p =>
    p.id !== pid ? p : { ...p, price_ghs: price, placeholder: false });
  const markSynced = (pairs) => {
    const map = new Map(pairs.map(([id, price]) => [String(id), price]));
    return save(`Price sync: ${map.size} Facebook listing${map.size === 1 ? "" : "s"} updated`, p => {
      if (!(p.facebook_listings || []).some(l => map.has(l.id))) return p;
      return {
        ...p, facebook_listings: p.facebook_listings.map(l => {
          if (!map.has(l.id)) return l;
          const { currency, ...rest } = l;
          return { ...rest, price: map.get(l.id), checked: todayStr(), synced: todayStr() };
        })
      };
    });
  };

  async function run(label, fn, ok) {
    A.busy(label);
    try { await fn(); if (ok) A.toast(ok); }
    catch (err) { A.toast(err.message || "Couldn't save. Check your connection and try again.", true); }
    finally { A.busy(null); }
  }

  screen.addEventListener("click", async e => {
    const f = e.target.closest("[data-psf]");
    if (f) { filter = f.dataset.psf; return render(); }

    const one = e.target.closest("[data-ps-sync]");
    if (e.target.closest("#ps-start") || one) {
      const q = queue().filter(j => !one || j.id === one.dataset.psSync);
      if (!q.length) return;
      if (!hasAddon()) {
        const box = $(".ps-setup"); if (box) { box.open = true; box.scrollIntoView({ behavior: "smooth", block: "center" }); }
        return A.toast("Install the FA Vision sync add-on first (one time), then tap Sync again.", true);
      }
      const payload = { q: q.map(({ id, price }) => ({ id, price })), back: location.origin + location.pathname };
      window.open(`${fbEdit(q[0].id)}#favsync=${encodeURIComponent(JSON.stringify(payload))}`, "favsync");
      q.forEach(j => syncing.add(j.id)); keepSyncing(); render();
      A.toast(`Updating ${q.length} Facebook listing${q.length === 1 ? "" : "s"} in a new tab. Rows turn green here as soon as Facebook confirms.`);
      return;
    }
    if (e.target.closest("#ps-copy-bm")) {
      try { await navigator.clipboard.writeText(bookmarkHref); A.toast("Bookmark code copied."); }
      catch (err) { prompt("Copy this bookmark code:", bookmarkHref); }
      return;
    }
    const ad = e.target.closest("[data-ps-adopt]");
    if (ad) {
      const [pid, price] = ad.dataset.psAdopt.split("|");
      return run("Saving…", () => setPrice(pid, Number(price)), `GH₵${Number(price).toLocaleString()} is now the price on your website. Start Facebook sync to update the other listings.`);
    }
    const m = e.target.closest("[data-ps-mark]");
    if (m) {
      const [pid, lid] = m.dataset.psMark.split("|");
      const p = A.products().find(x => x.id === pid);
      return run("Saving…", () => markSynced([[lid, p.price_ghs]]), "Marked as synced.");
    }
    const all = e.target.closest("[data-ps-all]");
    if (all) {
      const p = A.products().find(x => x.id === all.dataset.psAll);
      return run("Saving…", () => markSynced(p.facebook_listings.map(l => [l.id, p.price_ghs])), "Marked as synced.");
    }
  });

  screen.addEventListener("submit", async e => {
    const pf = e.target.closest("[data-ps-price]");
    if (pf) {
      e.preventDefault();
      const price = parseInt(pf.elements.price.value, 10);
      if (!(price > 0)) return A.toast("Enter a price in cedis", true);
      const pid = pf.dataset.psPrice;
      const n = (A.products().find(p => p.id === pid).facebook_listings || []).length;
      return run("Saving…", () => setPrice(pid, price), `Saved on your website.${n ? " Start Facebook sync to update Facebook." : ""}`);
    }
    if (e.target.id !== "ps-link-form") return;
    e.preventDefault();
    const d = new FormData(e.target);
    const m = String(d.get("url")).match(/(\d{8,})/);
    if (!m) return A.toast("That doesn't look like a Marketplace listing link", true);
    const lid = m[1], pid = d.get("pid"), price = parseInt(d.get("price"), 10) || null;
    run("Linking…", () => save(`Price sync: link Facebook listing ${lid} to ${pid}`, p => p.id !== pid ? p : {
      ...p, facebook_listings: [...(p.facebook_listings || []).filter(l => l.id !== lid), { id: lid, title: p.name, price, checked: todayStr() }]
    }), "Listing linked.");
  });

  // ------------------------------------------------------------------ navigation
  function open() {
    if (!A.signedIn()) return A.show("login");
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s !== screen; });
    $("#top-actions").hidden = false;
    window.scrollTo(0, 0);
    if (location.hash !== "#pricesync") history.replaceState(null, "", "#pricesync");
    render();
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-pricesync]");
    if (!b) return;
    e.preventDefault();
    open();
  });

  function nudge(ids) {
    const n = rows().filter(r => ids.includes(r.p.id) && r.status === "out").length;
    updateBadge();
    if (n) setTimeout(() => A.toast(`Price saved. ${n} Facebook listing${n === 1 ? " still shows" : "s still show"} the old price. Open Price sync → Start Facebook sync.`), 2600);
  }
  window.FAV_PRICESYNC = { open, nudge, updateBadge };

  if (channel) channel.onmessage = async ev => {
    if (!ev.data || ev.data.type !== "done") return;
    [...ev.data.done, ...ev.data.skip].forEach(id => syncing.delete(id)); keepSyncing();
    try { await A.reload(); } catch (err) { /* keep what we have */ }
    if (!screen.hidden) render(); else updateBadge();
    const n = ev.data.done.length, k = ev.data.skip.length;
    A.toast(`${n} Facebook listing${n === 1 ? "" : "s"} synced.${k ? ` ${k} couldn't be set and ${k === 1 ? "is" : "are"} still red.` : ""}`, !!k && !n);
  };

  const list = $("#list");
  if (list) new MutationObserver(updateBadge).observe(list, { childList: true });

  // Back from Facebook: the bookmark returns here with what it saved.
  const doneMatch = location.hash.match(/^#pricesync-done=(.+)$/);
  if (location.hash === "#pricesync" || doneMatch) {
    const wait = setInterval(async () => {
      if (!A.products().length) return;
      clearInterval(wait);
      open();
      if (!doneMatch) return;
      let result = null;
      try { result = JSON.parse(decodeURIComponent(doneMatch[1])); } catch (err) { /* ignore */ }
      if (!result) return;
      if (result.done && result.done.length) await run("Recording the Facebook updates…", () => markSynced(result.done),
        `${result.done.length} Facebook listing${result.done.length === 1 ? "" : "s"} updated.${result.skip && result.skip.length ? ` ${result.skip.length} need${result.skip.length === 1 ? "s" : ""} fixing by hand.` : ""}`);
      history.replaceState(null, "", "#pricesync");
      // Tell the admin tab that started the sync, then close this helper tab.
      if (channel) channel.postMessage({ type: "done", done: (result.done || []).map(d => d[0]), skip: result.skip || [] });
      if (window.name === "favsync") setTimeout(() => window.close(), 1500);
    }, 300);
    setTimeout(() => clearInterval(wait), 20000);
  }
})();
