// Free Room Designer on /studio/ (#designer).
//
// Customers pick a room, its size, wall colour or wallpaper and floor, then tap
// pieces to add them. Each piece is drawn in the colour they chose, at its size:
//   Room view   a front-on picture of the room, in perspective
//   Floor plan  a to-scale plan; drag a piece to move it, tap it to turn it
// Priced catalogue pieces (and wallpaper rolls) go to checkout together, so the
// customer only pays for what they order. Pieces we don't list yet ("Ask for
// price") are sent as a quote request.
// Sizes come from TYPES below unless a product has "footprint_cm": {w, d, h}.
// Wallpaper products (type "Wallpaper") show on the walls; rolls needed are worked
// out from the room size and "roll_m2" on the product (default 5.3 m², a 0.53 × 10 m roll).
(function () {
  const root = document.getElementById("designer-app");
  if (!root) return;
  const C = window.FAV_CONFIG;
  const { business, products } = window.FAV_DATA;
  const CO = window.FAV_CHECKOUT;
  const esc = C.escapeHtml;
  const WA = business.whatsapp.replace(/\D/g, "");
  const waLink = msg => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  const money = n => C.formatPrice(Math.round(n));
  const img = src => (!src || /^(https?:|\/|data:)/.test(src) ? src : "../" + src);
  const $ = s => root.querySelector(s);

  // Typical sizes in cm: w = width, d = depth, h = height. wall = stands against a wall.
  const TYPES = {
    "Sectional Sofa": { shape: "lsofa", w: 250, d: 160, h: 85, colour: "Grey" },
    "Sofa": { shape: "sofa", w: 200, d: 85, h: 85, colour: "Grey" },
    "Armchair": { shape: "armchair", w: 85, d: 80, h: 85, colour: "Cream" },
    "Centre Table": { shape: "ctable", w: 110, d: 60, h: 45, colour: "Dark Brown" },
    "TV Stand": { shape: "tvstand", w: 150, d: 40, h: 55, wall: true, colour: "Dark Brown" },
    "Shoe Rack": { shape: "shelf", w: 80, d: 35, h: 90, wall: true, colour: "Natural Wood" },
    "Side Table": { shape: "nightstand", w: 45, d: 45, h: 55, colour: "Natural Wood" },
    "Bed Frame": { shape: "bed", w: 160, d: 205, h: 110, wall: true, colour: "Dark Brown" },
    "Wardrobe": { shape: "wardrobe", w: 180, d: 60, h: 220, wall: true, colour: "Cream" },
    "Bedside Table": { shape: "nightstand", w: 45, d: 40, h: 55, wall: true, colour: "Dark Brown" },
    "Dressing Mirror": { shape: "dresser", w: 100, d: 45, h: 160, wall: true, colour: "White" },
    "Chest of Drawers": { shape: "chest", w: 90, d: 45, h: 100, wall: true, colour: "Dark Brown" },
    "Dining Set": { shape: "dining", w: 220, d: 180, h: 95, colour: "Black" },
    "Office Desk": { shape: "desk", w: 120, d: 60, h: 75, colour: "Dark Brown" },
    "Office Chair": { shape: "chair", w: 65, d: 65, h: 110, colour: "Black" },
    "Bookshelf": { shape: "shelf", w: 80, d: 30, h: 180, wall: true, colour: "Dark Brown" },
    "Filing Cabinet": { shape: "chest", w: 45, d: 60, h: 130, wall: true, colour: "Grey" },
    "Classroom Desk": { shape: "schooldesk", w: 70, d: 100, h: 88, gap: 30, colour: "Gold" },
    "Teacher's Table": { shape: "desk", w: 120, d: 60, h: 75, colour: "Dark Brown" },
    "Reception Desk": { shape: "desk", w: 160, d: 70, h: 105, colour: "Dark Brown" },
    "Conference Table": { shape: "ctable", w: 240, d: 110, h: 75, colour: "Dark Brown" }
  };
  const HEX = {
    "Grey": "#9ea3a8", "Black": "#2f3033", "Dark Brown": "#5d3d2b", "Mahogany": "#6e2e22", "Natural Wood": "#b98a5b",
    "White": "#f2f2ee", "Cream": "#e6d9bd", "Beige": "#d6c09c", "Blue": "#3c6fb5", "Green": "#4f7e5b",
    "Red": "#b5332b", "Gold": "#d6a92e", "Multi-colour": "#c25a80"
  };
  const hex = c => HEX[c] || "#8b9095";
  const GENERIC_COLOURS = ["Dark Brown", "Natural Wood", "Black", "Grey", "Cream", "White"];

  const ROOMS = {
    living: { label: "Living room", icon: "sofa", size: [4, 3.5], budget: 20000,
      types: ["Sectional Sofa", "Sofa", "Armchair", "Centre Table", "TV Stand", "Side Table", "Shoe Rack"] },
    bedroom: { label: "Bedroom", icon: "bed", size: [3.5, 3.2], budget: 15000,
      types: ["Bed Frame", "Wardrobe", "Bedside Table", "Dressing Mirror", "Chest of Drawers"] },
    dining: { label: "Dining", icon: "dining", size: [3.5, 3.2], budget: 12000, types: ["Dining Set"] },
    office: { label: "Office", icon: "office", size: [4, 3.5], budget: 20000,
      types: ["Office Desk", "Office Chair", "Bookshelf", "Filing Cabinet", "Reception Desk", "Conference Table"] },
    school: { label: "Classroom", icon: "school", size: [8, 6], budget: 26000, types: ["Classroom Desk", "Teacher's Table", "Bookshelf"] }
  };
  const WALLS = { "Cream": "#efe5d3", "Soft grey": "#e0e3e6", "Sky blue": "#d5e5f2", "Sage": "#dbe5d3", "Blush": "#f1dcd6" };
  const FLOORS = ["Tiles", "Wood", "Terrazzo"];

  // ---------- pieces ----------
  const buyable = p => p.in_stock && p.price_ghs && !p.placeholder;
  // Wallpaper: catalogue products of type "Wallpaper" (priced per roll, photo used as the
  // pattern), plus drawn sample styles customers can ask us to quote.
  const WP_STYLES = {
    "GEN-WP-brick": { name: "3D brick wallpaper", swatch: "linear-gradient(#f1ede6 0 0)",
      svg: t => `<rect width="${t}" height="${t}" fill="#ece6dc"/><g fill="#f7f3ec" stroke="#d6cdbf" stroke-width="${t / 40}"><rect x="1" y="1" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${t / 2 + 1}" y="1" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${-t / 4 + 1}" y="${t / 4 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${t / 4 + 1}" y="${t / 4 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${3 * t / 4 + 1}" y="${t / 4 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="1" y="${t / 2 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${t / 2 + 1}" y="${t / 2 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${-t / 4 + 1}" y="${3 * t / 4 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${t / 4 + 1}" y="${3 * t / 4 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/><rect x="${3 * t / 4 + 1}" y="${3 * t / 4 + 1}" width="${t / 2 - 2}" height="${t / 4 - 2}"/></g>` },
    "GEN-WP-wood": { name: "Wood panel wallpaper", swatch: "repeating-linear-gradient(90deg,#a8774e 0 9px,#8e603c 9px 10px)",
      svg: t => `<rect width="${t}" height="${t}" fill="#a8774e"/>${[0, 1, 2, 3].map(i => `<rect x="${i * t / 4}" width="${t / 4 - t / 60}" height="${t}" fill="${["#a8774e", "#b3835a", "#9c6d46", "#ad7c52"][i]}"/><line x1="${i * t / 4}" x2="${i * t / 4}" y2="${t}" stroke="#7a5233" stroke-width="${t / 60}"/>`).join("")}` },
    "GEN-WP-geo": { name: "Geometric wallpaper", swatch: "repeating-linear-gradient(45deg,#dfe7ee 0 6px,#c3d2de 6px 8px)",
      svg: t => `<rect width="${t}" height="${t}" fill="#e3eaf0"/><path d="M0 ${t / 2}L${t / 2} 0L${t} ${t / 2}L${t / 2} ${t}Z" fill="none" stroke="#9fb4c6" stroke-width="${t / 30}"/><path d="M${t / 4} ${t / 2}L${t / 2} ${t / 4}L${3 * t / 4} ${t / 2}L${t / 2} ${3 * t / 4}Z" fill="#c9d7e3"/>` },
    "GEN-WP-leaf": { name: "Leaf print wallpaper", swatch: "radial-gradient(circle at 30% 30%,#7fa37f 0 25%,#e8efe4 26%)",
      svg: t => `<rect width="${t}" height="${t}" fill="#e9efe4"/><g fill="#86a986"><ellipse cx="${t / 4}" cy="${t / 4}" rx="${t / 10}" ry="${t / 5}" transform="rotate(35 ${t / 4} ${t / 4})"/><ellipse cx="${3 * t / 4}" cy="${3 * t / 4}" rx="${t / 10}" ry="${t / 5}" transform="rotate(-35 ${3 * t / 4} ${3 * t / 4})"/></g><g fill="#5f8a64"><ellipse cx="${3 * t / 4}" cy="${t / 5}" rx="${t / 14}" ry="${t / 7}" transform="rotate(-20 ${3 * t / 4} ${t / 5})"/><ellipse cx="${t / 5}" cy="${3 * t / 4}" rx="${t / 14}" ry="${t / 7}" transform="rotate(20 ${t / 5} ${3 * t / 4})"/></g>` }
  };
  const papers = () => products.filter(p => p.in_stock && !p.placeholder && p.type === "Wallpaper" && (p.images || []).length)
    .map(p => ({ id: p.id, name: p.name, price: p.price_ghs || null, img: p.images[0], roll: Number(p.roll_m2) || 5.3 }))
    .concat(Object.entries(WP_STYLES).map(([id, w]) => ({ id, name: w.name, price: null, style: w, roll: 5.3 })));
  const paperFor = id => papers().find(x => x.id === id);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  function pieceFor(key) {
    const p = products.find(x => x.id === key);
    if (p && TYPES[p.type]) {
      const t = TYPES[p.type];
      const f = p.footprint_cm || {};
      return { key, product: p, type: p.type, name: p.name, price: p.price_ghs, shape: t.shape,
        w: f.w || t.w, d: f.d || t.d, h: f.h || t.h, wall: t.wall, gap: t.gap,
        colours: (p.colors || []).length ? p.colors : [t.colour], img: (p.images || [])[0] };
    }
    const type = Object.keys(TYPES).find(t => "GEN-" + slug(t) === key);
    if (!type) return null;
    const t = TYPES[type];
    return { key, type, name: type, price: null, shape: t.shape, w: t.w, d: t.d, h: t.h, wall: t.wall, gap: t.gap,
      colours: [t.colour, ...GENERIC_COLOURS.filter(c => c !== t.colour)] };
  }
  function roomPieces(all) {
    const types = all ? Object.keys(TYPES) : ROOMS[S.room].types;
    const list = products.filter(p => buyable(p) && types.includes(p.type)).map(p => pieceFor(p.id));
    types.forEach(t => { if (!list.some(x => x.type === t)) list.push(pieceFor("GEN-" + slug(t))); });
    return list;
  }
  const size = (pc, u) => (u.rot ? { w: pc.d, d: pc.w } : { w: pc.w, d: pc.d });

  // ---------- state ----------
  const S = { room: "living", W: 400, L: 350, wall: "Cream", paper: null, floor: "Tiles", budget: 20000, view: "room", all: false, items: [] };
  // items: [{ key, qty, colour, units: [{ x, y, rot }] }]  (cm, x/y = top-left on the plan, y = 0 at the back wall)

  // Wallpaper: all four walls at 2.7 m high, less about 15% for the door and window.
  function paperLine() {
    const p = S.paper && paperFor(S.paper);
    if (!p) return null;
    const area = 2 * (S.W + S.L) / 100 * 2.7 * .85;
    const rolls = Math.ceil(area / p.roll);
    return { p, rolls, area, total: p.price ? rolls * p.price : 0 };
  }

  const overlap = (a, b, g) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.d + g && b.y < a.y + a.d + g;
  function boxes(except) {
    const out = [];
    S.items.forEach(it => {
      const pc = pieceFor(it.key);
      it.units.forEach(u => { if (u !== except && u.x > -999) out.push(Object.assign({ x: u.x, y: u.y, u, it, pc }, size(pc, u))); });
    });
    return out;
  }
  // First free spot: wall pieces along the back wall first, everything else from the middle.
  function place(pc, unit) {
    const others = boxes(unit);
    const s = size(pc, unit);
    const gap = pc.gap != null ? pc.gap : 35;
    const ys = [];
    for (let y = 0; y + s.d <= S.L; y += 10) ys.push(y);
    if (!pc.wall && pc.shape !== "schooldesk") ys.sort((a, b) => Math.abs(a - S.L * 0.3) - Math.abs(b - S.L * 0.3) || a - b);
    const xs = [];
    for (let x = 0; x + s.w <= S.W; x += 10) xs.push(x);
    if (!pc.wall && pc.shape !== "schooldesk") xs.sort((a, b) => Math.abs(a - (S.W - s.w) / 2) - Math.abs(b - (S.W - s.w) / 2));
    // Tall pieces keep clear of the window (15%–40% along the back wall) on the first try.
    const blocksWindow = (x, y, strict) => strict && pc.h > 100 && y < 40 && x < S.W * .4 && x + s.w > S.W * .15;
    for (const [g, strict] of [[gap, true], [gap, false], [10, false]]) {
      const ok = (x, y) => x >= 0 && y >= 0 && x + s.w <= S.W && y + s.d <= S.L && !blocksWindow(x, y, strict) && !others.some(o => overlap({ x, y, w: s.w, d: s.d }, o, g));
      for (const y of ys) for (const x of xs) if (ok(x, y)) { unit.x = x; unit.y = y; return true; }
    }
    unit.x = Math.max(0, (S.W - s.w) / 2);
    unit.y = Math.max(0, (S.L - s.d) / 2);
    return false;
  }
  function setQty(it, qty) {
    qty = Math.max(0, Math.min(120, qty));
    const pc = pieceFor(it.key);
    while (it.units.length > qty) it.units.pop();
    while (it.units.length < qty) { const u = { x: -9999, y: -9999, rot: 0 }; it.units.push(u); place(pc, u); }
    it.qty = qty;
    if (!qty) S.items = S.items.filter(x => x !== it);
  }
  function arrange() {
    const all = S.items.flatMap(it => it.units.map(u => ({ it, u, pc: pieceFor(it.key) })));
    all.forEach(o => { o.u.x = -9999; o.u.y = -9999; o.u.rot = 0; });
    all.sort((a, b) => (b.pc.wall ? 1 : 0) - (a.pc.wall ? 1 : 0) || b.pc.w * b.pc.d - a.pc.w * a.pc.d)
      .forEach(o => place(o.pc, o.u));
  }
  function add(key) {
    let it = S.items.find(x => x.key === key);
    const pc = pieceFor(key);
    if (!it) { it = { key, qty: 0, colour: pc.colours[0], units: [] }; S.items.push(it); }
    setQty(it, it.qty + (pc.shape === "schooldesk" && !it.qty ? 20 : 1));
  }

  // Auto-fill: the best catalogue piece per type that still fits the budget.
  function autofill() {
    S.items = [];
    let left = S.budget - ((paperLine() || {}).total || 0);
    ROOMS[S.room].types.forEach(t => {
      const cands = products.filter(p => buyable(p) && p.type === t && TYPES[p.type]).sort((a, b) => b.price_ghs - a.price_ghs);
      const many = t === "Classroom Desk";
      const fit = cands.find(p => p.price_ghs * (many ? 1 : 1) <= left);
      if (!fit) return;
      const q = many ? Math.max(1, Math.min(40, Math.floor(left / fit.price_ghs))) : 1;
      left -= fit.price_ghs * q;
      const it = { key: fit.id, qty: 0, colour: pieceFor(fit.id).colours[0], units: [] };
      S.items.push(it);
      setQty(it, q);
    });
    arrange();
  }

  // ---------- drawing helpers ----------
  function shade(h, amt) {
    const n = parseInt(h.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? (255 - v) : v) / 100)));
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, "0")).join("");
  }
  const R = (x, y, w, h, fill, extra) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${fill}" ${extra || ""}/>`;
  const L = (x1, y1, x2, y2, st, sw) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${st}" stroke-width="${sw || 1}"/>`;

  // Front-on furniture, drawn from the bottom-left corner (x, yb), w × h px.
  const DRAW = {
    sofa(x, yb, w, h, c) {
      const d = shade(c, -18), l = shade(c, 14);
      return R(x + w * .05, yb - h * .08, w * .03, h * .08, "#3a2a20") + R(x + w * .92, yb - h * .08, w * .03, h * .08, "#3a2a20") +
        R(x + w * .07, yb - h, w * .86, h * .6, d, 'rx="6"') +
        R(x + w * .04, yb - h * .52, w * .92, h * .44, c, 'rx="5"') +
        L(x + w * .37, yb - h * .52, x + w * .37, yb - h * .14, d, 1.2) + L(x + w * .63, yb - h * .52, x + w * .63, yb - h * .14, d, 1.2) +
        R(x, yb - h * .66, w * .1, h * .58, shade(c, -8), 'rx="6"') + R(x + w * .9, yb - h * .66, w * .1, h * .58, shade(c, -8), 'rx="6"') +
        R(x + w * .16, yb - h * .82, w * .16, h * .28, l, 'rx="5"') + R(x + w * .68, yb - h * .82, w * .16, h * .28, l, 'rx="5"');
    },
    lsofa(x, yb, w, h, c) {
      return DRAW.sofa(x, yb, w, h, c) + R(x + w * .6, yb - h * .44, w * .4, h * .38, shade(c, 10), 'rx="5"') +
        L(x + w * .6, yb - h * .3, x + w, yb - h * .3, shade(c, -12), 1);
    },
    armchair(x, yb, w, h, c) {
      const d = shade(c, -18);
      return R(x + w * .1, yb - h * .08, w * .05, h * .08, "#3a2a20") + R(x + w * .85, yb - h * .08, w * .05, h * .08, "#3a2a20") +
        R(x + w * .1, yb - h, w * .8, h * .6, d, 'rx="8"') + R(x + w * .06, yb - h * .52, w * .88, h * .44, c, 'rx="6"') +
        R(x, yb - h * .68, w * .16, h * .6, shade(c, -8), 'rx="7"') + R(x + w * .84, yb - h * .68, w * .16, h * .6, shade(c, -8), 'rx="7"');
    },
    ctable(x, yb, w, h, c) {
      return R(x + w * .06, yb - h, w * .05, h, shade(c, -20)) + R(x + w * .89, yb - h, w * .05, h, shade(c, -20)) +
        R(x + w * .06, yb - h * .35, w * .88, h * .07, shade(c, -10)) + R(x, yb - h, w, h * .16, c, 'rx="3"') +
        R(x, yb - h, w, h * .05, shade(c, 25), 'rx="2"');
    },
    tvstand(x, yb, w, h, c) {
      const tw = w * .72, th = tw * .56, tx = x + (w - tw) / 2, ty = yb - h - th - h * .08;
      return R(x, yb - h, w, h, c, 'rx="3"') + L(x + w / 2, yb - h * .85, x + w / 2, yb - h * .1, shade(c, -25), 1.2) +
        R(x + w * .06, yb - h * .85, w * .88, h * .02, shade(c, -15)) +
        R(x + w * .44, yb - h * .5, w * .02, h * .12, "#c8c8c8") + R(x + w * .54, yb - h * .5, w * .02, h * .12, "#c8c8c8") +
        R(x + w * .47, yb - h - h * .1, w * .06, h * .1, "#222") +
        R(tx, ty, tw, th, "#1b1c1e", 'rx="3"') + R(tx + tw * .03, ty + th * .05, tw * .94, th * .85, "url(#rd-screen)");
    },
    shelf(x, yb, w, h, c) {
      let s = R(x, yb - h, w, h, c, 'rx="2"') + R(x + w * .07, yb - h * .96, w * .86, h * .9, shade(c, -30));
      const rows = h > 120 ? 4 : 3;
      const books = ["#b5332b", "#3c6fb5", "#d6a92e", "#4f7e5b", "#e6d9bd", "#6e2e22"];
      for (let i = 0; i < rows; i++) {
        const top = yb - h * .96 + i * h * .9 / rows, rh = h * .9 / rows;
        s += R(x + w * .07, top + rh - h * .02, w * .86, h * .02, c);
        let bx = x + w * .1;
        for (let b = 0; bx < x + w * .8; b++) {
          const bw = w * (.05 + ((i * 7 + b * 3) % 4) * .015), bh = rh * (.6 + ((i + b) % 3) * .1);
          s += R(bx, top + rh - h * .02 - bh, bw, bh, books[(i * 3 + b) % books.length]);
          bx += bw + w * .01;
        }
      }
      return s;
    },
    bed(x, yb, w, h, c) {
      return R(x, yb - h, w, h * .75, c, 'rx="8"') + R(x + w * .04, yb - h * .9, w * .92, h * .5, shade(c, -15), 'rx="6"') +
        R(x + w * .1, yb - h * .6, w * .34, h * .16, "#fbfaf6", 'rx="8"') + R(x + w * .56, yb - h * .6, w * .34, h * .16, "#fbfaf6", 'rx="8"') +
        R(x + w * .02, yb - h * .48, w * .96, h * .36, "#f4f1ea", 'rx="6"') + R(x + w * .02, yb - h * .3, w * .96, h * .18, "#d9cbb2", 'rx="4"') +
        R(x, yb - h * .14, w, h * .1, c) + R(x + w * .03, yb - h * .04, w * .04, h * .04, "#3a2a20") + R(x + w * .93, yb - h * .04, w * .04, h * .04, "#3a2a20");
    },
    wardrobe(x, yb, w, h, c) {
      const d = shade(c, -22);
      let s = R(x, yb - h, w, h, c, 'rx="2"') + L(x, yb - h * .8, x + w, yb - h * .8, d, 1.5) + R(x, yb - h * .03, w, h * .03, d);
      for (let i = 1; i < 4; i++) s += L(x + w * i / 4, yb - h, x + w * i / 4, yb - h * .03, d, 1.2);
      [1.5, 2.5].forEach(k => { s += R(x + w * k / 4 - w * .025, yb - h * .55, w * .015, h * .1, "#b9b9b9"); s += R(x + w * k / 4 + w * .01, yb - h * .55, w * .015, h * .1, "#b9b9b9"); });
      return s;
    },
    nightstand(x, yb, w, h, c) {
      return R(x + w * .05, yb - h * .12, w * .06, h * .12, "#3a2a20") + R(x + w * .89, yb - h * .12, w * .06, h * .12, "#3a2a20") +
        R(x, yb - h, w, h * .88, c, 'rx="2"') + L(x, yb - h * .56, x + w, yb - h * .56, shade(c, -25), 1.2) +
        R(x + w * .4, yb - h * .8, w * .2, h * .04, "#b9b9b9") + R(x + w * .4, yb - h * .36, w * .2, h * .04, "#b9b9b9");
    },
    chest(x, yb, w, h, c) {
      let s = R(x, yb - h, w, h * .95, c, 'rx="2"') + R(x + w * .04, yb - h * .05, w * .92, h * .05, shade(c, -30));
      const n = Math.max(3, Math.round(h / 30));
      for (let i = 1; i < n; i++) s += L(x, yb - h + i * h * .95 / n, x + w, yb - h + i * h * .95 / n, shade(c, -25), 1.2);
      for (let i = 0; i < n; i++) s += R(x + w * .42, yb - h + (i + .45) * h * .95 / n, w * .16, h * .015 + 1, "#b9b9b9");
      return s;
    },
    dresser(x, yb, w, h, c) {
      const th = h * .48;
      return `<ellipse cx="${(x + w / 2).toFixed(1)}" cy="${(yb - th - h * .26).toFixed(1)}" rx="${(w * .3).toFixed(1)}" ry="${(h * .25).toFixed(1)}" fill="${shade(c, -10)}"/>` +
        `<ellipse cx="${(x + w / 2).toFixed(1)}" cy="${(yb - th - h * .26).toFixed(1)}" rx="${(w * .26).toFixed(1)}" ry="${(h * .22).toFixed(1)}" fill="url(#rd-glass)"/>` +
        R(x, yb - th, w, th * .16, c, 'rx="2"') + R(x + w * .04, yb - th * .84, w * .3, th * .84, c) + R(x + w * .66, yb - th * .84, w * .3, th * .84, c) +
        L(x + w * .04, yb - th * .45, x + w * .34, yb - th * .45, shade(c, -25), 1) + L(x + w * .66, yb - th * .45, x + w * .96, yb - th * .45, shade(c, -25), 1) +
        R(x + w * .38, yb - th * .38, w * .24, th * .38, shade(c, -6), 'rx="4"');
    },
    dining(x, yb, w, h, c) {
      const back = (cx, top, bw, bh, col) => R(cx - bw / 2, top, bw, bh, col, 'rx="4"') + R(cx - bw / 2 + bw * .15, top + bh * .15, bw * .7, bh * .5, shade(col, 12), 'rx="3"');
      const chair = shade(c, 8);
      let s = "";
      [.3, .5, .7].forEach(k => { s += back(x + w * k, yb - h, w * .14, h * .38, chair); });
      s += R(x + w * .12, yb - h * .62, w * .76, h * .06, c, 'rx="2"') + R(x + w * .12, yb - h * .62, w * .76, h * .02, shade(c, 30)) +
        R(x + w * .16, yb - h * .56, w * .03, h * .56, shade(c, -20)) + R(x + w * .81, yb - h * .56, w * .03, h * .56, shade(c, -20));
      [.06, .94].forEach(k => {
        const cx = x + w * k;
        s += R(cx - w * .06, yb - h * .75, w * .12, h * .4, chair, 'rx="4"') + R(cx - w * .07, yb - h * .38, w * .14, h * .06, shade(chair, -8), 'rx="2"') +
          R(cx - w * .055, yb - h * .32, w * .012, h * .32, shade(c, -25)) + R(cx + w * .045, yb - h * .32, w * .012, h * .32, shade(c, -25));
      });
      return s;
    },
    desk(x, yb, w, h, c) {
      return R(x + w * .03, yb - h * .9, w * .04, h * .9, shade(c, -20)) + R(x + w * .66, yb - h * .9, w * .31, h * .9, c, 'rx="2"') +
        L(x + w * .66, yb - h * .6, x + w * .97, yb - h * .6, shade(c, -25), 1.2) + L(x + w * .66, yb - h * .3, x + w * .97, yb - h * .3, shade(c, -25), 1.2) +
        R(x + w * .78, yb - h * .77, w * .07, h * .03, "#b9b9b9") + R(x + w * .78, yb - h * .47, w * .07, h * .03, "#b9b9b9") +
        R(x, yb - h, w, h * .1, shade(c, 6), 'rx="2"');
    },
    chair(x, yb, w, h, c) {
      const m = x + w / 2;
      return R(x + w * .18, yb - h, w * .64, h * .48, c, 'rx="10"') + R(x + w * .24, yb - h * .94, w * .52, h * .36, shade(c, 12), 'rx="8"') +
        R(x + w * .06, yb - h * .5, w * .88, h * .12, shade(c, -8), 'rx="6"') + R(m - w * .03, yb - h * .38, w * .06, h * .28, "#6b6e72") +
        L(x + w * .08, yb - h * .05, x + w * .92, yb - h * .05, "#4a4c50", 3) +
        `<circle cx="${(x + w * .1).toFixed(1)}" cy="${(yb - h * .02).toFixed(1)}" r="${(w * .04).toFixed(1)}" fill="#222"/><circle cx="${(x + w * .9).toFixed(1)}" cy="${(yb - h * .02).toFixed(1)}" r="${(w * .04).toFixed(1)}" fill="#222"/>`;
    },
    schooldesk(x, yb, w, h, c) {
      const steel = "#8d9398";
      return R(x + w * .22, yb - h * 1.08, w * .56, h * .3, shade(c, -5), 'rx="4"') + R(x + w * .3, yb - h * .8, w * .03, h * .2, steel) + R(x + w * .67, yb - h * .8, w * .03, h * .2, steel) +
        R(x + w * .06, yb - h * .9, w * .04, h * .9, steel) + R(x + w * .9, yb - h * .9, w * .04, h * .9, steel) +
        R(x + w * .06, yb - h * .45, w * .88, h * .03, steel) + R(x, yb - h, w, h * .1, c, 'rx="2"');
    }
  };

  // ---------- room view (front-on, in perspective) ----------
  function roomView() {
    const s = 760 / S.W;                          // px per cm on the back wall
    const top = 30, wallH = Math.min(420, 270 * s), wb = top + wallH;
    const fd = Math.max(150, Math.min(300, 140 + (S.L / S.W) * 120)), H = wb + fd;
    const wall = WALLS[S.wall] || WALLS.Cream;
    const paper = paperLine();
    const X = (xcm, t) => 500 + (xcm - S.W / 2) * s * (1 + t * .3158);
    const tile = Math.max(40, 55 * s);           // a 55 cm pattern repeat
    let g = `<defs>
      <linearGradient id="rd-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d4a73"/><stop offset=".6" stop-color="#15243a"/><stop offset="1" stop-color="#0b1320"/></linearGradient>
      <linearGradient id="rd-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaf2f7"/><stop offset=".5" stop-color="#c9dbe6"/><stop offset="1" stop-color="#f4f8fa"/></linearGradient>
      <linearGradient id="rd-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(wall, -4)}"/><stop offset="1" stop-color="${wall}"/></linearGradient>
      <linearGradient id="rd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0f6"/><stop offset="1" stop-color="#eef7fc"/></linearGradient>
      <radialGradient id="rd-shadow"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      ${paper ? `<pattern id="rd-paper" patternUnits="userSpaceOnUse" width="${tile.toFixed(1)}" height="${tile.toFixed(1)}">${paper.p.style ? paper.p.style.svg(tile) : `<image href="${esc(img(paper.p.img))}" width="${tile.toFixed(1)}" height="${tile.toFixed(1)}" preserveAspectRatio="xMidYMid slice"/>`}</pattern>` : ""}
    </defs>`;
    const wallFill = paper ? "url(#rd-paper)" : "url(#rd-wall)";
    // walls
    g += `<polygon points="0,0 120,${top} 120,${wb} 0,${H}" fill="${paper ? "url(#rd-paper)" : shade(wall, -10)}"/>`;
    g += `<polygon points="1000,0 880,${top} 880,${wb} 1000,${H}" fill="${paper ? "url(#rd-paper)" : shade(wall, -7)}"/>`;
    if (paper) g += `<polygon points="0,0 120,${top} 120,${wb} 0,${H}" fill="#000" opacity=".18"/><polygon points="1000,0 880,${top} 880,${wb} 1000,${H}" fill="#000" opacity=".12"/>`;
    g += `<polygon points="0,0 1000,0 880,${top} 120,${top}" fill="${shade(wall, 20)}"/>`;
    g += R(120, top, 760, wallH, wallFill);
    // window on the back wall (15%–40% across), matching the floor plan
    const wx1 = 120 + 760 * .15, wx2 = 120 + 760 * .4, wy1 = top + wallH * .18, wy2 = top + wallH * .62;
    g += R(wx1 - 6, wy1 - 6, wx2 - wx1 + 12, wy2 - wy1 + 12, "#fff") + R(wx1, wy1, wx2 - wx1, wy2 - wy1, "url(#rd-sky)") +
      L((wx1 + wx2) / 2, wy1, (wx1 + wx2) / 2, wy2, "#fff", 4) + L(wx1, (wy1 + wy2) / 2, wx2, (wy1 + wy2) / 2, "#fff", 4);
    g += R(wx1 - 20, wy1 - 16, 16, wy2 - wy1 + 50, shade(wall, -18), 'rx="3" opacity=".8"') + R(wx2 + 4, wy1 - 16, 16, wy2 - wy1 + 50, shade(wall, -18), 'rx="3" opacity=".8"');
    // picture frame
    g += R(120 + 760 * .66, top + wallH * .2, 760 * .14, wallH * .2, "#fff", 'stroke="#caa56a" stroke-width="5"') +
      `<path d="M${120 + 760 * .67} ${top + wallH * .37} l${760 * .04} ${-wallH * .09} l${760 * .03} ${wallH * .05} l${760 * .03} ${-wallH * .07} l${760 * .03} ${wallH * .11}z" fill="#9fc3a0"/>`;
    // floor
    const fl = S.floor === "Wood" ? "#b88b5f" : S.floor === "Terrazzo" ? "#e7e2da" : "#e9e6e1";
    g += `<polygon points="120,${wb} 880,${wb} 1000,${H} 0,${H}" fill="${fl}"/>`;
    if (S.floor !== "Terrazzo") {
      const n = S.floor === "Wood" ? 16 : Math.max(6, Math.round(S.W / 60));
      for (let i = 1; i < n; i++) g += L(120 + 760 * i / n, wb, 1000 * i / n, H, S.floor === "Wood" ? "#a47a50" : "#d4d0ca", 1);
      if (S.floor === "Tiles") {
        const rows = Math.max(2, Math.round(S.L / 60));
        for (let i = 1; i < rows; i++) { const t = i / rows, y = wb + fd * t, x1 = 120 - 120 * t; g += L(x1, y, 1000 - x1, y, "#d4d0ca", 1); }
      }
    } else {
      for (let i = 0; i < 220; i++) {
        const t = ((i * 37) % 100) / 100, u = ((i * 61) % 100) / 100, y = wb + fd * t, x = (120 - 120 * t) + u * (760 + 240 * t);
        g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1 + t * 1.6).toFixed(1)}" fill="${["#b9b2a7", "#8f9a9e", "#c9a88a"][i % 3]}"/>`;
      }
    }
    g += R(120, wb - 8, 760, 8, shade(wall, -25));
    // furniture, back to front
    const units = boxes(null).sort((a, b) => (a.y + a.d) - (b.y + b.d));
    units.forEach(o => {
      const t = Math.min(1, (o.y + o.d) / S.L), k = 1 + t * .3158;
      const yb = wb + fd * t, x = X(o.x, t), w = o.w * s * k, h = o.pc.h * s * k;
      g += `<ellipse cx="${(x + w / 2).toFixed(1)}" cy="${(yb - 2).toFixed(1)}" rx="${(w * .58).toFixed(1)}" ry="${Math.max(4, w * .06).toFixed(1)}" fill="url(#rd-shadow)"/>`;
      g += `<g><title>${esc(o.pc.name)}</title>${DRAW[o.pc.shape](x, yb, w, h, hex(o.it.colour))}</g>`;
    });
    if (!units.length) g += R(300, wb + fd / 2 - 30, 400, 44, "#fff", 'rx="22" opacity=".9"') +
      `<text x="500" y="${wb + fd / 2}" text-anchor="middle" font-size="20" fill="#5f6368" font-family="Inter, sans-serif">Tap pieces below to add them</text>`;
    return `<svg viewBox="0 0 1000 ${H.toFixed(0)}" class="rd-svg" role="img" aria-label="Picture of your ${esc(ROOMS[S.room].label.toLowerCase())} with the pieces you picked">${g}</svg>`;
  }

  // ---------- floor plan (to scale, draggable) ----------
  function luma(h) { const n = parseInt(h.slice(1), 16); return .299 * (n >> 16) + .587 * ((n >> 8) & 255) + .114 * (n & 255); }
  function floorPlan() {
    const pad = 40;
    const all = boxes(null);
    const bad = new Set();
    all.forEach((a, i) => all.forEach((b, j) => { if (i < j && overlap(a, b, -1)) { bad.add(a.u); bad.add(b.u); } }));
    let g = R(-pad, -pad, S.W + pad * 2, S.L + pad * 2, "#fff");
    g += R(0, 0, S.W, S.L, S.floor === "Wood" ? "#f3e7d9" : "#f7f5f1", 'stroke="#202124" stroke-width="8"');
    for (let x = 50; x < S.W; x += 50) g += L(x, 0, x, S.L, "#e6e2dc", 1);
    for (let y = 50; y < S.L; y += 50) g += L(0, y, S.W, y, "#e6e2dc", 1);
    g += R(S.W * .15, -6, S.W * .25, 12, "#9cc7ea") + `<text x="${S.W * .275}" y="-14" text-anchor="middle" class="rd-pl-note">window</text>`;
    const dw = Math.min(90, S.W * .25), dx = S.W - dw - 20;
    g += R(dx, S.L - 6, dw, 12, "#fff") + `<path d="M${dx} ${S.L} A${dw} ${dw} 0 0 1 ${dx + dw} ${S.L - dw}" fill="none" stroke="#9aa0a6" stroke-dasharray="6 5" stroke-width="2"/>` +
      L(dx + dw, S.L, dx + dw, S.L - dw, "#9aa0a6", 3) + `<text x="${dx + dw / 2}" y="${S.L + 28}" text-anchor="middle" class="rd-pl-note">door</text>`;
    g += `<text x="${S.W / 2}" y="${S.L + 28}" text-anchor="middle" class="rd-pl-dim">${(S.W / 100).toFixed(1)} m</text>`;
    g += `<text x="-18" y="${S.L / 2}" text-anchor="middle" transform="rotate(-90 -18 ${S.L / 2})" class="rd-pl-dim">${(S.L / 100).toFixed(1)} m</text>`;
    S.items.forEach((it, ii) => {
      const pc = pieceFor(it.key);
      const colour = hex(it.colour);
      it.units.forEach((u, ui) => {
        const sz = size(pc, u);
        const fs = Math.max(9, Math.min(20, Math.min(sz.w, sz.d) / 4.5));
        const label = pc.type.replace("Sectional ", "L-").replace("Classroom Desk", "Desk");
        g += `<g class="rd-unit${bad.has(u) ? " clash" : ""}" data-i="${ii}" data-u="${ui}" transform="translate(${u.x} ${u.y})" tabindex="0" role="button" aria-label="${esc(pc.name)}. Drag to move, tap to turn.">` +
          R(0, 0, sz.w, sz.d, colour, `rx="6" stroke="${bad.has(u) ? "#d93025" : shade(colour, -35)}" stroke-width="${bad.has(u) ? 4 : 2}" fill-opacity=".88"`) +
          (sz.w > 40 && sz.d > 25 ? `<text x="${sz.w / 2}" y="${sz.d / 2 + fs / 3}" text-anchor="middle" font-size="${fs.toFixed(0)}" fill="${luma(colour) > 150 ? "#202124" : "#fff"}">${esc(label)}</text>` : "") +
          `</g>`;
      });
    });
    const used = all.reduce((s, o) => s + o.w * o.d, 0) / (S.W * S.L);
    return { svg: `<svg viewBox="${-pad} ${-pad} ${S.W + pad * 2} ${S.L + pad * 2}" class="rd-svg rd-plan" role="img" aria-label="Floor plan, drawn to scale">${g}</svg>`, clashes: bad.size, used };
  }

  // ---------- UI ----------
  root.innerHTML = `
    <div class="rd-setup">
      <div class="room-picks rd-rooms" id="rd-rooms" role="group" aria-label="Which room"></div>
      <div class="rd-row">
        <label>Width (m)<input id="rd-w" type="number" min="1.5" max="20" step="0.1" inputmode="decimal"></label>
        <label>Length (m)<input id="rd-l" type="number" min="1.5" max="20" step="0.1" inputmode="decimal"></label>
        <label>Budget (GH₵)<input id="rd-budget" type="number" min="0" step="500" inputmode="numeric"></label>
      </div>
      <div class="rd-looks">
        <div><span class="rd-lbl">Walls</span><div class="rd-swatches" id="rd-walls"></div><small class="rd-paper-note" id="rd-paper-note"></small></div>
        <div><span class="rd-lbl">Floor</span><div class="rd-pills" id="rd-floors"></div></div>
      </div>
    </div>
    <div class="rd-stage">
      <div class="rd-tabs">
        <div class="rd-tablist" role="tablist">
          <button type="button" role="tab" data-view="room">Room view</button>
          <button type="button" role="tab" data-view="plan">Floor plan</button>
        </div>
        <span class="rd-tools">
          <button type="button" class="btn btn-ghost btn-sm" id="rd-auto">Fill for my budget</button>
          <button type="button" class="btn btn-ghost btn-sm" id="rd-arrange">Arrange</button>
          <button type="button" class="btn btn-ghost btn-sm" id="rd-clear">Clear</button>
        </span>
      </div>
      <div class="rd-canvas" id="rd-canvas"></div>
      <p class="rd-status" id="rd-status" aria-live="polite"></p>
    </div>
    <div class="rd-pieces">
      <div class="rd-pieces-head"><h3>Tap to add</h3><label class="rd-all"><input type="checkbox" id="rd-all"> Pieces for every room</label></div>
      <div class="rd-grid" id="rd-grid"></div>
    </div>
    <div class="rd-cart" id="rd-cart"></div>`;

  function renderSetup() {
    $("#rd-rooms").innerHTML = Object.entries(ROOMS).map(([id, r]) =>
      `<button type="button" class="room-pick" data-room="${id}" aria-pressed="${id === S.room}">${C.iconSvg(C.ICONS[r.icon], 24)}<span>${esc(r.label)}</span></button>`).join("");
    $("#rd-w").value = (S.W / 100).toFixed(1);
    $("#rd-l").value = (S.L / 100).toFixed(1);
    $("#rd-budget").value = S.budget;
    $("#rd-walls").innerHTML =
      Object.entries(WALLS).map(([n, h]) => `<button type="button" data-wall="${esc(n)}" style="background:${h}" aria-pressed="${!S.paper && n === S.wall}" title="${esc(n)} paint" aria-label="${esc(n)} paint"></button>`).join("") +
      `<span class="rd-sep" aria-hidden="true"></span>` +
      papers().map(p => `<button type="button" class="paper" data-paper="${esc(p.id)}" style="background:${p.style ? p.style.swatch : `center/cover url('${esc(img(p.img))}')`}" aria-pressed="${S.paper === p.id}" title="${esc(p.name)} · ${p.price ? money(p.price) + " a roll" : "ask for price"}" aria-label="${esc(p.name)}"></button>`).join("");
    const pl = paperLine();
    $("#rd-paper-note").textContent = pl ? `${pl.p.name}: about ${pl.rolls} rolls for this room${pl.p.price ? ` · ${money(pl.total)}` : " · we'll quote"}` : "Paint colours, then wallpapers";
    $("#rd-floors").innerHTML = FLOORS.map(f => `<button type="button" data-floor="${f}" aria-pressed="${f === S.floor}">${f}</button>`).join("");
    $("#rd-all").checked = S.all;
  }

  function renderPieces() {
    $("#rd-grid").innerHTML = roomPieces(S.all).map(pc => {
      const it = S.items.find(x => x.key === pc.key);
      return `<article class="rd-piece${it ? " on" : ""}">
        <button type="button" class="rd-piece-main" data-add="${esc(pc.key)}">
          <span class="rd-piece-img">${pc.img ? `<img src="${esc(img(pc.img))}" alt="" loading="lazy">` : C.iconSvg(C.categoryIcon({ type: pc.type, category: "" }), 30)}</span>
          <span class="rd-piece-txt"><strong>${esc(pc.name)}</strong>
            <small>${pc.price ? money(pc.price) : "Ask for price"} · about ${(pc.w / 100).toFixed(1)} × ${(pc.d / 100).toFixed(1)} m</small></span>
          <span class="rd-piece-add" aria-hidden="true">${it ? "+1" : "Add"}</span>
        </button>
        ${it ? `<div class="rd-piece-ctl">
          <div class="rd-colours">${pc.colours.map(c => `<button type="button" data-colour="${esc(c)}" data-key="${esc(pc.key)}" style="background:${hex(c)}" aria-pressed="${c === it.colour}" title="${esc(c)}" aria-label="${esc(c)}"></button>`).join("")}</div>
          <div class="qty" role="group" aria-label="Quantity">
            <button type="button" data-q="-1" data-key="${esc(pc.key)}" aria-label="Fewer">−</button>
            <input type="number" min="0" max="120" value="${it.qty}" data-qi="${esc(pc.key)}" aria-label="Quantity" inputmode="numeric">
            <button type="button" data-q="1" data-key="${esc(pc.key)}" aria-label="More">+</button>
          </div>
        </div>` : ""}
      </article>`;
    }).join("");
  }

  function totals() {
    let total = 0;
    const priced = [], quote = [];
    S.items.forEach(it => {
      const pc = pieceFor(it.key);
      if (pc.price) { total += pc.price * it.qty; priced.push({ it, pc }); } else quote.push({ it, pc });
    });
    const paper = paperLine();
    if (paper) total += paper.total;
    return { total, priced, quote, paper, paperPriced: !!(paper && paper.p.price) };
  }

  function renderCanvas() {
    root.querySelectorAll(".rd-tabs [data-view]").forEach(t => t.setAttribute("aria-selected", String(t.dataset.view === S.view)));
    const plan = floorPlan();
    $("#rd-canvas").innerHTML = S.view === "room" ? roomView() : plan.svg;
    $("#rd-canvas").classList.toggle("is-plan", S.view === "plan");
    const pct = Math.round(plan.used * 100);
    $("#rd-status").innerHTML = !S.items.length ? "Your room is empty. Tap pieces below, or <b>Fill for my budget</b>."
      : plan.clashes ? `<span class="bad">Some pieces overlap.</span> Open the floor plan to move them, or tap <b>Arrange</b>.`
        : pct > 55 ? `<span class="warn">Tight fit:</span> furniture covers ${pct}% of the floor. Leave about 90 cm to walk.`
          : `<span class="good">Fits well.</span> Furniture covers ${pct}% of the floor.${S.view === "room" ? " Open the floor plan to move pieces." : " Drag to move, tap a piece to turn it."}`;
  }

  function designText() {
    const { total, priced, quote, paper } = totals();
    return `Room: ${ROOMS[S.room].label}, ${(S.W / 100).toFixed(1)} × ${(S.L / 100).toFixed(1)} m, ${paper ? paper.p.name + " wallpaper" : S.wall + " wall"}, ${S.floor} floor\n` +
      priced.map(({ it, pc }) => `- ${pc.name} (${pc.key}), ${it.colour} × ${it.qty} = ${money(pc.price * it.qty)}`).join("\n") +
      (paper && paper.p.price ? `\n- ${paper.p.name} (${paper.p.id}) × ${paper.rolls} rolls = ${money(paper.total)}` : "") +
      (paper && !paper.p.price ? `\n- Please quote: ${paper.p.name}, about ${paper.rolls} rolls (${Math.round(paper.area)} m² of wall)` : "") +
      (quote.length ? `\nPlease quote:\n` + quote.map(({ it, pc }) => `- ${pc.name}, ${it.colour} × ${it.qty}`).join("\n") : "") +
      `\nTotal for listed items: ${money(total)}\nMy design: ${shareUrl()}`;
  }

  function renderCart() {
    const { total, priced, quote, paper, paperPriced } = totals();
    const pct = S.budget ? Math.min(100, Math.round(total / S.budget * 100)) : 0;
    const over = S.budget && total > S.budget;
    const count = priced.length + (paperPriced ? 1 : 0);
    const quoting = quote.length || (paper && !paperPriced);
    $("#rd-cart").innerHTML = `
      <h3>Your room</h3>
      <div class="pl-sum">
        <div><span>Total</span><strong>${money(total)}</strong></div>
        <div><span>Budget</span><strong>${money(S.budget)}</strong></div>
        <div><span>${over ? "Over by" : "Left"}</span><strong class="${over ? "bad" : "ok"}">${money(Math.abs(S.budget - total))}</strong></div>
      </div>
      <div class="pl-bar${over ? " over" : ""}"><span style="width:${pct}%"></span></div>
      ${count || quoting ? `<ul class="rd-lines">
        ${priced.map(({ it, pc }) => `<li><span class="rd-dot" style="background:${hex(it.colour)}"></span><span>${esc(pc.name)} <small>${esc(it.colour)} × ${it.qty}</small></span><b>${money(pc.price * it.qty)}</b></li>`).join("")}
        ${paper ? `<li class="${paperPriced ? "" : "q"}"><span class="rd-dot" style="background:${paper.p.style ? paper.p.style.swatch : `center/cover url('${esc(img(paper.p.img))}')`}"></span><span>${esc(paper.p.name)} <small>${paper.rolls} rolls for about ${Math.round(paper.area)} m² of wall</small></span><b>${paperPriced ? money(paper.total) : "Quote"}</b></li>` : ""}
        ${quote.map(({ it, pc }) => `<li class="q"><span class="rd-dot" style="background:${hex(it.colour)}"></span><span>${esc(pc.name)} <small>${esc(it.colour)} × ${it.qty}</small></span><b>Quote</b></li>`).join("")}
      </ul>` : `<p class="rd-empty">Nothing added yet.</p>`}
      <p class="rd-free">Designing is free. You only pay for what you order${quoting ? "; we'll quote the items marked Quote" : ""}.</p>
      <div class="rd-actions">
        ${count ? `<button type="button" class="btn btn-gold" id="rd-order">Order ${count > 1 ? "these items" : "this item"} · ${money(total)}</button>` : ""}
        ${S.items.length || paper ? `<a class="btn ${count ? "btn-wa" : "btn-gold"}" id="rd-wa" target="_blank" rel="noopener" href="${waLink(`Hello F.A Vision, I designed my room on your website.\n${designText()}`)}">${count ? "Ask on WhatsApp" : "Request a quote on WhatsApp"}</a>` : ""}
        ${S.items.length || paper ? `<button type="button" class="btn btn-ghost" id="rd-share">Share my design</button>` : ""}
      </div>
      <p class="rd-note">The room view is a drawing to show fit and colour. Sizes are typical, so your piece may differ slightly; check each product's photos before ordering. Want your new pieces shown in a photo of your real room? It's free with any order: send the photo on WhatsApp.</p>`;
  }

  function render() { renderSetup(); renderPieces(); renderCanvas(); renderCart(); saveHash(); }
  const refresh = () => { renderPieces(); renderCanvas(); renderCart(); saveHash(); };

  // ---------- share link (state in the URL hash) ----------
  function encode() {
    const o = { r: S.room, w: S.W, l: S.L, a: S.wall, p: S.paper, f: S.floor, b: S.budget,
      i: S.items.map(it => [it.key, it.colour, it.units.map(u => [Math.round(u.x), Math.round(u.y), u.rot ? 1 : 0])]) };
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const clampCm = v => Math.max(150, Math.min(2000, Math.round(Number(v) || 350)));
  function decode(str) {
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/")))));
      if (!ROOMS[o.r]) return false;
      S.room = o.r; S.W = clampCm(o.w); S.L = clampCm(o.l);
      S.wall = WALLS[o.a] ? o.a : "Cream"; S.floor = FLOORS.includes(o.f) ? o.f : "Tiles"; S.budget = Math.max(0, Number(o.b) || 0);
      S.paper = paperFor(o.p) ? o.p : null;
      S.items = (o.i || []).filter(x => Array.isArray(x) && pieceFor(x[0])).slice(0, 40).map(([key, colour, units]) => {
        const pc = pieceFor(key);
        const us = (units || []).slice(0, 120).map(([x, y, r]) => ({ x: Number(x) || 0, y: Number(y) || 0, rot: r ? 1 : 0 }));
        return { key, colour: pc.colours.includes(colour) ? colour : pc.colours[0], qty: us.length, units: us };
      }).filter(it => it.qty);
      return true;
    } catch (e) { return false; }
  }
  const shareUrl = () => location.origin + location.pathname + "#design=" + encode();
  let hashTimer;
  function saveHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      if (location.hash && !/^#(design=|designer$)/.test(location.hash)) return;
      history.replaceState(null, "", S.items.length || S.paper ? "#design=" + encode() : location.pathname + location.search);
    }, 400);
  }

  // ---------- events ----------
  function setRoom(id) {
    S.room = id;
    [S.W, S.L] = ROOMS[id].size.map(m => m * 100);
    S.budget = ROOMS[id].budget;
    S.items = [];
    render();
  }
  root.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (!t || !root.contains(t)) return;
    if (t.dataset.room) return setRoom(t.dataset.room);
    if (t.dataset.wall) { S.wall = t.dataset.wall; S.paper = null; renderSetup(); renderCanvas(); renderCart(); saveHash(); return; }
    if (t.dataset.paper) { S.paper = S.paper === t.dataset.paper ? null : t.dataset.paper; renderSetup(); renderCanvas(); renderCart(); saveHash(); return; }
    if (t.dataset.floor) { S.floor = t.dataset.floor; renderSetup(); renderCanvas(); saveHash(); return; }
    if (t.dataset.view) { S.view = t.dataset.view; return renderCanvas(); }
    if (t.dataset.add) { add(t.dataset.add); return refresh(); }
    if (t.dataset.colour) { S.items.find(x => x.key === t.dataset.key).colour = t.dataset.colour; return refresh(); }
    if (t.dataset.q) { const it = S.items.find(x => x.key === t.dataset.key); setQty(it, it.qty + Number(t.dataset.q)); return refresh(); }
    if (t.id === "rd-auto") { autofill(); return refresh(); }
    if (t.id === "rd-arrange") { arrange(); return refresh(); }
    if (t.id === "rd-clear") { S.items = []; S.paper = null; renderSetup(); return refresh(); }
    if (t.id === "rd-order") return order();
    if (t.id === "rd-share") return share(t);
  });
  root.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "rd-all") { S.all = t.checked; return renderPieces(); }
    if (t.dataset.qi) { const it = S.items.find(x => x.key === t.dataset.qi); setQty(it, parseInt(t.value, 10) || 0); return refresh(); }
    if (t.id === "rd-w" || t.id === "rd-l") {
      S.W = clampCm(parseFloat($("#rd-w").value) * 100); S.L = clampCm(parseFloat($("#rd-l").value) * 100);
      arrange(); renderSetup(); return refresh();
    }
    if (t.id === "rd-budget") { S.budget = Math.max(0, Number(t.value) || 0); return renderCart(); }
  });

  // Drag on the floor plan; a tap without moving turns the piece 90°.
  let drag = null;
  const toSvg = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  root.addEventListener("pointerdown", e => {
    const g = e.target.closest(".rd-unit");
    if (!g) return;
    const svg = g.ownerSVGElement;
    const it = S.items[Number(g.dataset.i)], u = it.units[Number(g.dataset.u)];
    const pt = toSvg(svg, e);
    drag = { g, svg, it, u, dx: pt.x - u.x, dy: pt.y - u.y, sx: e.clientX, sy: e.clientY, moved: false };
    g.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  root.addEventListener("pointermove", e => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const sz = size(pieceFor(drag.it.key), drag.u), pt = toSvg(drag.svg, e);
    drag.u.x = Math.round(Math.max(0, Math.min(S.W - sz.w, pt.x - drag.dx)) / 5) * 5;
    drag.u.y = Math.round(Math.max(0, Math.min(S.L - sz.d, pt.y - drag.dy)) / 5) * 5;
    drag.g.setAttribute("transform", `translate(${drag.u.x} ${drag.u.y})`);
  });
  const endDrag = () => {
    if (!drag) return;
    if (!drag.moved) {
      drag.u.rot = drag.u.rot ? 0 : 1;
      const sz = size(pieceFor(drag.it.key), drag.u);
      drag.u.x = Math.max(0, Math.min(S.W - sz.w, drag.u.x));
      drag.u.y = Math.max(0, Math.min(S.L - sz.d, drag.u.y));
    }
    drag = null;
    renderCanvas(); saveHash();
  };
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);
  root.addEventListener("keydown", e => {
    const g = e.target.closest && e.target.closest(".rd-unit");
    if (!g) return;
    const it = S.items[Number(g.dataset.i)], u = it.units[Number(g.dataset.u)], pc = pieceFor(it.key);
    const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (e.key === "Enter" || e.key === " ") u.rot = u.rot ? 0 : 1;
    else if (step) { u.x += step[0]; u.y += step[1]; } else return;
    e.preventDefault();
    const sz = size(pc, u);
    u.x = Math.max(0, Math.min(S.W - sz.w, u.x)); u.y = Math.max(0, Math.min(S.L - sz.d, u.y));
    renderCanvas(); saveHash();
    const again = root.querySelector(`.rd-unit[data-i="${g.dataset.i}"][data-u="${g.dataset.u}"]`);
    if (again) again.focus();
  });

  async function share(btn) {
    const url = shareUrl();
    try {
      if (navigator.share) { await navigator.share({ title: "My room design · F.A Vision", url }); return; }
      await navigator.clipboard.writeText(url);
      btn.textContent = "Link copied ✓";
      setTimeout(() => { btn.textContent = "Share my design"; }, 1800);
    } catch (err) { /* cancelled */ }
  }

  // Checkout: one order for all priced items; unpriced pieces ride along as a quote request.
  function order() {
    const { total, priced, quote, paper, paperPriced } = totals();
    const items = priced.map(({ it, pc }) => ({ id: pc.key, name: pc.name, colour: it.colour, qty: it.qty, price_ghs: pc.price }));
    if (paperPriced) items.push({ id: paper.p.id, name: paper.p.name, colour: "", qty: paper.rolls, price_ghs: paper.p.price });
    if (paper && !paperPriced) quote.push({ pc: { name: paper.p.name } });
    if (!items.length) return;
    const brief = designText();
    const one = items.length === 1 && items[0];
    CO.open({
      id: "ROOM-DESIGN",
      name: one ? `${one.name}${one.colour ? ` (${one.colour})` : ""} × ${one.qty}` : `Room design: ${items.length} items`,
      price_ghs: total,
      in_stock: true,
      images: one ? ((products.find(p => p.id === one.id) || {}).images || []).slice(0, 1).map(img) : [],
      iconPath: C.ICONS[ROOMS[S.room].icon],
      items,
      brief,
      note: (quote.length ? `We'll also quote ${quote.map(q => q.pc.name.toLowerCase()).join(", ")} on WhatsApp. ` : "") + "Delivery fee, if any, depends on your location and is agreed on WhatsApp.",
      after: "Free with your order: send a photo of your room on WhatsApp and we'll show your new pieces in it.",
      onRecord: o => {
        if (!business.enquiry_endpoint) return;
        fetch(business.enquiry_endpoint, {
          method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ name: o.name, phone: o.phone, email: o.email, product: `Room design (${o.reference})`, quantity: 1,
            message: `Room Designer order ${o.reference} · ${o.plan_label} · ${money(o.total)}\n${brief}`, source: "room-designer" })
        }).catch(() => {});
      }
    });
  }

  // ---------- start ----------
  const m = location.hash.match(/^#design=([\w-]+)/);
  if (!(m && decode(m[1]))) { [S.W, S.L] = ROOMS.living.size.map(v => v * 100); S.budget = ROOMS.living.budget; }
  render();
  if (m) setTimeout(() => document.getElementById("designer").scrollIntoView(), 60);
})();
