// F.A Vision admin: post, edit and remove products.
//
// There is no server. Products and photos are committed straight to the
// GitHub repository through the GitHub REST API, using a fine-grained token
// the owner pastes in once. Every save writes data/products.json and the
// generated assets/js/products-data.js in one commit, and GitHub Pages
// republishes the site about a minute later.
(function () {
  const OWNER = "AlexanderAwuku";
  const REPO = "FA-Vision-Enterprise-Furniture-Store";
  const BRANCH = "main";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
  const MAX_PHOTOS = 10;
  const PHOTO_WIDTH = 1600;      // uploaded photos are 1600 x 1200 (4:3), finished by the photo studio
  const TOKEN_KEY = "fav_admin_token";

  const C = window.FAV_CONFIG;
  const esc = C.escapeHtml;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  let token = "";
  let business = null;
  let products = [];

  // =========================================================== utilities
  function store(get, value, remember) {
    try {
      if (get) return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      if (value) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, value);
    } catch (e) { /* storage blocked: token lives in memory for this visit */ }
    return "";
  }

  function toast(msg, bad) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("bad", !!bad);
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), bad ? 6000 : 2600);
  }

  function busy(msg) {
    $("#overlay").hidden = !msg;
    if (msg) $("#overlay-msg").textContent = msg;
  }

  function bytesToB64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const utf8ToB64 = s => bytesToB64(new TextEncoder().encode(s));
  const b64ToUtf8 = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, "")), c => c.charCodeAt(0)));

  const imgUrl = path => /^https?:/.test(path) ? path : RAW + path;
  const siteUrl = () => (business.website || `https://${OWNER.toLowerCase()}.github.io/${REPO}/`).replace(/\/?$/, "/");
  const productUrl = p => `${siteUrl()}#product/${p.id}`;

  // =========================================================== GitHub API
  async function gh(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {})
      },
      cache: "no-store"
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message || ""; } catch (e) { /* not JSON */ }
      const err = new Error(detail || res.statusText);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  function friendly(err) {
    if (err.status === 401) return "Your token was rejected. It may have expired: sign out and paste a new one.";
    if (err.status === 403) return "Your token can't save changes. On GitHub, give it Contents: Read and write for this repository.";
    if (err.status === 404) return "Couldn't find the repository with this token. Check that the token has access to FA-Vision-Enterprise-Furniture-Store.";
    if (!navigator.onLine) return "You're offline. Check your internet connection and try again.";
    return "Something went wrong: " + err.message;
  }

  async function readJson(path, ref) {
    const f = await gh(`/contents/${path}?ref=${ref || BRANCH}`);
    return JSON.parse(b64ToUtf8(f.content));
  }

  async function load() {
    const ref = (await gh(`/git/ref/heads/${BRANCH}`)).object.sha;
    [business, products] = await Promise.all([readJson("data/business.json", ref), readJson("data/products.json", ref)]);
  }

  function siteDataJs(biz, list) {
    // Same output as site_data_js() in scripts/generate_listings.py.
    return "// Generated from data/business.json and data/products.json. Do not edit by hand.\n" +
      `window.FAV_DATA = ${JSON.stringify({ business: biz, products: list }, null, 2)};\n`;
  }

  // Apply `mutate` to the latest products.json and commit it, plus any new
  // photos and photo deletions, as one commit. Retries if someone else
  // committed in between.
  async function commit({ mutate, uploads = [], deletes = [], message }) {
    const blobShas = {};
    for (let i = 0; i < uploads.length; i++) {
      busy(`Uploading photo ${i + 1} of ${uploads.length}…`);
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: uploads[i].b64, encoding: "base64" }) });
      blobShas[uploads[i].path] = blob.sha;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      busy("Saving to your website…");
      const head = (await gh(`/git/ref/heads/${BRANCH}`)).object.sha;
      const baseTree = (await gh(`/git/commits/${head}`)).tree.sha;
      const [biz, latest] = await Promise.all([readJson("data/business.json", head), readJson("data/products.json", head)]);
      const next = mutate(latest);
      const tree = [
        { path: "data/products.json", mode: "100644", type: "blob", content: JSON.stringify(next, null, 2) + "\n" },
        { path: "assets/js/products-data.js", mode: "100644", type: "blob", content: siteDataJs(biz, next) },
        ...Object.entries(blobShas).map(([path, sha]) => ({ path, mode: "100644", type: "blob", sha })),
        ...deletes.map(path => ({ path, mode: "100644", type: "blob", sha: null }))
      ];
      const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree }) });
      const newCommit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }) });
      try {
        await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) });
        business = biz;
        products = next;
        return next;
      } catch (err) {
        if (err.status !== 422 || attempt === 2) throw err;   // 422 = branch moved; rebuild on the new head
      }
    }
  }

  // =========================================================== captions
  const phones = () => (business.phones || [business.whatsapp]).map(C.localPhone).join(" / ");
  const priceText = p => p.price_ghs ? C.formatPrice(p.price_ghs) + (p.negotiable ? " (negotiable)" : "") : "Price on request";

  function marketplaceText(p) {
    return [
      `${p.name}${p.custom_order ? " - Made to Order" : ""}`,
      `Price: ${priceText(p)}`,
      "",
      p.description,
      "",
      ...(p.highlights || []).map(h => `✔ ${h}`),
      p.material && `Material: ${p.material}`,
      p.dimensions && `Size: ${p.dimensions}`,
      (p.colors || []).length && `Colours: ${p.colors.join(", ")}`,
      p.custom_order && "Custom sizes, colours and finishes available.",
      "",
      `📍 Showroom: ${business.address}`,
      `🚚 ${business.delivery_note}`,
      `💬 WhatsApp: ${C.localPhone(business.whatsapp)}`,
      `📞 Call: ${phones()}`,
      `🌐 See it here: ${productUrl(p)}`,
      `Ref: ${p.id}`
    ].filter(x => x !== false && x !== undefined && x !== null && x !== 0).join("\n").replace(/\n{3,}/g, "\n\n");
  }

  function groupText(p) {
    const bullets = (p.highlights || []).map(h => `• ${h}`).join("\n");
    return `🛋️ ${p.name} available now!\n${bullets ? bullets + "\n" : ""}💰 ${priceText(p)}\n📍 Odorkor, Accra, delivery available\n📞 WhatsApp ${C.localPhone(business.whatsapp)}\n👉 ${productUrl(p)}\n${(business.hashtags || []).slice(0, 4).join(" ")}`;
  }

  const statusText = p => `${p.name} 🔥\n${priceText(p)}\nOrder: ${productUrl(p)}`;

  // =========================================================== routing
  function show(screen) {
    $$(".screen").forEach(s => { s.hidden = s.id !== "screen-" + screen; });
    $("#top-actions").hidden = screen === "login";
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", e => {
    const go = e.target.closest("[data-go]");
    if (!go) return;
    e.preventDefault();
    if (!token) return show("login");
    if (go.dataset.go === "post") startPost(null);
    else { renderDash(); show("dash"); }
  });

  // =========================================================== sign in
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#login-error");
    err.hidden = true;
    token = $("#token").value.trim();
    busy("Signing in…");
    try {
      await load();
      store(false, token, $("#remember").checked);
      $("#token").value = "";
      renderDash();
      show("dash");
    } catch (ex) {
      token = "";
      err.textContent = friendly(ex);
      err.hidden = false;
    } finally { busy(null); }
  });

  $("#signout").addEventListener("click", () => {
    token = "";
    store(false, "");
    show("login");
  });

  // =========================================================== dashboard
  let dashFilter = "all";

  function thumb(p) {
    const img = (p.images || [])[0];
    return `<div class="thumb">${img ? `<img src="${esc(imgUrl(img))}" alt="" loading="lazy">` : C.iconSvg(C.categoryIcon(p)) + `<span class="nophoto">No photo</span>`}</div>`;
  }

  function renderDash() {
    const total = products.length;
    const inStock = products.filter(p => p.in_stock).length;
    const noPhoto = products.filter(p => !(p.images || []).length).length;
    $("#dash-sub").textContent = `${total} product${total === 1 ? "" : "s"} on your website`;
    const stat = (key, n, label, warn) => `<button class="stat ${warn && n ? "warn" : ""}" data-filter="${key}" aria-pressed="${dashFilter === key}"><b>${n}</b><span>${label}</span></button>`;
    $("#stats").innerHTML = stat("all", total, "Total products") + stat("instock", inStock, "In stock") +
      stat("sold", total - inStock, "Sold out") + stat("nophoto", noPhoto, "Missing photos", true);
    $("#dash-filter").value = dashFilter;

    const q = $("#dash-search").value.trim().toLowerCase();
    const list = products.filter(p =>
      (dashFilter === "all" || (dashFilter === "instock" && p.in_stock) || (dashFilter === "sold" && !p.in_stock) || (dashFilter === "nophoto" && !(p.images || []).length)) &&
      (!q || `${p.name} ${p.type} ${p.category} ${p.id}`.toLowerCase().includes(q))
    ).slice().reverse();   // newest first

    $("#list").innerHTML = list.length ? list.map(p => `
      <div class="item" data-id="${esc(p.id)}">
        ${thumb(p)}
        <div class="item-main">
          <div class="item-name">${esc(p.name)}</div>
          <div class="item-meta">${esc(p.id)} · ${esc(p.category)}${p.type ? " · " + esc(p.type) : ""}
            ${p.in_stock ? `<span class="pill ok">Live</span>` : `<span class="pill sold">Sold out</span>`}
            ${p.placeholder ? `<span class="pill est">Price not confirmed</span>` : ""}</div>
          <div class="item-price">${p.price_ghs ? C.formatPrice(p.price_ghs) : "Price on request"}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-ghost btn-sm" data-act="share">Share</button>
          <button class="btn btn-ghost btn-sm" data-act="stock">${p.in_stock ? "Mark sold" : "Back in stock"}</button>
          <button class="btn btn-danger btn-sm" data-act="delete">Delete</button>
        </div>
      </div>`).join("") : `<div class="empty-state">No products here yet. <button class="btn btn-sell" data-go="post">+ Post a product</button></div>`;
  }

  $("#stats").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (b) { dashFilter = b.dataset.filter; renderDash(); }
  });
  $("#dash-filter").addEventListener("change", e => { dashFilter = e.target.value; renderDash(); });
  $("#dash-search").addEventListener("input", renderDash);

  $("#list").addEventListener("click", async e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".item").dataset.id;
    const p = products.find(x => x.id === id);
    if (!p) return;
    const act = btn.dataset.act;
    if (act === "edit") return startPost(p);
    if (act === "share") return showDone(p, false);
    try {
      if (act === "stock") {
        await commit({
          message: `${p.in_stock ? "Mark sold out" : "Back in stock"}: ${p.name} (${p.id})`,
          mutate: list => list.map(x => x.id === id ? { ...x, in_stock: !x.in_stock } : x)
        });
        toast(p.in_stock ? "Marked as sold out" : "Back in stock");
      }
      if (act === "delete") {
        if (!confirm(`Delete "${p.name}" from your website? This removes its photos too.`)) return;
        await commit({
          message: `Remove product: ${p.name} (${p.id})`,
          mutate: list => list.filter(x => x.id !== id),
          deletes: (p.images || []).filter(src => src.startsWith("assets/images/products/"))
        });
        toast("Product deleted");
      }
      renderDash();
    } catch (err) {
      toast(friendly(err), true);
    } finally { busy(null); }
  });

  // =========================================================== post / edit form
  let draft = null;     // { editing, category, type, condition, colors:Set, photos:[] }
  let step = 1;

  function startPost(p) {
    draft = {
      editing: p ? p.id : null,
      category: p ? p.category : "",
      type: p ? p.type || "" : "",
      condition: p ? p.condition || "Brand New" : "Brand New",
      colors: new Set(p ? p.colors || [] : []),
      photos: p ? (p.images || []).map(path => ({ kind: "existing", path, url: imgUrl(path) })) : []
    };
    $("#post-heading").textContent = p ? `Edit: ${p.name}` : "Post a product";
    $("#publish").textContent = p ? "Save changes" : "Post product";
    $("#f-name").value = p ? p.name : "";
    $("#f-material").value = p ? p.material || "" : "";
    $("#f-dimensions").value = p ? p.dimensions || "" : "";
    $("#f-description").value = p ? p.description || "" : "";
    $("#f-highlights").value = p ? (p.highlights || []).join("\n") : "";
    $("#f-price").value = p && p.price_ghs ? p.price_ghs : "";
    $("#f-onrequest").checked = !!(p && !p.price_ghs);
    $$('input[name="neg"]').forEach(r => { r.checked = r.value === (p && p.negotiable === false ? "0" : "1"); });
    $("#f-custom").checked = p ? !!p.custom_order : true;
    $("#f-stock").checked = p ? !!p.in_stock : true;
    $$(".error[data-err]").forEach(e => { e.hidden = true; });
    renderCats();
    renderPhotos();
    renderPills();
    syncPrice();
    updateCounters();
    goStep(1);
    show("post");
  }

  function renderCats() {
    $("#cat-grid").innerHTML = C.CATEGORIES.map(c => `
      <button type="button" class="cat" data-cat="${esc(c.id)}" aria-pressed="${draft.category === c.id}">${C.iconSvg(C.ICONS[c.icon])}${esc(c.id)}</button>`).join("");
    const cat = C.CATEGORIES.find(c => c.id === draft.category);
    $("#type-wrap").hidden = !cat;
    if (cat) {
      const types = cat.types.includes(draft.type) || !draft.type ? cat.types : [draft.type, ...cat.types];
      $("#type-pills").innerHTML = types.map(t => `<button type="button" data-type="${esc(t)}" aria-pressed="${draft.type === t}">${esc(t)}</button>`).join("");
    }
  }

  $("#cat-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    if (draft.category !== b.dataset.cat) draft.type = "";
    draft.category = b.dataset.cat;
    $('[data-err="category"]').hidden = true;
    renderCats();
  });
  $("#type-pills").addEventListener("click", e => {
    const b = e.target.closest("[data-type]");
    if (!b) return;
    draft.type = b.dataset.type;
    $('[data-err="type"]').hidden = true;
    renderCats();
  });

  function renderPills() {
    $("#cond-pills").innerHTML = C.CONDITIONS.map(c => `<button type="button" data-cond="${esc(c)}" aria-pressed="${draft.condition === c}">${esc(c)}</button>`).join("");
    const colours = [...new Set([...C.COLOURS, ...draft.colors])];
    $("#colour-pills").innerHTML = colours.map(c => `<button type="button" data-colour="${esc(c)}" aria-pressed="${draft.colors.has(c)}">${esc(c)}</button>`).join("");
  }
  $("#cond-pills").addEventListener("click", e => {
    const b = e.target.closest("[data-cond]");
    if (b) { draft.condition = b.dataset.cond; renderPills(); }
  });
  $("#colour-pills").addEventListener("click", e => {
    const b = e.target.closest("[data-colour]");
    if (!b) return;
    const c = b.dataset.colour;
    draft.colors.has(c) ? draft.colors.delete(c) : draft.colors.add(c);
    renderPills();
  });

  // ---- photos
  // Each new photo keeps its original plus its studio edits (admin/photo-studio.js);
  // the finished 4:3 JPEG is only produced when the product is posted.
  async function thumbUrl(ph) {
    const blob = await new Promise(r => PhotoStudio.render(ph.photo, 480, "preview").toBlob(r, "image/jpeg", 0.8));
    if (ph.url && ph.url.startsWith("blob:")) URL.revokeObjectURL(ph.url);
    ph.url = URL.createObjectURL(blob);
  }

  async function addFiles(files) {
    const room = MAX_PHOTOS - draft.photos.length;
    if (!room) return toast(`You can add up to ${MAX_PHOTOS} photos`, true);
    const list = [...files].slice(0, room);
    busy("Preparing photos…");
    for (const f of list) {
      try {
        const ph = { kind: "new", photo: await PhotoStudio.fromFile(f) };
        await thumbUrl(ph);
        draft.photos.push(ph);
      } catch (err) { toast(err.message, true); }
    }
    busy(null);
    if (files.length > room) toast(`Only the first ${room} photo(s) were added (max ${MAX_PHOTOS})`, true);
    $('[data-err="photos"]').hidden = true;
    renderPhotos();
  }

  $("#photo-input").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
  const addTile = $("#photo-add");
  ["dragenter", "dragover"].forEach(ev => addTile.addEventListener(ev, e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); addTile.classList.add("drag"); } }));
  ["dragleave", "drop"].forEach(ev => addTile.addEventListener(ev, () => addTile.classList.remove("drag")));
  addTile.addEventListener("drop", e => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });

  function renderPhotos() {
    $$("#photos .photo").forEach(n => n.remove());
    const html = draft.photos.map((ph, i) => `
      <div class="photo" draggable="true" data-i="${i}">
        <img src="${esc(ph.url)}" alt="Photo ${i + 1}">
        ${i === 0 ? `<span class="main-tag">Main</span>` : ""}
        <button type="button" class="del" data-del="${i}" aria-label="Remove photo">×</button>
        <button type="button" class="edit" data-edit-photo="${i}">✎ Edit</button>
        <div class="moves">
          <button type="button" data-move="${i}" data-dir="-1" aria-label="Move left" ${i === 0 ? "disabled" : ""}>◀</button>
          <button type="button" data-move="${i}" data-dir="1" aria-label="Move right" ${i === draft.photos.length - 1 ? "disabled" : ""}>▶</button>
        </div>
      </div>`).join("");
    addTile.insertAdjacentHTML("beforebegin", html);
    addTile.hidden = draft.photos.length >= MAX_PHOTOS;
  }

  function movePhoto(from, to) {
    if (to < 0 || to >= draft.photos.length || from === to) return;
    const [ph] = draft.photos.splice(from, 1);
    draft.photos.splice(to, 0, ph);
    renderPhotos();
  }

  const photosEl = $("#photos");
  photosEl.addEventListener("click", e => {
    const del = e.target.closest("[data-del]");
    if (del) { draft.photos.splice(+del.dataset.del, 1); return renderPhotos(); }
    const mv = e.target.closest("[data-move]");
    if (mv) return movePhoto(+mv.dataset.move, +mv.dataset.move + +mv.dataset.dir);
    const ed = e.target.closest("[data-edit-photo]") || (e.target.closest(".photo") && !e.target.closest("button") && e.target.closest(".photo"));
    if (ed) editPhoto(+(ed.dataset.editPhoto || ed.dataset.i));
  });

  async function editPhoto(i) {
    const ph = draft.photos[i];
    if (ph.kind === "existing") {
      // Already-uploaded photos are reloaded and become a new upload once edited.
      busy("Opening photo…");
      try { ph.photo = await PhotoStudio.fromUrl(ph.url); }
      catch (err) { busy(null); return toast(err.message, true); }
      busy(null);
    }
    const others = draft.photos.filter((o, j) => j !== i && o.photo).map(o => o.photo);
    const result = await PhotoEditor.open(ph.photo, { others });
    if (result === "cancel") return;
    busy("Updating photos…");
    const changed = result === "all" ? draft.photos.filter(o => o.photo) : [ph];
    for (const o of changed) {
      if (o.kind === "existing") { o.kind = "new"; delete o.path; }
      await thumbUrl(o);
    }
    busy(null);
    renderPhotos();
  }
  let dragFrom = null;
  photosEl.addEventListener("dragstart", e => {
    const ph = e.target.closest(".photo");
    if (!ph) return;
    dragFrom = +ph.dataset.i;
    ph.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  photosEl.addEventListener("dragover", e => {
    const ph = e.target.closest(".photo");
    if (dragFrom === null || !ph) return;
    e.preventDefault();
    $$(".photo.over").forEach(n => n.classList.remove("over"));
    ph.classList.add("over");
  });
  photosEl.addEventListener("drop", e => {
    const ph = e.target.closest(".photo");
    if (dragFrom === null || !ph) return;
    e.preventDefault();
    movePhoto(dragFrom, +ph.dataset.i);
  });
  photosEl.addEventListener("dragend", () => { dragFrom = null; $$(".photo").forEach(n => n.classList.remove("dragging", "over")); });

  // ---- details
  function updateCounters() {
    $$(".counter").forEach(c => {
      const input = document.getElementById(c.dataset.for);
      c.textContent = `${input.value.length} / ${input.maxLength}`;
    });
  }
  ["f-name", "f-description"].forEach(id => document.getElementById(id).addEventListener("input", updateCounters));

  function syncPrice() {
    const onReq = $("#f-onrequest").checked;
    $("#f-price").disabled = onReq;
    $$('input[name="neg"]').forEach(r => { r.disabled = onReq; });
    if (onReq) $('[data-err="price"]').hidden = true;
  }
  $("#f-onrequest").addEventListener("change", syncPrice);

  function readForm() {
    const onReq = $("#f-onrequest").checked;
    const price = parseInt($("#f-price").value, 10);
    return {
      name: $("#f-name").value.trim(),
      category: draft.category,
      type: draft.type,
      marketplace_category: C.marketplaceCategory(draft.type),
      price_ghs: onReq || !(price > 0) ? null : price,
      negotiable: !onReq && $('input[name="neg"]:checked').value === "1",
      icon: "",
      description: $("#f-description").value.trim(),
      condition: draft.condition,
      material: $("#f-material").value.trim(),
      dimensions: $("#f-dimensions").value.trim(),
      colors: [...draft.colors],
      custom_order: $("#f-custom").checked,
      in_stock: $("#f-stock").checked,
      images: draft.photos.map(ph => ph.path || ph.url),
      highlights: $("#f-highlights").value.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 5),
      placeholder: false
    };
  }

  function validate(n) {
    const errs = {};
    if (n === 1) {
      if (!draft.category) errs.category = true;
      if (draft.category && !draft.type) errs.type = true;
      // New products need a photo, like Jiji. Existing ones can be saved without, to fix other details first.
      if (!draft.photos.length && !draft.editing) errs.photos = true;
    }
    if (n === 2) {
      const f = readForm();
      if (f.name.length < 5) errs.name = true;
      if (f.description.length < 20) errs.description = true;
      if (!$("#f-onrequest").checked && !f.price_ghs) errs.price = true;
    }
    $$(`.step[data-step="${n}"] .error[data-err]`).forEach(e => { e.hidden = !errs[e.dataset.err]; });
    const first = $(`.step[data-step="${n}"] .error[data-err]:not([hidden])`);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    return !first;
  }

  function goStep(n) {
    step = n;
    $$(".step").forEach(s => { s.hidden = +s.dataset.step !== n; });
    $$("#stepper li").forEach(li => {
      const k = +li.dataset.step;
      li.classList.toggle("active", k === n);
      li.classList.toggle("done", k < n);
    });
    if (n === 3) renderReview();
    window.scrollTo(0, 0);
  }

  $$("[data-next]").forEach(b => b.addEventListener("click", () => {
    const to = +b.dataset.next;
    if (to > step && !validate(step)) return;
    goStep(to);
  }));

  function previewCard(p, photoUrl) {
    const badges = [p.custom_order && `<span>Made to order</span>`, p.negotiable && p.price_ghs && `<span class="gold">Negotiable</span>`, !p.in_stock && `<span>Sold out</span>`].filter(Boolean).join("");
    return `
      <div class="pcard">
        <div class="pmedia">${photoUrl ? `<img src="${esc(photoUrl)}" alt="">` : C.iconSvg(C.categoryIcon(p))}<div class="pbadges">${badges}</div></div>
        <div class="pbody">
          <div class="ptype">${esc(p.type || p.category)}</div>
          <div class="pname">${esc(p.name)}</div>
          <div class="pdesc">${esc(p.description)}</div>
          <div class="pprice">${p.price_ghs ? C.formatPrice(p.price_ghs) : "Price on request"}</div>
        </div>
      </div>`;
  }

  function renderReview() {
    const f = readForm();
    const id = draft.editing || "FAV-###";
    const facts = [
      ["Category", `${f.category} · ${f.type}`], ["Condition", f.condition], ["Price", priceText(f)],
      ["Material", f.material], ["Size", f.dimensions], ["Colours", f.colors.join(", ")],
      ["Photos", String(draft.photos.length)], ["Availability", f.in_stock ? (f.custom_order ? "Made to order" : "In stock") : "Sold out"]
    ].filter(([, v]) => v);
    $("#review").innerHTML = previewCard(f, draft.photos[0] && draft.photos[0].url) +
      `<dl class="review-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    $("#review-caption").textContent = marketplaceText({ ...f, id });
  }

  function nextId(list) {
    const max = list.reduce((m, p) => Math.max(m, parseInt(String(p.id).replace(/\D/g, ""), 10) || 0), 0);
    return "FAV-" + String(max + 1).padStart(3, "0");
  }

  $("#publish").addEventListener("click", async () => {
    if (!validate(1)) return goStep(1);
    if (!validate(2)) return goStep(2);
    const form = readForm();
    const editing = draft.editing;
    const old = editing ? products.find(p => p.id === editing) : null;
    // Reserve the id now so photo file names match it; commit() re-checks against the latest list.
    let id = editing || nextId(products);
    const stamp = Date.now().toString(36);
    const uploads = [];
    const images = [];
    busy("Finishing photos…");
    mainPhotoPreview = null;
    for (let i = 0; i < draft.photos.length; i++) {
      const ph = draft.photos[i];
      if (ph.kind === "existing") { images.push(ph.path); continue; }
      const path = `assets/images/products/${id.toLowerCase()}-${stamp}-${i + 1}.jpg`;
      const blob = await PhotoStudio.toJpeg(ph.photo, PHOTO_WIDTH);
      uploads.push({ path, b64: bytesToB64(new Uint8Array(await blob.arrayBuffer())) });
      if (i === 0) mainPhotoPreview = URL.createObjectURL(blob);
      images.push(path);
    }
    const deletes = old ? (old.images || []).filter(src => src.startsWith("assets/images/products/") && !images.includes(src)) : [];
    try {
      const saved = await commit({
        message: `${editing ? "Update" : "Add"} product: ${form.name} (${id})`,
        uploads,
        deletes,
        mutate: list => {
          if (editing) return list.map(p => p.id === editing ? { ...p, ...form, id: editing, images, icon: p.icon || "" } : p);
          if (list.some(p => p.id === id)) id = nextId(list);   // someone else took this id meanwhile
          return [...list, { id, ...form, images }];
        }
      });
      const product = saved.find(p => p.id === id);
      draft.photos.forEach(ph => ph.kind === "new" && URL.revokeObjectURL(ph.url));
      showDone(product, true, editing, mainPhotoPreview);
    } catch (err) {
      toast(friendly(err), true);
    } finally { busy(null); }
  });

  // =========================================================== done / share
  let shareProduct = null, sharePhoto = null, mainPhotoPreview = null;

  // localPhoto: the just-rendered main photo, used until GitHub serves the uploaded copy.
  function showDone(p, justSaved, wasEdit, localPhoto) {
    shareProduct = p;
    sharePhoto = localPhoto || ((p.images || [])[0] && imgUrl(p.images[0]));
    $("#done-title").textContent = justSaved ? (wasEdit ? "Changes saved!" : "Your product is posted!") : `Share: ${p.name}`;
    $("#done-sub").textContent = justSaved ? "It will appear on the website in about a minute." : "Copy a ready-made post for Facebook or send it straight to a client.";
    $(".done-ico").hidden = !justSaved;
    $("#done-card").innerHTML = previewCard(p, sharePhoto);
    $("#share-wa").href = "https://wa.me/?text=" + encodeURIComponent(`${p.name} · ${priceText(p)}\n${productUrl(p)}`);
    $("#share-view").href = productUrl(p);
    show("done");
  }

  $("#screen-done").addEventListener("click", async e => {
    if (e.target.closest("#make-promo") && shareProduct) return PromoMaker.open(shareProduct, business, sharePhoto);
    const b = e.target.closest("[data-copy]");
    if (!b || !shareProduct) return;
    const text = { link: productUrl(shareProduct), marketplace: marketplaceText(shareProduct), group: groupText(shareProduct), status: statusText(shareProduct) }[b.dataset.copy];
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied. Now paste it on Facebook or WhatsApp.");
    } catch (err) {
      prompt("Copy this text:", text);
    }
  });

  // =========================================================== start
  (async function init() {
    token = store(true);
    if (!token) return show("login");
    busy("Loading your products…");
    try {
      await load();
      renderDash();
      show("dash");
    } catch (err) {
      token = "";
      show("login");
      $("#login-error").textContent = friendly(err);
      $("#login-error").hidden = false;
    } finally { busy(null); }
  })();
})();
