// Auto-scrolling carousel used by the live deals strip and the strategy deals row.
//
// - Glides on its own in an endless loop (the items are repeated after the last one).
// - Customers can swipe (touch) or hold-and-drag (mouse) left or right; it picks up again shortly after.
// - Press and hold: the longer the press, the slower it goes, until it stops. A short press just slows it
//   for a moment; a long hold keeps it still a little longer after release so the deal can be read.
// - Hovering with a mouse slows it down. Stops when off screen, when a deal has keyboard focus,
//   and doesn't move at all for people who turn on "reduce motion".
//
// Usage: FavCarousel(trackElement, { speed: 40, forwardClicks: true })
(function () {
  var HOLD_TO_STOP = 900;   // ms of holding until it comes to a full stop
  var LONG_PRESS = 450;     // a press longer than this doesn't open the deal on release
  var STAY_AFTER_STOP = 2500, IDLE_AFTER_SWIPE = 1800;

  window.FavCarousel = function (track, opts) {
    opts = opts || {};
    if (!track || track.dataset.carousel) return;
    track.dataset.carousel = "on";
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var SPEED = opts.speed || 40; // px per second
    var originals = Array.prototype.slice.call(track.children);
    if (!originals.length) return;

    // ------------------------------------------------ endless loop: repeat the items after the last one
    var clones = [];
    function addCopies() {
      clones.forEach(function (c) { c.remove(); });
      clones = [];
      var setW = originals[originals.length - 1].getBoundingClientRect().right - originals[0].getBoundingClientRect().left;
      if (setW <= 0) return;
      var copies = Math.ceil(track.clientWidth / setW) + 2; // room to slide both ways
      for (var k = 0; k < copies; k++) {
        originals.forEach(function (o, i) {
          var c = o.cloneNode(true);
          c.setAttribute("aria-hidden", "true");
          c.dataset.cloneOf = i;
          c.removeAttribute("id");
          c.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
          c.querySelectorAll("a,button,input,[tabindex]").forEach(function (n) { n.tabIndex = -1; });
          track.appendChild(c);
          clones.push(c);
        });
      }
    }
    // width of one full set of items, including the gap before the first copy
    function loopW() { return clones.length ? clones[0].offsetLeft - originals[0].offsetLeft : 0; }

    // Buttons inside a copy (e.g. Share) press the matching button on the real item.
    if (opts.forwardClicks) {
      track.addEventListener("click", function (e) {
        var copy = e.target.closest("[data-clone-of]");
        var btn = e.target.closest("button");
        if (!copy || !btn || !copy.contains(btn)) return;
        e.preventDefault(); e.stopPropagation();
        var path = [], n = btn;
        while (n !== copy) { path.unshift(Array.prototype.indexOf.call(n.parentNode.children, n)); n = n.parentNode; }
        var real = originals[+copy.dataset.cloneOf];
        path.forEach(function (i) { real = real && real.children[i]; });
        if (real) real.click();
      });
    }

    // ------------------------------------------------ state
    var pos = 0, rate = reduce ? 0 : 1, last = 0;
    var held = false, holdStart = 0, resumeAt = 0, hover = false, visible = true, focused = false;
    var drag = null, suppressClick = false;

    function wrap() {
      var W = loopW();
      if (!W) return;
      // stay within the first copy, so there is always room to swipe either way
      while (pos >= 2 * W) pos -= W;
      while (pos < W) pos += W;
    }
    function apply() { track.scrollLeft = pos; }

    // ------------------------------------------------ animation loop
    function tick(t) {
      var dt = last ? Math.min(64, t - last) : 16;
      last = t;
      var target;
      if (reduce || drag || focused || !visible) target = 0;
      else if (held) target = Math.max(0, 1 - (t - holdStart) / HOLD_TO_STOP);
      else if (t < resumeAt) target = 0;
      else target = hover ? 0.3 : 1;
      // ease toward the target speed: quick to slow down, gentle to speed back up
      var k = target < rate ? 0.18 : 0.04;
      rate += (target - rate) * k;
      if (rate < 0.002 && target === 0) rate = 0;
      if (rate > 0 && !drag) {
        pos += SPEED * rate * dt / 1000;
        wrap(); apply();
      }
      requestAnimationFrame(tick);
    }

    // Someone swiped/scrolled the row themselves (touch momentum, trackpad, keyboard)
    track.addEventListener("scroll", function () {
      if (Math.abs(track.scrollLeft - pos) <= 2) return;
      pos = track.scrollLeft;
      var W = loopW();
      if (W && (pos >= 2 * W || pos < W)) { wrap(); apply(); }
      resumeAt = Math.max(resumeAt, performance.now() + IDLE_AFTER_SWIPE);
    }, { passive: true });

    // ------------------------------------------------ press and hold, mouse drag
    track.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      held = true; holdStart = performance.now(); suppressClick = false;
      if (e.pointerType === "mouse" && !e.target.closest("button")) {
        drag = { x: e.clientX, start: pos, moved: false };
      }
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; track.classList.add("is-dragging"); }
      if (drag.moved) { pos = drag.start - dx; wrap(); apply(); drag.start = pos + dx; }
    });
    function release(e) {
      if (!held && !drag) return;
      var now = performance.now(), dur = now - holdStart;
      if (drag && drag.moved) {
        suppressClick = true;
        track.classList.remove("is-dragging");
        resumeAt = now + IDLE_AFTER_SWIPE;
      } else if (held) {
        if (dur > LONG_PRESS) suppressClick = true;
        // fully stopped: stay still for a bit so the deal can be read
        if (dur >= HOLD_TO_STOP) resumeAt = now + STAY_AFTER_STOP;
      }
      if (e && e.type === "pointercancel") resumeAt = Math.max(resumeAt, now + IDLE_AFTER_SWIPE); // touch swipe took over
      held = false; drag = null;
    }
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    track.addEventListener("click", function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
    }, true);
    track.addEventListener("dragstart", function (e) { e.preventDefault(); });
    track.addEventListener("contextmenu", function (e) { if (held) e.preventDefault(); });

    track.addEventListener("mouseenter", function () { hover = true; });
    track.addEventListener("mouseleave", function () { hover = false; });
    track.addEventListener("focusin", function (e) {
      // only keyboard focus pauses it; a mouse click or tap also focuses the deal
      try { focused = e.target.matches(":focus-visible"); } catch (err) { focused = false; }
    });
    track.addEventListener("focusout", function () { focused = false; });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(track);
    }

    // ------------------------------------------------ start
    track.classList.add("is-auto");
    addCopies(); wrap(); apply();
    if ("ResizeObserver" in window) {
      var lastW = track.clientWidth;
      new ResizeObserver(function () {
        if (Math.abs(track.clientWidth - lastW) < 2) return;
        lastW = track.clientWidth; addCopies(); wrap(); apply();
      }).observe(track);
    }
    requestAnimationFrame(tick);
  };
})();
