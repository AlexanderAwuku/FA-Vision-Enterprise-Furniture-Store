// Price sync: the website price next to every linked Facebook Marketplace listing.
//
// Facebook has no API for personal Marketplace listings, so this screen can't
// change Facebook by itself. It keeps the job fast instead: every tap updates the
// screen at once, and changes are saved to GitHub in the background (several taps
// are bundled into one save). Red rows need their price changed on Facebook; tap
// "Done" after updating one, or ask Claude to "sync my Facebook prices".
(function () {
  const C = window.FAV_CONFIG;
  const A = window.FAV_ADMIN;
  if (!A) return;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const screen = $("#screen-pricesync");
  const body = () => $("#ps-body");
  const fbView = id => `https://www.facebook.com/marketplace/item/${encodeURIComponent(id)}/`;
  const fbEdit = id => `https://www.facebook.com/marketplace/edit/?listing_id=${encodeURIComponent(id)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const money = n => C.formatPrice(n).replace(" ", "");
  let filter = "out";
  let local = null;            // working copy shown on screen (includes unsaved taps)
  try { sessionStorage.removeItem("favsync-pending"); } catch (e) { /* old sync state */ }

  // ------------------------------------------------------------------ state
  const products = () => local || A.products();
  const isOut = (p, l) => !!p.price_ghs && ((l.currency && l.currency !== "GHS") || Number(l.price) !== Number(p.price_ghs));
  function counts() {
    let out = 0, ok = 0, unset = 0;
    for (const p of products()) for (const l of p.facebook_listings || []) {
      if (!p.price_ghs) unset++; else if (isOut(p, l)) out++; else ok++;
    }
    return { out, ok, unset, all: out + ok + unset };
  }

  // ------------------------------------------------------------------ background saving
  const pending = [];          // { message, change(product) => product }
  let timer = null, saving = false;
  function status(text, kind) {
    const s = $("#ps-status");
    if (s) { s.textContent = text; s.dataset.kind = kind || ""; }
  }
  function apply(message, change) {
    local = products().map(p => change(p));          // instant on screen
    pending.push({ message, change });
    status("Saving…", "busy");
    clearTimeout(timer);
    timer = setTimeout(flush, 900);                   // bundle quick taps into one save
    updateBadge();
  }
  async function flush() {
    if (saving || !pending.length) return;
    saving = true;
    const batch = pending.splice(0);
    const message = batch.length === 1 ? batch[0].message : `Price sync: ${batch.length} changes`;
    try {
      await A.commit({ message, mutate: list => batch.reduce((l, b) => l.map(p => b.change(p)), list) });
      if (!pending.length) { local = null; status("All changes saved ✓", "ok"); }
      A.refreshDash();
    } catch (err) {
      pending.unshift(...batch);
      status("Couldn't save. Retrying…", "bad");
      setTimeout(flush, 4000);
    } finally {
      saving = false;
      if (pending.length) setTimeout(flush, 300);
    }
  }
  window.addEventListener("beforeunload", e => { if (pending.length || saving) { e.preventDefault(); e.returnValue = ""; } });

  const setPrice = (pid, price) => apply(`Price: ${pid} is now ${money(price)}`,
    p => p.id !== pid ? p : { ...p, price_ghs: price, placeholder: false });
  const markDone = (pid, lids) => apply(`Price sync: ${lids.length} Facebook listing${lids.length === 1 ? "" : "s"} of ${pid} updated`,
    p => p.id !== pid ? p : {
      ...p, facebook_listings: p.facebook_listings.map(l => {
        if (!lids.includes(l.id)) return l;
        const { currency, ...rest } = l;
        return { ...rest, price: p.price_ghs, checked: today(), synced: today() };
      })
    });

  // ------------------------------------------------------------------ rendering
  function productCard(p) {
    const list = (p.facebook_listings || []).map(l => ({ l, out: isOut(p, l), unset: !p.price_ghs }));
    const shown = list.filter(r => filter === "all" || (filter === "out" ? (r.out || r.unset) : (!r.out && !r.unset)));
    if (!shown.length) return "";
    const outIds = list.filter(r => r.out).map(r => r.l.id);
    const img = (p.images || [])[0];
    return `<section class="ps-product" data-pid="${esc(p.id)}">
      <header>
        ${img ? `<img src="../${esc(img)}" alt="" width="56" height="42" loading="lazy" decoding="async">` : ""}
        <div class="ps-name"><b>${esc(p.name)}</b><small>${esc(p.id)} · ${list.length} Facebook listing${list.length === 1 ? "" : "s"}</small></div>
        <form class="ps-price" data-ps-price="${esc(p.id)}">
          <label for="ps-in-${esc(p.id)}">Price</label>
          <span class="ps-cedi">GH₵<input id="ps-in-${esc(p.id)}" name="price" type="number" min="1" step="1" inputmode="numeric" value="${p.price_ghs || ""}" required></span>
          <button class="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      </header>
      <ul class="ps-rows">${shown.map(({ l, out, unset }) => `
        <li class="${out ? "is-out" : unset ? "is-unset" : "is-ok"}">
          <a class="ps-title" href="${fbView(l.id)}" target="_blank" rel="noopener">${esc(l.title || l.id)}</a>
          <span class="ps-fb">${l.price ? (l.currency && l.currency !== "GHS" ? esc(l.currency) + " " + Number(l.price).toLocaleString() : money(l.price)) : "–"}</span>
          <span class="ps-state">${out ? "Update on Facebook" : unset ? "Set a price" : "In sync ✓"}</span>
          <span class="ps-actions">${out ? `
            <button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(p.price_ghs)}">Copy ${money(p.price_ghs)}</button>
            <a class="btn btn-ghost btn-sm" href="${fbEdit(l.id)}" target="_blank" rel="noopener">Edit ↗</a>
            <button class="btn btn-ok btn-sm" type="button" data-done="${esc(p.id)}|${esc(l.id)}">✓ Done</button>` : ""}</span>
        </li>`).join("")}
      </ul>
      ${outIds.length > 1 ? `<p class="ps-foot"><button class="link" type="button" data-done="${esc(p.id)}|${esc(outIds.join(","))}">✓ Mark all ${outIds.length} done</button></p>` : ""}
    </section>`;
  }

  function render() {
    const c = counts();
    const cards = products().filter(p => (p.facebook_listings || []).length).map(productCard).join("");
    body().innerHTML = `
      <div class="ps-top">
        <div class="ps-tabs" role="tablist">
          <button role="tab" aria-selected="${filter === "out"}" data-psf="out">Needs update <b>${c.out + c.unset}</b></button>
          <button role="tab" aria-selected="${filter === "ok"}" data-psf="ok">In sync <b>${c.ok}</b></button>
          <button role="tab" aria-selected="${filter === "all"}" data-psf="all">All <b>${c.all}</b></button>
        </div>
        <span id="ps-status" class="ps-status" aria-live="polite">${pending.length ? "Saving…" : ""}</span>
      </div>
      <p class="ps-note">Facebook doesn't let websites change Marketplace prices, so red rows need updating on Facebook: <b>Copy</b> → <b>Edit ↗</b> → paste → Update → <b>✓ Done</b>. Or ask Claude to <i>sync my Facebook prices</i>.</p>
      ${cards || `<p class="ps-empty">${filter === "out" ? "Every Facebook listing matches your website price. 🎉" : "Nothing here."}</p>`}`;
    updateBadge();
  }

  // Re-draw one product card in place (keeps scroll position, no page flash).
  function refreshCard(pid) {
    const old = body().querySelector(`.ps-product[data-pid="${CSS.escape(pid)}"]`);
    const p = products().find(x => x.id === pid);
    const html = p ? productCard(p) : "";
    if (!old) return render();
    if (!html) {
      old.classList.add("leaving");
      setTimeout(() => { old.remove(); if (!body().querySelector(".ps-product")) render(); }, 220);
    } else {
      old.outerHTML = html;
    }
    const c = counts();
    const tabs = body().querySelectorAll(".ps-tabs b");
    if (tabs.length === 3) { tabs[0].textContent = c.out + c.unset; tabs[1].textContent = c.ok; tabs[2].textContent = c.all; }
  }

  function updateBadge() {
    const c = counts(), n = c.out + c.unset;
    const badge = $("#ps-badge"), alert = $("#ps-alert");
    if (badge) { badge.hidden = !n; badge.textContent = n; }
    if (alert) {
      alert.hidden = !n;
      alert.innerHTML = `<b>${n} Facebook listing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} a price update.</b> Open Price sync →`;
    }
  }

  // ------------------------------------------------------------------ events
  screen.addEventListener("click", async e => {
    const f = e.target.closest("[data-psf]");
    if (f) { filter = f.dataset.psf; return render(); }
    const cp = e.target.closest("[data-copy]");
    if (cp) {
      try { await navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = "Copied ✓"; }
      catch (err) { prompt("Copy this price:", cp.dataset.copy); }
      return;
    }
    const d = e.target.closest("[data-done]");
    if (d) {
      const [pid, ids] = d.dataset.done.split("|");
      markDone(pid, ids.split(","));
      refreshCard(pid);
    }
  });

  screen.addEventListener("submit", e => {
    const pf = e.target.closest("[data-ps-price]");
    if (!pf) return;
    e.preventDefault();
    const price = parseInt(pf.elements.price.value, 10);
    if (!(price > 0)) return A.toast("Enter a price in cedis", true);
    const pid = pf.dataset.psPrice;
    if (Number(products().find(p => p.id === pid).price_ghs) === price) return;
    setPrice(pid, price);
    refreshCard(pid);
  });

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
    const n = products().filter(p => ids.includes(p.id)).reduce((s, p) => s + (p.facebook_listings || []).filter(l => isOut(p, l)).length, 0);
    updateBadge();
    if (n) setTimeout(() => A.toast(`Price saved. ${n} Facebook listing${n === 1 ? " still shows" : "s still show"} the old price. See Price sync.`), 2600);
  }
  window.FAV_PRICESYNC = { open, nudge, updateBadge };

  const list = $("#list");
  if (list) new MutationObserver(updateBadge).observe(list, { childList: true });
  if (/^#pricesync/.test(location.hash)) {
    const wait = setInterval(() => { if (A.products().length) { clearInterval(wait); open(); } }, 200);
    setTimeout(() => clearInterval(wait), 20000);
  }
})();
