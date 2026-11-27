/* =============================================================================
   Page rendering and form behavior.
   For a typical rebrand, you should not need to edit this file — use config.js.
   ============================================================================= */

(function () {
  "use strict";

  if (typeof SITE === "undefined") {
    document.getElementById("app").innerHTML =
      "<p class='noscript-note'>Missing config.js. Add that file next to index.html and reload.</p>";
    return;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function firstName(fullName) {
    const part = String(fullName || "").trim().split(/\s+/)[0];
    return part || "there";
  }

  function applyColors(colors) {
    if (!colors) return;
    const root = document.documentElement;
    Object.keys(colors).forEach(function (key) {
      root.style.setProperty("--" + key, colors[key]);
    });
  }

  function markSvg() {
    return (
      '<svg class="mark" viewBox="0 0 42 42" aria-hidden="true">' +
      '<rect width="42" height="42" rx="6" fill="#14261F"/>' +
      '<path d="M6 33h30" stroke="#3D7A5A" stroke-width="2"/>' +
      '<path d="M8 33c2-7 5-12 7-12s4 5 6 12" fill="#3D7A5A"/>' +
      '<path d="M18 33c2-8 5-14 7-14s5 6 7 14" fill="#2D6A4F"/>' +
      '<circle cx="27" cy="13" r="5" fill="#C45C6A"/>' +
      '<circle cx="22" cy="16" r="4" fill="#A83C4A"/>' +
      '<path d="M27 18v6" stroke="#3D7A5A" stroke-width="1.5"/>' +
      "</svg>"
    );
  }

  /* Simple line icons used on the services grid. */
  var ICONS = {
    mower:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="17.5" cy="16.5" r="2.5"/><path d="M9 16.5h6M4 16.5H2l2-6h8l3 6M12 10.5V7h5l2 3.5"/></svg>',
    leaf:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c8-1 13-8 14-15-7 1-14 6-14 15z"/><path d="M5 19c3-6 8-10 14-12"/></svg>',
    bed:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19h18M5 19V12h14v7"/><path d="M8 12V9c0-2 8-4 8 0v3"/><path d="M12 8V5"/></svg>',
    drop:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z"/></svg>',
    seed:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V11"/><path d="M12 11c-4-1-7-5-7-9 6 0 10 4 10 9"/><path d="M12 14c3 1 6 4 6 8"/></svg>',
    sod:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15l9-5 9 5-9 5-9-5z"/><path d="M3 19l9 5 9-5"/><path d="M8 9c.5-2 2-4 4-5"/></svg>',
  };

  function heroArt() {
    /* Decorative landscape only — inline so nothing remote can break. */
    return (
      '<svg viewBox="0 0 560 420" role="img" aria-label="A tidy lawn with tulips and a house under a West Michigan sky">' +
      '<rect width="560" height="420" fill="#cfe3d7"/>' +
      '<path d="M0 0h560v210H0z" fill="#dcebe3"/>' +
      '<circle cx="78" cy="72" r="28" fill="#F8E6B8"/>' +
      '<path d="M0 188c40-22 80-18 120-8 50 12 90-18 150-22 70-5 110 24 170 18 40-4 80-16 120-6v50H0z" fill="#b7d4c4"/>' +
      '<path d="M0 250h560v170H0z" fill="#5f9a74"/>' +
      '<path d="M0 250c40 10 80 6 120 0s80-8 120 2 80 14 120 8 80-16 120-8 40 8 80 4v20H0z" fill="#4e8864"/>' +
      /* house */
      '<rect x="318" y="168" width="148" height="96" fill="#FFFCF7" stroke="#1E3A2F" stroke-width="3"/>' +
      '<path d="M304 172l90-62 90 62" fill="#1E3A2F"/>' +
      '<rect x="334" y="206" width="36" height="56" fill="#1E3A2F"/>' +
      '<rect x="386" y="196" width="34" height="28" fill="#C9D7CF" stroke="#1E3A2F" stroke-width="2"/>' +
      '<rect x="430" y="196" width="22" height="28" fill="#C9D7CF" stroke="#1E3A2F" stroke-width="2"/>' +
      /* windmill hint, Dutch heritage of Holland MI */
      '<rect x="126" y="150" width="16" height="92" fill="#5C6B62"/>' +
      '<polygon points="134,132 148,150 120,150" fill="#1E3A2F"/>' +
      '<g transform="translate(134 156) rotate(-18)">' +
      '<rect x="-4" y="-58" width="8" height="116" fill="#F3EFE6" stroke="#1E3A2F" stroke-width="1.5"/>' +
      '<rect x="-58" y="-4" width="116" height="8" fill="#F3EFE6" stroke="#1E3A2F" stroke-width="1.5"/>' +
      "</g>" +
      /* lawn stripes */
      '<path d="M0 300c70 16 140 16 210 0s140-16 210 0 90 16 140 8v112H0z" fill="#3D7A5A"/>' +
      '<path d="M0 330c80 12 150 10 230-2s150-10 220 4 70 10 110 4v88H0z" fill="#2f6b4d" opacity=".55"/>' +
      /* tulips */
      tulip(70, 292, "#C45C6A") +
      tulip(102, 300, "#A83C4A") +
      tulip(138, 288, "#C45C6A") +
      tulip(214, 296, "#A83C4A") +
      tulip(248, 286, "#C45C6A") +
      tulip(478, 300, "#C45C6A") +
      tulip(512, 292, "#A83C4A") +
      /* tree */
      '<path d="M500 250c-22-4-36-28-20-50 18-4 34 10 36 28 16-8 32 8 18 24z" fill="#1E3A2F"/>' +
      '<path d="M516 250v40" stroke="#14261F" stroke-width="5"/>' +
      "</svg>"
    );
  }

  function tulip(x, y, color) {
    return (
      '<g transform="translate(' + x + " " + y + ')">' +
      '<path d="M0 0v-28" stroke="#1E3A2F" stroke-width="2"/>' +
      '<path d="M0-16c-8-2-10-12-4-18 2 6 4 8 4 18z" fill="' + color + '"/>' +
      '<path d="M0-16c8-2 10-12 4-18-2 6-4 8-4 18z" fill="' + color + '"/>' +
      '<path d="M0-34c-4 6-3 12 0 18 3-6 4-12 0-18z" fill="' + color + '" opacity=".9"/>' +
      "</g>"
    );
  }

  function renderServices() {
    return SITE.services
      .map(function (service) {
        var icon = ICONS[service.icon] || ICONS.leaf;
        return (
          '<article class="service-card">' +
          '<div class="service-icon">' + icon + "</div>" +
          "<h3>" + escapeHtml(service.title) + "</h3>" +
          "<p>" + escapeHtml(service.text) + "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderWhy() {
    return SITE.whyUs
      .map(function (item, index) {
        var num = String(index + 1).padStart(2, "0");
        return (
          '<article class="why-card">' +
          '<div class="why-num" aria-hidden="true">' + num + "</div>" +
          "<div><h3>" +
          escapeHtml(item.title) +
          "</h3><p>" +
          escapeHtml(item.text) +
          "</p></div></article>"
        );
      })
      .join("");
  }

  function renderTowns() {
    return SITE.serviceArea.towns
      .map(function (town) {
        return "<li>" + escapeHtml(town) + "</li>";
      })
      .join("");
  }

  function renderTestimonials() {
    return SITE.testimonials
      .map(function (item) {
        return (
          '<figure class="quote-card">' +
          '<span class="sample-badge">' +
          escapeHtml(SITE.testimonialBadge || "Sample testimonial") +
          "</span>" +
          "<blockquote>" +
          escapeHtml(item.quote) +
          "</blockquote>" +
          "<footer><strong>" +
          escapeHtml(item.name) +
          "</strong> · " +
          escapeHtml(item.place) +
          " <span class='optional'>(sample)</span></footer>" +
          "</figure>"
        );
      })
      .join("");
  }

  function renderFaqs() {
    return SITE.faqs
      .map(function (item, index) {
        var id = "faq-panel-" + index;
        return (
          '<div class="faq-item">' +
          '<h3><button type="button" aria-expanded="false" aria-controls="' +
          id +
          '">' +
          escapeHtml(item.q) +
          "</button></h3>" +
          '<div class="faq-panel" id="' +
          id +
          '"><p>' +
          escapeHtml(item.a) +
          "</p></div></div>"
        );
      })
      .join("");
  }

  function renderServiceOptions() {
    var options = ['<option value="" selected disabled>Select a service</option>'];
    (SITE.serviceOptions || []).forEach(function (service) {
      options.push(
        '<option value="' + escapeHtml(service) + '">' + escapeHtml(service) + "</option>"
      );
    });
    return options.join("");
  }

  function renderPoints() {
    return (SITE.hero.points || [])
      .map(function (point) {
        return "<li>" + escapeHtml(point) + "</li>";
      })
      .join("");
  }

  function renderPage() {
    var demoBanner = SITE.demo && SITE.demo.enabled
      ? '<div class="demo-banner">' + escapeHtml(SITE.demo.banner) + "</div>"
      : "";

    var html =
      demoBanner +
      '<header class="site-header">' +
      '<div class="header-inner">' +
      '<a class="brand" href="#top">' +
      markSvg() +
      "<span><span class='brand-name'>" +
      escapeHtml(SITE.name) +
      "</span><div class='brand-place'>" +
      escapeHtml(SITE.city) +
      "</div></span></a>" +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span class="nav-toggle-bars"></span></button>' +
      '<nav class="nav" id="site-nav" aria-label="Primary">' +
      '<a href="#services">Services</a>' +
      '<a href="#why">Why us</a>' +
      '<a href="#area">Service area</a>' +
      '<a href="#faq">FAQ</a>' +
      '<a class="nav-cta" href="#quote">Get a free quote</a>' +
      "</nav></div></header>" +
      '<main id="main">' +
      '<section class="hero" id="top">' +
      '<div class="hero-grid">' +
      "<div>" +
      '<p class="kicker">' +
      escapeHtml(SITE.hero.kicker) +
      "</p>" +
      "<h1>" +
      escapeHtml(SITE.hero.headline) +
      "</h1>" +
      '<p class="lede">' +
      escapeHtml(SITE.hero.lede) +
      "</p>" +
      '<ul class="points">' +
      renderPoints() +
      "</ul>" +
      '<div class="hero-actions">' +
      '<a class="btn" href="#quote">' +
      escapeHtml(SITE.hero.cta) +
      "</a>" +
      '<a class="btn btn-secondary" href="#services">' +
      escapeHtml(SITE.hero.secondaryCta) +
      "</a>" +
      "</div></div>" +
      '<div class="hero-art">' +
      heroArt() +
      "</div></div></section>" +
      '<section class="section" id="services">' +
      '<div class="wrap">' +
      '<div class="section-head">' +
      '<p class="kicker">' +
      escapeHtml(SITE.servicesIntro.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.servicesIntro.heading) +
      "</h2>" +
      '<p class="lede">' +
      escapeHtml(SITE.servicesIntro.lede) +
      "</p></div>" +
      '<div class="services-grid">' +
      renderServices() +
      "</div></div></section>" +
      '<section class="section section-alt" id="why">' +
      '<div class="wrap">' +
      '<div class="section-head">' +
      '<p class="kicker">' +
      escapeHtml(SITE.whyIntro.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.whyIntro.heading) +
      "</h2>" +
      '<p class="lede">' +
      escapeHtml(SITE.whyIntro.lede) +
      "</p></div>" +
      '<div class="why-grid">' +
      renderWhy() +
      "</div></div></section>" +
      '<section class="section" id="area">' +
      '<div class="wrap area-grid">' +
      "<div>" +
      '<p class="kicker">' +
      escapeHtml(SITE.serviceArea.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.serviceArea.heading) +
      "</h2>" +
      '<p class="lede">' +
      escapeHtml(SITE.serviceArea.lede) +
      "</p></div>" +
      '<div class="area-panel"><ul class="town-list">' +
      renderTowns() +
      "</ul></div></div></section>" +
      '<section class="section section-alt" id="testimonials" aria-label="Sample testimonials">' +
      '<div class="wrap">' +
      '<div class="section-head">' +
      '<p class="kicker">' +
      escapeHtml(SITE.testimonialsIntro.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.testimonialsIntro.heading) +
      "</h2>" +
      '<p class="lede">' +
      escapeHtml(SITE.testimonialsIntro.lede) +
      "</p></div>" +
      '<div class="testimonials-grid">' +
      renderTestimonials() +
      "</div></div></section>" +
      '<section class="section" id="faq">' +
      '<div class="wrap">' +
      '<div class="section-head" style="margin-left:auto;margin-right:auto;text-align:center;">' +
      '<p class="kicker">' +
      escapeHtml(SITE.faqIntro.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.faqIntro.heading) +
      "</h2></div>" +
      '<div class="faq-list">' +
      renderFaqs() +
      "</div></div></section>" +
      '<section class="section section-alt quote-section" id="quote">' +
      '<div class="wrap quote-grid">' +
      '<div class="contact-card">' +
      '<p class="kicker">' +
      escapeHtml(SITE.form.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.form.heading) +
      "</h2>" +
      '<p class="hint">' +
      escapeHtml(SITE.form.lede) +
      "</p>" +
      '<ul class="contact-list">' +
      "<li><span class='label'>Phone</span><a href='" +
      escapeHtml(SITE.phoneHref) +
      "'>" +
      escapeHtml(SITE.phone) +
      "</a></li>" +
      "<li><span class='label'>Email</span><a href='mailto:" +
      escapeHtml(SITE.email) +
      "'>" +
      escapeHtml(SITE.email) +
      "</a></li>" +
      "<li><span class='label'>Service area</span><span>" +
      escapeHtml(SITE.city) +
      ", and nearby</span></li>" +
      "</ul></div>" +
      '<div class="form-card" id="quote-card">' +
      '<form class="quote-form" id="quote-form" action="#" method="post" novalidate>' +
      '<div class="form-error" id="form-error" hidden></div>' +
      '<div class="field"><label for="name">Full name <span class="req" aria-hidden="true">*</span></label>' +
      '<input id="name" name="name" autocomplete="name" required></div>' +
      '<div class="field"><label for="email">Email <span class="req" aria-hidden="true">*</span></label>' +
      '<input id="email" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="phone">Phone <span class="optional">(optional)</span></label>' +
      '<input id="phone" name="phone" type="tel" autocomplete="tel"></div>' +
      '<div class="field"><label for="service">Service needed <span class="req" aria-hidden="true">*</span></label>' +
      '<select id="service" name="service" required>' +
      renderServiceOptions() +
      "</select></div>" +
      '<div class="field"><label for="message">Message <span class="optional">(optional)</span></label>' +
      '<textarea id="message" name="message" placeholder="' +
      escapeHtml(SITE.form.messagePlaceholder) +
      '"></textarea></div>' +
      '<div class="hp-field" aria-hidden="true">' +
      '<label for="hp_field">Leave blank</label>' +
      '<input id="hp_field" name="hp_field" type="text" tabindex="-1" autocomplete="off">' +
      "</div>" +
      '<button type="submit">' +
      escapeHtml(SITE.form.submitLabel) +
      "</button></form>" +
      '<div class="thanks" id="thanks" tabindex="-1">' +
      '<p class="kicker">Request received</p>' +
      '<h2 id="thanks-title"></h2>' +
      '<p class="lede" id="thanks-body"></p>' +
      '<div class="notice" id="thanks-note"></div>' +
      '<button type="button" class="btn btn-secondary" id="send-another">' +
      escapeHtml(SITE.form.anotherLabel) +
      "</button></div></div></div></section>" +
      "</main>" +
      '<footer class="site-footer"><div class="footer-inner">' +
      '<div class="footer-meta"><strong>' +
      escapeHtml(SITE.name) +
      "</strong> " +
      escapeHtml(SITE.footer.blurb) +
      "</div>" +
      "<div>" +
      escapeHtml(SITE.footer.credit) +
      "<br>" +
      '<a href="' +
      escapeHtml(SITE.phoneHref) +
      '">' +
      escapeHtml(SITE.phone) +
      "</a> · <a href='mailto:" +
      escapeHtml(SITE.email) +
      "'>" +
      escapeHtml(SITE.email) +
      "</a></div></div></footer>";

    document.getElementById("app").innerHTML = html;
    document.title = SITE.name + " — " + SITE.city;
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", SITE.tagline + " " + (SITE.demo && SITE.demo.enabled ? SITE.demo.banner : ""));
  }

  function bindNav() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!header || !toggle || !nav) return;

    function setOpen(open) {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    function updateOffset() {
      var banner = document.querySelector(".demo-banner");
      var extra = banner ? banner.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty(
        "--header-offset",
        Math.round(header.getBoundingClientRect().height + (header.getBoundingClientRect().top <= 0 ? 0 : 0)) + "px"
      );
      /* Include sticky header height only; banner scrolls away. */
      document.documentElement.style.setProperty(
        "--header-offset",
        Math.round(header.offsetHeight) + "px"
      );
      return extra;
    }
    updateOffset();
    window.addEventListener("resize", updateOffset);
  }

  function bindFaqs() {
    document.querySelectorAll(".faq-item").forEach(function (item) {
      var button = item.querySelector("button");
      if (!button) return;
      button.addEventListener("click", function () {
        var open = item.classList.contains("is-open");
        document.querySelectorAll(".faq-item.is-open").forEach(function (other) {
          other.classList.remove("is-open");
          var otherBtn = other.querySelector("button");
          if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
        });
        if (!open) {
          item.classList.add("is-open");
          button.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  function fillTemplate(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] == null ? "" : vars[key];
    });
  }

  function mappedPayload(data) {
    var map = SITE.FORM_FIELD_MAP || {};
    var payload = {};
    Object.keys(data).forEach(function (key) {
      payload[map[key] || key] = data[key];
    });
    return payload;
  }

  function bindForm() {
    var card = document.getElementById("quote-card");
    var form = document.getElementById("quote-form");
    var errorEl = document.getElementById("form-error");
    var thanks = document.getElementById("thanks");
    var another = document.getElementById("send-another");
    if (!form || !card) return;

    function showError(message) {
      errorEl.hidden = !message;
      errorEl.textContent = message || "";
    }

    function showThanks(data, sent) {
      showError("");
      document.getElementById("thanks-title").textContent = fillTemplate(
        SITE.form.thanksTitle,
        { firstName: firstName(data.name) }
      );
      document.getElementById("thanks-body").textContent = fillTemplate(
        SITE.form.thanksBody,
        { service: data.service || "your lawn" }
      );
      document.getElementById("thanks-note").textContent = sent
        ? SITE.form.thanksLiveNote
        : SITE.form.thanksDemoNote;
      card.classList.add("is-thanks");
      thanks.focus();
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      showError("");
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        service: form.service.value,
        message: form.message.value.trim(),
      };

      var endpoint = String(SITE.FORM_ENDPOINT || "").trim();
      if (!endpoint) {
        showThanks(data, false);
        return;
      }

      var payload = mappedPayload(data);
      var body = new URLSearchParams();
      Object.keys(payload).forEach(function (key) {
        body.append(key, payload[key]);
      });
      body.append("Source", "Website");
      var honey = form.elements.namedItem("hp_field");
      body.append("hp_field", honey && honey.value ? String(honey.value).trim() : "");

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(endpoint, { method: "POST", body: body, mode: "no-cors" })
        .then(function () {
          showThanks(data, true);
        })
        .catch(function () {
          showError(SITE.form.error);
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });

    if (another) {
      another.addEventListener("click", function () {
        card.classList.remove("is-thanks");
        form.reset();
        showError("");
        form.name.focus();
      });
    }
  }

  applyColors(SITE.colors);
  renderPage();
  bindNav();
  bindFaqs();
  bindForm();
})();
