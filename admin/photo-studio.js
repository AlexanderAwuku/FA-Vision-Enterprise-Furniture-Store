// Photo studio for the admin: framing, straightening, light and colour,
// background removal with studio backdrops. Everything runs in the browser.
//
// A "photo" is { src, cutout, edits, stats, cache }. `src` is the original
// image (downscaled to MAX_SRC) on a canvas; `cutout` is the same image with
// the background made transparent, once removed. render() draws the finished
// 4:3 picture from those plus `edits`, so every change stays reversible.
window.PhotoStudio = (function () {
  const MAX_SRC = 2000;                 // longest side kept in memory
  const PREVIEW_SRC = 900;              // working size while editing
  const RATIO = 4 / 3;                  // matches the storefront's photo frames
  const BG_LIB = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

  const BACKDROPS = {
    blur:  { label: "Blurred", swatch: "linear-gradient(135deg,#8a7a6a,#c9b8a2)" },
    white: { label: "Studio white", wall: ["#f8f7f4", "#efece7"], floor: ["#e9e5de", "#dcd6cc"], swatch: "#f3f1ed" },
    cream: { label: "Cream", wall: ["#f7eee2", "#efe2cf"], floor: ["#e8d8c1", "#dbc6a9"], swatch: "#f0e3d0" },
    grey:  { label: "Soft grey", wall: ["#eeece9", "#e0dcd7"], floor: ["#d8d3cc", "#cac4bb"], swatch: "#e2ded9" },
    dark:  { label: "Showroom dark", wall: ["#2a1f17", "#15100c"], floor: ["#2e231a", "#1c150f"], glow: true, swatch: "#1f1711" }
  };

  const DEFAULT_LIGHT = { auto: true, brightness: 0, contrast: 0, warmth: 0, saturation: 0 };

  function defaultEdits(w, h) {
    // Photos close to 4:3 fill the frame; very tall or wide ones are shown whole on a blurred backdrop.
    const r = w / h;
    const near = r > RATIO * 0.85 && r < RATIO * 1.2;
    return { mode: near ? "fill" : "fit", zoom: 1, panX: 0, panY: 0, rot90: 0, angle: 0, ...DEFAULT_LIGHT, bg: "original", backdrop: "blur", studio: "white" };
  }

  // ------------------------------------------------------------ loading
  function toCanvas(img, maxEdge) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const s = Math.min(1, maxEdge / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function newPhoto(img) {
    const src = toCanvas(img, MAX_SRC);
    return { src, cutout: null, edits: defaultEdits(src.width, src.height), stats: levelStats(src), cache: {} };
  }

  async function fromFile(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: only JPG, PNG and WEBP photos are supported`);
    const bmp = await createImageBitmap(file);   // respects the photo's EXIF rotation
    return newPhoto(bmp);
  }

  function fromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(newPhoto(img));
      img.onerror = () => reject(new Error("Couldn't load that photo for editing"));
      img.src = url + (url.includes("?") ? "&" : "?") + "edit=" + Date.now();
    });
  }

  // ------------------------------------------------------------ light & colour
  // Auto-levels: find the dark and bright ends of the photo so it can be stretched to a full range.
  function levelStats(canvas) {
    const small = toCanvas(canvas, 256);
    const d = small.getContext("2d").getImageData(0, 0, small.width, small.height).data;
    const hist = new Uint32Array(256);
    let n = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      hist[l]++; n++; sum += l;
    }
    const pct = p => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; } return 255; };
    return { lo: pct(0.005), hi: pct(0.995), mean: n ? sum / n : 128 };
  }

  function buildLut(e, stats) {
    let lo = 0, hi = 255, gamma = 1, sat = 1 + e.saturation / 100;
    if (e.auto) {
      if (stats.hi - stats.lo > 60) { lo = Math.min(stats.lo, 40); hi = Math.max(stats.hi, 200); }
      const stretchedMean = ((stats.mean - lo) / (hi - lo)) * 255;
      if (stretchedMean < 110) gamma = Math.max(0.72, Math.log(118 / 255) / Math.log(Math.max(stretchedMean, 20) / 255));
      sat += 0.08;
    }
    const c = e.contrast * 1.5;
    const cf = (259 * (c + 255)) / (255 * (259 - c));
    const bright = e.brightness * 1.2;
    const warm = [e.warmth * 0.5, e.warmth * 0.1, -e.warmth * 0.5];
    const luts = [0, 1, 2].map(ch => {
      const lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) {
        let x = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
        x = Math.pow(x, gamma) * 255;
        x = cf * (x - 128) + 128 + bright + warm[ch];
        lut[v] = x;
      }
      return lut;
    });
    return { luts, sat };
  }

  function lightKey(e) { return [e.auto, e.brightness, e.contrast, e.warmth, e.saturation].join(","); }

  function adjust(canvas, e, stats) {
    const out = document.createElement("canvas");
    out.width = canvas.width; out.height = canvas.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvas, 0, 0);
    const neutral = !e.auto && !e.brightness && !e.contrast && !e.warmth && !e.saturation;
    if (neutral) return out;
    const img = ctx.getImageData(0, 0, out.width, out.height), d = img.data;
    const { luts: [lr, lg, lb], sat } = buildLut(e, stats);
    for (let i = 0; i < d.length; i += 4) {
      let r = lr[d[i]], g = lg[d[i + 1]], b = lb[d[i + 2]];
      if (sat !== 1) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  // ------------------------------------------------------------ geometry helpers
  function rotate90(canvas, turns) {
    turns = ((turns % 4) + 4) % 4;
    if (!turns) return canvas;
    const out = document.createElement("canvas");
    const swap = turns % 2 === 1;
    out.width = swap ? canvas.height : canvas.width;
    out.height = swap ? canvas.width : canvas.height;
    const ctx = out.getContext("2d");
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate(turns * Math.PI / 2);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return out;
  }

  // Bounding box of the non-transparent part of a cut-out, after straightening.
  function subjectBox(canvas, angle) {
    const s = Math.min(1, 300 / Math.max(canvas.width, canvas.height));
    const w = Math.round(canvas.width * s), h = Math.round(canvas.height * s);
    const a = angle * Math.PI / 180;
    const bw = Math.ceil(Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)));
    const bh = Math.ceil(Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a)));
    const c = document.createElement("canvas");
    c.width = bw; c.height = bh;
    const ctx = c.getContext("2d");
    ctx.translate(bw / 2, bh / 2); ctx.rotate(a);
    ctx.drawImage(canvas, -w / 2, -h / 2, w, h);
    const d = ctx.getImageData(0, 0, bw, bh).data;
    let x0 = bw, y0 = bh, x1 = -1, y1 = -1;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      if (d[(y * bw + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    // Returned relative to the straightened image's centre, in source pixels.
    return { x0: (x0 - bw / 2) / s, x1: (x1 + 1 - bw / 2) / s, y0: (y0 - bh / 2) / s, y1: (y1 + 1 - bh / 2) / s };
  }

  // ------------------------------------------------------------ backdrops
  function drawStudio(ctx, W, H, key) {
    const b = BACKDROPS[key] || BACKDROPS.white;
    const horizon = H * 0.7;
    let g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, b.wall[0]); g.addColorStop(1, b.wall[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizon + 1);
    g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, b.floor[0]); g.addColorStop(1, b.floor[1]);
    ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
    // soften the wall/floor join
    g = ctx.createLinearGradient(0, horizon - H * 0.06, 0, horizon + H * 0.06);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, b.glow ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.035)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, horizon - H * 0.06, W, H * 0.12);
    if (b.glow) {
      g = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, W * 0.6);
      g.addColorStop(0, "rgba(226,184,102,.22)"); g.addColorStop(1, "rgba(226,184,102,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBlurred(ctx, W, H, img) {
    const tiny = document.createElement("canvas");
    tiny.width = 24; tiny.height = Math.max(1, Math.round(24 * H / W));
    const t = tiny.getContext("2d");
    const s = Math.max(tiny.width / img.width, tiny.height / img.height);
    t.drawImage(img, (tiny.width - img.width * s) / 2, (tiny.height - img.height * s) / 2, img.width * s, img.height * s);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tiny, 0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------ render
  // Returns a W x (W*3/4) canvas with the finished photo. quality: "preview" | "full".
  function render(photo, W, quality, editsOverride) {
    const e = editsOverride || photo.edits;
    const H = Math.round(W / RATIO);
    const useCut = e.bg === "removed" && photo.cutout;
    const baseSrc = useCut ? photo.cutout : photo.src;

    // light-adjusted source, cached per size / source / settings
    const size = quality === "full" ? MAX_SRC : PREVIEW_SRC;
    const key = `${size}|${useCut ? "cut" : "src"}|${lightKey(e)}`;
    if (photo.cache.lightKey !== key) {
      photo.cache.lightKey = key;
      photo.cache.light = adjust(size >= Math.max(baseSrc.width, baseSrc.height) ? baseSrc : toCanvas(baseSrc, size), e, photo.stats);
      photo.cache.boxKey = null;
    }
    const img = rotate90(photo.cache.light, e.rot90);
    const a = e.angle * Math.PI / 180;

    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (useCut) {
      drawStudio(ctx, W, H, e.studio);
      const bk = `${photo.cache.lightKey}|${e.rot90}|${e.angle}`;
      if (photo.cache.boxKey !== bk) { photo.cache.box = subjectBox(img, e.angle); photo.cache.boxKey = bk; }
      const box = photo.cache.box || { x0: -img.width / 2, x1: img.width / 2, y0: -img.height / 2, y1: img.height / 2 };
      const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
      const k = Math.min((W * 0.84) / bw, (H * 0.76) / bh) * e.zoom;
      const floorY = H * 0.88 - e.panY * H * 0.2;
      const cx = W / 2 - e.panX * W * 0.3;
      // centre of the straightened image, placed so the subject sits on the floor
      const ox = cx - ((box.x0 + box.x1) / 2) * k;
      const oy = floorY - box.y1 * k;
      // soft contact shadow
      const sw = bw * k * 0.5, sh = Math.max(6, H * 0.035);
      const g = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, sw);
      g.addColorStop(0, e.studio === "dark" ? "rgba(0,0,0,.55)" : "rgba(40,28,18,.30)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); ctx.translate(cx, floorY); ctx.scale(1, sh / sw); ctx.translate(-cx, -floorY);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, floorY, sw, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(a);
      ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
      ctx.restore();
      return out;
    }

    if (e.mode === "fit") {
      if (e.backdrop === "blur") drawBlurred(ctx, W, H, img);
      else drawStudio(ctx, W, H, e.backdrop);
    } else {
      ctx.fillStyle = "#e9e3da"; ctx.fillRect(0, 0, W, H);
    }

    let k;
    if (e.mode === "fill") {
      // cover the frame; zoom in a little more when straightening so no corners show
      const rotCover = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) * Math.max(W / H, H / W);
      k = Math.max(W / img.width, H / img.height) * rotCover * e.zoom;
    } else {
      k = Math.min((W * 0.94) / img.width, (H * 0.94) / img.height) * e.zoom;
    }
    const maxX = Math.max(0, (img.width * k - W) / 2), maxY = Math.max(0, (img.height * k - H) / 2);
    const ox = W / 2 - e.panX * (e.mode === "fill" ? maxX : W * 0.3);
    const oy = H / 2 - e.panY * (e.mode === "fill" ? maxY : H * 0.3);
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(a);
    if (e.mode === "fit") { ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = W * 0.02; ctx.shadowOffsetY = W * 0.006; }
    ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
    ctx.restore();
    return out;
  }

  function toJpeg(photo, width) {
    return new Promise(resolve => render(photo, width || 1600, "full").toBlob(resolve, "image/jpeg", 0.85));
  }

  // ------------------------------------------------------------ background removal
  let libPromise = null;
  function loadLib() {
    if (!libPromise) libPromise = import(BG_LIB).catch(err => { libPromise = null; throw err; });
    return libPromise;
  }

  async function removeBackground(photo, onProgress) {
    const lib = await loadLib();
    const input = await new Promise(r => photo.src.toBlob(r, "image/png"));
    const blob = await lib.removeBackground(input, {
      model: "isnet_quint8",
      output: { format: "image/png" },
      progress: (key, cur, total) => { if (onProgress && total) onProgress(key.startsWith("fetch") ? "download" : "process", cur / total); }
    });
    const bmp = await createImageBitmap(blob);
    const cut = document.createElement("canvas");
    cut.width = photo.src.width; cut.height = photo.src.height;
    const cctx = cut.getContext("2d");
    cctx.drawImage(bmp, 0, 0, cut.width, cut.height);
    // Firm up the mask: drop the faint "ghost" edges the model leaves behind, keep soft true edges.
    const img = cctx.getImageData(0, 0, cut.width, cut.height), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = Math.max(0, Math.min(255, (d[i] - 70) * 255 / 130));
    cctx.putImageData(img, 0, 0);
    photo.cutout = cut;
    photo.cache = {};
  }

  return { BACKDROPS, DEFAULT_LIGHT, RATIO, fromFile, fromUrl, render, toJpeg, removeBackground, defaultEdits };
})();
