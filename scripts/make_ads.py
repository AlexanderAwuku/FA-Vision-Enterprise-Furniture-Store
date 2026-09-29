#!/usr/bin/env python3
"""Build the strategy ad for every entry in business.json -> promos.ads.

Each ad is a 1080 x 1350 JPEG (the 4:5 size Facebook, Instagram and WhatsApp
Status show without cropping) saved to assets/images/ads/<id>.jpg.
Layout: brand bar, big product photo, headline, a row of key facts, a
call-to-action button and a contact footer.

    python3 scripts/make_ads.py            # all ads
    python3 scripts/make_ads.py FAV-001    # one ad (by ad id or product id)

Edit the wording in data/business.json (promos.ads), then re-run. Needs Pillow and the Poppins
font (falls back to DejaVu Sans).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
W, H = 1080, 1350
BLUE, RED, PINK, PURPLE = (13, 85, 175), (244, 44, 44), (230, 80, 110), (176, 62, 166)
INK, GREY, CREAM, NAVY = (24, 24, 32), (92, 96, 110), (255, 248, 240), (9, 45, 104)
LINE = (222, 214, 232)
FONT_DIRS = ["/usr/share/fonts/truetype/google-fonts", str(ROOT / "assets" / "fonts")]


def font(weight, size):
    for d in FONT_DIRS:
        p = Path(d) / f"Poppins-{weight}.ttf"
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.truetype("DejaVuSans-Bold.ttf" if weight == "Bold" else "DejaVuSans.ttf", size)


def rounded(im, r):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), r, fill=255)
    return im, mask


def wrap(draw, text, fnt, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def headline(draw, x, y, main, accent, maxw):
    """Two-tone headline (ink + brand pink), shrunk until it fits in 2 lines."""
    words_all = [(w, INK) for w in main.split()] + [(w, PINK) for w in accent.split()]
    for size in (78, 72, 66, 60, 56):
        f = font("Bold", size)
        lines, cur, curw = [], [], 0
        for w, c in words_all:
            ww = draw.textlength(w + " ", font=f)
            if curw + ww > maxw and cur:
                lines.append(cur)
                cur, curw = [], 0
            cur.append((w, c))
            curw += ww
        lines.append(cur)
        if len(lines) <= 2:
            break
    lh = int(size * 1.1)
    for i, line in enumerate(lines):
        cx = x
        for w, c in line:
            draw.text((cx, y + i * lh), w, font=f, fill=c)
            cx += draw.textlength(w + " ", font=f)
    return y + len(lines) * lh


def _fallback(fnt):
    """DejaVu at the same size: Poppins has no ₵ (U+20B5) glyph."""
    bold = "Bold" in (fnt.getname()[1] or "") or "Medium" in (fnt.getname()[1] or "")
    return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", int(fnt.size * 0.92))


def _parts(text, fnt):
    fb, out, cur = None, [], ""
    for ch in text:
        if ch == "₵":
            if cur:
                out.append((cur, fnt))
            fb = fb or _fallback(fnt)
            out.append((ch, fb))
            cur = ""
        else:
            cur += ch
    if cur:
        out.append((cur, fnt))
    return out


def tlen(draw, text, fnt):
    return sum(draw.textlength(t, font=f) for t, f in _parts(text, fnt))


def txt(draw, xy, text, fnt, fill, anchor="la"):
    """draw.text that swaps in a fallback font for ₵. Anchors: la, ls, lm, mm, ms."""
    x, y = xy
    if anchor[0] == "m":
        x -= tlen(draw, text, fnt) / 2
    asc, desc = fnt.getmetrics()
    if anchor[1] == "a":          # align every piece on one baseline
        y += asc
    elif anchor[1] == "m":
        y += (asc - desc) / 2
    for t, f in _parts(text, fnt):
        draw.text((x, y), t, font=f, fill=fill, anchor="ls")
        x += draw.textlength(t, font=f)


def fact_row(draw, y, facts):
    """Rounded strip of up to 4 facts: bold value over a small caps label."""
    x0, x1, h = 44, W - 44, 124
    draw.rounded_rectangle((x0, y, x1, y + h), 26, fill="white", outline=LINE, width=3)
    cw = (x1 - x0) / len(facts)
    cols = [BLUE, RED, PINK, PURPLE]
    tick = ImageFont.truetype("DejaVuSans-Bold.ttf", 22)
    for i, (big, small) in enumerate(facts):
        cx = x0 + i * cw
        if i:
            draw.line((cx, y + 22, cx, y + h - 22), fill=LINE, width=3)
        ix, iy = cx + 18, y + h / 2
        draw.ellipse((ix, iy - 18, ix + 36, iy + 18), fill=cols[i % 4])
        draw.text((ix + 18, iy + 1), "✓", font=tick, fill="white", anchor="mm")
        tx, avail = ix + 48, cw - 72
        fb = font("Bold", 30)
        while tlen(draw, big, fb) > avail and fb.size > 18:
            fb = font("Bold", fb.size - 2)
        txt(draw, (tx, iy - 4), big, fb, INK, "ls")
        fs = font("Medium", 16)
        for j, line in enumerate(wrap(draw, small.upper(), fs, avail)[:2]):
            draw.text((tx, iy + 20 + j * 20), line, font=fs, fill=GREY, anchor="ls")


def local_phone(n):
    n = "".join(c for c in n if c.isdigit())
    n = "0" + n[3:] if n.startswith("233") else n
    return f"{n[:3]} {n[3:6]} {n[6:]}"


def make(ad, products, business):
    p = products[ad["product"]]
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    for i, c in enumerate([RED, BLUE, PINK, PURPLE]):          # brand bar
        d.rectangle((i * W / 4, 0, (i + 1) * W / 4, 12), fill=c)

    # photo panel with soft shadow. Cut-out product shots (white background)
    # sit whole on a soft studio backdrop; room photos fill the panel.
    src = Image.open(ROOT / (ad.get("photo") or p["images"][0])).convert("RGB")
    pw, ph = W - 72, 610
    edge = ImageOps.grayscale(src).resize((40, 40))
    px = list(edge.get_flattened_data()) if hasattr(edge, "get_flattened_data") else list(edge.getdata())
    border = [px[i] for i in range(40)] + [px[-40 + i] for i in range(40)] + [px[i * 40] for i in range(40)] + [px[i * 40 + 39] for i in range(40)]
    if ad.get("fit") == "contain" or sum(border) / len(border) > 236:
        photo = Image.new("RGB", (pw, ph), (255, 255, 255))
        glow = Image.new("L", (pw, ph), 0)
        ImageDraw.Draw(glow).ellipse((-pw * 0.2, -ph * 0.3, pw * 1.2, ph * 1.1), fill=255)
        photo.paste((238, 232, 246), (0, 0), ImageOps.invert(glow.filter(ImageFilter.GaussianBlur(90))))
        ImageDraw.Draw(photo).ellipse((pw * 0.22, ph * 0.84, pw * 0.78, ph * 0.96), fill=(226, 220, 236))
        cut = src.copy()
        s = min((pw * 0.86) / cut.width, (ph * 0.84) / cut.height)
        cut = cut.resize((int(cut.width * s), int(cut.height * s)), Image.LANCZOS)
        m = ImageOps.invert(ImageOps.grayscale(cut).point(lambda v: 255 if v > 242 else 0)).filter(ImageFilter.GaussianBlur(1))
        photo.paste(cut, ((pw - cut.width) // 2 - 60, ph - cut.height - int(ph * 0.07)), m)
    else:
        photo = ImageOps.fit(src, (pw, ph), Image.LANCZOS, centering=(0.5, ad.get("focus_y", 0.5)))
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).rounded_rectangle((44, 52, 44 + pw, 52 + ph), 32, fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    img.paste((60, 30, 80), (0, 0), sh)
    photo, mask = rounded(photo, 30)
    img.paste(photo, (36, 36), mask)

    # logo pill
    logo = Image.open(ROOT / "assets/images/logo-512.png").convert("RGBA")
    logo.thumbnail((84, 84))
    d.rounded_rectangle((56, 56, 56 + 300, 56 + 100), 50, fill="white")
    img.paste(logo, (66, 64), logo)
    d.text((160, 74), "F.A Vision", font=font("Bold", 32), fill=BLUE)
    d.text((162, 114), "ENTERPRISE", font=font("Bold", 15), fill=RED)

    if ad.get("tag"):                                           # tilted red tag
        ft = font("Bold", 28)
        tw = int(d.textlength(ad["tag"], font=ft) + 56)
        tag = Image.new("RGBA", (tw, 64), (0, 0, 0, 0))
        td = ImageDraw.Draw(tag)
        td.rounded_rectangle((0, 0, tw - 1, 63), 32, fill=RED)
        td.text((tw / 2, 33), ad["tag"], font=ft, fill="white", anchor="mm")
        tag = tag.rotate(4, expand=True, resample=Image.BICUBIC)
        img.paste(tag, (W - tag.width - 60, 66), tag)

    if ad.get("seal"):                                          # price seal
        big, small = ad["seal"]
        cx, cy, r = W - 168, 590, 112
        d.ellipse((cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8), fill="white")
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BLUE)
        fb = font("Bold", 54)
        while tlen(d, big, fb) > 2 * r - 34:
            fb = font("Bold", fb.size - 2)
        txt(d, (cx, cy - 10), big, fb, "white", "mm")
        fs = font("Medium", 20)
        for j, line in enumerate(wrap(d, small, fs, 2 * r - 56)[:2]):
            d.text((cx, cy + 38 + j * 24), line, font=fs, fill="white", anchor="mm")

    # copy
    y = 676
    d.text((58, y), ad["kicker"].upper(), font=font("Bold", 23), fill=PURPLE)
    y = headline(d, 56, y + 34, ad["headline"], ad["accent"], W - 112)
    fsub = font("Regular", 29)
    sub = wrap(d, ad["sub"], fsub, W - 112)[:2]
    for i, line in enumerate(sub):
        txt(d, (58, y + 8 + i * 40), line, fsub, GREY)
    y += 8 + len(sub) * 40
    # spread the leftover space evenly around the fact row and the button
    gap = max(24, (1256 - y - 124 - 62) / 3)
    fy = y + gap
    fact_row(d, fy, ad["facts"])

    cta = ad.get("cta", "Shop now") + "  ·  favisionenterprize.github.io"
    fc = font("Bold", 27)
    cw = tlen(d, cta, fc) + 80
    by = fy + 124 + gap
    d.rounded_rectangle(((W - cw) / 2, by, (W + cw) / 2, by + 62), 31, fill=NAVY)
    txt(d, (W / 2, by + 31), cta, fc, "white", "mm")

    d.rectangle((0, 1256, W, H), fill=BLUE)
    phones = " · ".join(local_phone(n) for n in business["phones"])
    d.text((56, 1272), "Call / WhatsApp  " + phones, font=font("Bold", 27), fill="white")
    d.text((56, 1312), "Odorkor · Omanjor · Kasoa  —  delivery across Ghana", font=font("Medium", 20), fill=(220, 230, 250))

    out = ROOT / "assets/images/ads" / f"{ad['id']}.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, quality=88, optimize=True, progressive=True)
    return out


def main():
    ads = json.loads((ROOT / "data/business.json").read_text(encoding="utf-8"))["promos"]["ads"]
    products = {p["id"]: p for p in json.loads((ROOT / "data/products.json").read_text(encoding="utf-8"))}
    business = json.loads((ROOT / "data/business.json").read_text(encoding="utf-8"))
    only = set(sys.argv[1:])
    for ad in ads:
        if only and ad["id"] not in only and ad["product"] not in only:
            continue
        print("wrote", make(ad, products, business).relative_to(ROOT))


if __name__ == "__main__":
    main()
