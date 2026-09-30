// AI Studio (/studio/): paid AI services. The free Room Designer is in room-designer.js.
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

  // ---------- paid services ----------
  let SERVICES = [];
  let group = "all";
  const from = s => (s.free ? 0 : Math.min(...s.options.map(o => o.price_ghs)));
  const priceLabel = s => (s.free ? "Free" : money(from(s)));

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
          <div class="st-price"><small>${s.free ? "No charge" : "From"}</small><strong>${priceLabel(s)}</strong><small>${esc(s.turnaround)}</small></div>
          ${s.link ? `<a class="btn btn-gold" href="${esc(s.link)}">${esc(s.cta || "Open")}</a>` : `<button type="button" class="btn btn-gold" data-order="${esc(s.id)}">Order</button>`}
        </div>
      </article>`).join("");
  }

  function renderHero() {
    $("#hero-list").innerHTML = SERVICES.map(s => `
      <li><a href="${esc(s.link || "#service-" + s.id)}"><span class="st-ico">${icon(s.icon, 20)}</span><span>${esc(s.name)}</span><b class="${s.free ? "free" : ""}">${priceLabel(s)}</b></a></li>`).join("");
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

  // Deep links: /studio/#service-bulk opens that service's brief.
  let pending = null;
  function fromHash() {
    const m = location.hash.match(/^#service-([\w-]+)$/);
    const svc = m && SERVICES.find(s => s.id === m[1]);
    if (!svc) return;
    if (svc.link) { const t = document.querySelector(svc.link); if (t) t.scrollIntoView({ behavior: "smooth" }); return; }
    const card = document.getElementById("service-" + svc.id);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    openBrief(svc, pending);
    pending = null;
  }
  window.addEventListener("hashchange", fromHash);
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#service-"]');
    if (!a) return;
    pending = null;
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
