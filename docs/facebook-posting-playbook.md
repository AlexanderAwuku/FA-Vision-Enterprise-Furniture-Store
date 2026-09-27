# Facebook Posting Playbook

How to use the listing kit to post on Facebook Marketplace and in groups without getting the account restricted.

## Why posting is manual

- **Marketplace:** Meta has no public API for small-business Marketplace listings. Bots and auto-posters break Meta's Terms and are a common reason accounts get restricted.
- **Groups:** Meta removed the Groups API in 2024, so apps can no longer post into groups.
- **What can be automated:** posts on the F.A Vision **Page** and **Instagram**, which can be scheduled in Meta Business Suite, and the **Facebook/Instagram Shop** catalog (`output/meta-catalog.csv`).

The kit makes each manual post a quick copy and paste.

## One-time setup

1. **Products.** Edit `data/products.json` and give each item:
   - a real `price_ghs`, for example `2500`
   - `dimensions`, `material` and `colors`
   - `images`: photo URLs, or paths such as `images/fav-001-1.jpg` once photos are added to the repo
   - `"placeholder": false` once the details are confirmed
2. **Groups.** Replace the example rows in `data/groups.csv` with the buy-and-sell and home-decor groups you belong to. Note which days each group allows sales posts.
3. **Generate.** Run `python3 scripts/generate_listings.py`. It rewrites everything in `output/`.

## Weekly routine (about 30 minutes)

| Day | Task |
|---|---|
| Mon | Post 2–3 products on Marketplace using the **Marketplace** block in `output/listings.md`. |
| Tue–Thu | Post in 3–5 groups per day. Use a **different caption variant** in each group, and log every post in `output/posting-tracker.csv`. |
| Fri | Post WhatsApp statuses for the week's products. |
| Sat | Renew Marketplace listings that are 7 or more days old, or delete and relist them. Mark sold items. |
| Daily | Reply to Marketplace and Messenger enquiries within 1 hour. Response speed affects how visible listings are. |

## Rules to stay safe

- Leave **at least 1–2 minutes** between group posts, and don't post the same product in more than about 10 groups a day.
- **Never paste identical text** in several groups. Rotate Variants 1–3.
- Follow each group's own rules. Many allow sales posts only on certain days.
- Use real photos of your own furniture. Stock photos get listings removed.
- Keep prices honest. "GH₵ 1" bait prices break Marketplace rules.
- Don't put phone numbers inside Marketplace **titles**. The number in the description is fine.

## Facebook/Instagram Shop

Once products have prices and photo URLs, `output/meta-catalog.csv` is ready to upload in **Meta Commerce Manager → Catalog → Data sources → Data feed**. Products then appear in the Page's Shop tab and can be tagged in posts.

## Photo tips

- Use 4–6 photos per item: front, side, a close-up of the fabric or wood grain, and the item in a room.
- Shoot in daylight against a plain wall. Landscape 4:3 fits both Marketplace and the website.
- The first photo is the thumbnail, so make it the clearest full view.
