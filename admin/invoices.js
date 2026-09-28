// Invoices screen for the admin.
// Lists invoice requests customers send from the website ("Request an invoice"),
// and turns any request (or a blank one) into a numbered invoice with one click:
//   Generate invoice -> opens the finished invoice to print / save as PDF, and,
//   when the backend is connected (backend/README.md), saves the PDF in Google
//   Drive, emails it to the customer and marks the request as sent.
// Works without the backend too: numbering then continues on this device.
(function () {
  const C = window.FAV_CONFIG;
  const INV = window.FAV_INVOICE;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const KEY_STORE = "fav-orders-key"; // same ADMIN_KEY as Orders & payments
  const LOCAL_SEQ = "fav-invoice-seq";
  const safe = {
    get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + (Number(n) || 0)); return x.toISOString().slice(0, 10); };

  let business = null, products = [], endpoint = "", requests = [], next = null, sheetUrl = "", draft = null, filter = "open", lastHtml = "";
  const screen = $("#screen-invoices");

  async function loadSite() {
    if (business) return;
    const [biz, prods] = await Promise.all([
      fetch("../data/business.json", { cache: "no-store" }).then(r => r.json()),
      fetch("../data/products.json", { cache: "no-store" }).then(r => r.json()).catch(() => [])
    ]);
    business = biz;
    products = Array.isArray(prods) ? prods : prods.products || [];
    endpoint = biz.enquiry_endpoint || "";
  }

  function open() {
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s !== screen; });
    window.scrollTo(0, 0);
    if (location.hash !== "#invoices") history.replaceState(null, "", "#invoices");
    refresh();
  }

  async function refresh() {
    const body = $("#inv-body");
    body.innerHTML = `<p class="muted">Loading invoices…</p>`;
    try { await loadSite(); } catch (e) {
      body.innerHTML = `<div class="card"><p class="error">Couldn't read the site settings. Check your connection and tap Refresh.</p></div>`;
      return;
    }
    requests = []; next = null; sheetUrl = "";
    const key = safe.get(KEY_STORE);
    if (endpoint && key) {
      try {
        const res = await fetch(`${endpoint}?action=invoices&key=${encodeURIComponent(key)}`).then(r => r.json());
        if (res.ok) { requests = res.requests || []; next = res.next || null; sheetUrl = res.sheet || ""; }
        else if (res.error === "not allowed") safe.set(KEY_STORE, "");
      } catch (e) { /* offline or backend not updated: still allow manual invoices */ }
    }
    renderList();
  }

  // ---------------------------------------------------------------- list
  const isOpen = r => !r.InvoiceNo;
  function renderList() {
    const connected = !!(endpoint && safe.get(KEY_STORE));
    const list = requests.filter(r => filter === "all" || (filter === "open" ? isOpen(r) : !isOpen(r)));
    $("#inv-body").innerHTML = `
      ${!endpoint ? `<div class="card notice"><b>Backend not connected.</b> You can still make invoices here and save them as PDF. To receive customers' invoice requests, keep numbers in one place and email PDFs automatically, connect the backend (backend/README.md).</div>`
        : !connected ? `<form class="card notice" id="inv-key-form"><b>Enter your admin key</b> to see customers' invoice requests (the same key as Orders &amp; payments).
            <div class="row-inline"><input id="inv-key" type="password" autocomplete="off" placeholder="ADMIN_KEY" required><button class="btn btn-primary btn-sm" type="submit">Connect</button></div></form>` : ""}
      <div class="stats">
        ${[["open", "Waiting for an invoice", requests.filter(isOpen).length], ["done", "Invoiced", requests.filter(r => !isOpen(r)).length], ["all", "All requests", requests.length]]
          .map(([id, label, n]) => `<button class="stat${id === "open" && n ? " warn" : ""}" data-inv-filter="${id}" aria-pressed="${filter === id}"><b>${n}</b><span>${label}</span></button>`).join("")}
      </div>
      <div class="dash-tools">
        <button class="btn btn-sell" data-inv-new>+ New invoice</button>
        ${sheetUrl ? `<a class="btn btn-ghost" href="${esc(sheetUrl)}" target="_blank" rel="noopener">Open Sheet ↗</a>` : ""}
      </div>
      ${list.length ? `<div class="orders">${list.map(reqCard).join("")}</div>`
        : `<div class="card center"><p class="muted">${requests.length ? "Nothing here." : connected ? "No invoice requests yet. They appear here when customers use “Request an invoice” on the website." : "Tap “+ New invoice” to make one now."}</p></div>`}`;
    const kf = $("#inv-key-form");
    if (kf) kf.addEventListener("submit", e => { e.preventDefault(); safe.set(KEY_STORE, $("#inv-key").value.trim()); refresh(); });
  }

  function reqCard(r) {
    const d = r.Timestamp ? new Date(r.Timestamp) : null;
    const when = d ? d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";
    const wa = String(r.Phone || "").replace(/\D/g, "").replace(/^0/, "233");
    return `
      <article class="order${isOpen(r) ? " flag-blue" : ""}" data-req="${esc(r.RequestId)}">
        <div class="order-top">
          <div>
            <div class="item-name">${esc(r.Organisation || r.Customer || "(no name)")} ${isOpen(r) ? `<span class="pill est">${esc(r.Kind || "Request")}</span>` : `<span class="pill ok">${esc(r.InvoiceNo)}</span>`}</div>
            <div class="item-meta">${esc(r.RequestId)} · ${esc(when)}${r.OrderRef ? ` · order ${esc(r.OrderRef)}` : ""}</div>
          </div>
        </div>
        <div class="order-item">${esc(r.Items)}</div>
        <dl class="order-facts">
          ${r.Organisation && r.Customer ? `<dt>Contact</dt><dd>${esc(r.Customer)}</dd>` : ""}
          <dt>Phone</dt><dd>${esc(r.Phone)}</dd>
          ${r.Email ? `<dt>Email</dt><dd>${esc(r.Email)}</dd>` : ""}
          ${r.Address ? `<dt>Address</dt><dd>${esc(r.Address)}</dd>` : ""}
          ${r.TIN || r.PO ? `<dt>TIN / PO</dt><dd>${esc([r.TIN, r.PO].filter(Boolean).join(" / "))}</dd>` : ""}
          ${r.TotalGHS ? `<dt>Total</dt><dd>${C.formatPrice(Number(r.TotalGHS))}</dd>` : ""}
        </dl>
        <div class="order-actions">
          <button class="btn btn-sell btn-sm" data-inv-make="${esc(r.RequestId)}">${isOpen(r) ? "Create invoice" : "New version"}</button>
          ${r.PdfUrl ? `<a class="btn btn-ghost btn-sm" href="${esc(r.PdfUrl)}" target="_blank" rel="noopener">PDF ↗</a>` : ""}
          ${wa ? `<a class="btn btn-wa btn-sm" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(r.PdfUrl ? `Hello ${String(r.Customer || "").split(" ")[0]}, here is your invoice ${r.InvoiceNo} from F.A Vision Enterprise: ${r.PdfUrl}` : `Hello ${String(r.Customer || "").split(" ")[0]}, this is F.A Vision Enterprise about your invoice request ${r.RequestId}.`)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- editor
  function numberFor(kind) {
    if (next && next[kind]) return next[kind];
    const seq = (parseInt(safe.get(LOCAL_SEQ), 10) || 100683) + 1;
    return ({ proforma: "PINV", receipt: "RCT" }[kind] || "INV") + seq;
  }

  // Best guess of the lines from what the customer typed, e.g. "70 student desks (FAV-014)".
  function guessLines(text) {
    const lines = [];
    const ids = String(text || "").match(/FAV-\d{3,}/gi) || [];
    ids.forEach(id => {
      const p = products.find(x => x.id.toUpperCase() === id.toUpperCase());
      if (!p) return;
      const m = String(text).match(/(\d{1,5})\s*(?:x\s*)?(?:sets?|pieces?|pcs|units?|no\.?)?\b[^\d]{0,40}/i);
      lines.push({ description: p.name, note: p.id, qty: m ? Number(m[1]) : 1, unit_price: p.price_ghs || 0, discount_pct: 0 });
    });
    if (!lines.length) lines.push({ description: String(text || "").slice(0, 200), note: "", qty: 1, unit_price: 0, discount_pct: 0 });
    return lines;
  }

  function startDraft(req) {
    const kind = req && /order/i.test(req.Kind) ? "invoice" : "proforma";
    const cfg = (business && business.invoice) || {};
    draft = {
      request_id: req ? req.RequestId : "",
      kind,
      number: numberFor(kind),
      issue_date: today(),
      due_date: addDays(today(), cfg.payment_terms_days || 0),
      po: req ? req.PO : "",
      order_ref: req ? req.OrderRef : "",
      customer: {
        name: req ? req.Customer : "", organisation: req ? req.Organisation : "", phone: req ? req.Phone : "",
        email: req ? req.Email : "", address: req ? req.Address : "", tin: req ? req.TIN : ""
      },
      lines: req ? guessLines(req.Items) : [{ description: "", note: "", qty: 1, unit_price: 0, discount_pct: 0 }],
      taxes: (cfg.taxes || []).map(t => ({ name: t.name, rate: t.rate })),
      deposit_pct: 0,
      amount_paid: 0,
      paid_note: "",
      notes: "",
      email_customer: !!(req && req.Email)
    };
    renderEditor();
  }

  function renderEditor() {
    const d = draft;
    const t = INV.totals(d);
    const connected = !!(endpoint && safe.get(KEY_STORE));
    $("#inv-body").innerHTML = `
      <form class="inv-editor" id="inv-editor" novalidate>
        <div class="card">
          <div class="inv-grid">
            <label class="field"><span>Type</span>
              <select name="kind">${Object.entries(INV.KINDS).map(([k, v]) => `<option value="${k}" ${d.kind === k ? "selected" : ""}>${v.charAt(0) + v.slice(1).toLowerCase()}</option>`).join("")}</select></label>
            <label class="field"><span>Number</span><input name="number" value="${esc(d.number)}" required></label>
            <label class="field"><span>Date</span><input name="issue_date" type="date" value="${esc(d.issue_date)}"></label>
            <label class="field"><span>Due date</span><input name="due_date" type="date" value="${esc(d.due_date)}"></label>
            <label class="field"><span>PO #</span><input name="po" value="${esc(d.po)}"></label>
            <label class="field"><span>Order ref</span><input name="order_ref" value="${esc(d.order_ref)}"></label>
          </div>
        </div>
        <div class="card">
          <h2>Bill to</h2>
          <div class="inv-grid">
            <label class="field"><span>School / company</span><input name="c.organisation" value="${esc(d.customer.organisation)}"></label>
            <label class="field"><span>Contact name</span><input name="c.name" value="${esc(d.customer.name)}"></label>
            <label class="field"><span>Phone</span><input name="c.phone" value="${esc(d.customer.phone)}" inputmode="tel"></label>
            <label class="field"><span>Email</span><input name="c.email" value="${esc(d.customer.email)}" type="email"></label>
            <label class="field"><span>Address</span><input name="c.address" value="${esc(d.customer.address)}"></label>
            <label class="field"><span>Customer TIN</span><input name="c.tin" value="${esc(d.customer.tin)}"></label>
          </div>
        </div>
        <div class="card">
          <h2>Items</h2>
          <div class="inv-lines">
            <div class="inv-line head"><span>Description</span><span>Qty</span><span>Unit price (GH₵)</span><span>Discount %</span><span>Amount</span><span></span></div>
            ${d.lines.map((l, i) => {
              const tl = INV.totals({ lines: [l] }).lines[0];
              return `<div class="inv-line" data-i="${i}">
                <span><input data-l="description" value="${esc(l.description)}" placeholder="Item"><input data-l="note" class="note" value="${esc(l.note)}" placeholder="Note (optional)"></span>
                <input data-l="qty" type="number" min="0" step="any" value="${esc(l.qty)}">
                <input data-l="unit_price" type="number" min="0" step="0.01" value="${esc(l.unit_price)}">
                <input data-l="discount_pct" type="number" min="0" max="100" step="0.01" value="${esc(l.discount_pct)}">
                <b class="amt">${tl ? INV.money(tl.amount) : "–"}</b>
                <button type="button" class="btn btn-ghost btn-sm" data-l-del="${i}" aria-label="Remove line">×</button>
              </div>`;
            }).join("")}
          </div>
          <div class="row-inline wrap">
            <button type="button" class="btn btn-ghost btn-sm" data-l-add>+ Add line</button>
            <select data-l-product aria-label="Add a product"><option value="">+ Add a product…</option>${products.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.price_ghs ? ` · GH₵${p.price_ghs}` : ""}</option>`).join("")}</select>
            <button type="button" class="btn btn-ghost btn-sm" data-l-extra="Transportation">+ Transport</button>
            <button type="button" class="btn btn-ghost btn-sm" data-l-extra="Fixing / installation">+ Fixing</button>
          </div>
        </div>
        <div class="card">
          <div class="inv-grid">
            <label class="field"><span>Deposit required %</span><input name="deposit_pct" type="number" min="0" max="100" value="${esc(d.deposit_pct)}"></label>
            <label class="field"><span>Already paid (GH₵)</span><input name="amount_paid" type="number" min="0" step="0.01" value="${esc(d.amount_paid)}"></label>
            <label class="field"><span>Paid by</span><input name="paid_note" value="${esc(d.paid_note)}" placeholder="e.g. MoMo 12 Sep"></label>
          </div>
          <div class="inv-taxes">
            ${d.taxes.map((x, i) => `<div class="row-inline" data-t="${i}"><input data-t="name" value="${esc(x.name)}" placeholder="Tax name (e.g. VAT)"><input data-t="rate" type="number" step="0.01" value="${esc(x.rate)}" placeholder="%"><button type="button" class="btn btn-ghost btn-sm" data-t-del="${i}">×</button></div>`).join("")}
            <button type="button" class="btn btn-ghost btn-sm" data-t-add>+ Add tax / levy</button>
          </div>
          <label class="field"><span>Notes on the invoice</span><textarea name="notes" rows="2" placeholder="e.g. Delivery within 7 days of deposit">${esc(d.notes)}</textarea></label>
        </div>
        <div class="card inv-summary">
          <dl class="order-facts">
            <dt>Subtotal</dt><dd>${INV.money(t.gross)}</dd>
            ${t.discount ? `<dt>Discount</dt><dd>-${INV.money(t.discount)}</dd>` : ""}
            ${t.taxes.map(x => `<dt>${esc(x.name)} (${x.rate}%)</dt><dd>${INV.money(x.amount)}</dd>`).join("")}
            <dt><b>Total</b></dt><dd><b>${INV.money(t.total)}</b></dd>
            ${t.paid ? `<dt>Paid</dt><dd>-${INV.money(t.paid)}</dd><dt><b>Balance</b></dt><dd class="due"><b>${INV.money(t.balance)}</b></dd>` : ""}
          </dl>
          <p class="muted small">${esc(INV.amountInWords(t.total))}</p>
          ${connected ? `<label class="check"><input type="checkbox" name="email_customer" ${d.email_customer ? "checked" : ""}> Email the PDF to the customer</label>` : ""}
          <p class="error" id="inv-error" hidden></p>
          <div class="row-inline wrap">
            <button type="button" class="btn btn-ghost" data-go-list>← Back</button>
            <button type="button" class="btn btn-ghost" data-inv-preview>Preview</button>
            <button type="submit" class="btn btn-sell btn-lg">Generate invoice</button>
          </div>
          <div id="inv-result"></div>
        </div>
      </form>`;
  }

  // Keep the draft in step with the form without re-rendering (so typing isn't interrupted).
  function readForm() {
    const f = $("#inv-editor");
    if (!f) return;
    const val = n => f.elements[n] ? f.elements[n].value : "";
    ["kind", "number", "issue_date", "due_date", "po", "order_ref", "notes", "paid_note"].forEach(k => { draft[k] = val(k); });
    draft.deposit_pct = Number(val("deposit_pct")) || 0;
    draft.amount_paid = Number(val("amount_paid")) || 0;
    ["name", "organisation", "phone", "email", "address", "tin"].forEach(k => { draft.customer[k] = val("c." + k); });
    f.querySelectorAll(".inv-line[data-i]").forEach(row => {
      const l = draft.lines[row.dataset.i];
      row.querySelectorAll("[data-l]").forEach(inp => { l[inp.dataset.l] = inp.type === "number" ? Number(inp.value) || 0 : inp.value; });
    });
    f.querySelectorAll(".inv-taxes [data-t]").forEach(row => {
      if (!row.matches(".row-inline")) return;
      const x = draft.taxes[row.dataset.t];
      x.name = row.querySelector('[data-t="name"]').value;
      x.rate = Number(row.querySelector('[data-t="rate"]').value) || 0;
    });
    const em = f.elements.email_customer;
    draft.email_customer = em ? em.checked : false;
  }

  function refreshTotals() {
    const f = $("#inv-editor");
    f.querySelectorAll(".inv-line[data-i]").forEach(row => {
      const tl = INV.totals({ lines: [draft.lines[row.dataset.i]] }).lines[0];
      row.querySelector(".amt").textContent = tl ? INV.money(tl.amount) : "–";
    });
    const t = INV.totals(draft);
    f.querySelector(".inv-summary .order-facts").innerHTML = `
      <dt>Subtotal</dt><dd>${INV.money(t.gross)}</dd>
      ${t.discount ? `<dt>Discount</dt><dd>-${INV.money(t.discount)}</dd>` : ""}
      ${t.taxes.map(x => `<dt>${esc(x.name)} (${x.rate}%)</dt><dd>${INV.money(x.amount)}</dd>`).join("")}
      <dt><b>Total</b></dt><dd><b>${INV.money(t.total)}</b></dd>
      ${t.paid ? `<dt>Paid</dt><dd>-${INV.money(t.paid)}</dd><dt><b>Balance</b></dt><dd class="due"><b>${INV.money(t.balance)}</b></dd>` : ""}`;
    f.querySelector(".inv-summary > .muted").textContent = INV.amountInWords(t.total);
  }

  function problem() {
    const t = INV.totals(draft);
    if (!draft.number.trim()) return "Give the invoice a number.";
    if (!draft.customer.name.trim() && !draft.customer.organisation.trim()) return "Who is the invoice for? Add a name or organisation.";
    if (!t.lines.length || !t.lines.some(l => l.description.trim())) return "Add at least one item.";
    if (t.lines.some(l => l.amount < 0)) return "A line has a negative amount. Check the discount.";
    if (draft.email_customer && !/^\S+@\S+\.\S+$/.test(draft.customer.email)) return "Add the customer's email address, or untick “Email the PDF”.";
    return "";
  }

  function openPreview(html, win) {
    const w = win || window.open("", "_blank");
    if (!w) { alert("Allow pop-ups for this site to see the invoice."); return null; }
    const bar = `<div class="no-print" style="position:sticky;top:0;background:#0d55af;color:#fff;padding:10px 16px;font:600 14px Helvetica,Arial,sans-serif;display:flex;gap:12px;align-items:center;justify-content:center">
      <span>Save this invoice as a PDF or print it</span>
      <button onclick="window.print()" style="font:600 14px Helvetica,Arial,sans-serif;background:#fff;color:#0d55af;border:0;border-radius:8px;padding:8px 14px;cursor:pointer">Print / Save as PDF</button></div>`;
    w.document.open();
    w.document.write(html.replace(/(<body[^>]*>)/, `$1${bar}`));
    w.document.close();
    return w;
  }

  async function generate() {
    readForm();
    const err = $("#inv-error");
    const p = problem();
    err.hidden = !p;
    err.textContent = p;
    if (p) return;
    const win = window.open("", "_blank"); // open now, before any waiting, so pop-up blockers allow it
    const html = INV.render(draft, business);
    const t = INV.totals(draft);
    const res = $("#inv-result");
    const btn = $("#inv-editor").querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Generating…";

    let number = draft.number, url = "", saved = false, note = "";
    const key = safe.get(KEY_STORE);
    if (endpoint && key) {
      const payload = JSON.stringify({
        action: "save_invoice", key, request_id: draft.request_id, email_customer: draft.email_customer, html,
        invoice: {
          number: draft.number, kind_label: (INV.KINDS[draft.kind] || "INVOICE").replace(/(^|\s)(\w)(\w*)/g, (m, s, a, b) => s + a + b.toLowerCase()),
          issue_date: draft.issue_date, order_ref: draft.order_ref, po: draft.po, customer_name: draft.customer.name || draft.customer.organisation,
          organisation: draft.customer.organisation, phone: draft.customer.phone, email: draft.customer.email, address: draft.customer.address,
          tin: draft.customer.tin, total: t.total, balance: t.paid ? t.balance : t.total
        }
      });
      try {
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: payload }).then(x => x.json());
        if (r.ok) { saved = true; number = r.number || number; url = r.url || ""; }
        else note = r.error === "not allowed" ? "The admin key didn't work, so it wasn't saved to the backend." : "The backend couldn't save it (" + (r.error || "error") + ").";
      } catch (e) {
        // The response can't always be read from the browser; send it anyway.
        try {
          await fetch(endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: payload });
          saved = true;
          note = "Sent to the backend. The PDF link will show in the list and in the Sheet in a moment.";
        } catch (e2) { note = "Couldn't reach the backend. Save the PDF from the invoice window instead."; }
      }
    }
    const finalHtml = number !== draft.number ? html.split(draft.number).join(number) : html;
    openPreview(finalHtml, win);

    const seq = parseInt(String(number).replace(/\D/g, ""), 10);
    if (seq > (parseInt(safe.get(LOCAL_SEQ), 10) || 0)) safe.set(LOCAL_SEQ, String(seq));
    if (next) next = null; // fetch fresh numbers next time

    const wa = String(draft.customer.phone || "").replace(/\D/g, "").replace(/^0/, "233");
    const first = String(draft.customer.name || draft.customer.organisation || "").split(" ")[0];
    const waText = `Hello ${first}, here is your ${(INV.KINDS[draft.kind] || "invoice").toLowerCase()} ${number} from F.A Vision Enterprise for ${INV.money(t.total)}.` + (url ? `\n${url}` : "\n(PDF attached)");
    res.innerHTML = `
      <div class="inv-ok">
        <b>${esc(number)} is ready.</b>
        ${saved ? (url ? ` Saved to Google Drive${draft.email_customer ? " and emailed to " + esc(draft.customer.email) : ""}.` : "") : " Use “Print / Save as PDF” in the invoice window to keep a copy."}
        ${note ? `<p class="muted small">${esc(note)}</p>` : ""}
        <div class="row-inline wrap">
          ${url ? `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Open PDF ↗</a>` : ""}
          <button type="button" class="btn btn-ghost btn-sm" data-inv-reopen>Show invoice again</button>
          ${wa ? `<a class="btn btn-wa btn-sm" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener">Send on WhatsApp</a>` : ""}
          <button type="button" class="btn btn-ghost btn-sm" data-go-list>Back to invoices</button>
        </div>
      </div>`;
    lastHtml = finalHtml;
    btn.disabled = false;
    btn.textContent = "Generate again";
    draft.number = number;
  }

  // ---------------------------------------------------------------- events
  screen.addEventListener("click", e => {
    const t = e.target;
    const f = t.closest("[data-inv-filter]");
    if (f) { filter = f.dataset.invFilter; return renderList(); }
    if (t.closest("[data-inv-new]")) return startDraft(null);
    const mk = t.closest("[data-inv-make]");
    if (mk) return startDraft(requests.find(r => r.RequestId === mk.dataset.invMake));
    if (t.closest("[data-go-list]")) { draft = null; return refresh(); }
    if (!draft) return;
    if (t.closest("[data-l-add]")) { readForm(); draft.lines.push({ description: "", note: "", qty: 1, unit_price: 0, discount_pct: 0 }); return renderEditor(); }
    const ex = t.closest("[data-l-extra]");
    if (ex) { readForm(); draft.lines.push({ description: ex.dataset.lExtra, note: "", qty: 1, unit_price: 0, discount_pct: 0 }); return renderEditor(); }
    const del = t.closest("[data-l-del]");
    if (del) { readForm(); draft.lines.splice(Number(del.dataset.lDel), 1); if (!draft.lines.length) draft.lines.push({ description: "", note: "", qty: 1, unit_price: 0, discount_pct: 0 }); return renderEditor(); }
    if (t.closest("[data-t-add]")) { readForm(); draft.taxes.push({ name: "", rate: 0 }); return renderEditor(); }
    const td = t.closest("[data-t-del]");
    if (td) { readForm(); draft.taxes.splice(Number(td.dataset.tDel), 1); return renderEditor(); }
    if (t.closest("[data-inv-preview]")) { readForm(); return openPreview(INV.render(draft, business)); }
    if (t.closest("[data-inv-reopen]")) return openPreview(lastHtml);
  });
  screen.addEventListener("input", e => {
    if (!draft || !e.target.closest("#inv-editor")) return;
    readForm();
    refreshTotals();
  });
  screen.addEventListener("change", e => {
    if (!draft) return;
    const sel = e.target.closest("[data-l-product]");
    if (sel && sel.value) {
      readForm();
      const p = products.find(x => x.id === sel.value);
      const blank = draft.lines.findIndex(l => !l.description && !Number(l.unit_price));
      const line = { description: p.name, note: p.id, qty: 1, unit_price: p.price_ghs || 0, discount_pct: 0 };
      if (blank >= 0) draft.lines[blank] = line; else draft.lines.push(line);
      return renderEditor();
    }
    if (e.target.name === "kind") {
      readForm();
      // Suggest the matching number prefix (PINV for proforma, INV for invoices).
      const n = String(draft.number).match(/\d+$/);
      draft.number = (({ proforma: "PINV", receipt: "RCT" }[draft.kind]) || "INV") + (n ? n[0] : "");
      renderEditor();
    }
  });
  screen.addEventListener("submit", e => {
    if (e.target.id === "inv-editor") { e.preventDefault(); generate(); }
  });
  $("#inv-refresh").addEventListener("click", () => { draft = null; refresh(); });
  $("#inv-forget").addEventListener("click", () => { safe.set(KEY_STORE, ""); draft = null; refresh(); });
  document.addEventListener("click", e => {
    if (e.target.closest("[data-invoices]")) { e.preventDefault(); open(); }
  });
  window.FAV_ADMIN_INVOICES = { open };
})();
