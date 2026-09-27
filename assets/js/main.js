// ---- Edit these to update the site ----------------------------------------

// Business WhatsApp number, international format without "+" or spaces
// (e.g. "233241234567"). Leave empty to open WhatsApp without a preset number.
const WHATSAPP_NUMBER = "233572646176";

// Products come from data/products.json. After editing it, run
// `python3 scripts/generate_listings.py`, which rewrites
// assets/js/products-data.js (loaded before this file) with a PRODUCTS list.

// ---------------------------------------------------------------------------

function whatsappLink(message) {
  const base = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

function formatPrice(amount) {
  return amount ? "GHS " + amount.toLocaleString("en-GH") : "Price on request";
}

function renderProducts(category) {
  const grid = document.getElementById("product-grid");
  const items = category === "All" ? PRODUCTS : PRODUCTS.filter(p => p.category === category);
  grid.innerHTML = "";
  items.forEach(p => {
    const card = document.createElement("article");
    card.className = "card";
    const media = p.image
      ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
      : `<span aria-hidden="true">${p.icon}</span>`;
    card.innerHTML = `
      <div class="card-img">${media}</div>
      <div class="card-body">
        <span class="card-cat">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="card-desc">${p.description}</p>
        <span class="card-price">${p.price ? "From " : ""}${formatPrice(p.price)}</span>
        <a class="btn btn-primary" target="_blank" rel="noopener"
           href="${whatsappLink(`Hello FA Vision, I'm interested in the ${p.name} (${p.id}). Is it available?`)}">Enquire</a>
      </div>`;
    grid.appendChild(card);
  });
}

function renderFilters() {
  const wrap = document.querySelector(".filters");
  const categories = ["All", ...new Set(PRODUCTS.map(p => p.category))];
  categories.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".filter-btn").forEach(b => b.setAttribute("aria-selected", "false"));
      btn.setAttribute("aria-selected", "true");
      renderProducts(cat);
    });
    wrap.appendChild(btn);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderFilters();
  renderProducts("All");

  document.querySelectorAll(".js-whatsapp").forEach(a => {
    a.href = whatsappLink(a.dataset.message || "Hello FA Vision!");
    a.target = "_blank";
    a.rel = "noopener";
  });

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));

  document.getElementById("quote-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const msg = `Hello FA Vision, I'd like a quote.\nName: ${data.get("name")}\nType: ${data.get("type")}\nDetails: ${data.get("details")}`;
    window.open(whatsappLink(msg), "_blank", "noopener");
  });

  document.getElementById("year").textContent = new Date().getFullYear();
});
