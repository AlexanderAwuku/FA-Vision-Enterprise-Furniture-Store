(function () {
  const C = window.FAV_CONFIG;
  const { business, products } = window.FAV_DATA;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const WA = business.whatsapp.replace(/\D/g, "");
  const SITE = (business.website || location.href.split("#")[0]).replace(/\/?$/, "/");

  const waLink = msg => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  const productUrl = p => `${SITE}#product/${p.id}`;

  // ---------- helpers ----------
  function media(p, alt) {
    const img = (p.images || [])[0];
    if (img) return `<img src="${esc(img)}" alt="${esc(alt || p.name)}" loading="lazy">`;
    return `<div class="ph" data-cat="${esc(p.category)}">${C.iconSvg(C.categoryIcon(p))}</div>`;
  }
  function priceHtml(p, cls) {
    if (!p.price_ghs) return `<span class="price request ${cls || ""}">Price on request</span>`;
    return `<span class="price ${cls || ""}"><small>${p.custom_order ? "From" : "Price"}</small>${C.formatPrice(p.price_ghs)}</span>`;
  }
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function enquiry(p) {
    return `Hello F.A Vision, I'm interested in the ${p.name} (${p.id}).${p.price_ghs ? ` Listed at ${C.formatPrice(p.price_ghs)}.` : ""} Is it available?\n${productUrl(p)}`;
  }

  // Products with photos first, then in-stock, then the rest, keeping data order.
  const featured = products
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (!!(b.p.images || []).length - !!(a.p.images || []).length) || (b.p.in_stock - a.p.in_stock) || a.i - b.i)
    .map(x => x.p);

  // ---------- static bits ----------
  document.querySelectorAll(".js-wa").forEach(a => {
    a.href = waLink(a.dataset.msg || "Hello F.A Vision!");
    a.target = "_blank";
    a.rel = "noopener";
  });
  $("#year").textContent = new Date().getFullYear();
  $("#address").textContent = business.address;
  $("#directions").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Tarazzo Road Odorkor Accra");
  $("#phones").innerHTML = (business.phones || [business.whatsapp])
    .map(n => `<li><a href="tel:${esc(n)}">${esc(C.localPhone(n))}</a></li>`).join("");

  const toggle = $("#nav-toggle"), links = $("#nav-links");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", e => {
    if (e.target.tagName === "A") { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });

  // Hero: three featured pieces from different categories
  const heroPicks = [];
  for (const p of featured) {
    if (heroPicks.length === 3) break;
    if (!heroPicks.some(h => h.category === p.category)) heroPicks.push(p);
  }
  $("#hero-stack").innerHTML = heroPicks.map(p => `
    <a class="hero-card" href="#product/${esc(p.id)}" tabindex="-1">
      <div class="media">${media(p)}</div>
      <div class="hc-body"><span class="hc-name">${esc(p.name)}</span><span class="hc-price">${p.price_ghs ? C.formatPrice(p.price_ghs) : "On request"}</span></div>
    </a>`).join("");

  const marqueeItems = ["Sofas", "Beds", "Wardrobes", "Dining sets", "Office desks", "School furniture", "Custom builds", "Re-upholstery", "Delivery across Ghana"];
  $("#marquee").innerHTML = [...marqueeItems, ...marqueeItems].map(t => `<span>${t}</span>`).join("");

  $("#quote-type").innerHTML += C.CATEGORIES.map(c => `<option>${esc(c.id)}</option>`).join("");
  $("#quote-form").addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(e.target);
    window.open(waLink(`Hello F.A Vision, I'd like a quote.\nName: ${d.get("name")}\nFor: ${d.get("type")}\nDetails: ${d.get("details")}`), "_blank", "noopener");
  });

  // ---------- catalogue ----------
  const state = { cat: "All", q: "", sort: "featured" };
  const cats = C.CATEGORIES.filter(c => products.some(p => p.category === c.id));

  function renderChips() {
    const all = `<button class="chip" role="tab" data-cat="All" aria-selected="${state.cat === "All"}">All <span class="count">${products.length}</span></button>`;
    $("#chips").innerHTML = all + cats.map(c => `
      <button class="chip" role="tab" data-cat="${esc(c.id)}" aria-selected="${state.cat === c.id}">
        ${C.iconSvg(C.ICONS[c.icon])}${esc(c.id)} <span class="count">${products.filter(p => p.category === c.id).length}</span>
      </button>`).join("");
  }

  function visible() {
    const q = state.q.trim().toLowerCase();
    let list = featured.filter(p =>
      (state.cat === "All" || p.category === state.cat) &&
      (!q || [p.name, p.type, p.category, p.description, p.material, ...(p.colors || [])].join(" ").toLowerCase().includes(q)));
    const price = p => p.price_ghs || Infinity;
    if (state.sort === "price-asc") list = [...list].sort((a, b) => price(a) - price(b));
    if (state.sort === "price-desc") list = [...list].sort((a, b) => (b.price_ghs || 0) - (a.price_ghs || 0));
    if (state.sort === "newest") list = [...list].sort((a, b) => b.id.localeCompare(a.id));
    return list;
  }

  function renderGrid() {
    const list = visible();
    $("#empty").hidden = list.length > 0;
    $("#grid").innerHTML = list.map((p, i) => {
      const badges = [
        !p.in_stock ? `<span class="badge sold">Sold out</span>` : "",
        p.custom_order ? `<span class="badge">Made to order</span>` : "",
        p.negotiable && p.price_ghs ? `<span class="badge gold">Negotiable</span>` : ""
      ].join("");
      const n = (p.images || []).length;
      return `
      <article class="card" data-id="${esc(p.id)}" style="animation-delay:${Math.min(i, 8) * 40}ms" tabindex="0" aria-label="${esc(p.name)}">
        <div class="media">${media(p)}<div class="badges">${badges}</div>${n > 1 ? `<span class="photo-count">${n} photos</span>` : ""}</div>
        <div class="card-body">
          <span class="card-type">${esc(p.type || p.category)}</span>
          <h3>${esc(p.name)}</h3>
          <p class="card-desc">${esc(p.description)}</p>
          <div class="card-foot">
            ${priceHtml(p)}
            <a class="icon-btn" href="${waLink(enquiry(p))}" target="_blank" rel="noopener" aria-label="Enquire about ${esc(p.name)} on WhatsApp" data-stop>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>
            </a>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  $("#chips").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    state.cat = b.dataset.cat;
    renderChips();
    renderGrid();
  });
  $("#search").addEventListener("input", e => { state.q = e.target.value; renderGrid(); });
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; renderGrid(); });
  $("#grid").addEventListener("click", e => {
    if (e.target.closest("[data-stop]")) return;
    const card = e.target.closest(".card");
    if (card) location.hash = "product/" + card.dataset.id;
  });
  $("#grid").addEventListener("keydown", e => {
    const card = e.target.closest(".card");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); location.hash = "product/" + card.dataset.id; }
  });

  // ---------- product detail (deep-linkable: #product/FAV-001) ----------
  const dlg = $("#pd");

  function openProduct(p) {
    const imgs = p.images || [];
    const specs = [
      ["Category", p.type ? `${p.category} · ${p.type}` : p.category],
      ["Condition", p.condition],
      ["Material", p.material],
      ["Size", p.dimensions],
      ["Colours", (p.colors || []).join(", ")],
      ["Availability", p.in_stock ? (p.custom_order ? "Made to order" : "In stock") : "Sold out"],
      ["Ref", p.id]
    ].filter(([, v]) => v);
    $("#pd-body").innerHTML = `
      <div class="gallery">
        <div class="media" id="pd-main">${media(p)}</div>
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) => `<button data-src="${esc(src)}" aria-current="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="pd-info">
        <span class="card-type">${esc(p.type || p.category)}</span>
        <h2 id="pd-title">${esc(p.name)}</h2>
        <div class="pd-price">${p.price_ghs ? `${C.formatPrice(p.price_ghs)}<small>${p.negotiable ? "Negotiable" : "Fixed price"}</small>` : `<span class="price request">Price on request</span>`}</div>
        <p class="pd-desc">${esc(p.description)}</p>
        ${(p.highlights || []).length ? `<ul class="features">${p.highlights.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
        <dl class="specs">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <div class="pd-actions">
          <a class="btn btn-wa" href="${waLink(enquiry(p))}" target="_blank" rel="noopener">Order on WhatsApp</a>
          <a class="btn btn-outline" href="tel:${esc(business.phones ? business.phones[0] : business.whatsapp)}">Call</a>
          <button class="btn btn-outline" id="pd-share" type="button">Share</button>
        </div>
      </div>`;
    const thumbs = dlg.querySelector(".thumbs");
    if (thumbs) thumbs.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      $("#pd-main").innerHTML = `<img src="${esc(b.dataset.src)}" alt="${esc(p.name)}">`;
      thumbs.querySelectorAll("button").forEach(x => x.setAttribute("aria-current", String(x === b)));
    });
    $("#pd-share").addEventListener("click", async () => {
      const data = { title: p.name, text: `${p.name}${p.price_ghs ? " · " + C.formatPrice(p.price_ghs) : ""} from F.A Vision Enterprise`, url: productUrl(p) };
      try {
        if (navigator.share) { await navigator.share(data); return; }
        await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
        toast("Link copied. Paste it in WhatsApp or anywhere.");
      } catch (err) { /* share sheet dismissed */ }
    });
    document.title = `${p.name} | F.A Vision Enterprise`;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }

  function closeProduct() {
    if (dlg.open) dlg.close();
  }

  function route() {
    const m = location.hash.match(/^#product\/(.+)$/);
    const p = m && products.find(x => x.id === decodeURIComponent(m[1]));
    if (p) openProduct(p); else closeProduct();
  }

  dlg.addEventListener("close", () => {
    document.title = "F.A Vision Enterprise | Furniture for Homes, Offices & Schools · Odorkor, Accra";
    if (location.hash.startsWith("#product/")) history.replaceState(null, "", "#shop");
  });
  $("#pd-close").addEventListener("click", closeProduct);
  dlg.addEventListener("click", e => { if (e.target === dlg) closeProduct(); });
  window.addEventListener("hashchange", route);

  renderChips();
  renderGrid();
  route();
})();
