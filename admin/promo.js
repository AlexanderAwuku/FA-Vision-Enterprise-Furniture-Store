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
      const iw = photoImg.width, ih = photoImg.height;
      // soft blurred fill behind, so the frame never looks empty
      const cover = Math.max(pw / iw, ph / ih) * 1.15;
      if ("filter" in ctx) {
        ctx.filter = "blur(28px) brightness(" + (state.theme === "dark" ? .6 : .95) + ")";
        ctx.drawImage(photoImg, M + (pw - iw * cover) / 2, y + (ph - ih * cover) / 2, iw * cover, ih * cover);
        ctx.filter = "none";
      }
      // whole product visible: fit (contain), never crop
      const s = Math.min(pw / iw, ph / ih);
      const dw = iw * s, dh = ih * s, dx = M + (pw - dw) / 2, dy = y + (ph - dh) / 2;
      ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 30;
      ctx.drawImage(photoImg, dx, dy, dw, dh);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
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

  // Where each platform button sends the image. Browsers can't post straight onto
  // WhatsApp Status or Instagram, so on phones we hand the image + caption to the
  // phone's share sheet (which lists "My status", Instagram Stories/Feed, Facebook).
  // On computers we save the image, copy the caption and open the platform.
  const PLATFORMS = {
    wa: { label: "WhatsApp Status", format: "story",  cap: "status", tip: "Pick WhatsApp → My status, then paste the caption.", desktop: () => "https://web.whatsapp.com/" },
    fb: { label: "Facebook",        format: "square", cap: "post",   tip: "Pick Facebook, then paste the caption.",            desktop: () => "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(share.link || "") },
    ig: { label: "Instagram",       format: null,     cap: "post",   tip: "Pick Instagram (Stories or Feed), then paste the caption.", desktop: () => "https://www.instagram.com/" }
  };
  const ICONS = {
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4A22 22 0 0 0 14.3 4c-2.4 0-4 1.5-4 4.1v2.7H7.6V14h2.7v8h3.2Z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>'
  };
  let share = { link: "", captions: {} };

  function setCaption(key) {
    const box = dlg.querySelector(".promo-caption");
    if (box.dataset.edited === "1") return;          // keep the owner's own edits
    box.value = share.captions[key] || share.captions.post || share.link || product.name;
  }

  async function copyCaption() {
    const box = dlg.querySelector(".promo-caption");
    try { await navigator.clipboard.writeText(box.value); return true; }
    catch (e) { box.select(); try { return document.execCommand("copy"); } catch (e2) { return false; } }
  }

  function hint(msg) {
    const h = dlg.querySelector(".promo-hint");
    h.textContent = msg; h.hidden = !msg;
  }

  const fileName = () => `fa-vision-${slug(product.name)}-${state.format}.jpg`;
  const asFile = () => new File([lastBlob], fileName(), { type: "image/jpeg" });
  const canShareFiles = f => !!(navigator.canShare && navigator.canShare({ files: [f] }));

  async function nativeShare(file) {
    try { await navigator.share({ files: [file], text: dlg.querySelector(".promo-caption").value, title: product.name }); }
    catch (err) { /* share sheet closed */ }
  }

  async function shareTo(key) {
    const pf = PLATFORMS[key];
    if (pf.format && state.format !== pf.format) { state.format = pf.format; await refresh(); }
    setCaption(pf.cap);
    const copied = await copyCaption();
    const file = asFile();
    if (canShareFiles(file)) {                       // phones: straight into the app's share sheet
      hint((copied ? "Caption copied. " : "") + pf.tip);
      return nativeShare(file);
    }
    // Computer (or a browser without file sharing): save image, copy caption, open the platform.
    download(fileName());
    window.open(pf.desktop(), "_blank", "noopener");
    hint(`Image saved${copied ? " and caption copied" : ""}. ` +
      (key === "wa" ? "WhatsApp Status is posted from your phone: open this page on your phone and tap WhatsApp Status, or send the saved image to your phone and post it under Updates → My status."
        : key === "fb" ? "Facebook opened with your product link — add the saved image and paste the caption."
        : "Instagram opened — tap Create (+), choose the saved image and paste the caption."));
  }

  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "promo";
    dlg.innerHTML = `
      <div class="st-top"><button type="button" class="st-link" data-act="close">Close</button><b>Promo image</b><span></span></div>
      <div class="promo-body">
        <div class="promo-stage"><img class="promo-preview" alt="Promo image preview"></div>
        <div class="promo-controls">
          <div class="seg">${Object.entries(FORMATS).map(([k, f]) => `<button type="button" data-format="${k}">${f.label}</button>`).join("")}</div>
          <div class="seg">${Object.entries(THEMES).map(([k, t]) => `<button type="button" data-theme="${k}">${t.label}</button>`).join("")}</div>
          <p class="promo-label">Share to</p>
          <div class="promo-share">
            ${Object.entries(PLATFORMS).map(([k, p]) => `<button type="button" class="pshare pshare-${k}" data-to="${k}">${ICONS[k]}<span>${p.label}</span></button>`).join("")}
          </div>
          <p class="promo-hint" role="status" hidden></p>
          <label class="promo-label" for="promo-caption">Caption <span class="muted">· copied for you when you share</span></label>
          <textarea id="promo-caption" class="promo-caption" rows="5"></textarea>
          <div class="promo-row">
            <button type="button" class="btn btn-ghost" data-act="copy">Copy caption</button>
            <button type="button" class="btn btn-ghost" data-act="more">More apps…</button>
            <button type="button" class="btn btn-ghost" data-act="download">Download</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".promo-caption").addEventListener("input", e => { e.target.dataset.edited = "1"; });
    dlg.addEventListener("click", async e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.format) { state.format = b.dataset.format; setCaption(state.format === "story" ? "status" : "post"); return refresh(); }
      if (b.dataset.theme) { state.theme = b.dataset.theme; return refresh(); }
      if (b.dataset.to) return shareTo(b.dataset.to);
      if (b.dataset.act === "close") return dlg.close();
      if (b.dataset.act === "download") return download(fileName());
      if (b.dataset.act === "copy") return hint((await copyCaption()) ? "Caption copied." : "Couldn't copy — select the caption and copy it.");
      if (b.dataset.act === "more") {
        const copied = await copyCaption();
        const file = asFile();
        if (canShareFiles(file)) return nativeShare(file);
        download(fileName()); hint(`Image saved${copied ? " and caption copied" : ""}.`);
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

  async function open(p, biz, url, shareInfo) {
    if (!dlg) build();
    const changed = product !== p;
    product = p; business = biz;
    share = shareInfo || { link: "", captions: {} };
    if (changed) { dlg.querySelector(".promo-caption").dataset.edited = ""; hint(""); }
    setCaption(state.format === "story" ? "status" : "post");
    if (url !== photoUrl) { photoUrl = url; photoImg = await loadImage(url); }
    try { await Promise.all([document.fonts.load(serif(58)), document.fonts.load(sans(34, 800))]); } catch (e) { /* fall back to system fonts */ }
    dlg.showModal();
    await refresh();
  }

  return { open, draw: () => draw() };
})();
