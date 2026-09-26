// ---- Edit these to update the site ----------------------------------------

// Business WhatsApp number, international format without "+" or spaces
// (e.g. "233241234567"). Leave empty to open WhatsApp without a preset number.
const WHATSAPP_NUMBER = "";

// Product catalogue. `image` is a file name inside assets/images/ (optional).
// `price` is the starting price in GHS.
const PRODUCTS = [
  { name: "3-Seater Fabric Sofa", category: "Living Room", price: 4500, icon: "🛋️", description: "Hardwood frame, high-density foam, choice of fabric colours." },
  { name: "L-Shaped Sectional Sofa", category: "Living Room", price: 9800, icon: "🛋️", description: "Spacious corner sofa, ideal for family living rooms." },
  { name: "Wooden Centre Table", category: "Living Room", price: 1200, icon: "🪵", description: "Solid wood coffee table with lower storage shelf." },
  { name: "TV Stand / Console", category: "Living Room", price: 1800, icon: "📺", description: "Cabinet with drawers and cable management." },
  { name: "Queen Size Bed Frame", category: "Bedroom", price: 3800, icon: "🛏️", description: "Solid hardwood frame with padded headboard." },
  { name: "King Size Bed Frame", category: "Bedroom", price: 4800, icon: "🛏️", description: "Strong slatted base, available in natural or dark finish." },
  { name: "Wardrobe (3-Door)", category: "Bedroom", price: 5200, icon: "🚪", description: "Hanging space, shelves and drawers; custom sizes available." },
  { name: "Bedside Table", category: "Bedroom", price: 650, icon: "🗄️", description: "Compact nightstand with drawer." },
  { name: "6-Seater Dining Set", category: "Dining", price: 6500, icon: "🍽️", description: "Solid wood table with six upholstered chairs." },
  { name: "4-Seater Dining Set", category: "Dining", price: 4200, icon: "🍽️", description: "Space-saving dining set for apartments." },
  { name: "Executive Office Desk", category: "Office", price: 3500, icon: "🖥️", description: "Large work surface with lockable drawers." },
  { name: "Office Chair", category: "Office", price: 1100, icon: "🪑", description: "Comfortable padded chair for home and office." },
  { name: "Bookshelf", category: "Office", price: 1500, icon: "📚", description: "Five-tier hardwood bookshelf." },
];

// ---------------------------------------------------------------------------

function whatsappLink(message) {
  const base = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

function formatPrice(amount) {
  return "GHS " + amount.toLocaleString("en-GH");
}

function renderProducts(category) {
  const grid = document.getElementById("product-grid");
  const items = category === "All" ? PRODUCTS : PRODUCTS.filter(p => p.category === category);
  grid.innerHTML = "";
  items.forEach(p => {
    const card = document.createElement("article");
    card.className = "card";
    const media = p.image
      ? `<img src="assets/images/${p.image}" alt="${p.name}" loading="lazy">`
      : `<span aria-hidden="true">${p.icon}</span>`;
    card.innerHTML = `
      <div class="card-img">${media}</div>
      <div class="card-body">
        <span class="card-cat">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="card-desc">${p.description}</p>
        <span class="card-price">From ${formatPrice(p.price)}</span>
        <a class="btn btn-primary" target="_blank" rel="noopener"
           href="${whatsappLink(`Hello FA Vision, I'm interested in the ${p.name} (from ${formatPrice(p.price)}). Is it available?`)}">Enquire</a>
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
