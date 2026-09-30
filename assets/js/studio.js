// AI Studio (/studio/): the free furniture planner and paid AI services.
//
// Services, options and prices live in data/services.json. Ordering a service
// opens a short brief, then the shared checkout (assets/js/checkout.js) in
// service mode, so MoMo / card / deposit / pay-when-ready work exactly like
// furniture orders. The brief is also logged in the backend's Enquiries tab
// (with an SMS alert) under the order reference, and included in the customer's
// WhatsApp message.
(function () {
  const C = window.FAV_CONFIG;
  const { business, products } = window.FAV_DATA;
  const CO = window.FAV_CHECKOUT;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const WA = business.whatsapp.replace(/\D/g, "");
  const waLink = msg => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  const money = n => C.formatPrice(Math.round(n));
  const img = src => (!src || /^(https?:|\/|data:)/.test(src) ? src : "../" + src);
  const icon = (path, size) => `<svg viewBox="0 0 24 24" width="${size || 24}" height="${size || 24}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${esc(path)}"/></svg>`;

  // ---------- static bits ----------
  document.querySelectorAll(".js-wa").forEach(a => {
    a.href = waLink(a.dataset.msg || "Hello F.A Vision!");
    a.target = "_blank";
    a.rel = "noopener";
  });
  $("#year").textContent = new Date().getFullYear();
  $("#pay-ways").innerHTML = CO.badges();
  const toggle = $("#nav-toggle"), links = $("#nav-links");
  toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", String(links.classList.toggle("open"))));
  links.addEventListener("click", e => {
    if (e.target.tagName === "A") { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });

  function post(body) {
    if (!business.enquiry_endpoint) return;
    fetch(business.enquiry_endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  // ---------- free planner ----------
  // brief: the matching "Which room?" choice in the AI Room Makeover brief.
  const ROOMS = {
    living: { label: "Living room", brief: "Living room", icon: "sofa", budgets: [8000, 20000, 35000],
      want: [{ label: "Sofa", types: ["Sectional Sofa", "Sofa"] }, { label: "Centre table", types: ["Centre Table"] },
        { label: "TV stand", types: ["TV Stand"] }, { label: "Armchair", types: ["Armchair"] }, { label: "Shoe rack", types: ["Shoe Rack"] }] },
    bedroom: { label: "Bedroom", brief: "Bedroom", icon: "bed", budgets: [5000, 12000, 25000],
      want: [{ label: "Bed", types: ["Bed Frame"] }, { label: "Mattress", types: ["Mattress"] }, { label: "Wardrobe", types: ["Wardrobe"] },
        { label: "Dressing table", types: ["Dressing Mirror"] }, { label: "Bedside table", types: ["Bedside Table"] }] },
    dining: { label: "Dining", brief: "Dining", icon: "dining", budgets: [5000, 12000, 25000], people: true,
      want: [{ label: "Dining set (6 seats)", types: ["Dining Set"], seats: 6 }] },
    office: { label: "Office", brief: "Shop / office", icon: "office", budgets: [5000, 15000, 50000], people: true,
      want: [{ label: "Desk", types: ["Office Desk"], each: true }, { label: "Chair", types: ["Office Chair"], each: true },
        { label: "Shelf or cabinet", types: ["Bookshelf", "Filing Cabinet"] }] },
    school: { label: "Classroom", brief: "Other", icon: "school", budgets: [10000, 26000, 65000], people: true,
      want: [{ label: "Student desk & chair", types: ["Classroom Desk", "Student Chair"], each: true }, { label: "Teacher's table", types: ["Teacher's Table"] }] }
  };
  const TIPS = {
    small: ["Choose pieces on legs so more floor shows. The room reads bigger.", "Put a mirror opposite the window to double the light.", "Go for storage that climbs: tall wardrobes and wall shelves free the floor."],
    medium: ["Leave about 90 cm (a big step) for walkways between pieces.", "Anchor the sitting area with a rug or centre table so it feels planned.", "Repeat one colour on two things (sofa and curtains, say) to tie the room together."],
    large: ["Split the space into zones: sitting, working, storage.", "In classrooms, leave a 1 m aisle every two rows so the teacher can reach every desk.", "Buy in one batch so finishes match; bulk orders get wholesale prices."]
  };

  let room = "living";
  const buyable = p => p.in_stock && p.price_ghs && !p.placeholder;

  function renderRooms() {
    $("#room-picks").innerHTML = Object.entries(ROOMS).map(([id, r]) =>
      `<button type="button" class="room-pick" data-room="${id}" aria-pressed="${id === room}">${C.iconSvg(C.ICONS[r.icon], 26)}<span>${esc(r.label)}</span></button>`).join("");
    $("#budget-quick").innerHTML = ROOMS[room].budgets.map(b => `<button type="button" data-budget="${b}">${money(b)}</button>`).join("");
    $("#pl-people-wrap").hidden = !ROOMS[room].people;
  }

  function plan() {
    const r = ROOMS[room];
    const budget = Math.max(0, Number($("#pl-budget").value) || 0);
    const people = r.people ? Math.max(1, Math.min(2000, parseInt($("#pl-people").value, 10) || 1)) : 1;
    let left = budget;
    const lines = [];
    r.want.forEach(w => {
      const qty = w.each ? people : w.seats ? Math.ceil(people / w.seats) : 1;
      const cands = products.filter(p => buyable(p) && w.types.includes(p.type)).sort((a, b) => b.price_ghs - a.price_ghs);
      if (!cands.length) return lines.push({ w, qty, missing: true });
      // The best piece that still fits what's left; otherwise the cheapest, flagged.
      const fit = cands.find(p => p.price_ghs * qty <= left);
      const p = fit || cands[cands.length - 1];
      const sub = p.price_ghs * qty;
      if (fit) left -= sub;
      lines.push({ w, qty, p, sub, over: !fit });
    });
    const total = lines.filter(l => l.p && !l.over).reduce((s, l) => s + l.sub, 0);
    const pct = budget ? Math.min(100, Math.round(total / budget * 100)) : 0;
    const size = $("#pl-size").value;

    const waList = `Hello F.A Vision, I used your free planner for my ${r.label.toLowerCase()} (budget ${money(budget)}${r.people ? `, ${people} people` : ""}).\n` +
      lines.map(l => l.p ? `- ${l.p.name} (${l.p.id}) × ${l.qty} = ${money(l.sub)}${l.over ? " (over budget)" : ""}` : `- ${l.w.label}${l.qty > 1 ? ` × ${l.qty}` : ""}: please quote`).join("\n") +
      `\nPlanned total: ${money(total)}. Please confirm availability.`;

    $("#planner-out").innerHTML = `
      <div class="pl-sum">
        <div><span>Planned</span><strong>${money(total)}</strong></div>
        <div><span>Budget</span><strong>${money(budget)}</strong></div>
        <div><span>Left over</span><strong class="ok">${money(budget - total)}</strong></div>
      </div>
      <div class="pl-bar" role="img" aria-label="${pct}% of budget used"><span style="width:${pct}%"></span></div>
      <ul class="pl-lines">
        ${lines.map((l, i) => l.missing ? `
          <li class="pl-line missing">
            <span class="pl-thumb">${C.iconSvg(C.ICONS.custom, 22)}</span>
            <span class="pl-info"><strong>${esc(l.w.label)}${l.qty > 1 ? ` × ${l.qty}` : ""}</strong><small>Not on the website yet. We can source it or have it made for you.</small></span>
            <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(`Hello F.A Vision, please quote ${l.w.label}${l.qty > 1 ? ` × ${l.qty}` : ""} for my ${r.label.toLowerCase()}.`)}">Get a quote</a>
          </li>` : `
          <li class="pl-line${l.over ? " over" : ""}">
            <span class="pl-thumb">${l.p.images && l.p.images[0] ? `<img src="${esc(img(l.p.images[0]))}" alt="" loading="lazy">` : C.iconSvg(C.categoryIcon(l.p), 22)}</span>
            <span class="pl-info"><strong>${esc(l.p.name)}</strong><small>${l.qty} × ${money(l.p.price_ghs)} = <b>${money(l.sub)}</b>${l.over ? (l.w.each && Math.floor(budget / l.p.price_ghs) > 0 ? ` · over budget; ${money(budget)} covers ${Math.floor(budget / l.p.price_ghs)}` : " · over your budget, not counted") : ""}</small></span>
            <button type="button" class="btn ${l.over ? "btn-ghost" : "btn-gold"} btn-sm" data-buy="${i}">Buy</button>
          </li>`).join("")}
      </ul>
      ${room === "school" && people >= 50 ? `<p class="pl-note">Ordering ${people} sets? Bulk prices apply from 50 sets. Our <a href="#service-bulk">Bulk Setup Plan</a> gives you a layout and a proforma invoice.</p>` : ""}
      <div class="pl-tips"><b>Tips for a ${size} ${esc(r.label.toLowerCase())}</b><ul>${TIPS[size].map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
      <div class="pl-actions">
        <a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(waList)}">Send this list on WhatsApp</a>
        <a class="btn btn-ghost" href="#service-room" data-prefill-room="${esc(r.brief)}" data-prefill-budget="${budget}">Get a designer's plan · ${money(50)}</a>
      </div>`;
    $("#planner-out").querySelectorAll("[data-buy]").forEach(b => b.addEventListener("click", () => {
      const p = lines[Number(b.dataset.buy)].p;
      CO.open(Object.assign({}, p, { images: (p.images || []).map(img) }));
    }));
  }

  $("#room-picks").addEventListener("click", e => {
    const b = e.target.closest("[data-room]");
    if (!b) return;
    room = b.dataset.room;
    $("#pl-budget").value = ROOMS[room].budgets[1];
    if (ROOMS[room].people) $("#pl-people").value = { school: 40, dining: 6, office: 4 }[room] || 1;
    renderRooms();
    plan();
  });
  $("#budget-quick").addEventListener("click", e => {
    const b = e.target.closest("[data-budget]");
    if (!b) return;
    $("#pl-budget").value = b.dataset.budget;
    plan();
  });
  $("#planner-form").addEventListener("input", plan);
  renderRooms();
  plan();

  // ---------- paid services ----------
  let SERVICES = [];
  let group = "all";
  const from = s => Math.min(...s.options.map(o => o.price_ghs));

  function renderServices() {
    const list = SERVICES.filter(s => group === "all" || s.group === group);
    $("#st-grid").innerHTML = list.map(s => `
      <article class="st-card" id="service-${esc(s.id)}">
        <div class="st-card-top">
          <span class="st-ico">${icon(s.icon, 26)}</span>
          ${s.badge ? `<span class="st-badge">${esc(s.badge)}</span>` : ""}
        </div>
        <h3>${esc(s.name)}</h3>
        <p class="st-tag">${esc(s.tagline)}</p>
        <ul class="st-incl">${s.includes.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
        <div class="st-foot">
          <div class="st-price"><small>From</small><strong>${money(from(s))}</strong><small>${esc(s.turnaround)}</small></div>
          <button type="button" class="btn btn-gold" data-order="${esc(s.id)}">Order</button>
        </div>
      </article>`).join("");
  }

  function renderHero() {
    $("#hero-list").innerHTML = SERVICES.map(s => `
      <li><a href="#service-${esc(s.id)}"><span class="st-ico">${icon(s.icon, 20)}</span><span>${esc(s.name)}</span><b>${money(from(s))}</b></a></li>`).join("") +
      `<li><a href="#planner"><span class="st-ico">${C.iconSvg(C.ICONS.sofa, 20)}</span><span>Furniture budget planner</span><b class="free">Free</b></a></li>`;
  }

  document.querySelector(".st-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-group]");
    if (!b) return;
    group = b.dataset.group;
    document.querySelectorAll(".st-tabs .chip").forEach(c => c.setAttribute("aria-selected", String(c === b)));
    renderServices();
  });
  $("#st-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-order]");
    if (b) openBrief(SERVICES.find(s => s.id === b.dataset.order));
  });

  // ---------- brief dialog ----------
  let dlg;
  function openBrief(svc, prefill) {
    if (!svc) return;
    prefill = prefill || {};
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "co st-brief";
      dlg.setAttribute("aria-labelledby", "br-title");
      document.body.appendChild(dlg);
      dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
    }
    const field = f => {
      const req = f.required ? " required" : "";
      const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
      const val = prefill[f.name] != null ? String(prefill[f.name]) : "";
      const opt = f.required ? "" : " <small>(optional)</small>";
      if (f.type === "select") return `<label>${esc(f.label)}<select name="${esc(f.name)}"${req}>${f.choices.map(c => `<option${c === val ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>`;
      if (f.type === "textarea") return `<label>${esc(f.label)}${opt}<textarea name="${esc(f.name)}" rows="3"${ph}${req}>${esc(val)}</textarea></label>`;
      return `<label>${esc(f.label)}${opt}<input name="${esc(f.name)}" type="${f.type === "number" ? "number" : "text"}"${f.type === "number" ? ' inputmode="numeric" min="0"' : ""} value="${esc(val)}"${ph}${req}></label>`;
    };
    dlg.innerHTML = `
      <button class="pd-close" type="button" data-close aria-label="Close">×</button>
      <div class="co-body">
        <p class="kicker">${esc(svc.name)}</p>
        <h2 id="br-title">Tell us what you need</h2>
        <form class="co-form" id="br-form" novalidate>
          <fieldset class="options st-opts">
            <legend>Choose an option</legend>
            ${svc.options.map((o, i) => `
              <label class="option${i === 0 ? " on" : ""}">
                <input type="radio" name="opt" value="${esc(o.id)}" ${i === 0 ? "checked" : ""}>
                <span class="option-txt"><strong>${esc(o.label)}</strong><small>${money(o.price_ghs)}${o.per ? " per " + esc(o.per) : ""}</small></span>
              </label>`).join("")}
          </fieldset>
          ${svc.fields.map(field).join("")}
          <p class="co-note">${esc(svc.turnaround)}. ${esc(svc.after)}</p>
          <p class="co-error" id="br-error" role="alert" hidden></p>
          <button class="btn btn-gold co-pay" type="submit">Continue to payment</button>
        </form>
      </div>`;
    const form = dlg.querySelector("#br-form");
    form.addEventListener("change", () => form.querySelectorAll(".option").forEach(o => o.classList.toggle("on", o.querySelector("input").checked)));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const missing = svc.fields.find(f => f.required && !String(form.elements[f.name].value).trim());
      const err = dlg.querySelector("#br-error");
      if (missing) { err.textContent = `Please fill in "${missing.label}".`; err.hidden = false; form.elements[missing.name].focus(); return; }
      const opt = svc.options.find(o => o.id === form.opt.value);
      const brief = svc.fields.map(f => [f.label, String(form.elements[f.name].value).trim()]).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
      dlg.close();
      CO.open({
        id: opt.id,
        name: `${svc.name}: ${opt.label}`,
        price_ghs: opt.price_ghs,
        per: opt.per,
        in_stock: true,
        images: [],
        category: "Custom",
        type: "Custom Build",
        iconPath: svc.icon,
        service: true,
        // Guides go out as soon as they're paid for, so they're pay-first only.
        plans: svc.id === "guides" && CO.payNow ? ["full"] : null,
        brief,
        after: svc.after,
        note: `${svc.turnaround}. ${svc.after}`,
        onRecord: order => post({
          name: order.name, phone: order.phone, email: order.email, organisation: "",
          product: `${order.product} (${order.product_id})`, quantity: order.quantity,
          message: `AI Studio order ${order.reference} · ${order.plan_label} · ${money(order.total)}\n${brief || "(no brief)"}`,
          source: "ai-studio"
        })
      });
    });
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }

  // Deep links: /studio/#service-room opens that service's brief. The planner's
  // "designer's plan" button also passes its room and budget into the brief.
  let pending = null;
  function fromHash() {
    const m = location.hash.match(/^#service-([\w-]+)$/);
    const svc = m && SERVICES.find(s => s.id === m[1]);
    if (!svc) return;
    const card = document.getElementById("service-" + svc.id);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    openBrief(svc, pending);
    pending = null;
  }
  window.addEventListener("hashchange", fromHash);
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#service-"]');
    if (!a) return;
    pending = a.dataset.prefillRoom ? { room: a.dataset.prefillRoom, budget: a.dataset.prefillBudget } : null;
    if (location.hash === a.getAttribute("href")) { e.preventDefault(); fromHash(); }
  });

  fetch("../data/services.json", { cache: "no-cache" })
    .then(r => r.json())
    .then(d => {
      SERVICES = d.services || [];
      renderServices();
      renderHero();
      fromHash();
    })
    .catch(() => {
      $("#st-grid").innerHTML = `<p class="st-loading">Couldn't load services. <a href="${waLink("Hello F.A Vision, I'd like to order an AI Studio service.")}" target="_blank" rel="noopener">Order on WhatsApp instead</a>.</p>`;
    });
})();
