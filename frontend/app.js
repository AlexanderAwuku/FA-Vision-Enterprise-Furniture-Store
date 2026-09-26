(function () {
  const cfg = window.FA_CONFIG || {};
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const whatsappLink = (text) =>
    cfg.whatsappNumber
      ? `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(text)}`
      : "";

  // Contact details: hide anything not configured yet.
  const waDefault = whatsappLink("Hello FA Vision, I'd like a quote for student desks.");
  $$("[data-whatsapp]").forEach((a) => {
    if (waDefault) a.href = waDefault;
    else a.hidden = true;
  });
  $("[data-location]").textContent = cfg.location || "";
  if (cfg.phoneNumber) {
    const a = $("[data-phone]");
    a.textContent = cfg.phoneNumber;
    a.href = "tel:" + cfg.phoneNumber.replace(/\s+/g, "");
    $("[data-phone-line]").hidden = false;
  }
  if (cfg.email) {
    const a = $("[data-email]");
    a.textContent = cfg.email;
    a.href = "mailto:" + cfg.email;
    $("[data-email-line]").hidden = false;
  }
  $("#year").textContent = new Date().getFullYear();

  // Products
  const grid = $("#product-grid");
  const select = $("#product-select");
  fetch("products.json")
    .then((r) => r.json())
    .then((products) => {
      products.sort((a, b) => Number(b.featured) - Number(a.featured));
      for (const p of products) {
        const card = document.createElement("article");
        card.className = "card";
        const price = p.price ? `GHS ${Number(p.price).toLocaleString()}` : "Price on request";
        card.innerHTML = `
          <span class="tag"></span>
          <h3></h3>
          <p class="desc"></p>
          <p class="price"></p>
          <p class="note"></p>
          <a class="btn primary" href="#quote">Get a quote</a>`;
        card.querySelector(".tag").textContent = p.category;
        card.querySelector("h3").textContent = p.name;
        card.querySelector(".desc").textContent = p.description;
        card.querySelector(".price").textContent = price;
        card.querySelector(".note").textContent = p.bulkNote || "";
        card.querySelector(".btn").addEventListener("click", () => { select.value = p.name; });
        grid.appendChild(card);

        const opt = document.createElement("option");
        opt.textContent = p.name;
        select.appendChild(opt);
      }
    })
    .catch(() => { grid.textContent = "Products could not be loaded. Please call or WhatsApp us."; });

  // Enquiry form
  const form = $("#enquiry-form");
  const status = $("#form-status");
  const setStatus = (msg, cls) => { status.textContent = msg; status.className = "full status " + (cls || ""); };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (data.website) return; // spam bot filled the hidden field
    if (!data.name || !data.phone) {
      setStatus("Please add your name and phone number.", "err");
      return;
    }
    data.source = "website";

    if (cfg.enquiryEndpoint) {
      setStatus("Sending…");
      try {
        // text/plain avoids a CORS preflight, which Apps Script cannot answer.
        await fetch(cfg.enquiryEndpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data),
        });
        form.reset();
        setStatus("Thank you! We will contact you today.", "ok");
        return;
      } catch (_) {
        // fall through to WhatsApp / email
      }
    }

    const summary =
      `Quote request\nName: ${data.name}\nSchool/Business: ${data.organisation || "-"}\n` +
      `Phone: ${data.phone}\nProduct: ${data.product} x ${data.quantity}\n${data.message || ""}`;
    const wa = whatsappLink(summary);
    if (wa) window.open(wa, "_blank");
    else if (cfg.email) location.href = `mailto:${cfg.email}?subject=Quote request&body=${encodeURIComponent(summary)}`;
    else setStatus("Online enquiries are not set up yet. Please visit us in Odorkor.", "err");
  });
})();
