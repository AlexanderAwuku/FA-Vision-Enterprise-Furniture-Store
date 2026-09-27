#!/usr/bin/env python3
"""Generate ready-to-paste Facebook Marketplace, group and WhatsApp posts for
F.A Vision Enterprise from data/business.json, data/products.json and
data/groups.csv.

Outputs (in output/):
  listings.md          Marketplace listing fields, 3 group caption variants
                       and a WhatsApp status text for every product
  posting-tracker.csv  One row per product x group, for logging manual posts
  meta-catalog.csv     Product feed for Meta Commerce Manager (Facebook /
                       Instagram Shop); only products with a price and photo

It also rewrites assets/js/products-data.js, the product list the website
(index.html) displays, so the site and the listings always match.

Uses the Python standard library only:  python3 scripts/generate_listings.py
"""

import csv
import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "output"
SITE_DATA = ROOT / "assets" / "js" / "products-data.js"

MARKETPLACE_TITLE_MAX = 100


def load():
    business = json.loads((DATA / "business.json").read_text(encoding="utf-8"))
    products = json.loads((DATA / "products.json").read_text(encoding="utf-8"))
    with (DATA / "groups.csv").open(encoding="utf-8", newline="") as f:
        groups = list(csv.DictReader(f))
    return business, products, groups


def price_text(product):
    price = product.get("price_ghs")
    return f"GH₵ {price:,.0f}" if price else "Price on request"


def whatsapp_link(business, product):
    number = "".join(c for c in business["whatsapp"] if c.isdigit())
    message = f"Hello F.A Vision, I'm interested in the {product['name']} ({product['id']})."
    return f"https://wa.me/{number}?text={quote(message)}"


def details(product):
    lines = []
    if product.get("material"):
        lines.append(f"Material: {product['material']}")
    if product.get("dimensions"):
        lines.append(f"Size: {product['dimensions']}")
    if product.get("colors"):
        lines.append(f"Colours: {', '.join(product['colors'])}")
    return lines


def marketplace_title(product):
    title = product["name"]
    if product.get("custom_order"):
        title += " - Made to Order"
    return title[:MARKETPLACE_TITLE_MAX]


def marketplace_description(business, product):
    parts = [f"{product['name']} by {business['name']}.", ""]
    parts += [f"✔ {h}" for h in product.get("highlights", [])]
    parts += [""] + details(product)
    if product.get("custom_order"):
        parts.append("Custom sizes, colours and finishes available.")
    parts += [
        "",
        f"📍 Showroom: {business['address']}",
        f"🚚 {business['delivery_note']}",
        f"📞 Call / WhatsApp: {business['whatsapp']}",
        f"Ref: {product['id']}",
    ]
    return "\n".join(p for p in parts if p is not None).strip()


def group_captions(business, product):
    """Three wordings, rotated across groups so identical text is not
    posted repeatedly (Facebook flags duplicate posts as spam)."""
    price = price_text(product)
    tags = " ".join(business["hashtags"][:4])
    highlights = product.get("highlights", [])
    first = highlights[0] if highlights else ""
    bullet_list = "\n".join(f"• {h}" for h in highlights)
    wa = business["whatsapp"]
    return [
        f"🛋️ {product['name']} available now!\n{bullet_list}\n💰 {price}\n"
        f"📍 Odorkor, Accra, delivery available\n📞 WhatsApp {wa}\n{tags}",
        f"Looking for a quality {product['name'].lower()}? {first}.\n"
        f"We make it right here in Odorkor, Accra. {price}.\n"
        f"Send us a message or WhatsApp {wa} to order. {tags}",
        f"NEW FROM F.A VISION ✨ {product['name']}\n{price} | "
        f"{'Made to order in your size and colour' if product.get('custom_order') else 'Ready for pickup'}\n"
        f"Homes • Offices • Schools\nDM or call {wa} {tags}",
    ]


def whatsapp_status(business, product):
    return (
        f"{product['name']} 🔥\n{price_text(product)}\n"
        f"Order: {whatsapp_link(business, product)}"
    )


def write_listings(business, products):
    out = [f"# {business['name']}: ready-to-paste listings", "",
           f"Generated {date.today().isoformat()}. Regenerate after editing `data/products.json`.", ""]
    for p in products:
        out += [f"## {p['id']} · {p['name']}", ""]
        if p.get("placeholder"):
            out += ["> ⚠️ Placeholder product: confirm details, price and photos before posting.", ""]
        out += [
            "### Facebook Marketplace",
            "",
            f"- **Title:** {marketplace_title(p)}",
            f"- **Price:** {p['price_ghs'] if p.get('price_ghs') else '⚠️ set price_ghs'}",
            f"- **Category:** {p['marketplace_category']}",
            f"- **Condition:** {p['condition']}",
            f"- **Location:** {business['marketplace_location']}",
            f"- **Photos:** {', '.join(p['images']) if p.get('images') else '⚠️ add photos'}",
            "",
            "**Description:**",
            "",
            "```",
            marketplace_description(business, p),
            "```",
            "",
            "### Group posts (use a different variant in each group)",
            "",
        ]
        for i, caption in enumerate(group_captions(business, p), 1):
            out += [f"**Variant {i}**", "", "```", caption, "```", ""]
        out += ["### WhatsApp status", "", "```", whatsapp_status(business, p), "```", ""]
    (OUT / "listings.md").write_text("\n".join(out), encoding="utf-8")


def write_tracker(products, groups):
    fields = ["product_id", "product_name", "channel", "group_name", "caption_variant",
              "date_posted", "renew_on", "status", "enquiries", "sold", "notes"]
    with (OUT / "posting-tracker.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for p in products:
            w.writerow({"product_id": p["id"], "product_name": p["name"], "channel": "Marketplace",
                        "status": "To post"})
            for i, g in enumerate(groups):
                w.writerow({"product_id": p["id"], "product_name": p["name"], "channel": "Group",
                            "group_name": g["group_name"], "caption_variant": i % 3 + 1,
                            "status": "To post"})


def write_catalog(business, products):
    """Meta Commerce Manager data-feed columns. Products without a price or
    photo are skipped because Meta rejects them."""
    fields = ["id", "title", "description", "availability", "condition",
              "price", "link", "image_link", "brand"]
    skipped = []
    with (OUT / "meta-catalog.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for p in products:
            image = image_url(business, p["images"][0]) if p.get("images") else ""
            if not p.get("price_ghs") or not image:
                skipped.append(p["id"])
                continue
            w.writerow({
                "id": p["id"],
                "title": p["name"],
                "description": " ".join(p.get("highlights", [])) or p["name"],
                "availability": "in stock" if p.get("in_stock") else "out of stock",
                "condition": p["condition"].lower(),
                "price": f"{p['price_ghs']:.2f} GHS",
                "link": business.get("website") or whatsapp_link(business, p),
                "image_link": image,
                "brand": business["name"],
            })
    return skipped


def image_url(business, path):
    """Meta needs absolute image URLs; relative paths such as
    assets/images/sofa.jpg are resolved against the published website."""
    if path.startswith(("http://", "https://")):
        return path
    site = business.get("website", "").rstrip("/")
    return f"{site}/{path.lstrip('/')}" if site else ""


def write_site_data(products):
    site_products = [{
        "id": p["id"],
        "name": p["name"],
        "category": p["category"],
        "price": p.get("price_ghs"),
        "icon": p.get("icon", ""),
        "description": p.get("description", ""),
        "image": p["images"][0] if p.get("images") else "",
    } for p in products]
    SITE_DATA.write_text(
        "// Generated by scripts/generate_listings.py from data/products.json. Do not edit.\n"
        f"const PRODUCTS = {json.dumps(site_products, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )


def main():
    business, products, groups = load()
    OUT.mkdir(exist_ok=True)
    write_listings(business, products)
    write_tracker(products, groups)
    skipped = write_catalog(business, products)
    write_site_data(products)

    print(f"Wrote {len(products)} products to {OUT.relative_to(ROOT)}/ and {SITE_DATA.relative_to(ROOT)}")
    missing_price = [p["id"] for p in products if not p.get("price_ghs")]
    missing_photo = [p["id"] for p in products if not p.get("images")]
    if missing_price:
        print(f"  Missing price: {', '.join(missing_price)}", file=sys.stderr)
    if missing_photo:
        print(f"  Missing photos: {', '.join(missing_photo)}", file=sys.stderr)
    if skipped:
        print(f"  Left out of meta-catalog.csv: {', '.join(skipped)}", file=sys.stderr)


if __name__ == "__main__":
    main()
