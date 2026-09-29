// Price sync screen: website price vs every linked Facebook Marketplace listing.
//
// Facebook gives personal Marketplace sellers no API, so a website can't change
// listing prices by itself. This screen is the one place to watch: it compares
// products.json -> price_ghs with products.json -> facebook_listings[].price,
// shows what's out of sync, and gives one-tap steps to fix each listing
// (copy the new price or full listing text, open the listing on Facebook, then
// "Mark synced", which saves the new Facebook price back to products.json).
(function () {
  const C = window.FAV_CONFIG;
  const A = window.FAV_ADMIN;
  if (!A) return;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const screen = $("#screen-pricesync");
  const fbUrl = id => `https://www.facebook.com/marketplace/item/${encodeURIComponent(id)}/`;
  const fbEdit = id => `https://www.facebook.com/marketplace/edit/?listing_id=${encodeURIComponent(id)}`;
  const todayStr = () => new Date().toISOString().slice(0, 10);
  let filter = "out";

  // One row per linked listing, with its status.
  function rows() {
    const out = [];
    for (const p of A.products()) {
      for (const l of p.facebook_listings || []) {
        let status = "ok", why = "";
        if (!p.price_ghs) { status = "unset"; why = "Set a website price first"; }
        else if (l.currency && l.currency !== "GHS") { status = "out"; why = `Listed in ${l.currency} on Facebook. Change the currency to GH₵`; }
        else if (Number(l.price) !== Number(p.price_ghs)) { status = "out"; why = `Facebook shows ${l.price ? C.formatPrice(l.price) : "no price"}`; }
        out.push({ p, l, status, why });
      }
    }
    return out;
  }
  const tally = list => list.reduce((c, r) => (c[r.status]++, c), { ok: 0, out: 0, unset: 0 });

  function updateBadge() {
    const t = tally(rows()), n = t.out + t.unset;
    const badge = $("#ps-badge"), alert = $("#ps-alert");
    if (badge) { badge.hidden = !n; badge.textContent = n; }
    if (alert) {
      alert.hidden = !n;
      alert.innerHTML = `⚠️ <b>${n} Facebook listing${n === 1 ? " has" : "s have"} a price that doesn't match your website.</b> Open Price sync →`;
    }
  }

  function render() {
    const all = rows();
    const c = tally(all);
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
      <p class="ps-how muted">How to sync: tap <b>Copy price</b> (or <b>Copy listing text</b>), then <b>Edit on Facebook</b>, paste into the price box and tap <b>Update</b>. Come back and tap <b>Mark synced</b>. Prefer not to do it by hand? Ask Claude to “sync my Facebook prices”.</p>
      ${shown.length ? "" : `<p class="ps-empty">${filter === "out" ? "🎉 Every linked Facebook listing matches your website price." : "Nothing here yet."}</p>`}
      ${[...byProduct.values()].map(list => {
        const p = list[0].p;
        const img = (p.images || [])[0];
        const outN = list.filter(r => r.status === "out").length;
        return `<section class="ps-product">
          <header>
            ${img ? `<img src="../${esc(img)}" alt="" width="64" height="48">` : ""}
            <div><b>${esc(p.name)}</b><small>${esc(p.id)} · Website price <strong>${p.price_ghs ? C.formatPrice(p.price_ghs) : "not set"}</strong></small></div>
            ${outN > 1 ? `<button class="btn btn-ghost btn-sm" data-ps-all="${esc(p.id)}">Mark all ${outN} synced</button>` : ""}
          </header>
          <div class="ps-scroll"><table class="ps-table">
            <thead><tr><th>Facebook listing</th><th>Facebook price</th><th>Status</th><th></th></tr></thead>
            <tbody>${list.map(({ l, status, why }) => `
              <tr class="ps-${status}">
                <td><a href="${fbUrl(l.id)}" target="_blank" rel="noopener">${esc(l.title || l.id)}</a><small>Checked ${esc(l.checked || "–")}${l.synced ? ` · synced ${esc(l.synced)}` : ""}</small></td>
                <td>${l.price ? (l.currency && l.currency !== "GHS" ? esc(l.currency) + " " + Number(l.price).toLocaleString() : C.formatPrice(l.price)) : "–"}</td>
                <td><span class="ps-pill ${status}">${status === "ok" ? "In sync" : status === "unset" ? "No website price" : "Out of sync"}</span>${why && status !== "ok" ? `<small>${esc(why)}</small>` : ""}</td>
                <td class="ps-actions">${status === "out" ? `
                  <button class="btn btn-ghost btn-sm" data-ps-copy="${esc(p.id)}">Copy price</button>
                  <button class="btn btn-ghost btn-sm" data-ps-text="${esc(p.id)}">Copy listing text</button>
                  <a class="btn btn-ghost btn-sm" href="${fbEdit(l.id)}" target="_blank" rel="noopener">Edit on Facebook ↗</a>
                  <button class="btn btn-sell btn-sm" data-ps-mark="${esc(p.id)}|${esc(l.id)}">Mark synced</button>` : ""}
                </td>
              </tr>`).join("")}
            </tbody>
          </table></div>
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

  async function save(message, change) {
    await A.commit({ message, mutate: list => list.map(p => change(p)) });
    A.refreshDash();
    render();
  }

  screen.addEventListener("click", async e => {
    const f = e.target.closest("[data-psf]");
    if (f) { filter = f.dataset.psf; return render(); }
    const pc = e.target.closest("[data-ps-copy]");
    const pt = e.target.closest("[data-ps-text]");
    if (pc || pt) {
      const p = A.products().find(x => x.id === (pc ? pc.dataset.psCopy : pt.dataset.psText));
      const text = pc ? String(p.price_ghs) : `${A.marketplaceText(p)}\n\n🌐 Order online: https://favisionenterprize.github.io/#product/${p.id}`;
      try {
        await navigator.clipboard.writeText(text);
        A.toast(pc ? `Copied ${C.formatPrice(p.price_ghs)}. Paste it into the Facebook price box.` : "Listing text copied. Paste it into the Facebook description.");
      } catch (err) { prompt("Copy this:", text); }
      return;
    }
    const m = e.target.closest("[data-ps-mark]");
    const all = e.target.closest("[data-ps-all]");
    if (m || all) {
      const [pid, lid] = m ? m.dataset.psMark.split("|") : [all.dataset.psAll, null];
      A.busy("Saving…");
      try {
        await save(`Price sync: Facebook ${lid ? "listing " + lid : "listings"} of ${pid} now match the website`, p => {
          if (p.id !== pid) return p;
          return {
            ...p, facebook_listings: p.facebook_listings.map(l => {
              if (lid && l.id !== lid) return l;
              const { currency, ...rest } = l;
              return { ...rest, price: p.price_ghs, checked: todayStr(), synced: todayStr() };
            })
          };
        });
        A.toast("Marked as synced.");
      } catch (err) { A.toast(err.message || "Couldn't save", true); }
      finally { A.busy(null); }
    }
  });

  screen.addEventListener("submit", async e => {
    if (e.target.id !== "ps-link-form") return;
    e.preventDefault();
    const d = new FormData(e.target);
    const m = String(d.get("url")).match(/(\d{8,})/);
    if (!m) return A.toast("That doesn't look like a Marketplace listing link", true);
    const lid = m[1], pid = d.get("pid"), price = parseInt(d.get("price"), 10) || null;
    A.busy("Linking…");
    try {
      await save(`Price sync: link Facebook listing ${lid} to ${pid}`, p => p.id !== pid ? p : {
        ...p, facebook_listings: [...(p.facebook_listings || []).filter(l => l.id !== lid), { id: lid, title: p.name, price, checked: todayStr() }]
      });
      A.toast("Listing linked.");
    } catch (err) { A.toast(err.message || "Couldn't save", true); }
    finally { A.busy(null); }
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

  // Called by admin.js right after a price is saved.
  function nudge(ids) {
    const n = rows().filter(r => ids.includes(r.p.id) && r.status === "out").length;
    updateBadge();
    if (n) setTimeout(() => A.toast(`Price saved. ${n} Facebook listing${n === 1 ? " still shows" : "s still show"} the old price. Open Price sync to update ${n === 1 ? "it" : "them"}.`), 2600);
  }
  window.FAV_PRICESYNC = { open, nudge, updateBadge };

  // Keep the dashboard badge current whenever the product list re-renders.
  const list = $("#list");
  if (list) new MutationObserver(updateBadge).observe(list, { childList: true });
  if (location.hash === "#pricesync") {
    const wait = setInterval(() => { if (A.products().length) { clearInterval(wait); open(); } }, 300);
    setTimeout(() => clearInterval(wait), 15000);
  }
})();
