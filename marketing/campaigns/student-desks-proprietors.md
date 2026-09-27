# Campaign: Student desks for school proprietors

**Audience:** Proprietors and heads of private basic and junior high schools in Greater Accra, starting with Odorkor, Dansoman, Kaneshie, Darkuman, Mallam, Weija and Kasoa.
**Goal:** Quote requests for 20+ student desks before the next school term.
**Channels:** Email (sent from the backend Sheet), WhatsApp broadcast, and in-person visits for the warmest leads.

## Email

The live version is the `student-desks-2026` block in [`backend/apps-script/Code.gs`](../../backend/apps-script/Code.gs).

**Subject options** (switch between them to see which gets more replies):
1. Durable student desks for {{organisation}}: bulk pricing for proprietors
2. New term, new desks: a school discount from F.A Vision, Odorkor
3. {{name}}, how many desks does {{organisation}} need this term?

## WhatsApp broadcast (copy and paste)

> Good day Sir/Madam 🙏🏾
> This is F.A Vision Enterprise, furniture makers on Tarazzo Road, opposite Pacific, Odorkor.
> We make **strong student desks** (hardwood top, steel frame) for schools, single and double seater.
> ✅ Discount for 20 desks and above
> ✅ Delivery and setup in your classrooms
> ✅ Repairs whenever needed
> Reply with the number of desks you need and we'll send a quote today.
> 👉 https://alexanderawuku.github.io/FA-Vision-Enterprise-Furniture-Store/#product/FAV-014

WhatsApp Business "Broadcast lists" only reach people who have saved your number, so ask each proprietor to save it when you first speak.

## Building the list

- Past customers and school contacts you already have
- Ghana Education Service / GNACOPS (private schools association) district directories
- Google Maps: search "school" around each target area and note the listed phone and email
- Walk-ins: visit schools near the workshop with a flyer and the website address
- Before sending: add a price and real photos to **School Desk and Chair Set** (FAV-014) from the admin page, because the email links straight to it

Put every contact in the **Clients** tab of the backend Sheet with `Segment = Proprietor`.

## Follow-up

- Day 0: email plus WhatsApp
- Day 3: call everyone who opened the email or replied on WhatsApp
- Day 7: second email (subject option 2) to non-responders. Add a new campaign id in `Code.gs`
- Record every sale in the **Sales** tab to see the campaign's return in **Summary**
