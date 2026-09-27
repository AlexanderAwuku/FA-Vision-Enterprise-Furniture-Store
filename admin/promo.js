// Branded promo images for Facebook / Instagram posts and WhatsApp status,
// drawn in the browser from a product and its main photo.
window.PromoMaker = (function () {
  const C = window.FAV_CONFIG;
  const FORMATS = { square: { w: 1080, h: 1080, label: "Post (square)" }, story: { w: 1080, h: 1920, label: "Status / Story" } };
  const THEMES = {
    dark: { bg: "#15100c", bg2: "#2a1f17", text: "#ffffff", muted: "rgba(255,255,255,.7)", accent: "#e2b866", bar: "#c9973f", barText: "#15100c", frame: "#2e231a", label: "Dark & gold" },
    light: { bg: "#f7f1e8", bg2: "#efe2cf", text: "#1c1510", muted: "#74675b", accent: "#a8741f", bar: "#15100c", barText: "#e2b866", frame: "#e7ddd0", label: "Cream" }
  };
  let dlg, state = { format: "square", theme: "dark" }, product, business, photoUrl, photoImg = null, lastBlob = null;

  const serif = px => `600 ${px}px Fraunces, Georgia, serif`;
  const sans = (px, w) => `${w || 600} ${px}px Inter, system-ui, sans-serif`;

  function loadImage(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text).split(/\s+/), lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + "…").width > maxW && last.length) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }

  function draw() {
    const f = FORMATS[state.format], t = THEMES[state.theme], p = product;
    const W = f.w, H = f.h, story = state.format === "story";
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    // background
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.bg2); g.addColorStop(0.5, t.bg); g.addColorStop(1, t.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, W * 0.7);
    g.addColorStop(0, state.theme === "dark" ? "rgba(201,151,63,.28)" : "rgba(201,151,63,.18)"); g.addColorStop(1, "rgba(201,151,63,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const M = 64;
    let y = story ? 120 : 64;

    // logo
    g = ctx.createLinearGradient(M, y, M + 72, y + 72);
    g.addColorStop(0, "#e2b866"); g.addColorStop(1, "#c9973f");
    ctx.fillStyle = g; roundRect(ctx, M, y, 72, 72, 16); ctx.fill();
    ctx.fillStyle = "#15100c"; ctx.font = "700 30px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("FA", M + 36, y + 38);
    ctx.textAlign = "left"; ctx.fillStyle = t.text; ctx.font = serif(36);
    ctx.fillText("Vision Enterprise", M + 92, y + 30);
    ctx.fillStyle = t.muted; ctx.font = sans(18, 500);
    ctx.fillText("ODORKOR · ACCRA", M + 94, y + 60);

    // badge
    const badge = !p.in_stock ? "SOLD OUT" : p.custom_order ? "MADE TO ORDER" : "IN STOCK";
    ctx.font = sans(20, 700);
    const bw = ctx.measureText(badge).width + 40;
    ctx.fillStyle = t.accent; roundRect(ctx, W - M - bw, y + 16, bw, 44, 22); ctx.fill();
    ctx.fillStyle = state.theme === "dark" ? "#15100c" : "#fff"; ctx.textBaseline = "middle";
    ctx.fillText(badge, W - M - bw + 20, y + 39);

    // photo
    y += story ? 140 : 110;
    const pw = W - M * 2, ph = story ? Math.round(pw * 3 / 4) : 560;
    ctx.save();
    roundRect(ctx, M, y, pw, ph, 28); ctx.clip();
    ctx.fillStyle = t.frame; ctx.fillRect(M, y, pw, ph);
    if (photoImg) {
      const s = Math.max(pw / photoImg.width, ph / photoImg.height);
      ctx.drawImage(photoImg, M + (pw - photoImg.width * s) / 2, y + (ph - photoImg.height * s) / 2, photoImg.width * s, photoImg.height * s);
    } else {
      g = ctx.createLinearGradient(M, y, M + pw, y + ph);
      g.addColorStop(0, "#f4e6d4"); g.addColorStop(1, "#dfc3a0");
      ctx.fillStyle = g; ctx.fillRect(M, y, pw, ph);
      const icon = new Path2D(C.categoryIcon(p));
      const k = ph * 0.5 / 24;
      ctx.translate(M + pw / 2 - 12 * k, y + ph / 2 - 12 * k); ctx.scale(k, k);
      ctx.strokeStyle = "#c9973f"; ctx.lineWidth = 1.4; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(icon);
    }
    ctx.restore();

    // name + price
    y += ph + (story ? 90 : 70);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = t.text; ctx.font = serif(story ? 72 : 58);
    const lines = wrap(ctx, p.name, W - M * 2, story ? 3 : 2);
    lines.forEach((l, i) => ctx.fillText(l, M, y + i * (story ? 84 : 66)));
    y += (lines.length - 1) * (story ? 84 : 66) + (story ? 100 : 76);

    ctx.fillStyle = t.accent; ctx.font = sans(story ? 76 : 60, 800);
    const price = p.price_ghs ? C.formatPrice(p.price_ghs) : "Price on request";
    ctx.fillText(price, M, y);
    if (p.price_ghs && p.negotiable) {
      const pwid = ctx.measureText(price).width;
      ctx.fillStyle = t.muted; ctx.font = sans(story ? 28 : 24, 500);
      ctx.fillText("Negotiable", M + pwid + 20, y - 4);
    }

    // features (story only has room)
    if (story && (p.highlights || []).length) {
      y += 90;
      ctx.font = sans(34, 500);
      p.highlights.slice(0, 3).forEach((h, i) => {
        ctx.fillStyle = t.accent; ctx.fillText("✓", M, y + i * 60);
        ctx.fillStyle = t.text; ctx.fillText(wrap(ctx, h, W - M * 2 - 50, 1)[0], M + 50, y + i * 60);
      });
    }

    // contact bar
    const barH = story ? 150 : 110;
    if (story) {
      // tagline and call to action fill the lower part of the status
      const ty = H - barH - 150;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = t.muted; ctx.font = "italic 500 34px Fraunces, Georgia, serif";
      ctx.fillText("Bringing love to your Homes, Offices & Schools", W / 2, ty);
      ctx.font = sans(34, 800);
      const cta = "Chat with us to order  →";
      const cw = ctx.measureText(cta).width + 80;
      ctx.fillStyle = t.accent; roundRect(ctx, (W - cw) / 2, ty + 36, cw, 76, 38); ctx.fill();
      ctx.fillStyle = state.theme === "dark" ? "#15100c" : "#fff"; ctx.textBaseline = "middle";
      ctx.fillText(cta, W / 2, ty + 75);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = t.bar; ctx.fillRect(0, H - barH, W, barH);
    ctx.fillStyle = t.barText; ctx.textBaseline = "middle";
    ctx.font = sans(story ? 40 : 34, 800);
    ctx.fillText("WhatsApp " + C.localPhone(business.whatsapp), M, H - barH / 2 - (story ? 22 : 0));
    if (story) {
      ctx.font = sans(28, 500);
      ctx.fillText("Delivery across Ghana · Odorkor, Accra", M, H - barH / 2 + 30);
    } else {
      ctx.font = sans(24, 600); ctx.textAlign = "right";
      ctx.fillText("Delivery across Ghana", W - M, H - barH / 2);
    }
    return c;
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  async function refresh() {
    const c = draw();
    lastBlob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
    const img = dlg.querySelector(".promo-preview");
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    img.dataset.url = URL.createObjectURL(lastBlob);
    img.src = img.dataset.url;
    img.className = "promo-preview " + state.format;
    dlg.querySelectorAll("[data-format]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.format === state.format)));
    dlg.querySelectorAll("[data-theme]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.theme === state.theme)));
  }

  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "promo";
    dlg.innerHTML = `
      <div class="st-top"><button type="button" class="st-link" data-act="close">Close</button><b>Promo image</b><span></span></div>
      <div class="promo-body">
        <img class="promo-preview" alt="Promo image preview">
        <div class="promo-controls">
          <div class="seg">${Object.entries(FORMATS).map(([k, f]) => `<button type="button" data-format="${k}">${f.label}</button>`).join("")}</div>
          <div class="seg">${Object.entries(THEMES).map(([k, t]) => `<button type="button" data-theme="${k}">${t.label}</button>`).join("")}</div>
          <button type="button" class="btn btn-wa btn-block" data-act="share">Share image</button>
          <button type="button" class="btn btn-ghost btn-block" data-act="download">Download image</button>
          <p class="muted small">Post it on Facebook, Instagram or your WhatsApp status. Put the product link in the caption so buyers can order.</p>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("click", async e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.format) { state.format = b.dataset.format; return refresh(); }
      if (b.dataset.theme) { state.theme = b.dataset.theme; return refresh(); }
      const name = `fa-vision-${slug(product.name)}-${state.format}.jpg`;
      if (b.dataset.act === "close") return dlg.close();
      if (b.dataset.act === "download") return download(name);
      if (b.dataset.act === "share") {
        const file = new File([lastBlob], name, { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: product.name }); } catch (err) { /* share sheet closed */ }
        } else download(name);
      }
    });
  }

  function download(name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(lastBlob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function open(p, biz, url) {
    if (!dlg) build();
    product = p; business = biz;
    if (url !== photoUrl) { photoUrl = url; photoImg = await loadImage(url); }
    try { await Promise.all([document.fonts.load(serif(58)), document.fonts.load(sans(34, 800))]); } catch (e) { /* fall back to system fonts */ }
    dlg.showModal();
    await refresh();
  }

  return { open, draw: () => draw() };
})();
