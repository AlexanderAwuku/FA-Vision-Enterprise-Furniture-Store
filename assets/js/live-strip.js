// Live deals strip: X-style swipeable bubbles with scrolling promo text, each
// with a Share button that sends the product's HD share card (made by
// scripts/make_share_cards.py) to WhatsApp, Facebook, X, TikTok and more.
// Built from window.FAV_DATA (products-data.js), so new listings and price changes show up automatically.
(function () {
  var D = window.FAV_DATA;
  if (!D || !D.products) return;
  var root = document.getElementById("fav-live");
  var SITE = "https://favisionenterprize.github.io/";

  var PROMO_ID = "FAV-014"; // the current headline promo goes first
  var ads = {};
  ((D.business.promos || {}).ads || []).forEach(function (a) { if (a.product) ads[a.product] = a; });

  function cedis(n) { return "GH₵" + Number(n).toLocaleString("en-GH"); }
  function shortName(n) { return String(n).split(" — ")[0]; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function localPhone(n) { var d = String(n || "").replace(/\D/g, ""); d = d.length >= 9 ? "0" + d.slice(-9) : d; return d.length === 10 ? d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6) : d; }

  var products = D.products.filter(function (p) { return !p.placeholder && p.images && p.images.length; });
  products.sort(function (a, b) { return (b.id === PROMO_ID) - (a.id === PROMO_ID); });

  // ------------------------------------------------------------- what each share sends
  function shareInfo(p) {
    if (!p) {
      return {
        title: "F.A Vision Enterprise · Live deals",
        text: products.length + " furniture deals live now at F.A Vision Enterprise, Odorkor, Accra. Pay 50% now, the rest on delivery. WhatsApp " + localPhone(D.business.whatsapp) + ".",
        url: SITE, card: "assets/images/og-cover.jpg"
      };
    }
    var wa = localPhone((p.seller && p.seller.whatsapp) || D.business.whatsapp);
    var price = p.price_ghs ? cedis(p.price_ghs) + (p.id === PROMO_ID ? " a set (GH₵640 each from 50)" : "") : "";
    return {
      title: shortName(p.name) + (price ? " · " + price : ""),
      text: shortName(p.name) + (price ? " · " + price : "") + " at " + (p.seller ? p.seller.name : "F.A Vision Enterprise") + ". Order on WhatsApp " + wa + ".",
      url: p.price_ghs ? SITE + "p/" + p.id + ".html" : SITE + "#product/" + p.id,
      card: p.price_ghs ? "assets/images/share/" + p.id.toLowerCase() + ".jpg" : p.images[0],
      id: p.id
    };
  }

  // ------------------------------------------------------------- share sheet
  var sheet = null, current = null, file = null;
  var ICON_SAVE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19.5h14"/></svg>';
  var ICON_LINK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>';
  // Brand icons (Font Awesome Free, CC BY 4.0), loaded only when the share sheet first opens.
  function loadIcons() {
    ["fontawesome", "brands"].forEach(function (f) {
      var l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/" + f + ".min.css";
      l.crossOrigin = "anonymous";
      document.head.appendChild(l);
    });
  }
  function buildSheet() {
    loadIcons();
    sheet = el("dialog", "fls");
    sheet.setAttribute("aria-label", "Share this deal");
    sheet.innerHTML =
      '<div class="fls__box">' +
      '<button class="fls__close" type="button" aria-label="Close">×</button>' +
      '<img class="fls__img" alt="">' +
      '<p class="fls__title"></p>' +
      '<button class="fls__native" type="button">Share photo…</button>' +
      '<div class="fls__icons">' +
      '<a class="fls__ic fls__wa" target="_blank" rel="noopener"><span class="fls__dot"><i class="fa-brands fa-whatsapp"></i></span>WhatsApp</a>' +
      '<a class="fls__ic fls__fb" target="_blank" rel="noopener"><span class="fls__dot"><i class="fa-brands fa-facebook-f"></i></span>Facebook</a>' +
      '<a class="fls__ic fls__x" target="_blank" rel="noopener"><span class="fls__dot"><i class="fa-brands fa-x-twitter"></i></span>X</a>' +
      '<a class="fls__ic fls__tt" target="_blank" rel="noopener"><span class="fls__dot"><i class="fa-brands fa-tiktok"></i></span>TikTok</a>' +
      '<a class="fls__ic fls__save"><span class="fls__dot">' + ICON_SAVE + '</span>Save</a>' +
      '<button class="fls__ic fls__copy" type="button"><span class="fls__dot">' + ICON_LINK + '</span>Copy link</button>' +
      '</div>' +
      '<p class="fls__hint"></p>' +
      '</div>';
    document.body.appendChild(sheet);
    var q = function (s) { return sheet.querySelector(s); };
    q(".fls__close").addEventListener("click", function () { sheet.close(); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet) sheet.close(); });
    q(".fls__native").addEventListener("click", function () {
      var s = current;
      var data = { title: s.title, text: s.text + "\n" + s.url };
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      else data.url = s.url;
      navigator.share(data).catch(function () { /* closed */ });
    });
    q(".fls__tt").addEventListener("click", function () {
      hint("TikTok: tap Save image, then in TikTok tap + → Upload → Photos and pick it. The caption is copied, paste it in.");
      copy(current.text + "\n" + current.url, true);
    });
    q(".fls__copy").addEventListener("click", function () { copy(current.text + "\n" + current.url); });
  }
  function hint(t) { sheet.querySelector(".fls__hint").textContent = t; }
  function copy(t, quiet) {
    var done = function () { if (!quiet) hint("Link copied. Paste it anywhere."); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { window.prompt("Copy this:", t); });
    else window.prompt("Copy this:", t);
  }

  function openShare(p) {
    if (!sheet) buildSheet();
    var s = current = shareInfo(p);
    file = null;
    var q = function (x) { return sheet.querySelector(x); };
    q(".fls__img").src = s.card;
    q(".fls__img").alt = s.title;
    q(".fls__title").textContent = s.title;
    hint("");
    var msg = encodeURIComponent(s.text + "\n" + s.url);
    q(".fls__wa").href = "https://wa.me/?text=" + msg;
    q(".fls__fb").href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(s.url);
    q(".fls__x").href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(s.text) + "&url=" + encodeURIComponent(s.url);
    q(".fls__tt").href = "https://www.tiktok.com/upload";
    var save = q(".fls__save");
    save.href = s.card;
    save.setAttribute("download", (s.id || "fa-vision") + "-deal.jpg");
    var nat = q(".fls__native");
    nat.hidden = !navigator.share;
    nat.textContent = "Preparing photo…";
    nat.disabled = true;
    // Fetch the card now, so tapping Share can attach it straight away.
    fetch(s.card).then(function (r) { return r.blob(); }).then(function (b) {
      if (current !== s) return;
      file = new File([b], (s.id || "fa-vision") + "-deal.jpg", { type: b.type || "image/jpeg" });
      var withPhoto = navigator.canShare && navigator.canShare({ files: [file] });
      nat.textContent = withPhoto ? "Share photo to WhatsApp, Facebook, TikTok…" : "Share…";
      nat.disabled = false;
    }).catch(function () { nat.textContent = "Share…"; nat.disabled = false; });
    if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", "");
  }
  window.FAV_SHARE = { open: function (id) { openShare(D.products.find(function (p) { return p.id === id; }) || null); } };

  if (!root) return;

  // ------------------------------------------------------------- strip
  var chips = [{
    href: "#shop", img: "assets/images/logo.png", name: "F.A Vision", badge: "LIVE", product: null,
    text: products.length + " listings on promo now · Pay 50% now, rest on delivery · MoMo, GhanaPay & card · Odorkor · Omanjor · Kasoa"
  }];
  products.forEach(function (p) {
    var bits = [];
    if (p.id === PROMO_ID) bits.push("Back-to-school promo · " + cedis(p.price_ghs) + " per set · GH₵640 each from 50 sets");
    else bits.push(cedis(p.price_ghs) + (p.negotiable ? " (negotiable)" : ""));
    var ad = ads[p.id];
    if (ad && ad.sub) bits.push(ad.sub.replace(/\.$/, ""));
    else (p.highlights || []).slice(0, 2).forEach(function (h) { bits.push(h); });
    if (p.seller && p.seller.name) bits.push("Sold by " + p.seller.name);
    chips.push({
      href: "#product/" + p.id, img: p.images[0], name: shortName(p.name), product: p,
      badge: p.id === PROMO_ID ? "PROMO" : "DEAL", text: bits.join(" · ")
    });
  });

  var SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18 16.1c-.8 0-1.5.3-2 .8l-7.1-4.1c.1-.3.1-.5.1-.8s0-.5-.1-.8l7-4.1c.5.5 1.2.8 2.1.8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .3 0 .5.1.8L8 9.8c-.5-.5-1.2-.8-2-.8-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l7.1 4.2c-.1.2-.1.4-.1.7 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9-1.2-3-2.8-3z"/></svg>';

  var track = el("div", "fav-live__track");
  chips.forEach(function (c) {
    var item = el("div", "fav-live__item");
    var a = el("a", "fav-live__chip");
    a.href = c.href; a.setAttribute("aria-label", c.name + ": " + c.text);
    var ava = el("span", "fav-live__ava"), img = el("img");
    img.src = c.img; img.alt = ""; img.width = 48; img.height = 48; img.loading = "lazy"; img.decoding = "async";
    ava.appendChild(img);
    var body = el("span", "fav-live__body"), top = el("span", "fav-live__top");
    top.appendChild(el("span", "fav-live__name", c.name));
    top.appendChild(el("span", "fav-live__badge", c.badge));
    var tick = el("span", "fav-live__ticker"), s1 = el("span", null, c.text), s2 = el("span", null, c.text);
    s2.setAttribute("aria-hidden", "true");
    var dur = Math.max(9, c.text.length / 7) + "s";
    s1.style.setProperty("--fl-dur", dur); s2.style.setProperty("--fl-dur", dur);
    tick.appendChild(s1); tick.appendChild(s2);
    body.appendChild(top); body.appendChild(tick);
    a.appendChild(ava); a.appendChild(body);
    var sh = el("button", "fav-live__share");
    sh.type = "button";
    sh.innerHTML = SHARE_ICON;
    sh.setAttribute("aria-label", "Share " + c.name);
    sh.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openShare(c.product); });
    item.appendChild(a); item.appendChild(sh);
    track.appendChild(item);
  });
  root.appendChild(track);

  // Hold and slide with a mouse (touch screens swipe natively)
  var down = false, moved = false, startX = 0, startLeft = 0;
  function snapLeft(c) { return c.offsetLeft - track.firstElementChild.offsetLeft; }
  track.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.target.closest(".fav-live__share")) return;
    down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
  });
  window.addEventListener("pointermove", function (e) {
    if (!down) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 4) { moved = true; track.classList.add("is-dragging"); }
    track.scrollLeft = startLeft - dx;
  });
  window.addEventListener("pointerup", function () {
    if (!down) return;
    down = false;
    if (!moved) return;
    track.classList.remove("is-dragging");
    var x = track.scrollLeft, best = track.firstElementChild;
    Array.prototype.forEach.call(track.children, function (c) {
      if (Math.abs(snapLeft(c) - x) < Math.abs(snapLeft(best) - x)) best = c;
    });
    track.scrollTo({ left: snapLeft(best), behavior: "smooth" });
  });
  track.addEventListener("click", function (e) {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
  }, true);
  track.addEventListener("dragstart", function (e) { e.preventDefault(); });
})();
