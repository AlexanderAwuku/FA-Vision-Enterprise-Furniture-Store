// Live deals strip: X-style swipeable bubbles with scrolling promo text.
// Built from window.FAV_DATA (products-data.js), so new listings and price changes show up automatically.
(function () {
  var root = document.getElementById("fav-live");
  var D = window.FAV_DATA;
  if (!root || !D || !D.products) return;

  var PROMO_ID = "FAV-014"; // the current headline promo goes first
  var ads = {};
  ((D.business.promos || {}).ads || []).forEach(function (a) { if (a.product) ads[a.product] = a; });

  function cedis(n) { return "GH₵" + Number(n).toLocaleString("en-GH"); }
  function shortName(n) { return String(n).split(" — ")[0]; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var products = D.products.filter(function (p) { return !p.placeholder && p.images && p.images.length; });
  products.sort(function (a, b) { return (b.id === PROMO_ID) - (a.id === PROMO_ID); });

  var chips = [{
    href: "#shop", img: "assets/images/logo.png", name: "F.A Vision", badge: "LIVE",
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
      href: "#product/" + p.id, img: p.images[0], name: shortName(p.name),
      badge: p.id === PROMO_ID ? "PROMO" : "DEAL", text: bits.join(" · ")
    });
  });

  var track = el("div", "fav-live__track");
  chips.forEach(function (c) {
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
    track.appendChild(a);
  });
  root.appendChild(track);

  // Hold and slide with a mouse (touch screens swipe natively)
  var down = false, moved = false, startX = 0, startLeft = 0;
  function snapLeft(c) { return c.offsetLeft - track.firstElementChild.offsetLeft; }
  track.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") return;
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
