"""Build the AI Studio Room Designer strategy ad.

Design: soft pastel "store" look. A tablet showing the real Room Designer, a
gradient headline, a pill button, a fanned row of product tiles and a bold
closing line. Writes two sizes to assets/images/ads/:

    ai-studio.jpg        1080 x 1350  (Facebook / Instagram feed, uncropped)
    ai-studio-story.jpg  1080 x 1920  (WhatsApp Status / Stories)

Run from the repository root (needs Playwright + Chromium):

    python3 -m http.server 8765 &      # serves the site so the designer can be captured
    python3 scripts/make_studio_ad.py
"""
import base64
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/studio/"
OUT = ROOT / "assets/images/ads"
TILES = ["fav-009-1.jpg", "fav-001-1.jpg", "fav-010-1.jpg", "fav-011-1.jpg", "fav-006-1.jpg", "fav-002-1.jpg", "fav-008-1.jpg"]


def data_uri(path, mime="image/jpeg"):
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(path).read_bytes()).decode()


def capture_room(page):
    """A living room with the sofa, centre table, TV stand, armchair and brick wallpaper."""
    page.set_viewport_size({"width": 1100, "height": 900})
    page.route("**/fonts.g*/**", lambda r: r.abort())
    page.goto(SITE)
    page.wait_for_selector(".rd-piece")
    for key in ["FAV-011", "GEN-centre-table", "GEN-tv-stand", "GEN-armchair"]:
        page.click(f'[data-add="{key}"]')
    page.click('[data-paper="GEN-WP-brick"]')
    page.click("#rd-arrange")
    page.wait_for_timeout(300)
    return page.locator(".rd-canvas svg").screenshot(type="png")


def html(w, h, room_png, font_dir):
    story = h > 1500
    tiles = "".join(
        f'<div class="tile t{i}" style="background-image:url({data_uri(ROOT / "assets/images/products" / f)})"></div>'
        for i, f in enumerate(TILES))
    logo = data_uri(ROOT / "assets/images/logo.png", "image/png")
    room = "data:image/png;base64," + base64.b64encode(room_png).decode()
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: P; src: url({font_dir}/Poppins-Bold.ttf); font-weight: 700; }}
@font-face {{ font-family: P; src: url({font_dir}/Poppins-Medium.ttf); font-weight: 500; }}
@font-face {{ font-family: P; src: url({font_dir}/Poppins-Regular.ttf); font-weight: 400; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: {w}px; height: {h}px; overflow: hidden; font-family: P, sans-serif; color: #111;
  background: #f1f1f5; position: relative; }}
.mesh {{ position: absolute; inset: 0; filter: blur(60px); }}
.mesh i {{ position: absolute; border-radius: 50%; opacity: .75; }}
.swirl {{ position: absolute; inset: 0; background:
  radial-gradient(1200px 300px at 70% {40 if story else 44}%, rgba(255,255,255,.7), transparent 60%),
  radial-gradient(600px 160px at 20% {30 if story else 34}%, rgba(255,255,255,.6), transparent 70%); }}
.bar {{ position: absolute; top: 0; left: 0; right: 0; height: 104px; background: rgba(255,255,255,.92);
  display: flex; align-items: center; gap: 22px; padding: 0 48px; box-shadow: 0 2px 18px rgba(0,0,0,.06); }}
.bar img {{ width: 64px; height: 64px; }}
.brand {{ font-weight: 700; font-size: 34px; color: #0d55af; letter-spacing: -.5px; }}
.brand b {{ color: #f42c2c; }}
.divide {{ width: 2px; height: 46px; background: #222; }}
.store {{ font-weight: 400; font-size: 34px; color: #222; }}
.bar .free {{ margin-left: auto; font-weight: 700; font-size: 22px; color: #0a7a3a; background: #e3f5ea;
  padding: 10px 20px; border-radius: 999px; }}
.device {{ position: absolute; left: 50%; transform: translateX(-50%); top: {150 if story else 128}px;
  width: {880 if story else 640}px; background: #fff; border-radius: 34px; padding: 22px;
  box-shadow: 0 30px 70px rgba(40,40,90,.18), 0 2px 6px rgba(0,0,0,.06); }}
.device .ui {{ display: flex; gap: 10px; align-items: center; margin-bottom: 14px; }}
.device .ui span {{ font: 500 18px P; padding: 8px 18px; border-radius: 999px; background: #f1f3f7; color: #5f6368; }}
.device .ui span.on {{ background: #0d55af; color: #fff; }}
.device .ui em {{ margin-left: auto; font: 500 17px P; color: #0a7a3a; font-style: normal; }}
.device img {{ width: 100%; display: block; border-radius: 18px; }}
.h1 {{ position: absolute; left: 60px; right: 60px; top: {880 if story else 668}px; text-align: center;
  font-weight: 700; font-size: {78 if story else 60}px; line-height: 1.12; letter-spacing: -1.5px;
  background: linear-gradient(90deg, #0d55af 0%, #3a6fd8 40%, #7b4fc9 75%, #b03ea6 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }}
.cta {{ position: absolute; left: 50%; transform: translateX(-50%); top: {1090 if story else 812}px;
  display: flex; align-items: center; gap: 18px; background: #0d55af; color: #fff; border-radius: 999px;
  padding: 22px 46px 22px 26px; font-weight: 500; font-size: 34px; white-space: nowrap;
  box-shadow: 0 0 0 5px rgba(13,85,175,.18), 0 16px 36px rgba(13,85,175,.35); }}
.cta .ico {{ width: 56px; height: 56px; border-radius: 14px; background: #fff; display: grid; place-items: center; }}
.fan {{ position: absolute; left: 0; right: 0; top: {1270 if story else 900}px; height: 200px; transform: scale({1 if story else .84}); }}
.tile {{ position: absolute; top: 50%; background-size: cover; background-position: center; border-radius: 26px;
  box-shadow: 0 14px 30px rgba(0,0,0,.18); border: 5px solid #fff; }}
.t0 {{ width: 116px; height: 116px; left: 40px; margin-top: -58px; z-index: 1; }}
.t1 {{ width: 146px; height: 146px; left: 130px; margin-top: -73px; z-index: 2; }}
.t2 {{ width: 176px; height: 176px; left: 250px; margin-top: -88px; z-index: 3; }}
.t3 {{ width: 216px; height: 216px; left: 432px; margin-top: -108px; z-index: 5; border: 0;
  box-shadow: 0 0 0 7px #fff, 0 0 0 12px #e6506e, 0 0 0 16px #b03ea6, 0 22px 44px rgba(0,0,0,.28); }}
.t4 {{ width: 176px; height: 176px; left: 654px; margin-top: -88px; z-index: 3; }}
.t5 {{ width: 146px; height: 146px; left: 804px; margin-top: -73px; z-index: 2; }}
.t6 {{ width: 116px; height: 116px; left: 924px; margin-top: -58px; z-index: 1; }}
.h2 {{ position: absolute; left: 50px; right: 50px; top: {1510 if story else 1112}px; text-align: center;
  font-weight: 700; font-size: {64 if story else 46}px; line-height: 1.1; letter-spacing: -1px; color: #0f1115; }}
.sub {{ position: absolute; left: 60px; right: 60px; top: {1680 if story else 1228}px; text-align: center;
  font-size: {34 if story else 26}px; color: #3c4043; }}
.foot {{ position: absolute; left: 0; right: 0; bottom: {44 if story else 24}px; text-align: center;
  font: 500 {26 if story else 22}px P; color: #5f6368; }}
.foot b {{ color: #0d55af; }}
</style></head><body>
<div class="mesh">
  <i style="width:620px;height:520px;left:-120px;top:{560 if story else 520}px;background:#d6cff6"></i>
  <i style="width:560px;height:480px;right:-140px;top:{520 if story else 460}px;background:#cfe4fb"></i>
  <i style="width:520px;height:420px;left:320px;top:{700 if story else 640}px;background:#f6d7e5"></i>
  <i style="width:600px;height:420px;left:120px;top:{1300 if story else 980}px;background:#d9f1e8"></i>
  <i style="width:480px;height:400px;right:-60px;top:{1450 if story else 1080}px;background:#e3dcfa"></i>
</div>
<div class="swirl"></div>
<div class="bar"><img src="{logo}"><span class="brand"><b>F.A</b> Vision</span><span class="divide"></span><span class="store">AI Studio</span><span class="free">FREE</span></div>
<div class="device"><div class="ui"><span class="on">Room view</span><span>Floor plan</span><em>✓ Fits well</em></div><img src="{room}"></div>
<div class="h1">See your room before you buy it</div>
<div class="cta"><span class="ico"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0d55af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/></svg></span>Design my room free</div>
<div class="fan">{tiles}</div>
<div class="h2">Furniture &amp; wallpaper that fits your space</div>
<div class="sub">Pick pieces, colours and wallpaper · Pay only for what you order</div>
<div class="foot"><b>favisionenterprize.github.io/studio</b> · WhatsApp 057 264 6176{'<br>' if story else ' · '}Odorkor · Omanjor · Kasoa</div>
</body></html>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fonts = (ROOT / "assets/fonts").as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        cap = browser.new_page(device_scale_factor=2)
        room_png = capture_room(cap)
        for name, (w, h) in {"ai-studio": (1080, 1350), "ai-studio-story": (1080, 1920)}.items():
            page = browser.new_page(viewport={"width": w, "height": h})
            tmp = OUT / f".{name}.html"
            tmp.write_text(html(w, h, room_png, fonts), encoding="utf-8")
            page.goto(tmp.as_uri())
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=90)
            tmp.unlink()
            print("wrote", (OUT / f"{name}.jpg").relative_to(ROOT))
        browser.close()


if __name__ == "__main__":
    main()
