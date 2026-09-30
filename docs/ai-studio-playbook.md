# AI Studio playbook

How to run the services sold at **favisionenterprize.github.io/studio/**: what arrives when a customer orders, how to do each job with AI tools, and when to get paid.

## When an order comes in

Every AI Studio order lands in three places:

1. **SMS alert** (from the backend) with the reference, service and amount.
2. **Orders tab** of the backend Sheet: reference, service (`SVC-…` id), total, payment plan, what was paid. Service prices are re-checked against `data/services.json`, so a tampered price shows up in the Notes column.
3. **Enquiries tab**: same reference, `source = ai-studio`, and the customer's brief in the message column.

Most customers also tap **Send order details on WhatsApp**, which sends you the reference, their brief and what to send next (photos, notes).

**Before you start work:** check the payment. For "Pay in full" or "50% deposit", confirm the MoMo came in (manual MoMo) or the Orders row says verified (Paystack). For "Pay when it's ready", start work, but send only a watermarked preview until you're paid.

## Services and how to deliver them

| Service | Price (GH₵) | Deliver within | Tools |
|---|---|---|---|
| AI Room Makeover Plan | 50 / 120 | 48 hours | Claude or ChatGPT (image), Canva |
| Bulk Setup Plan & Quote | 100 / 300 | 2 working days | Claude, admin Invoices screen |
| Home & Study Guides | 20 each, 45 for all 3 | Same day | The PDF files (keep them off the public site) |
| Event Flyers & Programmes | 60 / 120 / 200 | First draft 24 hours | Claude for wording, Canva for design, printing press |
| Small Business Starter Kit | 150 / 300 | 3 working days | Canva (logo, posts, card), Claude for captions, WhatsApp Business |
| Letters, Forms & Typing | 25 / 80 / 5 per page | Same day | Claude, Word |

### AI Room Makeover Plan

1. Get 2 to 4 photos of the room on WhatsApp, plus the brief (room, budget, style, size).
2. Upload a photo to an AI image tool and ask: *"Restyle this room as a [style] [room] in Ghana. Keep the walls, windows and floor exactly as they are. Add: [pieces from our catalogue]. Photorealistic."* Make 3 looks.
3. Ask Claude: *"Here is a room of about [size] with a budget of GH₵[budget]. From this list of our products and prices [paste], suggest what to buy, where each piece goes, and the total. Keep walkways of 90 cm."*
4. Put the 3 looks, the layout notes and the shopping list on one or two Canva pages and send them as a PDF.
5. Remind them the fee comes off any furniture order of GH₵1,000+ within 30 days.

### Bulk Setup Plan & Quote

1. Get the space sizes and headcount from the brief (ask for a photo or sketch).
2. Ask Claude to work out the layout: *"A classroom of 8 m × 6 m, 45 students, student desks of 60 × 45 cm, 1 m aisles every two rows, 1.5 m at the front for the teacher. How many rows and columns? Draw it as a simple grid."*
3. Create the proforma invoice in **admin → Invoices** so it's numbered and saved.
4. Send the layout and the proforma. When they order, take the plan fee off the invoice.

### Home & Study Guides

The three PDFs are **not** in this repository (it's public). Keep them on your phone or Google Drive. When a guide order is paid, send the right PDF on WhatsApp to the customer's number:

- `SVC-GUIDE-SMALL`: Small Room, Big Style
- `SVC-GUIDE-CARE`: Furniture Care in Ghana's Weather
- `SVC-GUIDE-STUDY`: The Student Study Corner
- `SVC-GUIDE-ALL`: all three

### Event Flyers & Programmes

1. Collect names, dates, venue, order of service and photos.
2. Ask Claude for the wording: *"Write a funeral brochure for [name], [age], [dates]. Include a short biography from these notes, a tribute from the children, and the order of service: [list]. Warm, respectful Ghanaian church tone."* Check every name and date with the family.
3. Design in Canva (brochure or programme template), using the family's colours. Clean up photos with the admin's photo studio if needed.
4. Send a watermarked preview, allow 2 rounds of changes, then send the print-ready PDF.
5. Quote printing separately at the press.

### Small Business Starter Kit

1. Get the business name, what they sell, location, colours and photos.
2. Logo and colours in Canva. For posts, ask Claude for captions: *"Write 12 short Facebook/WhatsApp status captions for [business] in [area] that sells [items]. Mix prices, opening hours, customer care and a weekend offer."*
3. Price list: one Canva page.
4. Pro kit: set up their WhatsApp Business catalogue with them and design a business card.

### Letters, Forms & Typing

1. Get the purpose, recipient and deadline.
2. Ask Claude: *"Write a formal letter from [name, address] to [recipient] requesting [purpose]. Ghanaian official letter format, polite and brief."* Check the facts with the customer.
3. Send Word and PDF. Offer printing at the showroom.

## Changing prices or adding a service

Edit `data/services.json`. Each service has `options` (id, label, price_ghs). Option ids must start with `SVC-` and stay unique. The website and backend both read this file, so there's nothing else to update.

## One-time setup

- **Backend:** paste the updated `backend/apps-script/Code.gs` into the Apps Script editor, then **Deploy → Manage deployments → Edit → New version** so service prices are checked. Until then, service orders are still recorded, with a note saying the price came from the website.
- **Card payments:** replace the `pk_test_…` key in `data/business.json` with your `pk_live_…` key once Paystack activates the business. Until then customers pay by MoMo to the number in `momo_number`.
