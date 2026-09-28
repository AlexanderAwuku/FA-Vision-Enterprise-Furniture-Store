# FA Vision Enterprise Furniture Store

Online presence for **F.A Vision Enterprise**: bulk & wholesale furniture, upholstery, a bookstore and a printing press in **Odorkor, Omanjor and Kasoa** (Accra / Central Region, Ghana).

**Live website:** https://favisionenterprize.github.io/
**Admin (post products):** https://favisionenterprize.github.io/admin/

## About

FA Vision Enterprise makes and sells quality, handcrafted furniture for homes, offices and schools, in single pieces or in bulk at wholesale prices. It also does upholstery and re-upholstery, runs a bookstore (books and stationery) and a printing press. This repository holds the store's website, its admin page and the Facebook listing kit.

Product prices are still starting estimates and there are no product photos yet. Post real photos and prices from the admin page before promoting the site widely.

## Posting products (admin)

Open `/admin/` on your phone or computer. It works like posting an ad on Jiji:

1. **Category & photos.** Pick a category and type, then add photos. The first photo is the main photo; drag or use the arrows to reorder. Every photo is auto-enhanced and framed to the website's 4:3 shape. Tap **✎ Edit** on a photo to open the photo studio (below).
2. **Details & price.** Title, condition, material, size, colours, description, key features, price (negotiable or not, or "price on request"), made to order, in stock.
3. **Review & post.** See the card exactly as customers will, then post.

After posting you get one-tap buttons to send the product on WhatsApp, or copy a Facebook Marketplace listing, a group post or a WhatsApp status. **🎨 Create promo image** makes a branded picture (square post or status/story, dark or cream) to share or download. **My products** lets you edit, share, mark sold or delete anything.

### Photo studio (✎ Edit)

Everything runs in the browser, and photos never leave your device until you post.

- **Frame:** *Fill frame* (drag to position, zoom) or *Show whole piece* on a backdrop, straighten (±15°), rotate 90°.
- **Light & colour:** *Auto-enhance* (on by default) plus brightness, contrast, warmth and colour sliders. Hold **Compare** to see the original.
- **Background:** *Remove background* cuts the furniture out with on-device AI and puts it in a studio (white, cream, soft grey or showroom dark) with a soft floor shadow. The first use downloads about 55 MB, so use Wi-Fi; it's cached after that. It works best when the furniture is the main thing in the photo.
- **Use this look on all photos** copies the light, framing style and background to the product's other photos, so a product's photos match.

Background removal uses [@imgly/background-removal](https://github.com/imgly/background-removal-js) (AGPL-3.0), loaded from jsDelivr.

**How it works:** there's no server to pay for. The admin saves products and photos straight into this GitHub repository, and GitHub Pages republishes the site about a minute later.

### One-time sign-in setup

The admin needs a GitHub token that can only edit this one repository:

1. Open https://github.com/settings/personal-access-tokens/new (Settings → Developer settings → Fine-grained tokens → Generate new token).
2. **Token name:** FA Vision Admin. **Expiration:** 1 year.
3. **Repository access:** Only select repositories → `favisionenterprize.github.io`.
4. **Permissions → Repository permissions → Contents:** Read and write.
5. Generate it, copy it, and paste it into the admin's sign-in box.

The token stays in that browser only. Anyone who has it can change the website, so don't share it. If a phone is lost, delete the token on GitHub and create a new one.

## Payments (MoMo, Visa/Mastercard, deposit, pay on delivery, walk in)

Every priced, in-stock product has a **Buy now** button. At checkout the customer picks how to pay:

| Option | What happens |
|---|---|
| **Pay in full now** | Mobile Money (MTN MoMo, Telecel Cash, AT Money) or Visa / Mastercard |
| **Pay 50% deposit now** | Deposit online, balance on delivery or pickup (change `deposit_percent` to use another percentage) |
| **Pay on delivery** | Nothing online; cash or MoMo when the piece arrives |
| **Walk in & pay at showroom** | Reserves the piece; the customer pays at Odorkor |

Pay on delivery and walk in work straight away. To turn on the **pay now** options, fill in `payments` in `data/business.json` and run `python3 scripts/generate_listings.py`:

```json
"payments": {
  "paystack_public_key": "pk_live_…",
  "momo_number": "+233…",
  "momo_name": "F.A Vision Enterprise",
  "momo_network": "MTN",
  "deposit_percent": 50
}
```

- **Paystack (MoMo + Visa/Mastercard).** Sign up free at <https://paystack.com> (Ghana). There's no setup or monthly fee, only a small percentage per successful payment, and money settles to your bank or MoMo wallet. Once your business is activated, copy the **Public key** from *Settings → API Keys & Webhooks* into `paystack_public_key`. Use the `pk_test_…` key first to try it with test cards and test MoMo numbers.
- **Manual MoMo (no Paystack yet).** Put your MoMo merchant or wallet number in `momo_number`. Customers get your number, the amount and an order reference, pay with *170#, and confirm on WhatsApp. Cards need Paystack.
- **Never put the Paystack secret key (`sk_…`) in the website.** It goes only in the backend (below).

Every order, paid or not, is saved to the **Orders** tab of the backend Sheet, emailed to you, and listed in the admin under **Orders & payments**, where you can move it along (Confirmed → Delivered → Balance paid). Paystack also notifies the backend directly and an hourly sync catches anything missed, so a payment is recorded even if the customer closes the page. Setup steps: [backend/README.md](backend/README.md#orders--payments). Add `PAYSTACK_SECRET_KEY` to the Apps Script's *Script properties* and the backend checks each online payment with Paystack and re-prices the order from the catalogue, so a tampered or failed payment shows as **UNVERIFIED** or **UNDERPAID**. Always check the Orders tab or your Paystack dashboard before releasing furniture.

## What's inside

| Path | Purpose |
|---|---|
| `index.html` | Storefront: hero, collection with search/filters/sort, product pages (`#product/FAV-001` links), custom-order form, showroom and contacts |
| `assets/css/site.css`, `assets/js/site.js` | Storefront styling and behaviour |
| `assets/js/checkout.js` | Buy now checkout: MoMo / card via Paystack, manual MoMo, deposit, pay on delivery, walk in |
| `admin/` | Admin page for posting, editing and sharing products (`admin.js`), orders & payments (`orders.js`), photo studio (`photo-studio.js`, `photo-editor.js`) and promo images (`promo.js`) |
| `assets/js/catalog-config.js` | Categories, product types, colours and icons shared by the site and admin |
| `assets/js/products-data.js` | Product and business data the site reads. **Generated, don't edit by hand.** |
| `assets/images/products/` | Product photos uploaded from the admin |
| `assets/images/og-cover.jpg` | Preview image shown when the site link is shared on WhatsApp or Facebook |
| `data/products.json` | The product list. The admin edits this for you. |
| `data/business.json` | Name, tagline, address, phone/WhatsApp numbers, service areas, hashtags |
| `data/groups.csv` | Facebook groups you post in |
| `scripts/generate_listings.py` | Rebuilds `assets/js/products-data.js` and the bulk listing files in `output/` |
| `output/` | Bulk Marketplace/group/WhatsApp texts, posting tracker and Meta catalog feed |
| `docs/facebook-posting-playbook.md` | Weekly posting routine and rules for staying within Facebook's limits |
| `docs/business-profile.md` | Business profile, product lines and operating details |

## Brand

The site uses the F.A Vision logo from Canva ("FA VISION ENT LOGO") and its colours:

| Colour | Hex | From the logo |
|---|---|---|
| Blue | `#0d55af` | "Vision" (main buttons, links) |
| Red | `#f42c2c` | "FA", "ENTERPRISE" (labels, directions buttons) |
| Pink | `#e6506e` | Ring, top left |
| Purple | `#b03ea6` | Ring, right |

The colours are CSS variables at the top of `assets/css/site.css` (`--brand-*`). Logo files: `assets/images/logo.png` (header), `logo-512.png` (Google), `favicon.png`, `apple-touch-icon.png`. The share picture for WhatsApp/Facebook is `assets/images/og-cover.jpg`.

## Google search (SEO) and getting found

The website tells Google who we are in three ways:

- **Page title and description** mention wholesale furniture, upholstery, bookstore, printing press, Odorkor, Omanjor, Kasoa and all three phone numbers.
- **Structured data** (the `application/ld+json` blocks in `index.html`) lists the business, its three locations as furniture stores, opening hours, phone numbers, services and Facebook pages, plus the FAQ.
- **`robots.txt` and `sitemap.xml`** point search engines at `https://favisionenterprize.github.io/`.

To start getting traffic from Google (only the business owner can do these):

1. **Google Search Console:** go to https://search.google.com/search-console, add the property `https://favisionenterprize.github.io/` (URL prefix), choose **HTML tag**, and paste the `<meta name="google-site-verification" ...>` tag into the `<head>` of `index.html` (or send it to Claude to add). Then open **Sitemaps** and submit `sitemap.xml`, and use **URL inspection → Request indexing** on the home page.
2. **Google Business Profile** (this is what makes you show on Google Maps and "near me" searches): all three branches are already on Google Maps ("Fa Vision Enterprise Odorkor Branch", "Fa Vision Enterprise - Omanjor Branch", "FA Vision Enterprise Kasoa Branch"). Open each one in Google Maps and tap **Own this business?** / **Claim this business** (or manage it at https://business.google.com if it's already yours). Verify it, then under **Edit profile → Contact** set **Website** to `https://favisionenterprize.github.io/`. Add categories *Furniture store*, *Furniture wholesaler*, *Upholstery shop*, *Book store*, *Print shop*, all three phone numbers, hours, and photos.
3. **Exact map pins:** done. Each location's Google Maps link and coordinates are in `data/business.json` (`locations[].maps_url`, `lat`, `lng`) and in the website's structured data. If a pin moves, paste the new **Share → Copy link** there and run `python3 scripts/generate_listings.py`.
4. **Point everything at the website:** put `https://favisionenterprize.github.io/` in the website field of both Facebook pages, WhatsApp Business profile, Instagram bio and any directory listings (Jiji, Tonaton, Ghana Yellow Pages).

## Changing contact details

Phone and WhatsApp numbers, the address, the three `locations`, `services`, `seo_keywords` and hashtags live in `data/business.json`. After editing it, run `python3 scripts/generate_listings.py` and commit, and the site and listings pick up the change.

## Bulk listing files

The admin's share buttons cover day-to-day posting. To rebuild the bulk files in `output/` (all products at once, the posting tracker and the Meta catalog feed), run:

```bash
python3 scripts/generate_listings.py
```

## Preview locally

Open `index.html` in any browser. There's no build step and nothing to install. The admin page needs an internet connection because it saves to GitHub.

## Invoices

- **Customers** request an invoice on the website (**Invoice** in the menu, the **Request a proforma invoice** button on the student-desk promo, or **Request an invoice for this order** after checkout). The request goes to the backend Sheet's **Invoices** tab and to WhatsApp, so nothing is lost even before the backend is connected.
- **You** open `/admin/#invoices` (no GitHub sign-in needed). Each request becomes a draft with the customer's details and a best guess of the lines (e.g. "70 sets FAV-014" → 70 × GH₵650). Adjust quantities, discounts, transport and fixing, deposit or amount already paid, and taxes if you register for VAT, then tap **Generate invoice**.
- One click: the invoice gets the next number (**PINV100684** for a proforma, **INV…** for an invoice, **RCT…** for a receipt, continuing from the paper series PINV100683), opens ready to **Print / Save as PDF**, and, with the backend connected, is saved as a PDF in your Google Drive folder **FA Vision Invoices**, emailed to the customer and linked in the Sheet. A **Send on WhatsApp** button sends the link.
- The layout (`assets/js/invoice.js`) follows standard invoice practice: seller and buyer names, addresses, phones, email and TIN; invoice number, date, due date, PO and order reference; currency; itemised rate × quantity − discount; subtotal, discount, taxes, total; amount in words; deposit, paid and balance; how to pay; terms; signature and date.
- Settings are in `data/business.json` → `invoice`: your **TIN**, `vat_registered`, `taxes` (e.g. `[{"name": "VAT", "rate": 15}]`), `payment_terms_days`, `bank_details` and `terms`. MoMo details come from `payments`.

## Student desk promo

The yellow-and-grey desk set (FAV-014) is promoted with a bar at the very top of every page and a flyer section under the hero, with tabs for **school proprietors** (bulk price, proforma invoice), **parents** (buy one set) and **everyone** (churches, tutorial centres, donors). The flyer image `assets/images/promo-student-desks.jpg` (1080 × 1350) is sized for WhatsApp Status, Instagram and Facebook; **Share this flyer** sends it from a phone.

## Publish the website free with GitHub Pages

GitHub Pages is already switched on for this repository: every change merged into `main` is live at https://favisionenterprize.github.io/ about a minute later. To check or change it:

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the site is live at
   `https://favisionenterprize.github.io/`

## How it fits together

- [x] Landing page with business overview and location
- [x] Product catalogue with prices (GHS), filterable by category
- [x] Contact and enquiry form (sends via WhatsApp)
- [x] Phone / WhatsApp number in the contact section
- [x] Facebook Marketplace and group listing kit
- [x] Admin page for posting products with photos
- [ ] Confirm real prices and dimensions (current prices are estimates)
- [ ] Real product photos
- [x] Publish the website on GitHub Pages
- [x] Simple sales and expense tracking (Google Sheet backend, see [`backend/`](backend/))

## Backend: enquiries, sales, expenses and batch emails

[`backend/`](backend/) is a Google Sheet with Apps Script (free, no server). It:

- saves every **Custom orders** request from the website (as well as opening WhatsApp) and emails you an alert
- keeps your **client list**, **sales** and **expenses**, with a profit summary by month
- sends **batch email campaigns** within Gmail's daily limit, with unsubscribe links

Setup takes about 10 minutes: see [`backend/README.md`](backend/README.md). The last step is pasting the Sheet's web app URL into `enquiry_endpoint` in `data/business.json`. Until then the form works exactly as before, WhatsApp only.

The first campaign, student desks for school proprietors, is in [`marketing/campaigns/student-desks-proprietors.md`](marketing/campaigns/student-desks-proprietors.md).

## Contact

WhatsApp 057 264 6176 · Call 020 747 3267 / 057 264 6176 / 054 614 8923 · [Facebook](https://www.facebook.com/FaVisionEnterprise) · https://favisionenterprize.github.io/

## Locations

- **Odorkor** (main workshop & showroom): Tarazzo Road, opposite Pacific, Odorkor, Accra
- **Omanjor**: Omanjor, Accra
- **Kasoa**: Kasoa, Central Region

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
