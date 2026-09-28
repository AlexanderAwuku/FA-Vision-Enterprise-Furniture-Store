// Invoice template shared by the admin (preview, print / save as PDF) and the
// backend (which turns the same HTML into a PDF in Google Drive and emails it).
//
// Follows common international invoicing practice: a unique sequential number,
// issue and due dates, seller and buyer names, addresses and tax IDs, itemised
// lines with quantity, unit price, discount and amount, taxes shown separately,
// total and amount in words, payments received and balance due, payment
// details, terms, and a signature.
//
// Styles are inline and table-based so Google Apps Script's HTML-to-PDF
// converter renders it the same as the browser.
window.FAV_INVOICE = (function () {
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "GH₵" + round2(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = d => {
    if (!d) return "";
    const x = new Date(d + (String(d).length === 10 ? "T12:00:00" : ""));
    return isNaN(x) ? String(d) : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const KINDS = { proforma: "PROFORMA INVOICE", invoice: "INVOICE", tax: "TAX INVOICE", receipt: "RECEIPT" };

  function totals(inv) {
    const lines = (inv.lines || []).filter(l => l.description || Number(l.qty) || Number(l.unit_price)).map(l => {
      const qty = Number(l.qty) || 0;
      const gross = round2(qty * (Number(l.unit_price) || 0));
      const discount = round2(gross * (Number(l.discount_pct) || 0) / 100);
      return Object.assign({}, l, { qty, gross, discount, amount: round2(gross - discount) });
    });
    const gross = round2(lines.reduce((s, l) => s + l.gross, 0));
    const discount = round2(lines.reduce((s, l) => s + l.discount, 0));
    const subtotal = round2(gross - discount);
    const taxes = (inv.taxes || []).filter(t => Number(t.rate)).map(t => ({ name: t.name, rate: Number(t.rate), amount: round2(subtotal * Number(t.rate) / 100) }));
    const total = round2(subtotal + taxes.reduce((s, t) => s + t.amount, 0));
    const paid = round2(inv.amount_paid);
    return { lines, gross, discount, subtotal, taxes, total, paid, balance: round2(Math.max(0, total - paid)) };
  }

  // "Forty-five thousand eight hundred and one Ghana cedis, nineteen pesewas"
  const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function under1000(n) {
    const h = Math.floor(n / 100), r = n % 100;
    const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : "");
    return [h ? ONES[h] + " hundred" : "", rest].filter(Boolean).join(" and ");
  }
  function words(n) {
    n = Math.floor(n);
    if (!n) return "zero";
    const parts = [];
    [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [1, ""]].forEach(([size, name]) => {
      const chunk = Math.floor(n / size) % 1000;
      if (chunk) parts.push(under1000(chunk) + (name ? " " + name : ""));
    });
    // British style: "one thousand and five", "forty-five thousand eight hundred and one"
    if (n % 1000 && n % 1000 < 100 && n > 1000) parts[parts.length - 1] = "and " + parts[parts.length - 1];
    return parts.join(" ");
  }
  function amountInWords(amount) {
    const cedis = Math.floor(round2(amount));
    const pesewas = Math.round((round2(amount) - cedis) * 100);
    const s = `${words(cedis)} Ghana cedi${cedis === 1 ? "" : "s"}` + (pesewas ? `, ${words(pesewas)} pesewa${pesewas === 1 ? "" : "s"}` : " only");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function render(inv, business) {
    const b = business || {};
    const t = totals(inv);
    const c = inv.customer || {};
    const site = (b.website || "").replace(/\/?$/, "/");
    const title = KINDS[inv.kind] || "INVOICE";
    const blue = "#0d55af", red = "#f42c2c", line = "#dadce0", muted = "#5f6368";
    const phones = (b.phones || []).map(p => String(p).replace(/^\+233/, "0").replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3")).join(" · ");
    const pay = b.payments || {};
    const cfg = b.invoice || {};
    const payLines = [
      pay.momo_number ? `Mobile Money (${esc(pay.momo_network || "MTN")}): <b>${esc(pay.momo_number)}</b>${pay.momo_name ? ` · ${esc(pay.momo_name)}` : ""}` : "",
      cfg.bank_details ? `Bank: ${esc(cfg.bank_details)}` : "",
      "Cash, MoMo or card at any of our showrooms",
      `Please quote <b>${esc(inv.number)}</b> as the payment reference.`
    ].filter(Boolean);
    const locs = (b.locations || []).map(l => l.area).join(" · ");
    const row = (k, v) => v ? `<tr><td style="padding:3px 12px 3px 0;color:${muted};font-size:11px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">${k}</td><td style="padding:3px 0;font-weight:600;text-align:right">${v}</td></tr>` : "";

    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} ${esc(inv.number)} · ${esc(b.name || "")}</title>
<style>@page{size:A4;margin:14mm}body{margin:0}@media print{.no-print{display:none!important}}</style></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#202124;font-size:12.5px;line-height:1.45;background:#fff">
<div style="max-width:780px;margin:0 auto;padding:24px">
  <div style="height:6px;background:linear-gradient(90deg,${red} 0 25%,${blue} 25% 50%,#e6506e 50% 75%,#b03ea6 75%);background-color:${blue};margin-bottom:20px"></div>
  <table style="width:100%;border-collapse:collapse"><tr>
    <td style="vertical-align:top;width:60%">
      <table style="border-collapse:collapse"><tr>
        <td style="vertical-align:top;padding-right:12px"><img src="${esc(site)}assets/images/logo.png" alt="" width="72" height="72" style="display:block;width:72px;height:72px"></td>
        <td style="vertical-align:top">
          <div style="font-size:20px;font-weight:800;color:${blue};letter-spacing:.01em"><span style="color:${red}">F.A</span> VISION ENTERPRISE</div>
          ${b.owner ? `<div style="color:${muted}">${esc(b.owner)}</div>` : ""}
          <div>${esc(b.address || "")}</div>
          ${locs ? `<div style="color:${muted}">Branches: ${esc(locs)}</div>` : ""}
          <div>${esc(phones)}</div>
          <div>${esc(b.email || "")}${b.email && site ? " · " : ""}${esc(site.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</div>
          ${cfg.tin ? `<div>TIN: <b>${esc(cfg.tin)}</b></div>` : ""}
        </td>
      </tr></table>
    </td>
    <td style="vertical-align:top;text-align:right">
      <div style="font-size:26px;font-weight:800;letter-spacing:.04em;color:${blue}">${esc(title)}</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:10px">${esc(inv.number)}</div>
      <table style="border-collapse:collapse;margin-left:auto">
        ${row("Date", esc(fmtDate(inv.issue_date)))}
        ${row("Due date", esc(fmtDate(inv.due_date)))}
        ${row("PO #", esc(inv.po))}
        ${row("Order ref", esc(inv.order_ref))}
        ${row("Currency", "GHS (Ghana cedi)")}
      </table>
    </td>
  </tr></table>

  <table style="width:100%;border-collapse:collapse;margin:22px 0 16px"><tr>
    <td style="vertical-align:top;width:55%;padding:14px 16px;background:#f6f8fc;border-radius:8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:${red};margin-bottom:4px">BILL TO</div>
      <div style="font-size:15px;font-weight:700">${esc(c.organisation || c.name || "")}</div>
      ${c.organisation && c.name ? `<div>Attn: ${esc(c.name)}</div>` : ""}
      ${c.address ? `<div>${esc(c.address)}</div>` : ""}
      ${c.phone ? `<div>${esc(c.phone)}</div>` : ""}
      ${c.email ? `<div>${esc(c.email)}</div>` : ""}
      ${c.tin ? `<div>TIN: ${esc(c.tin)}</div>` : ""}
    </td>
    <td style="width:5%"></td>
    <td style="vertical-align:top;text-align:right;padding:14px 16px;border:2px solid ${blue};border-radius:8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:${muted}">${t.paid ? "BALANCE DUE" : inv.kind === "proforma" ? "AMOUNT DUE" : "TOTAL DUE"}</div>
      <div style="font-size:24px;font-weight:800;color:${blue}">${money(t.paid ? t.balance : t.total)}</div>
      ${inv.deposit_pct && !t.paid ? `<div style="color:${muted}">Deposit required (${esc(inv.deposit_pct)}%): <b style="color:#202124">${money(t.total * inv.deposit_pct / 100)}</b></div>` : ""}
    </td>
  </tr></table>

  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:${blue};color:#fff">
      <th style="padding:9px 8px;text-align:left;font-size:11px;letter-spacing:.06em;width:28px">#</th>
      <th style="padding:9px 8px;text-align:left;font-size:11px;letter-spacing:.06em">DESCRIPTION</th>
      <th style="padding:9px 8px;text-align:right;font-size:11px;letter-spacing:.06em">RATE</th>
      <th style="padding:9px 8px;text-align:right;font-size:11px;letter-spacing:.06em">QTY</th>
      <th style="padding:9px 8px;text-align:right;font-size:11px;letter-spacing:.06em">DISCOUNT</th>
      <th style="padding:9px 8px;text-align:right;font-size:11px;letter-spacing:.06em">AMOUNT</th>
    </tr></thead>
    <tbody>
    ${t.lines.map((l, i) => `<tr style="border-bottom:1px solid ${line}">
      <td style="padding:10px 8px;vertical-align:top;color:${muted}">${i + 1}</td>
      <td style="padding:10px 8px;vertical-align:top"><b>${esc(l.description)}</b>${l.note ? `<div style="color:${muted};font-size:11.5px">${esc(l.note)}</div>` : ""}</td>
      <td style="padding:10px 8px;vertical-align:top;text-align:right;white-space:nowrap">${money(l.unit_price)}</td>
      <td style="padding:10px 8px;vertical-align:top;text-align:right">${esc(l.qty)}</td>
      <td style="padding:10px 8px;vertical-align:top;text-align:right;white-space:nowrap">${l.discount ? `-${money(l.discount)}<div style="color:${muted};font-size:11px">${round2(l.discount_pct)}%</div>` : "–"}</td>
      <td style="padding:10px 8px;vertical-align:top;text-align:right;white-space:nowrap;font-weight:600">${money(l.amount)}</td>
    </tr>`).join("")}
    </tbody>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-top:14px"><tr>
    <td style="vertical-align:top;width:52%;padding-right:20px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:${muted};margin-bottom:4px">AMOUNT IN WORDS</div>
      <div style="font-style:italic;margin-bottom:14px">${esc(amountInWords(t.total))}</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:${muted};margin-bottom:4px">HOW TO PAY</div>
      ${payLines.map(p => `<div>${p}</div>`).join("")}
    </td>
    <td style="vertical-align:top">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:${muted}">Subtotal</td><td style="padding:4px 0;text-align:right">${money(t.gross)}</td></tr>
        ${t.discount ? `<tr><td style="padding:4px 0;color:${muted}">Discount</td><td style="padding:4px 0;text-align:right">-${money(t.discount)}</td></tr>` : ""}
        ${t.taxes.map(x => `<tr><td style="padding:4px 0;color:${muted}">${esc(x.name)} (${x.rate}%)</td><td style="padding:4px 0;text-align:right">${money(x.amount)}</td></tr>`).join("")}
        <tr><td style="padding:8px 0;border-top:2px solid #202124;font-weight:800;font-size:14px">TOTAL</td><td style="padding:8px 0;border-top:2px solid #202124;text-align:right;font-weight:800;font-size:14px">${money(t.total)}</td></tr>
        ${t.paid ? `<tr><td style="padding:4px 0;color:${muted}">Paid${inv.paid_note ? ` (${esc(inv.paid_note)})` : ""}</td><td style="padding:4px 0;text-align:right">-${money(t.paid)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:800;color:${blue}">BALANCE REMAINING</td><td style="padding:8px 0;text-align:right;font-weight:800;color:${blue}">${money(t.balance)}</td></tr>` : ""}
      </table>
      ${!(b.invoice || {}).vat_registered && !t.taxes.length ? `<div style="color:${muted};font-size:11px;text-align:right;margin-top:4px">Not VAT registered. No VAT charged.</div>` : ""}
    </td>
  </tr></table>

  ${inv.notes ? `<div style="margin-top:18px;padding:12px 14px;background:#f6f8fc;border-radius:8px"><b>Notes:</b> ${esc(inv.notes)}</div>` : ""}
  ${cfg.terms ? `<div style="margin-top:12px;color:${muted};font-size:11.5px"><b style="color:#202124">Terms &amp; conditions:</b> ${esc(cfg.terms)}${inv.kind === "proforma" ? " This proforma invoice is valid for 14 days and is not a demand for payment." : ""}</div>` : ""}

  <table style="width:100%;border-collapse:collapse;margin-top:36px"><tr>
    <td style="width:50%;vertical-align:bottom">
      <div style="border-top:1px solid #202124;width:220px;padding-top:4px">Authorised signature</div>
      <div style="color:${muted}">For F.A Vision Enterprise${b.owner ? ` · ${esc(b.owner)}` : ""}</div>
    </td>
    <td style="vertical-align:bottom;text-align:right">
      <div style="color:${muted}">Date signed</div><div style="font-weight:600">${esc(fmtDate(inv.issue_date))}</div>
    </td>
  </tr></table>

  <div style="margin-top:28px;padding-top:10px;border-top:1px solid ${line};text-align:center;color:${muted};font-size:11px">
    Thank you for your business! · ${esc(b.tagline || "")}<br>${esc(site)}
  </div>
</div>
</body></html>`;
  }

  return { render, totals, amountInWords, money, KINDS };
})();
