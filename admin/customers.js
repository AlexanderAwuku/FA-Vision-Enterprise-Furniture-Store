// Customers (CRM) screen for the admin.
// One card per customer, joined from the backend Sheet's Enquiries, Orders and
// Invoices tabs by phone number. Move enquiries along (New → Contacted → Quoted →
// Won / Lost), add a note, set a follow-up date, and answer on WhatsApp with a
// ready-made reply. Uses the same admin key as the Orders screen.
(function () {
  const C = window.FAV_CONFIG;
  const esc = C.escapeHtml;
  const money = n => C.formatPrice(Math.round((Number(n) || 0) * 100) / 100);
  const $ = s => document.querySelector(s);
  const KEY_STORE = "fav-orders-key"; // shared with orders.js
  const store = {
    get() { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } },
    set(v) { try { v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE); } catch (e) { /* private mode */ } }
  };
  const screen = $("#screen-customers");
  if (!screen) return;

  let endpoint = "", business = {}, customers = [], statuses = [], anonWa = 0, sheetUrl = "", filter = "action", query = "";

  const today = () => new Date().toISOString().slice(0, 10);
  const first = name => String(name || "").trim().split(/\s+/)[0] || "there";
  const waNumber = phone => String(phone || "").replace(/\D/g, "").replace(/^0/, "233");
  const closed = e => ["Won", "Lost"].includes(e.status);
  const dueFollowUp = c => c.enquiries.some(e => e.followUp && String(e.followUp).slice(0, 10) <= today() && !closed(e));
  const needsAction = c => c.enquiries.some(e => e.status === "New") || dueFollowUp(c) || c.balanceGHS > 0;

  // Ready-made WhatsApp replies. {name}, {product}, {balance}, {site}, {address} are filled in.
  const REPLIES = [
    ["hello", "Say hello", "Hello {name}, thank you for contacting F.A Vision Enterprise. How can we help you today?"],
    ["quote", "Send a price", "Hello {name}, thank you for your interest in the {product}. The price is GH₵___ each, and we give bulk prices for schools, offices and churches. You can see photos and order here: {site}"],
    ["photos", "Share photos", "Hello {name}, here are the photos and full details of the {product}: {site}. Tell me the quantity and your location and I'll confirm the total with delivery."],
    ["pay", "How to pay", "Hello {name}, you can pay in full, pay 50% now and the rest on delivery, pay on delivery within Accra, or walk in and pay at our showroom ({address}). MoMo and card are accepted."],
    ["delivery", "Delivery update", "Hello {name}, your {product} is ready and we will deliver on ____. Please confirm the delivery address and a phone number to call on arrival."],
    ["balance", "Balance reminder", "Hello {name}, a friendly reminder that a balance of {balance} is outstanding on your order. You can pay by MoMo or when we deliver. Thank you!"],
    ["thanks", "Thank you", "Hello {name}, thank you for buying from F.A Vision Enterprise! We hope you enjoy your {product}. Please recommend us to friends, and send us a photo of it in place 🙏"],
    ["followup", "Follow up", "Hello {name}, just checking in about the {product} you asked about. Are you still interested? We can hold the current price for you this week."]
  ];

  async function loadSettings() {
    if (endpoint) return;
    business = await fetch("../data/business.json", { cache: "no-store" }).then(r => r.json());
    endpoint = business.enquiry_endpoint || "";
  }

  function open() {
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s !== screen; });
    const top = $("#top-actions"); if (top) top.hidden = false;
    window.scrollTo(0, 0);
    if (location.hash !== "#customers") history.replaceState(null, "", "#customers");
    refresh();
  }

  async function refresh() {
    const body = $("#cust-body");
    body.innerHTML = `<p class="muted">Loading customers…</p>`;
    try { await loadSettings(); } catch (e) {
      body.innerHTML = `<div class="card"><p class="error">Couldn't read the site settings. Check your connection and tap Refresh.</p></div>`;
      return;
    }
    if (!endpoint) {
      body.innerHTML = `<div class="card narrow"><h2>Connect the backend first</h2><p class="muted">Customers come from your Google Sheet backend. Follow <b>backend/README.md</b>, then come back.</p></div>`;
      return;
    }
    const key = store.get();
    if (!key) return renderKey();
    try {
      const res = await fetch(`${endpoint}?action=customers&key=${encodeURIComponent(key)}`).then(r => r.json());
      if (!res.ok) {
        if (res.error === "not allowed") { store.set(""); return renderKey("That admin key didn't work. Paste it again."); }
        throw new Error(res.error || "error");
      }
      if (!res.customers) {
        body.innerHTML = `<div class="card narrow"><h2>Update the backend to turn on Customers</h2>
          <p class="muted">Your Apps Script is still running the older version. Paste the new <b>backend/apps-script/Code.gs</b> into Apps Script, then <b>Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy</b>. The web app URL stays the same.</p></div>`;
        return;
      }
      customers = res.customers;
      statuses = res.statuses || ["New", "Contacted", "Quoted", "Won", "Lost"];
      anonWa = res.anonymousWhatsApp || 0;
      sheetUrl = res.sheet || "";
      render();
    } catch (e) {
      body.innerHTML = `<div class="card"><p class="error">Couldn't load customers from the backend. Check your connection and tap Refresh.</p></div>`;
    }
  }

  function renderKey(msg) {
    $("#cust-body").innerHTML = `
      <div class="card narrow">
        <h2>Enter your admin key</h2>
        <p class="muted">It's the same key as the Orders screen: Apps Script → <b>Project Settings → Script properties → ADMIN_KEY</b>.</p>
        <form id="cust-key-form" class="stack">
          <label class="field"><span>Admin key</span><input id="cust-key" type="password" autocomplete="off" required></label>
          ${msg ? `<p class="error">${esc(msg)}</p>` : ""}
          <button class="btn btn-primary btn-block" type="submit">Show customers</button>
        </form>
      </div>`;
    $("#cust-key-form").addEventListener("submit", e => { e.preventDefault(); store.set($("#cust-key").value.trim()); refresh(); });
  }

  const FILTERS = [
    ["action", "Need action", needsAction],
    ["new", "New enquiries", c => c.enquiries.some(e => e.status === "New")],
    ["followup", "Follow up due", dueFollowUp],
    ["buyers", "Bought", c => c.orders.length > 0],
    ["repeat", "Repeat buyers", c => c.orders.filter(o => o.progress !== "Cancelled").length > 1],
    ["all", "Everyone", () => true]
  ];

  function render() {
    const f = FILTERS.find(x => x[0] === filter)[2];
    const q = query.trim().toLowerCase();
    const list = customers.filter(f).filter(c => !q || [c.name, c.organisation, c.phone, c.email,
      ...c.enquiries.map(e => e.product), ...c.orders.map(o => o.product + " " + o.ref)].join(" ").toLowerCase().includes(q));
    $("#cust-body").innerHTML = `
      <div class="stats">
        ${FILTERS.map(([id, label, fn]) => `
          <button class="stat${id === "followup" && customers.some(dueFollowUp) ? " warn" : ""}" data-cfilter="${id}" aria-pressed="${filter === id}">
            <b>${customers.filter(fn).length}</b><span>${label}</span>
          </button>`).join("")}
      </div>
      ${anonWa ? `<p class="muted small">💬 ${anonWa} WhatsApp chat${anonWa > 1 ? "s were" : " was"} opened from the website. Those customers are in your WhatsApp, not here, until they order or send an enquiry.</p>` : ""}
      <div class="dash-tools">
        <input type="search" id="cust-search" placeholder="Search name, phone, product…" value="${esc(query)}" aria-label="Search customers">
        ${sheetUrl ? `<a class="btn btn-ghost" href="${esc(sheetUrl)}" target="_blank" rel="noopener">Open Sheet ↗</a>` : ""}
      </div>
      ${list.length ? `<div class="orders">${list.map(card).join("")}</div>` :
        `<div class="card center"><p class="muted">${customers.length ? "Nobody here right now." : "No customers yet. Enquiries, orders and invoice requests from the website will appear here."}</p></div>`}`;
    $("#cust-search").addEventListener("input", e => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const s = $("#cust-search"); s.focus();
      try { s.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
    });
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  }

  function card(c) {
    const idx = customers.indexOf(c);
    const wa = waNumber(c.phone);
    const latest = c.enquiries[c.enquiries.length - 1];
    const product = (latest && latest.product) || (c.orders[c.orders.length - 1] || {}).product || "furniture";
    const tags = [
      c.enquiries.some(e => e.status === "New") ? `<span class="pill sold">New enquiry</span>` : "",
      dueFollowUp(c) ? `<span class="pill sold">Follow up</span>` : "",
      c.balanceGHS > 0 ? `<span class="pill est">Owes ${money(c.balanceGHS)}</span>` : "",
      c.orders.length > 1 ? `<span class="pill ok">Repeat buyer</span>` : ""
    ].join(" ");
    return `
      <article class="order${needsAction(c) ? " flag" : ""}" data-idx="${idx}">
        <div class="order-top">
          <div>
            <div class="item-name">${esc(c.name || "(no name)")} ${tags}</div>
            <div class="item-meta">${esc([c.organisation, c.phone, c.email].filter(Boolean).join(" · "))}</div>
            <div class="item-meta">Last contact ${esc(fmtDate(c.last))} · via ${esc(c.sources.join(", ") || "website")}</div>
          </div>
        </div>
        <dl class="order-facts">
          <dt>Orders</dt><dd>${c.orders.length}${c.orders.length ? ` · ${money(c.spentGHS)} spent` : ""}</dd>
          <dt>Balance</dt><dd class="${c.balanceGHS > 0 ? "due" : ""}">${money(c.balanceGHS)}</dd>
          ${c.invoices.length ? `<dt>Invoices</dt><dd class="small">${c.invoices.map(v => /^https:\/\//.test(v.pdf || "") ? `<a href="${esc(v.pdf)}" target="_blank" rel="noopener">${esc(v.no)}</a>` : esc(v.no)).join(", ")}</dd>` : ""}
        </dl>
        ${c.enquiries.slice(-3).reverse().map(enquiryRow).join("")}
        ${c.orders.length ? `<details class="small"><summary>Order history (${c.orders.length})</summary><ul>${c.orders.slice().reverse().map(o =>
          `<li>${esc(fmtDate(o.when))} · ${esc(o.ref)} · ${esc(o.product)}${o.quantity ? ` × ${esc(o.quantity)}` : ""} · ${money(o.total)} · ${esc(o.progress || "")}</li>`).join("")}</ul></details>` : ""}
        ${wa.length >= 12 ? `<div class="order-actions">
          <select class="cust-reply" aria-label="WhatsApp reply" data-product="${esc(product)}">
            <option value="">WhatsApp reply…</option>
            ${REPLIES.map(r => `<option value="${r[0]}">${esc(r[1])}</option>`).join("")}
          </select>
          <a class="btn btn-wa btn-sm" data-wa href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(fill(REPLIES[0][2], c, product))}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn btn-ghost btn-sm" href="tel:${esc(c.phone)}">Call</a>
        </div>` : ""}
      </article>`;
  }

  function enquiryRow(e) {
    return `
      <div class="enq" data-row="${esc(e.row)}">
        <div class="small"><b>${esc(e.product || "Enquiry")}</b>${e.quantity ? ` × ${esc(e.quantity)}` : ""} · ${esc(fmtDate(e.when))}${e.source ? ` · ${esc(e.source)}` : ""}</div>
        ${e.message ? `<div class="small muted">“${esc(String(e.message).slice(0, 240))}”</div>` : ""}
        ${e.notes ? `<div class="small">📝 ${esc(e.notes)}</div>` : ""}
        <div class="enq-tools">
          <select class="enq-status" aria-label="Enquiry status">${statuses.map(s => `<option ${s === e.status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
          <label class="small">Follow up <input type="date" class="enq-follow" value="${esc(String(e.followUp || "").slice(0, 10))}"></label>
          <button class="btn btn-ghost btn-sm enq-note" type="button">+ Note</button>
        </div>
      </div>`;
  }

  function fill(tpl, c, product) {
    return tpl.replace(/\{name\}/g, first(c.name)).replace(/\{product\}/g, product || "furniture")
      .replace(/\{balance\}/g, money(c.balanceGHS)).replace(/\{site\}/g, business.website || "https://favisionenterprize.github.io/")
      .replace(/\{address\}/g, business.address || "Tarazzo Road, opposite Pacific, Odorkor");
  }

  // The enquiry object behind a row, so the screen updates at once.
  function enquiryOf(el) {
    const c = customers[Number(el.closest(".order").dataset.idx)];
    const row = Number(el.closest(".enq").dataset.row);
    return c && c.enquiries.find(e => Number(e.row) === row);
  }

  async function save(payload) {
    await fetch(endpoint, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action: "update_enquiry", key: store.get() }, payload))
    });
  }

  screen.addEventListener("click", async e => {
    const f = e.target.closest("[data-cfilter]");
    if (f) { filter = f.dataset.cfilter; render(); return; }
    const n = e.target.closest(".enq-note");
    if (!n) return;
    const note = prompt("Add a note to this enquiry (e.g. 'Sent price, wants 20 sets for January'):");
    if (!note) return;
    const enq = enquiryOf(n);
    n.disabled = true;
    try {
      await save({ row: enq.row, note });
      enq.notes = [enq.notes, new Date().toLocaleDateString([], { day: "numeric", month: "short" }) + ": " + note].filter(Boolean).join(" | ");
      render();
    } catch (err) { n.disabled = false; alert("Couldn't save. Check your connection and try again."); }
  });

  screen.addEventListener("change", async e => {
    const r = e.target.closest(".cust-reply");
    if (r) {
      const c = customers[Number(r.closest(".order").dataset.idx)];
      const tpl = (REPLIES.find(x => x[0] === r.value) || REPLIES[0])[2];
      const a = r.parentElement.querySelector("[data-wa]");
      a.href = `https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(fill(tpl, c, r.dataset.product))}`;
      a.textContent = r.value ? "Send on WhatsApp" : "WhatsApp";
      return;
    }
    const s = e.target.closest(".enq-status");
    const d = e.target.closest(".enq-follow");
    if (!s && !d) return;
    const el = s || d;
    const enq = enquiryOf(el);
    el.disabled = true;
    try {
      if (s) { await save({ row: enq.row, status: s.value }); enq.status = s.value; }
      else { await save({ row: enq.row, followUp: d.value }); enq.followUp = d.value; }
      render();
    } catch (err) { el.disabled = false; alert("Couldn't save. Check your connection and try again."); }
  });

  $("#cust-refresh").addEventListener("click", refresh);
  document.addEventListener("click", e => {
    if (e.target.closest("[data-customers]")) { e.preventDefault(); open(); }
  });
})();
