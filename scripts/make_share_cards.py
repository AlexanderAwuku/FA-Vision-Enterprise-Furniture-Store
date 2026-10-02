#!/usr/bin/env python3
"""Build the HD share card and share page for every product.

Card: assets/images/share/<id>.jpg, 1080 x 1350 (4:5, shown uncropped on
WhatsApp, Facebook, Instagram, X and TikTok photo posts). Layout, like a
branded social card: blurred photo backdrop, white card with the F.A Vision
header, the HD product photo with the name and price over it, the live deals
strip (this product's bubble plus the next deal peeking in), and a caption.

Page: p/<ID>.html, a tiny page whose link preview (og:image) is the card, then
opens the product on the site. Sharing that link on WhatsApp, Facebook or X
shows the card.

    python3 scripts/make_share_cards.py            # all products
    python3 scripts/make_share_cards.py FAV-001    # one product
"""
import hashlib
import html
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_ads import font, tlen, txt  # noqa: E402  (same fonts and ₵ fallback as the ads)

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://favisionenterprize.github.io/"
W, H = 1080, 1350
INK, GREY, LIVE, BLUE = (20, 23, 26), (96, 104, 112), (224, 36, 94), (13, 85, 175)
ORANGE, CHIP, WHITE = (255, 138, 61), (253, 232, 238), (255, 255, 255)
PROMO_ID = "FAV-014"


def cedis(n):
    return "GH₵" + f"{int(n):,}"


def short(name):
    return str(name).split(" — ")[0]


def cover(im, w, h):
    return ImageOps.fit(im.convert("RGB"), (w, h), Image.LANCZOS, centering=(0.5, 0.5))


def round_mask(d):
    m = Image.new("L", (d * 4, d * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, d * 4 - 1, d * 4 - 1), fill=255)
    return m.resize((d, d), Image.LANCZOS)


def circle(im, d):
    return cover(im, d, d), round_mask(d)


def ring(base, xy, d, img, gap_fill):
    """Bubble with the red → orange → blue ring used in the live strip."""
    x, y = xy
    grad = Image.new("RGB", (d, d))
    px = grad.load()
    for yy in range(d):
        for xx in range(d):
            t = (xx + yy) / (2 * d - 2)
            a, b, u = (LIVE, ORANGE, t * 2) if t < .5 else (ORANGE, BLUE, (t - .5) * 2)
            px[xx, yy] = tuple(int(a[k] + (b[k] - a[k]) * u) for k in range(3))
    base.paste(grad, (x, y), round_mask(d))
    inner = d - 8
    base.paste(Image.new("RGB", (inner, inner), gap_fill), (x + 4, y + 4), round_mask(inner))
    ph, pm = circle(img, d - 16)
    base.paste(ph, (x + 8, y + 8), pm)


def fit_text(draw, text, fnt, maxw):
    if tlen(draw, text, fnt) <= maxw:
        return text
    while text and tlen(draw, text + "…", fnt) > maxw:
        text = text[:-1]
    return text.rstrip() + "…"


def wrap_lines(draw, text, fnt, maxw, max_lines):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if tlen(draw, t, fnt) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = fit_text(draw, lines[-1] + " …", fnt, maxw)
    return lines


def pill(base, draw, x, y, w, p, badge, line):
    """One live-strip pill: bubble, name, LIVE/DEAL badge with dot, ticker line."""
    h = 104
    draw.rounded_rectangle((x, y, x + w, y + h), h // 2, fill=CHIP)
    ring(base, (x + 8, y + 8), h - 16, p["_img"], CHIP)
    tx = x + h + 6
    name_f, badge_f, line_f = font("Bold", 30), font("Bold", 21), font("Regular", 23)
    bw = tlen(draw, badge, badge_f) + 24
    name = fit_text(draw, short(p["name"]), name_f, w - (tx - x) - bw - 36)
    txt(draw, (tx, y + 16), name, name_f, INK)
    bx = tx + tlen(draw, name, name_f) + 14
    txt(draw, (bx, y + 23), badge, badge_f, LIVE)
    draw.ellipse((bx + bw - 12, y + 30, bx + bw, y + 42), fill=LIVE)
    txt(draw, (tx, y + 60), fit_text(draw, line, line_f, w - (tx - x) - 34), line_f, GREY)


def ticker(p):
    if p["id"] == PROMO_ID:
        bits = ["Back-to-school promo", cedis(p["price_ghs"]) + " per set", "GH₵640 each from 50"]
    else:
        bits = [cedis(p["price_ghs"]) + (" (negotiable)" if p.get("negotiable") else "")]
    return " · ".join(bits + (p.get("highlights") or [])[:1])


def local_phone(num):
    d = "".join(ch for ch in str(num) if ch.isdigit())
    d = "0" + d[-9:] if len(d) >= 9 else d
    return f"{d[:3]} {d[3:6]} {d[6:]}" if len(d) == 10 else d


def make_card(p, others, biz, logo):
    photo = Image.open(ROOT / p["images"][0])
    base = cover(photo, W, H).filter(ImageFilter.GaussianBlur(38))
    base = Image.blend(base, Image.new("RGB", (W, H), (30, 30, 36)), 0.35)

    cx0, cx1, cy0 = 54, W - 54, 80
    cw = cx1 - cx0
    head_h, photo_h, strip_h, cap_h = 112, int(cw * 0.75), 150, 150
    ch = head_h + photo_h + strip_h + cap_h
    cy1 = cy0 + ch

    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((cx0, cy0 + 14, cx1, cy1 + 14), 34, fill=120)
    base.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(24)))

    card = Image.new("RGB", (cw, ch), WHITE)
    cd = ImageDraw.Draw(card)

    # header: round logo + account name, like a social post
    lg, lm = circle(logo, 70)
    card.paste(lg, (30, 21), lm)
    cd.ellipse((29, 20, 101, 92), outline=(228, 228, 234), width=2)
    txt(cd, (120, 30), "favisionenterprise", font("Medium", 34), INK)
    loc, lf = "Odorkor · Omanjor · Kasoa", font("Regular", 24)
    txt(cd, (cw - 30 - tlen(cd, loc, lf), 40), loc, lf, GREY)

    # HD product photo with a soft dark fade under the text
    ph = cover(photo, cw, photo_h)
    fade = Image.new("L", (1, photo_h), 0)
    for yy in range(photo_h):
        t = max(0.0, (yy - photo_h * 0.40) / (photo_h * 0.60))
        fade.putpixel((0, yy), int(220 * t ** 1.3))
    ph = Image.composite(Image.new("RGB", (cw, photo_h), (8, 10, 14)), ph, fade.resize((cw, photo_h)))
    card.paste(ph, (0, head_h))

    # brand mark on the photo (like the publication logo)
    mark_f = font("Bold", 32)
    cd.rounded_rectangle((26, head_h + 24, 26 + tlen(cd, "F.A VISION", mark_f) + 36, head_h + 80), 12, fill=WHITE)
    txt(cd, (44, head_h + 31), "F.A VISION", mark_f, BLUE)

    # quote-style name, price pill and deal line over the photo
    name_f, qf = font("Bold", 48), font("Bold", 72)
    lines = wrap_lines(cd, short(p["name"]), name_f, cw - 170, 2)
    y = head_h + photo_h - 210 - 58 * len(lines)
    for i, ln in enumerate(lines):
        lw = tlen(cd, ln, name_f)
        x = (cw - lw) // 2
        if i == 0:
            txt(cd, (x - 46, y - 12), "“", qf, LIVE)
        txt(cd, (x, y), ln, name_f, WHITE)
        if i == len(lines) - 1:
            txt(cd, (x + lw + 8, y - 12), "”", qf, LIVE)
        y += 58
    price = cedis(p["price_ghs"]) + (" a set" if p["id"] == PROMO_ID else "")
    pf = font("Bold", 44)
    pw = tlen(cd, price, pf) + 56
    px = (cw - pw) // 2
    cd.rounded_rectangle((px, y + 16, px + pw, y + 82), 33, fill=LIVE)
    txt(cd, (px + 28, y + 21), price, pf, WHITE)
    seller = p.get("seller")
    sub = ("GH₵640 each from 50 sets" if p["id"] == PROMO_ID
           else "Sold by " + seller["name"] if seller else "Pay 50% now, the rest on delivery")
    sf = font("Medium", 27)
    txt(cd, ((cw - tlen(cd, sub, sf)) // 2, y + 100), sub, sf, (236, 237, 241))

    # the live deals strip: this deal, then the next one peeking in (swipe)
    sy = head_h + photo_h + 23
    badge = "PROMO" if p["id"] == PROMO_ID else "DEAL"
    pill(card, cd, 22, sy, 640, p, badge, ticker(p))
    if others:
        pill(card, cd, 22 + 640 + 14, sy, 640, others[0], "DEAL", ticker(others[0]))

    # caption, like the line under a social post
    cyy = head_h + photo_h + strip_h + 8
    capf_b, capf = font("Bold", 30), font("Regular", 30)
    wa = local_phone((seller or {}).get("whatsapp") or biz.get("whatsapp", ""))
    who = "favisionenterprise"
    txt(cd, (30, cyy), who, capf_b, INK)
    x0 = 30 + tlen(cd, who + " ", capf_b)
    cap = (f"{short(p['name'])} available now. Order on WhatsApp {wa} or tap the link "
           "to see every photo and pay with MoMo, GhanaPay or card.")
    words, line1 = cap.split(), ""
    while words and tlen(cd, (line1 + " " + words[0]).strip(), capf) <= cw - x0 - 30:
        line1 = (line1 + " " + words.pop(0)).strip()
    txt(cd, (x0, cyy), line1, capf, INK)
    more = "… more"
    room, l2 = cw - 60 - tlen(cd, " " + more, capf), ""
    for w in words:                                    # whole words only
        if tlen(cd, (l2 + " " + w).strip(), capf) > room:
            break
        l2 = (l2 + " " + w).strip()
    l2 += " "
    txt(cd, (30, cyy + 44), l2, capf, INK)
    txt(cd, (30 + tlen(cd, l2, capf), cyy + 44), more, capf, (150, 156, 164))
    txt(cd, (30, cyy + 96), "favisionenterprize.github.io", font("Medium", 25), BLUE)

    cmask = Image.new("L", (cw * 2, ch * 2), 0)
    ImageDraw.Draw(cmask).rounded_rectangle((0, 0, cw * 2 - 1, ch * 2 - 1), 64, fill=255)
    base.paste(card, (cx0, cy0), cmask.resize((cw, ch), Image.LANCZOS))
    bd = ImageDraw.Draw(base)
    foot, ff = "Tap the link to order  ·  Delivery across Ghana", font("Medium", 28)
    txt(bd, ((W - tlen(bd, foot, ff)) // 2, cy1 + 40), foot, ff, (245, 245, 248))
    return base


def share_page(p, card_rel, ver):
    t = html.escape(f"{short(p['name'])} · {cedis(p['price_ghs'])}")
    d = html.escape(" · ".join((p.get("highlights") or [])[:2]) or "F.A Vision Enterprise, Odorkor, Accra")
    img = f"{SITE}{card_rel}?v={ver}"
    target = f"{SITE}#product/{p['id']}"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{t} | F.A Vision Enterprise</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{d}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="F.A Vision Enterprise">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{SITE}p/{p['id']}.html">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1350">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{img}">
<link rel="canonical" href="{target}">
<meta http-equiv="refresh" content="0; url={target}">
<style>body{{margin:0;font:16px system-ui,sans-serif;background:#111;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center}}img{{max-width:min(92vw,540px);border-radius:16px}}a{{color:#fff}}</style>
</head><body><div><img src="{img}" alt="{t}"><p><a href="{target}">Open {t} →</a></p></div>
<script>location.replace({json.dumps(target)});</script></body></html>
"""


def main():
    products = json.loads((ROOT / "data/products.json").read_text())
    biz = json.loads((ROOT / "data/business.json").read_text())
    logo = Image.open(ROOT / "assets/images/logo.png").convert("RGBA")
    flat = Image.new("RGB", logo.size, WHITE)
    flat.paste(logo, (0, 0), logo)
    ready = [p for p in products if not p.get("placeholder") and p.get("images") and p.get("price_ghs")
             and (ROOT / p["images"][0]).exists()]
    for p in ready:
        p["_img"] = Image.open(ROOT / p["images"][0])
    only = {a.upper() for a in sys.argv[1:]}
    (ROOT / "assets/images/share").mkdir(parents=True, exist_ok=True)
    (ROOT / "p").mkdir(exist_ok=True)
    for i, p in enumerate(ready):
        if only and p["id"] not in only:
            continue
        others = [ready[(i + k) % len(ready)] for k in (1, 2)] if len(ready) > 1 else []
        rel = f"assets/images/share/{p['id'].lower()}.jpg"
        make_card(p, others, biz, flat).save(ROOT / rel, "JPEG", quality=90, optimize=True, progressive=True)
        ver = hashlib.md5((ROOT / rel).read_bytes()).hexdigest()[:8]
        (ROOT / f"p/{p['id']}.html").write_text(share_page(p, rel, ver))
        print("card", rel)


if __name__ == "__main__":
    main()
