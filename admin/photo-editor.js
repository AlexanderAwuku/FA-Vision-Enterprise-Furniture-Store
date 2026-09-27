// Full-screen photo editor used by the admin's upload step.
// PhotoEditor.open(photo, { others }) resolves to "done", "cancel" or "all"
// ("all" = the look was copied to the other photos of the product).
window.PhotoEditor = (function () {
  const S = window.PhotoStudio;
  let dlg, canvas, photo, before, resolveFn, others, comparing = false, frame = 0;

  const SLIDERS = [
    { key: "brightness", label: "Brightness" },
    { key: "contrast", label: "Contrast" },
    { key: "warmth", label: "Warmth" },
    { key: "saturation", label: "Colour" }
  ];

  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "studio";
    dlg.innerHTML = `
      <div class="st-top">
        <button type="button" class="st-link" data-act="cancel">Cancel</button>
        <b>Edit photo</b>
        <button type="button" class="st-done" data-act="done">Done</button>
      </div>
      <div class="st-stage">
        <canvas class="st-canvas"></canvas>
        <span class="st-hint">Drag to move</span>
        <button type="button" class="st-compare">Hold to compare</button>
      </div>
      <div class="st-tabs" role="tablist">
        <button type="button" role="tab" data-tab="frame" aria-selected="true">Frame</button>
        <button type="button" role="tab" data-tab="light" aria-selected="false">Light &amp; colour</button>
        <button type="button" role="tab" data-tab="bg" aria-selected="false">Background</button>
      </div>
      <div class="st-panels">
        <section data-panel="frame">
          <div class="seg" data-seg="mode">
            <button type="button" data-val="fill">Fill frame</button>
            <button type="button" data-val="fit">Show whole piece</button>
          </div>
          <label class="st-slider"><span>Zoom <output data-out="zoom"></output></span><input type="range" data-edit="zoom" min="50" max="300" step="1"></label>
          <label class="st-slider"><span>Straighten <output data-out="angle"></output></span><input type="range" data-edit="angle" min="-15" max="15" step="0.5"></label>
          <div class="st-row">
            <button type="button" class="btn btn-ghost btn-sm" data-act="rotate">↻ Rotate 90°</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="reset-frame">Reset framing</button>
          </div>
        </section>
        <section data-panel="light" hidden>
          <label class="switch"><input type="checkbox" data-edit="auto"><i></i><span><b>Auto-enhance</b><small>Balances brightness and colour automatically</small></span></label>
          ${SLIDERS.map(s => `<label class="st-slider"><span>${s.label} <output data-out="${s.key}"></output></span><input type="range" data-edit="${s.key}" min="-50" max="50" step="1"></label>`).join("")}
          <div class="st-row"><button type="button" class="btn btn-ghost btn-sm" data-act="reset-light">Reset light &amp; colour</button></div>
        </section>
        <section data-panel="bg" hidden>
          <div class="seg" data-seg="bg">
            <button type="button" data-val="original">Keep background</button>
            <button type="button" data-val="removed">Remove background ✨</button>
          </div>
          <div class="st-remove" hidden>
            <p class="muted small">Cuts the furniture out and places it in a clean studio. Runs on this device. <b>The first time it downloads about 55 MB, so use Wi-Fi.</b> After that it's quick.</p>
            <button type="button" class="btn btn-sell" data-act="remove">Remove background</button>
            <div class="st-progress" hidden><div></div><span></span></div>
          </div>
          <p class="st-backdrop-label"></p>
          <div class="swatches"></div>
          <p class="muted small st-fill-note" hidden>Backdrops show around the photo in <b>Show whole piece</b> mode (Frame tab).</p>
        </section>
      </div>
      <div class="st-foot" hidden>
        <button type="button" class="btn btn-ghost btn-block" data-act="all">Use this look on all photos of this product</button>
      </div>`;
    document.body.appendChild(dlg);
    canvas = dlg.querySelector(".st-canvas");

    dlg.addEventListener("click", onClick);
    dlg.addEventListener("input", onInput);
    dlg.addEventListener("cancel", e => { e.preventDefault(); close("cancel"); });

    const cmp = dlg.querySelector(".st-compare");
    const on = e => { e.preventDefault(); comparing = true; draw(); };
    const off = () => { if (comparing) { comparing = false; draw(); } };
    cmp.addEventListener("pointerdown", on);
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => cmp.addEventListener(ev, off));

    // drag to reposition
    let drag = null;
    canvas.addEventListener("pointerdown", e => {
      drag = { x: e.clientX, y: e.clientY, px: photo.edits.panX, py: photo.edits.panY };
      canvas.setPointerCapture(e.pointerId);
      dlg.querySelector(".st-hint").hidden = true;
    });
    canvas.addEventListener("pointermove", e => {
      if (!drag) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const clamp = v => Math.max(-1, Math.min(1, v));
      photo.edits.panX = clamp(drag.px - (e.clientX - drag.x) / (w * 0.35));
      photo.edits.panY = clamp(drag.py - (e.clientY - drag.y) / (h * 0.35));
      draw();
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { drag = null; }));
  }

  function draw() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const w = Math.min(900, Math.round(canvas.clientWidth * (window.devicePixelRatio || 1)) || 800);
      const edits = comparing ? { ...S.defaultEdits(photo.src.width, photo.src.height), mode: "fit", auto: false, backdrop: "blur", bg: "original" } : undefined;
      const out = S.render(photo, w, "preview", edits);
      canvas.width = out.width; canvas.height = out.height;
      canvas.getContext("2d").drawImage(out, 0, 0);
    });
  }

  function sync() {
    const e = photo.edits;
    const val = (k, v) => { const el = dlg.querySelector(`[data-edit="${k}"]`); if (el.type === "checkbox") el.checked = v; else el.value = v; };
    val("zoom", Math.round(e.zoom * 100));
    val("angle", e.angle);
    val("auto", e.auto);
    SLIDERS.forEach(s => val(s.key, e[s.key]));
    dlg.querySelector('[data-out="zoom"]').textContent = Math.round(e.zoom * 100) + "%";
    dlg.querySelector('[data-out="angle"]').textContent = (e.angle > 0 ? "+" : "") + e.angle + "°";
    SLIDERS.forEach(s => { dlg.querySelector(`[data-out="${s.key}"]`).textContent = (e[s.key] > 0 ? "+" : "") + e[s.key]; });
    dlg.querySelectorAll('[data-seg="mode"] button').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.val === e.mode)));
    const removed = e.bg === "removed" && photo.cutout;
    dlg.querySelectorAll('[data-seg="bg"] button').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.val === (removed ? "removed" : e.bg === "removed" ? "removed" : "original"))));
    dlg.querySelector('[data-seg="mode"]').classList.toggle("disabled", !!removed);
    dlg.querySelector(".st-remove").hidden = !(e.bg === "removed" && !photo.cutout);

    // backdrop swatches
    const keys = removed ? ["white", "cream", "grey", "dark"] : ["blur", "white", "cream", "grey", "dark"];
    const current = removed ? e.studio : e.backdrop;
    const showSwatches = removed || (e.bg === "original" && e.mode === "fit");
    dlg.querySelector(".st-backdrop-label").textContent = showSwatches ? (removed ? "Studio backdrop" : "Backdrop around the photo") : "";
    dlg.querySelector(".swatches").innerHTML = showSwatches ? keys.map(k => `
      <button type="button" class="swatch" data-backdrop="${k}" aria-pressed="${k === current}">
        <i style="background:${S.BACKDROPS[k].swatch}"></i>${S.BACKDROPS[k].label}
      </button>`).join("") : "";
    dlg.querySelector(".st-fill-note").hidden = !(e.bg === "original" && e.mode === "fill");
    dlg.querySelector(".st-foot").hidden = !others.length;
    dlg.querySelector('[data-act="all"]').textContent = `Use this look on all ${others.length + 1} photos of this product`;
    draw();
  }

  function onInput(ev) {
    const k = ev.target.dataset.edit;
    if (!k) return;
    const e = photo.edits;
    if (k === "auto") e.auto = ev.target.checked;
    else if (k === "zoom") e.zoom = +ev.target.value / 100;
    else e[k] = +ev.target.value;
    sync();
  }

  async function runRemoval(target, label) {
    const bar = dlg.querySelector(".st-progress");
    bar.hidden = false;
    const fill = bar.querySelector("div"), text = bar.querySelector("span");
    const btn = dlg.querySelector('[data-act="remove"]');
    btn.disabled = true;
    try {
      await S.removeBackground(target, (phase, frac) => {
        fill.style.width = Math.round(frac * 100) + "%";
        text.textContent = (label ? label + " · " : "") + (phase === "download" ? `Downloading background remover… ${Math.round(frac * 100)}%` : "Removing background…");
      });
      text.textContent = "Done";
      return true;
    } catch (err) {
      text.textContent = navigator.onLine ? "Couldn't remove the background. Try again, or keep the original." : "You're offline. Connect to the internet and try again.";
      return false;
    } finally {
      btn.disabled = false;
      setTimeout(() => { bar.hidden = true; fill.style.width = "0"; }, 800);
    }
  }

  async function onClick(ev) {
    const b = ev.target.closest("button");
    if (!b) return;
    const e = photo.edits;
    if (b.dataset.tab) {
      dlg.querySelectorAll("[data-tab]").forEach(t => t.setAttribute("aria-selected", String(t === b)));
      dlg.querySelectorAll("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
      return;
    }
    const seg = b.closest("[data-seg]");
    if (seg) {
      if (seg.dataset.seg === "mode") { e.mode = b.dataset.val; e.zoom = 1; e.panX = e.panY = 0; }
      if (seg.dataset.seg === "bg") { e.bg = b.dataset.val; e.zoom = 1; e.panX = e.panY = 0; }
      return sync();
    }
    if (b.dataset.backdrop) {
      if (e.bg === "removed" && photo.cutout) e.studio = b.dataset.backdrop; else e.backdrop = b.dataset.backdrop;
      return sync();
    }
    switch (b.dataset.act) {
      case "rotate": e.rot90 = (e.rot90 + 1) % 4; e.panX = e.panY = 0; return sync();
      case "reset-frame": Object.assign(e, { zoom: 1, panX: 0, panY: 0, angle: 0, rot90: 0 }); return sync();
      case "reset-light": Object.assign(e, S.DEFAULT_LIGHT); return sync();
      case "remove": if (await runRemoval(photo)) { e.bg = "removed"; e.zoom = 1; e.panX = e.panY = 0; } return sync();
      case "cancel": return close("cancel");
      case "done": return close("done");
      case "all": return applyAll();
    }
  }

  async function applyAll() {
    const e = photo.edits;
    const look = { mode: e.mode, auto: e.auto, brightness: e.brightness, contrast: e.contrast, warmth: e.warmth, saturation: e.saturation, backdrop: e.backdrop, studio: e.studio, bg: e.bg };
    const wantCut = e.bg === "removed" && photo.cutout;
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      if (wantCut && !o.cutout && !(await runRemoval(o, `Photo ${i + 2} of ${others.length + 1}`))) continue;
      Object.assign(o.edits, look, { zoom: 1, panX: 0, panY: 0 });
      o.cache = {};
    }
    close("all");
  }

  function close(result) {
    if (result === "cancel") { photo.edits = before; photo.cache = {}; }
    dlg.close();
    resolveFn(result);
  }

  function open(p, opts) {
    if (!dlg) build();
    photo = p;
    others = (opts && opts.others) || [];
    before = { ...p.edits };
    comparing = false;
    dlg.querySelectorAll("[data-tab]").forEach((t, i) => t.setAttribute("aria-selected", String(i === 0)));
    dlg.querySelectorAll("[data-panel]").forEach((pn, i) => { pn.hidden = i !== 0; });
    dlg.querySelector(".st-hint").hidden = false;
    dlg.showModal();
    sync();
    return new Promise(r => { resolveFn = r; });
  }

  return { open };
})();
