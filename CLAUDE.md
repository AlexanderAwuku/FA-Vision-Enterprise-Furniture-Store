# F.A Vision Enterprise site: working notes

Static GitHub Pages site, live at https://favisionenterprize.github.io (push to `main` deploys). README.md has the full guide; read it only when needed.

## Edit rules
- Edit data in `data/*.json`, then run `python3 scripts/generate_listings.py`. That rebuilds `assets/js/products-data.js` and `output/`. Never hand-edit `products-data.js`.
- Promos: `data/business.json` → `promos.ads` + `promos.schedule` (first matching date window wins).
- Stock badge: `custom_order` / `in_stock` per product in `data/products.json`.
- Copy says "we sell", not "we make".

## Business facts
- Phones: 020 747 3267 · 057 264 6176 · 054 614 8923 (WhatsApp 057 264 6176)
- Locations: Odorkor (showroom), Omanjor (printing press), Kasoa
- Student desk FAV-014: GH₵650/set, GH₵640 each from 50. In stock.

## Socials (accounts)
| Platform | Account | How to post |
|---|---|---|
| Facebook Page | F.A Vision Enterprise (id 110032960671410) | Chrome; Windsor can read but can't post. Turn **Boost off**. |
| Instagram | @favisionent | Chrome; switch off "share to Alexander Awuku Facebook" |
| X | @FaVisionEnt | Chrome; ≤280 chars |
| TikTok | FA Vision Enterprise | Chrome → TikTok Studio → Photos tab |

Ad images live at `assets/images/ads/*.jpg` (1080×1350); upload them from this repo path.
