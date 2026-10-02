# FA Vision Autopilot (browser add-on)

Works with the admin's **Social autopilot** (Facebook and Instagram) and **Price sync** screens. Facebook and Instagram have no free API for Marketplace renewals, group posts or posting from a personal setup like this, so this add-on does the clicking in your own logged-in Chrome.

## Install (one time)

1. Download this `extension` folder (GitHub → Code → Download ZIP, then unzip).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the folder. Remove any older "FA Vision Price Sync" add-on first.
3. Pin it from the puzzle-piece menu. Stay logged in to Facebook (personal profile) and to Instagram (@favisionent) in this Chrome.

## What it does

- **Badge and reminder.** Once an hour it reads your live site's `data/facebook-autopilot.json` and `data/products.json`. The red number on its icon shows Marketplace listings due for renewal, plus 1 if today's group posts haven't run. It sends one reminder a day. Click the icon to open the autopilot screen.
- **Renew.** Opens **Your listings** (marketplace/you/selling), reads every listing and its date, and for each one 7+ days old opens **More options → Renew listing**. Works in batches (20 by default) with a 2-minute pause. Facebook must be on your personal profile; Pages can't use Marketplace.
- **Test without posting.** Runs every step in one group (caption, photo, Post button ready) but never taps Post.
- **Group posts.** Posts today's listing into its next groups: types the caption, attaches the first photo, taps **Post**, then waits 1–3 minutes before the next group.
- **Import groups.** Reads your joined groups from facebook.com/groups/joins.
- **Instagram.** Checks Instagram is logged in as @favisionent and reads its follower, following and post counts. Then it posts each queued photo: Create → Post → photo → keeps the full 4:5 picture → caption → switches **Share to Facebook** off → Share, waiting 2–5 minutes between posts. Test mode does everything except Share.
- **One-button run.** The admin's **Run everything for today** hands the add-on a chain: renew → group posts → Instagram. Each step passes the rest back to the admin, which starts the next one and finally emails the day's report.
- **Daily run.** If switched on in the admin's Today tab, opens the admin at your chosen time and runs everything, report included.
- **Safety.** It stops straight away and reports back if Facebook or Instagram shows any warning ("temporarily blocked", "try again later", "action blocked" and so on). A warning on one site doesn't stop the next site in the one-button run. Every page it works on shows a **Stop** button.

It only acts in a tab the admin opened with a job (the admin hands the job to this add-on, which keeps it per tab, so Facebook's www → web.facebook.com redirect can't lose it). Normal Facebook browsing is untouched.

**After any update:** replace this folder with the new one and click reload ↻ on FA Vision Autopilot in `chrome://extensions`.
