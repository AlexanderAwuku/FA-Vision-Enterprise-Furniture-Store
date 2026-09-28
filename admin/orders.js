// Orders & payments screen for the admin.
// Reads the "Orders" tab of the backend Google Sheet (backend/README.md) through
// the Apps Script web app, and lets you move each order along
// (Confirmed → Delivered → Balance paid …). Needs the backend's ADMIN_KEY once.
(function () {
  const C = window.FAV_CONFIG;
  const esc = C.escapeHtml;
  const money = n => (n === "" || n == null) ? "–" : C.formatPrice(Math.round(Number(n) * 100) / 100);
  const $ = s => document.querySelector(s);
  const KEY_STORE = "fav-orders-key";
  const store = {
    get() { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } },
    set(v) { try { v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE); } catch (e) { /* private mode */ } }
  };

  let endpoint = "", orders = [], progressList = [], sheetUrl = "", filter = "all", query = "";

  const screen = $("#screen-orders");

  async function loadEndpoint() {
    if (endpoint) return endpoint;
    const biz = await fetch("../data/business.json", { cache: "no-store" }).then(r => r.json());
    endpoint = biz.enquiry_endpoint || "";
    return endpoint;
  }

  function open() {
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s !== screen; });
    $("#top-actions").hidden = false;
    window.scrollTo(0, 0);
    if (location.hash !== "#orders") history.replaceState(null, "", "#orders");
    refresh();
  }

  async function refresh() {
    const body = $("#orders-body");
    body.innerHTML = `<p class="muted">Loading orders…</p>`;
    try {
      await loadEndpoint();
    } catch (e) {
      body.innerHTML = `<div class="card"><p class="error">Couldn't read the site settings. Check your connection and tap Refresh.</p></div>`;
      return;
    }
    if (!endpoint) return renderSetup();
    const key = store.get();
    if (!key) return renderKey();
    try {
      const res = await fetch(`${endpoint}?action=orders&key=${encodeURIComponent(key)}`).then(r => r.json());
      if (!res.ok) {
        if (res.error === "not allowed") { store.set(""); return renderKey("That admin key didn't work. Paste it again."); }
        throw new Error(res.error || "error");
      }
      orders = res.orders || [];
      progressList = res.progress || [];
      sheetUrl = res.sheet || "";
      render();
    } catch (e) {
      body.innerHTML = `<div class="card"><p class="error">Couldn't load orders from the backend. Check your connection and tap Refresh.</p></div>`;
    }
  }

  function renderSetup() {
    $("#orders-body").innerHTML = `
      <div class="card narrow">
        <h2>Connect the backend to see orders</h2>
        <p class="muted">Orders and payments are saved in your Google Sheet backend. It isn't connected yet.</p>
        <ol class="setup-steps">
          <li>Follow <b>backend/README.md</b> in your repository to create the Sheet and deploy the Apps Script web app (about 10 minutes).</li>
          <li>Put the web app URL in <b>data/business.json</b> as <code>"enquiry_endpoint"</code>.</li>
          <li>Come back here and paste the admin key the setup gives you.</li>
        </ol>
      </div>`;
  }

  function renderKey(msg) {
    $("#orders-body").innerHTML = `
      <div class="card narrow">
        <h2>Enter your admin key</h2>
        <p class="muted">In Apps Script, open <b>Project Settings → Script properties</b> and copy <b>ADMIN_KEY</b>. You only do this once on each device.</p>
        <form id="orders-key-form" class="stack">
          <label class="field"><span>Admin key</span><input id="orders-key" type="password" autocomplete="off" required></label>
          ${msg ? `<p class="error">${esc(msg)}</p>` : ""}
          <button class="btn btn-primary btn-block" type="submit">Show orders</button>
        </form>
      </div>`;
    $("#orders-key-form").addEventListener("submit", e => {
      e.preventDefault();
      store.set($("#orders-key").value.trim());
      refresh();
    });
  }

  const isPaidOnline = o => Number(o.PaidNowGHS) > 0;
  const unverified = o => String(o.Verification).startsWith("UNVERIFIED") || String(o.Verification).startsWith("NOT FOUND") || /UNDERPAID/.test(o.Notes);
  const isOpen = o => !["Delivered", "Balance paid", "Cancelled"].includes(o.Progress);

  const FILTERS = [
    ["all", "All orders", () => true],
    ["open", "To deliver", isOpen],
    ["paid", "Paid online", isPaidOnline],
    ["balance", "Balance due", o => Number(o.BalanceGHS) > 0 && o.Progress !== "Cancelled"],
    ["check", "Needs checking", unverified]
  ];

  function render() {
    const today = new Date().toDateString();
    const live = orders.filter(o => o.Progress !== "Cancelled");
    const stats = {
      all: orders.length,
      open: orders.filter(isOpen).length,
      paid: live.reduce((s, o) => s + (Number(o.PaidNowGHS) || 0), 0),
      balance: live.reduce((s, o) => s + (Number(o.BalanceGHS) || 0), 0),
      check: orders.filter(unverified).length
    };
    const f = FILTERS.find(x => x[0] === filter)[2];
    const q = query.trim().toLowerCase();
    const list = orders.filter(f).filter(o => !q || [o.Reference, o.Customer, o.Phone, o.Product, o.Delivery].join(" ").toLowerCase().includes(q));

    $("#orders-body").innerHTML = `
      <div class="stats">
        ${FILTERS.map(([id, label]) => `
          <button class="stat${id === "check" && stats.check ? " warn" : ""}" data-filter="${id}" aria-pressed="${filter === id}">
            <b>${id === "paid" || id === "balance" ? money(stats[id]) : stats[id]}</b><span>${label}</span>
          </button>`).join("")}
      </div>
      <div class="dash-tools">
        <input type="search" id="orders-search" placeholder="Search name, phone, reference…" value="${esc(query)}" aria-label="Search orders">
        ${sheetUrl ? `<a class="btn btn-ghost" href="${esc(sheetUrl)}" target="_blank" rel="noopener">Open Sheet ↗</a>` : ""}
      </div>
      ${list.length ? `<div class="orders">${list.map(o => card(o, today)).join("")}</div>` :
        `<div class="card center"><p class="muted">${orders.length ? "No orders match." : "No orders yet. They'll appear here as soon as customers check out."}</p></div>`}`;
    $("#orders-search").addEventListener("input", e => { query = e.target.value; renderKeepFocus(); });
  }

  // Re-render but keep the cursor in the search box.
  function renderKeepFocus() {
    const pos = $("#orders-search").selectionStart;
    render();
    const s = $("#orders-search");
    s.focus();
    try { s.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
  }

  function card(o, today) {
    const d = o.Timestamp ? new Date(o.Timestamp) : null;
    const when = d ? (d.toDateString() === today ? "Today " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })) : "";
    const phone = String(o.Phone || "");
    const wa = phone.replace(/\D/g, "").replace(/^0/, "233");
    const v = String(o.Verification || "");
    const vPill = v.startsWith("VERIFIED") ? `<span class="pill ok">Paid · verified</span>`
      : unverified(o) ? `<span class="pill sold">Check payment</span>`
        : isPaidOnline(o) ? `<span class="pill est">Paid</span>`
          : `<span class="pill est">${esc(o.PaymentOption || "Unpaid")}</span>`;
    return `
      <article class="order${unverified(o) ? " flag" : ""}" data-ref="${esc(o.Reference)}">
        <div class="order-top">
          <div>
            <div class="item-name">${esc(o.Customer || "(no name)")} ${vPill}</div>
            <div class="item-meta">${esc(o.Reference)} · ${esc(when)}</div>
          </div>
          <select class="order-progress" aria-label="Order progress">
            ${progressList.map(p => `<option ${p === o.Progress ? "selected" : ""}>${esc(p)}</option>`).join("")}
          </select>
        </div>
        <div class="order-item">${esc(o.Product)}${o.Quantity ? ` × ${esc(o.Quantity)}` : ""}</div>
        <dl class="order-facts">
          <dt>Total</dt><dd>${money(o.TotalGHS)}</dd>
          <dt>Paid online</dt><dd>${money(o.PaidNowGHS)}${o.Method ? ` · ${esc(o.Method)}` : ""}</dd>
          <dt>Balance</dt><dd class="${Number(o.BalanceGHS) > 0 ? "due" : ""}">${money(o.BalanceGHS)}</dd>
          <dt>Payment</dt><dd>${esc(o.PaymentOption)}</dd>
          <dt>Delivery</dt><dd>${esc(o.Delivery)}</dd>
          <dt>Check</dt><dd class="small">${esc(v)}</dd>
          ${o.Notes ? `<dt>Notes</dt><dd class="small">${esc(o.Notes)}</dd>` : ""}
        </dl>
        ${phone ? `<div class="order-actions">
          <a class="btn btn-wa btn-sm" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(`Hello ${String(o.Customer || "").split(" ")[0]}, this is F.A Vision Enterprise about your order ${o.Reference}.`)}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn btn-ghost btn-sm" href="tel:${esc(phone)}">Call</a>
        </div>` : ""}
      </article>`;
  }

  async function setProgress(ref, progress, select) {
    select.disabled = true;
    try {
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "update_order", key: store.get(), reference: ref, progress })
      });
      const o = orders.find(x => x.Reference === ref);
      if (o) { o.Progress = progress; if (progress === "Balance paid") o.BalanceGHS = 0; }
      render();
    } catch (e) {
      select.disabled = false;
      alert("Couldn't save. Check your connection and try again.");
    }
  }

  screen.addEventListener("click", e => {
    const f = e.target.closest("[data-filter]");
    if (f) { filter = f.dataset.filter; render(); }
  });
  screen.addEventListener("change", e => {
    const sel = e.target.closest(".order-progress");
    if (sel) setProgress(sel.closest(".order").dataset.ref, sel.value, sel);
  });
  $("#orders-refresh").addEventListener("click", refresh);
  $("#orders-forget").addEventListener("click", () => { store.set(""); refresh(); });
  document.addEventListener("click", e => {
    if (e.target.closest("[data-orders]")) { e.preventDefault(); open(); }
  });
})();
