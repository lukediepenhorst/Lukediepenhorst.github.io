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
      '<rect width="42" height="42" rx="8" fill="#0A3D5C"/>' +
      '<g transform="translate(21 19) rotate(-28)">' +
      '<ellipse cx="0" cy="0" rx="14.5" ry="9" fill="#E6E9ED"/>' +
      '<path d="M-8.5 0 Q0 -1.3 8.5 0" stroke="#0A3D5C" stroke-width="1" fill="none"/>' +
      '<path d="M-3.2-2.3v4.6M0-2.5v5M3.2-2.3v4.6" stroke="#0A3D5C" stroke-width="1" stroke-linecap="round"/>' +
      "</g>" +
      '<rect x="8" y="33" width="3" height="5" fill="#7FB7D8"/>' +
      '<rect x="12" y="30" width="3.2" height="8" fill="#A9D0E8"/>' +
      '<rect x="16" y="26" width="4" height="12" fill="#C5CBD1"/>' +
      '<rect x="21" y="29" width="3" height="9" fill="#7FB7D8"/>' +
      '<rect x="25" y="31" width="2.4" height="7" fill="#A9D0E8"/>' +
      '<rect x="28.5" y="28" width="3.2" height="10" fill="#C5CBD1"/>' +
      "</svg>"
    );
  }

  var ICONS = {
    table:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="10" width="18" height="3" rx="1"/><path d="M6 13v6M18 13v6M8 10V7h8v3"/></svg>',
    trays:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="8" rx="7" ry="3"/><path d="M5 8v3c0 1.7 3.1 3 7 3s7-1.3 7-3V8"/><path d="M7 14.5V17c0 1.5 2.2 2.6 5 2.6s5-1.1 5-2.6v-2.5"/></svg>',
    room:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12"/><path d="M10 20v-6h4v6"/></svg>',
  };

  function heroArt() {
    return (
      '<svg viewBox="0 0 640 500" role="img" aria-label="An original drawing of the Detroit skyline at dusk, with a grill, a football, and a tailgate table in the foreground">' +
      "<defs>" +
      '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#071824"/>' +
      '<stop offset="42%" stop-color="#0A3D5C"/>' +
      '<stop offset="72%" stop-color="#0076B6"/>' +
      '<stop offset="90%" stop-color="#7FA8C4"/>' +
      '<stop offset="100%" stop-color="#E2C9A0"/>' +
      "</linearGradient>" +
      '<linearGradient id="river" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#6AA0B8"/>' +
      '<stop offset="45%" stop-color="#3B6F8A"/>' +
      '<stop offset="100%" stop-color="#1E4458"/>' +
      "</linearGradient>" +
      '<linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#3A2A22"/>' +
      '<stop offset="100%" stop-color="#241912"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<rect width="640" height="500" fill="url(#sky)"/>' +
      '<circle cx="552" cy="168" r="44" fill="#F3E6C8" opacity="0.95"/>' +
      '<circle cx="552" cy="168" r="70" fill="#F3E6C8" opacity="0.14"/>' +
      /* far shore */
      '<path d="M0 328c40-8 80-14 130-10 60 5 90-16 150-18 70-2 110 16 170 12 50-3 90-14 190-6v32H0z" fill="#0B2C3E" opacity="0.55"/>' +
      /* river */
      '<rect x="0" y="338" width="640" height="80" fill="url(#river)"/>' +
      '<path d="M0 350c80 10 160-8 240 0s160 14 240 2 100-8 160 4" stroke="#D7E6EE" stroke-width="2" fill="none" opacity="0.35"/>' +
      '<path d="M0 372c90-8 150 10 240 4s170-12 250 0 90 10 150 2" stroke="#F3E6C8" stroke-width="1.5" fill="none" opacity="0.25"/>' +
      /* back buildings */
      '<g fill="#0B2C3E">' +
      '<rect x="168" y="250" width="28" height="90"/>' +
      '<rect x="200" y="228" width="22" height="112"/>' +
      '<rect x="288" y="210" width="26" height="130"/>' +
      '<rect x="500" y="236" width="40" height="104"/>' +
      '<rect x="548" y="258" width="18" height="82"/>' +
      "</g>" +
      /* mid buildings */
      '<g fill="#0A3D5C">' +
      '<rect x="186" y="240" width="24" height="100"/>' +
      '<rect x="226" y="200" width="30" height="140"/>' +
      '<rect x="318" y="188" width="22" height="152"/>' +
      '<rect x="478" y="214" width="36" height="126"/>' +
      '<rect x="580" y="248" width="24" height="92"/>' +
      "</g>" +
      /* windows on mid towers */
      '<g fill="#C5CBD1" opacity="0.55">' +
      windowGrid(230, 210, 22, 110, 5, 9) +
      windowGrid(322, 198, 14, 120, 3, 10) +
      windowGrid(486, 224, 22, 100, 5, 8) +
      "</g>" +
      /* Penobscot-like stepped tower with a spire */
      '<g fill="#071824">' +
      '<rect x="252" y="196" width="32" height="144"/>' +
      '<rect x="257" y="168" width="22" height="28"/>' +
      '<rect x="262" y="148" width="12" height="20"/>' +
      '<rect x="266.5" y="118" width="3" height="30"/>' +
      "</g>" +
      '<g fill="#E2C9A0" opacity="0.7">' +
      windowGrid(256, 204, 24, 120, 5, 10) +
      "</g>" +
      /* Renaissance Center-inspired cluster: central tower plus four shorter ones and a ring */
      '<g fill="#071824">' +
      '<rect x="372" y="214" width="22" height="126"/>' +
      '<rect x="444" y="214" width="22" height="126"/>' +
      '<rect x="364" y="236" width="20" height="104"/>' +
      '<rect x="454" y="236" width="20" height="104"/>' +
      '<rect x="396" y="128" width="36" height="212" rx="6"/>' +
      "</g>" +
      '<ellipse cx="414" cy="188" rx="34" ry="11" fill="none" stroke="#C5CBD1" stroke-width="5"/>' +
      '<ellipse cx="414" cy="188" rx="34" ry="11" fill="none" stroke="#071824" stroke-width="1.5"/>' +
      '<g fill="#F3E6C8" opacity="0.55">' +
      windowGrid(402, 150, 24, 170, 4, 14) +
      windowGrid(376, 222, 14, 100, 3, 9) +
      windowGrid(448, 222, 14, 100, 3, 9) +
      "</g>" +
      /* Ambassador-style suspension bridge at left */
      '<g fill="#071824">' +
      '<rect x="36" y="250" width="10" height="90"/>' +
      '<rect x="126" y="250" width="10" height="90"/>' +
      '<polygon points="41,250 51,250 46,228" />' +
      '<polygon points="131,250 141,250 136,228" />' +
      "</g>" +
      '<path d="M46 236 Q91 300 136 236" fill="none" stroke="#C5CBD1" stroke-width="2"/>' +
      '<path d="M41 332 H141" stroke="#071824" stroke-width="5"/>' +
      '<g stroke="#C5CBD1" stroke-width="1" opacity="0.8">' +
      '<path d="M56 252 v70M66 264 v58M76 274 v48M86 274 v48M96 264 v58M106 252 v70M116 246 v76"/>' +
      "</g>" +
      /* riverfront walk */
      '<rect x="0" y="338" width="640" height="8" fill="#0A3D5C"/>' +
      /* foreground deck */
      '<path d="M0 400h640v100H0z" fill="url(#deck)"/>' +
      '<path d="M0 400c80-18 160-28 240-16 90 14 140 8 220 0 70-7 120 6 180 16v16H0z" fill="#4A3228"/>' +
      '<g stroke="#2A1C16" stroke-width="2" opacity="0.35">' +
      '<path d="M0 424h640M0 448h640M0 472h640"/>' +
      "</g>" +
      /* string lights */
      '<path d="M20 392 Q160 368 320 392 T620 388" fill="none" stroke="#2A1C16" stroke-width="2"/>' +
      bulb(70, 384) + bulb(130, 376) + bulb(190, 380) + bulb(250, 386) +
      bulb(320, 392) + bulb(390, 386) + bulb(460, 378) + bulb(530, 382) + bulb(590, 386) +
      /* kettle grill */
      grillSvg(96, 392) +
      /* football on the table */
      '<g transform="translate(250 438) rotate(-22)">' +
      '<ellipse cx="0" cy="0" rx="38" ry="22" fill="#E6E9ED"/>' +
      '<ellipse cx="0" cy="0" rx="38" ry="22" fill="none" stroke="#8B929A" stroke-width="1.5"/>' +
      '<path d="M-22 0 Q0 -3 22 0" stroke="#071824" stroke-width="1.6" fill="none"/>' +
      '<path d="M-8-6v12M-2.5-7v14M4-7v14M10.5-6v12" stroke="#071824" stroke-width="1.6" stroke-linecap="round"/>' +
      "</g>" +
      /* cups */
      '<g transform="translate(330 430)">' +
      '<path d="M-10 0h20l-3 28h-14z" fill="#0076B6"/>' +
      '<path d="M-10 0h20l-1 6h-18z" fill="#C5CBD1"/>' +
      '<rect x="16" y="4" width="16" height="24" rx="2" fill="#C5CBD1"/>' +
      '<rect x="16" y="4" width="16" height="6" fill="#0076B6"/>' +
      "</g>" +
      /* pennant */
      '<g transform="translate(520 400)">' +
      '<path d="M0 0v70" stroke="#2A1C16" stroke-width="3"/>' +
      '<polygon points="2,6 78,28 2,50" fill="#0076B6"/>' +
      '<polygon points="2,6 78,28 2,50" fill="none" stroke="#C5CBD1" stroke-width="2"/>' +
      '<text x="12" y="33" fill="#F3F5F7" font-family="Oswald, Arial Narrow, sans-serif" font-size="11" font-weight="700" letter-spacing="1">GAME DAY</text>' +
      "</g>" +
      "</svg>"
    );
  }

  function windowGrid(x, y, w, h, cols, rows) {
    var out = "";
    var gapX = w / (cols + 0.4);
    var gapY = h / (rows + 0.4);
    var i, j;
    for (i = 0; i < rows; i++) {
      for (j = 0; j < cols; j++) {
        out +=
          '<rect x="' +
          (x + 2 + j * gapX).toFixed(1) +
          '" y="' +
          (y + 3 + i * gapY).toFixed(1) +
          '" width="2.4" height="3.2" rx="0.3"/>';
      }
    }
    return out;
  }

  function bulb(x, y) {
    return (
      '<g transform="translate(' + x + " " + y + ')">' +
      '<line x1="0" y1="-6" x2="0" y2="0" stroke="#2A1C16" stroke-width="1"/>' +
      '<circle cx="0" cy="4" r="5" fill="#F3E6C8"/>' +
      "</g>"
    );
  }

  function grillSvg(x, y) {
    return (
      '<g transform="translate(' + x + " " + y + ')">' +
      '<path d="M-28 8c0-22 12-40 28-40s28 18 28 40z" fill="#1A1F24"/>' +
      '<path d="M-28 8h56" stroke="#C5CBD1" stroke-width="3"/>' +
      '<path d="M-22 8c2-16 8-28 22-28s20 12 22 28" fill="none" stroke="#3A4248" stroke-width="2"/>' +
      '<path d="M-8-8c2-10 6-16 8-16s6 6 8 16" fill="#E07A3D"/>' +
      '<path d="M-4-4c1-7 3-12 4-12s3 5 4 12" fill="#F3C56C"/>' +
      '<path d="M-6-22c-4-14-2-28 2-36" fill="none" stroke="#C5CBD1" stroke-width="3" stroke-linecap="round" opacity="0.55"/>' +
      '<path d="M4-24c-2-12 2-24 8-32" fill="none" stroke="#C5CBD1" stroke-width="3" stroke-linecap="round" opacity="0.4"/>' +
      '<path d="M-16 8l-8 36M16 8l8 36" stroke="#1A1F24" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M-28 44h56" stroke="#1A1F24" stroke-width="3"/>' +
      "</g>"
    );
  }

  /* ----- Gallery illustrations (original, no logos) ----- */

  function artSkyline() {
    return (
      '<svg viewBox="0 0 400 300" role="img" aria-label="Original drawing of a Detroit riverfront skyline at dusk">' +
      '<rect width="400" height="300" fill="#0A3D5C"/>' +
      '<rect width="400" height="190" fill="#071824"/>' +
      '<circle cx="330" cy="70" r="28" fill="#F3E6C8"/>' +
      '<rect x="0" y="190" width="400" height="110" fill="#0076B6"/>' +
      '<path d="M0 200c60 8 110-6 170 0s120 10 230 0" stroke="#C5CBD1" fill="none" stroke-width="2" opacity="0.4"/>' +
      '<g fill="#15202A">' +
      '<rect x="20" y="150" width="14" height="50"/>' +
      '<rect x="40" y="130" width="22" height="70"/>' +
      '<rect x="68" y="148" width="16" height="52"/>' +
      '<rect x="110" y="100" width="28" height="100"/>' +
      '<rect x="114" y="82" width="20" height="18"/>' +
      '<rect x="122" y="58" width="4" height="24"/>' +
      '<rect x="150" y="120" width="18" height="80"/>' +
      '<rect x="200" y="70" width="30" height="130" rx="4"/>' +
      '<rect x="186" y="110" width="16" height="90"/>' +
      '<rect x="232" y="110" width="16" height="90"/>' +
      '<rect x="260" y="125" width="36" height="75"/>' +
      '<rect x="304" y="140" width="20" height="60"/>' +
      '<rect x="336" y="118" width="24" height="82"/>' +
      "</g>" +
      '<ellipse cx="215" cy="108" rx="24" ry="8" fill="none" stroke="#C5CBD1" stroke-width="3"/>' +
      '<g fill="#F3E6C8" opacity="0.65">' +
      '<rect x="114" y="110" width="3" height="4"/>' +
      '<rect x="122" y="110" width="3" height="4"/>' +
      '<rect x="114" y="122" width="3" height="4"/>' +
      '<rect x="122" y="122" width="3" height="4"/>' +
      '<rect x="114" y="134" width="3" height="4"/>' +
      '<rect x="122" y="134" width="3" height="4"/>' +
      '<rect x="206" y="86" width="3" height="5"/>' +
      '<rect x="214" y="86" width="3" height="5"/>' +
      '<rect x="222" y="86" width="3" height="5"/>' +
      '<rect x="206" y="100" width="3" height="5"/>' +
      '<rect x="214" y="100" width="3" height="5"/>' +
      '<rect x="222" y="100" width="3" height="5"/>' +
      '<rect x="206" y="114" width="3" height="5"/>' +
      '<rect x="214" y="114" width="3" height="5"/>' +
      '<rect x="222" y="114" width="3" height="5"/>' +
      "</g>" +
      "</svg>"
    );
  }

  function artGrill() {
    return (
      '<svg viewBox="0 0 400 300" role="img" aria-label="Original drawing of a kettle grill with a small fire and smoke">' +
      '<rect width="400" height="300" fill="#E8EEF2"/>' +
      '<circle cx="70" cy="54" r="22" fill="#F3E6C8"/>' +
      /* grass / patio */
      '<path d="M0 210h400v90H0z" fill="#C5CBD1"/>' +
      '<path d="M0 210c80-10 160-6 240 4s100 8 160 0v20H0z" fill="#D7DEE4"/>' +
      /* smoke */
      '<path d="M188 96c-10-24 4-44 2-66" fill="none" stroke="#8B929A" stroke-width="6" stroke-linecap="round" opacity="0.45"/>' +
      '<path d="M210 100c4-22 16-40 10-66" fill="none" stroke="#8B929A" stroke-width="5" stroke-linecap="round" opacity="0.3"/>' +
      /* kettle */
      '<path d="M130 200c0-56 32-102 70-102s70 46 70 102z" fill="#15202A"/>' +
      '<path d="M130 200h140" stroke="#C5CBD1" stroke-width="6"/>' +
      '<path d="M148 200c4-40 22-72 52-72s48 32 52 72" fill="none" stroke="#3A4248" stroke-width="3"/>' +
      /* flames */
      '<path d="M184 176c6-24 16-40 16-40s12 16 16 40c-8 8-24 8-32 0z" fill="#E07A3D"/>' +
      '<path d="M194 176c4-16 10-26 10-26s6 10 10 26c-5 5-15 5-20 0z" fill="#F3C56C"/>' +
      /* legs */
      '<path d="M160 200l-16 70M240 200l16 70" stroke="#15202A" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M130 272h140" stroke="#15202A" stroke-width="6"/>' +
      /* tongs leaning */
      '<g transform="translate(300 150) rotate(18)" stroke="#0A3D5C" stroke-width="4" fill="none" stroke-linecap="round">' +
      '<path d="M0 0 v90"/>' +
      '<path d="M10 0 v90"/>' +
      '<path d="M0 0 h10"/>' +
      '<path d="M-4 90 h8M6 90 h8"/>' +
      "</g>" +
      "</svg>"
    );
  }

  function artFootball() {
    return (
      '<svg viewBox="0 0 400 300" role="img" aria-label="Original drawing of a plain football with laces, no team marks">' +
      '<rect width="400" height="300" fill="#E4F1F8"/>' +
      '<circle cx="60" cy="50" r="26" fill="#C5CBD1" opacity="0.7"/>' +
      /* field band */
      '<rect x="0" y="210" width="400" height="90" fill="#0A3D5C"/>' +
      '<path d="M0 230 h400 M0 250 h400 M0 270 h400" stroke="#C5CBD1" stroke-width="2" opacity="0.35"/>' +
      '<g transform="translate(200 148) rotate(-18)">' +
      '<ellipse cx="0" cy="0" rx="140" ry="78" fill="#E6E9ED"/>' +
      '<ellipse cx="0" cy="0" rx="140" ry="78" fill="none" stroke="#8B929A" stroke-width="4"/>' +
      '<path d="M-90 0 Q0 -10 90 0" stroke="#071824" stroke-width="4" fill="none"/>' +
      '<path d="M-36-22v44M-12-26v52M12-26v52M36-22v44" stroke="#071824" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M-128-6c-6 2-10 6-10 6M128 6c6-2 10-6 10-6" stroke="#8B929A" stroke-width="3" fill="none"/>' +
      "</g>" +
      "</svg>"
    );
  }

  function artWatchParty() {
    return (
      '<svg viewBox="0 0 400 300" role="img" aria-label="Original drawing of a reserved watch-party table under string lights">' +
      '<rect width="400" height="300" fill="#071824"/>' +
      /* back wall */
      '<rect x="0" y="0" width="400" height="170" fill="#0A3D5C"/>' +
      /* screen, blank — no logos */
      '<rect x="108" y="28" width="184" height="104" rx="4" fill="#071824" stroke="#C5CBD1" stroke-width="4"/>' +
      '<rect x="118" y="38" width="164" height="84" fill="#0076B6"/>' +
      '<circle cx="200" cy="80" r="16" fill="#C5CBD1" opacity="0.35"/>' +
      /* string lights */
      '<path d="M16 16 Q200 48 384 16" fill="none" stroke="#15202A" stroke-width="2"/>' +
      '<circle cx="50" cy="22" r="5" fill="#F3E6C8"/>' +
      '<circle cx="110" cy="32" r="5" fill="#F3E6C8"/>' +
      '<circle cx="200" cy="40" r="5" fill="#F3E6C8"/>' +
      '<circle cx="290" cy="32" r="5" fill="#F3E6C8"/>' +
      '<circle cx="350" cy="22" r="5" fill="#F3E6C8"/>' +
      /* table */
      '<path d="M40 200h320l16 80H24z" fill="#4A3228"/>' +
      '<path d="M40 200h320l-8 16H48z" fill="#6A4A3A"/>' +
      '<path d="M70 280v20M330 280v20" stroke="#2A1C16" stroke-width="8"/>' +
      /* plates and cups */
      '<ellipse cx="140" cy="236" rx="28" ry="10" fill="#E6E9ED"/>' +
      '<ellipse cx="200" cy="242" rx="40" ry="14" fill="#C5CBD1"/>' +
      '<ellipse cx="200" cy="240" rx="30" ry="10" fill="#E07A3D" opacity="0.8"/>' +
      '<ellipse cx="260" cy="236" rx="28" ry="10" fill="#E6E9ED"/>' +
      '<rect x="168" y="214" width="14" height="20" fill="#0076B6"/>' +
      '<rect x="218" y="212" width="14" height="22" fill="#C5CBD1"/>' +
      /* chairs hinted */
      '<rect x="70" y="188" width="44" height="10" rx="2" fill="#15202A"/>' +
      '<rect x="286" y="188" width="44" height="10" rx="2" fill="#15202A"/>' +
      "</svg>"
    );
  }

  function artTrays() {
    return (
      '<svg viewBox="0 0 400 300" role="img" aria-label="Original drawing of stacked catering trays with lids">' +
      '<rect width="400" height="300" fill="#F3F5F7"/>' +
      '<rect x="0" y="210" width="400" height="90" fill="#E8EEF2"/>' +
      /* table edge */
      '<rect x="30" y="200" width="340" height="18" rx="2" fill="#4A3228"/>' +
      /* back tray */
      '<g transform="translate(200 128)">' +
      '<ellipse cx="0" cy="0" rx="120" ry="36" fill="#C5CBD1"/>' +
      '<ellipse cx="0" cy="8" rx="120" ry="36" fill="#8B929A"/>' +
      '<ellipse cx="0" cy="0" rx="108" ry="28" fill="#E6E9ED"/>' +
      '<ellipse cx="-30" cy="0" rx="22" ry="10" fill="#E07A3D"/>' +
      '<ellipse cx="10" cy="4" rx="26" ry="11" fill="#0076B6" opacity="0.7"/>' +
      '<ellipse cx="48" cy="-2" rx="18" ry="8" fill="#F3E6C8"/>' +
      "</g>" +
      /* front tray */
      '<g transform="translate(200 188)">' +
      '<ellipse cx="0" cy="0" rx="140" ry="40" fill="#8B929A"/>' +
      '<ellipse cx="0" cy="-10" rx="140" ry="40" fill="#C5CBD1"/>' +
      '<ellipse cx="0" cy="-10" rx="126" ry="30" fill="#F3F5F7"/>' +
      '<ellipse cx="-40" cy="-10" rx="30" ry="12" fill="#6A4F16"/>' +
      '<ellipse cx="8" cy="-6" rx="34" ry="13" fill="#E07A3D"/>' +
      '<ellipse cx="58" cy="-12" rx="22" ry="9" fill="#0A3D5C"/>' +
      "</g>" +
      /* napkin and fork */
      '<rect x="300" y="214" width="36" height="50" rx="2" fill="#0076B6"/>' +
      '<path d="M316 220 v50" stroke="#C5CBD1" stroke-width="3"/>' +
      '<path d="M322 220 v50" stroke="#C5CBD1" stroke-width="2"/>' +
      "</svg>"
    );
  }

  function artPennant() {
    return (
      '<svg viewBox="0 0 400 300" role="img" aria-label="Original drawing of a handmade game-day pennant, with no team marks">' +
      '<rect width="400" height="300" fill="#E8EEF2"/>' +
      '<circle cx="60" cy="48" r="20" fill="#C5CBD1" opacity="0.6"/>' +
      '<rect x="0" y="230" width="400" height="70" fill="#0A3D5C"/>' +
      /* pole */
      '<path d="M86 40v210" stroke="#15202A" stroke-width="8" stroke-linecap="round"/>' +
      '<circle cx="86" cy="36" r="8" fill="#C5CBD1"/>' +
      /* pennant */
      '<polygon points="94,70 330,140 94,210" fill="#0076B6"/>' +
      '<polygon points="94,70 330,140 94,210" fill="none" stroke="#C5CBD1" stroke-width="6"/>' +
      '<path d="M118 92 l8 16 18-4-10 16 10 16-18-4-8 16-8-16-18 4 10-16-10-16 18 4z" fill="#C5CBD1" opacity="0.9"/>' +
      '<text x="160" y="150" fill="#F3F5F7" font-family="Oswald, Arial Narrow, sans-serif" font-size="28" font-weight="700" letter-spacing="2">GAME DAY</text>' +
      "</svg>"
    );
  }

  var GALLERY_ART = {
    skyline: artSkyline,
    grill: artGrill,
    football: artFootball,
    watchparty: artWatchParty,
    trays: artTrays,
    pennant: artPennant,
  };

  function renderPackages() {
    return SITE.packages
      .map(function (item) {
        var icon = ICONS[item.icon] || ICONS.table;
        return (
          '<article class="service-card">' +
          '<div class="service-icon">' + icon + "</div>" +
          "<h3>" + escapeHtml(item.title) + "</h3>" +
          "<p>" + escapeHtml(item.text) + "</p>" +
          '<div class="price-box">' +
          '<span class="sample-badge">' +
          escapeHtml(item.priceLabel || "Sample price") +
          "</span>" +
          '<div class="price">' +
          escapeHtml(item.price) +
          "</div>" +
          '<div class="price-note">' +
          escapeHtml(item.priceNote || "Example only.") +
          "</div></div></article>"
        );
      })
      .join("");
  }

  function renderMenu() {
    return (SITE.menuSections || [])
      .map(function (section) {
        var items = (section.items || [])
          .map(function (item) {
            return (
              '<div class="menu-item">' +
              '<div class="menu-item-row">' +
              '<span class="name">' +
              escapeHtml(item.name) +
              "</span>" +
              '<span class="leaders" aria-hidden="true"></span>' +
              '<span class="price">' +
              escapeHtml(item.price) +
              '<span class="ex"> ex.</span></span></div>' +
              "<p>" +
              escapeHtml(item.text) +
              "</p></div>"
            );
          })
          .join("");
        return (
          '<div class="menu-section">' +
          "<h3>" +
          escapeHtml(section.title) +
          "</h3>" +
          items +
          "</div>"
        );
      })
      .join("");
  }

  function renderGallery() {
    return (SITE.gallery || [])
      .map(function (item) {
        var artFn = GALLERY_ART[item.id];
        var art = artFn ? artFn() : "";
        return (
          "<figure class='gallery-card'>" +
          '<div class="gallery-frame">' +
          art +
          "</div>" +
          "<figcaption><strong>" +
          escapeHtml(item.title) +
          "</strong><span>" +
          escapeHtml(item.caption) +
          "</span></figcaption></figure>"
        );
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

  function renderPackageOptions() {
    var options = ['<option value="" selected disabled>Select a package</option>'];
    (SITE.packageOptions || []).forEach(function (item) {
      options.push(
        '<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + "</option>"
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

  function renderCountdown() {
    var g = SITE.nextGameDay || {};
    return (
      '<div class="gameday-card" id="gameday-countdown">' +
      '<div class="gameday-card-top">' +
      '<p class="kicker">' +
      escapeHtml(g.kicker || "Next game day") +
      "</p>" +
      '<span class="sample-badge">' +
      escapeHtml(g.badge || "Sample date") +
      "</span></div>" +
      '<p class="gameday-date"><time datetime="' +
      escapeHtml(g.iso || "") +
      '">' +
      escapeHtml(g.displayDate || "Sample date") +
      "</time></p>" +
      '<p class="gameday-time">' +
      escapeHtml(g.displayTime || "") +
      "</p>" +
      '<div class="countdown" aria-live="polite">' +
      '<div class="countdown-unit"><span class="num" id="cd-days">00</span><span class="lbl">Days</span></div>' +
      '<div class="countdown-unit"><span class="num" id="cd-hours">00</span><span class="lbl">Hours</span></div>' +
      '<div class="countdown-unit"><span class="num" id="cd-mins">00</span><span class="lbl">Minutes</span></div>' +
      '<div class="countdown-unit"><span class="num" id="cd-secs">00</span><span class="lbl">Seconds</span></div>' +
      "</div>" +
      '<p class="sample-date-note" id="cd-status">' +
      escapeHtml(g.note || "This countdown uses a sample date for the demo.") +
      "</p></div>"
    );
  }

  function renderPage() {
    var demoBanner =
      SITE.demo && SITE.demo.enabled
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
      '<a href="#packages">Packages</a>' +
      '<a href="#menu">Menu</a>' +
      '<a href="#gallery">Gallery</a>' +
      '<a href="#faq">FAQ</a>' +
      '<a class="nav-cta" href="#reserve">Reserve a table</a>' +
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
      '<a class="btn" href="#reserve">' +
      escapeHtml(SITE.hero.cta) +
      "</a>" +
      '<a class="btn btn-secondary" href="#packages">' +
      escapeHtml(SITE.hero.secondaryCta) +
      "</a>" +
      "</div>" +
      renderCountdown() +
      "</div>" +
      '<div class="hero-art">' +
      heroArt() +
      "</div></div></section>" +
      '<section class="section" id="packages">' +
      '<div class="wrap">' +
      '<div class="section-head">' +
      '<p class="kicker">' +
      escapeHtml(SITE.packagesIntro.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.packagesIntro.heading) +
      "</h2>" +
      '<p class="lede">' +
      escapeHtml(SITE.packagesIntro.lede) +
      "</p></div>" +
      '<div class="services-grid">' +
      renderPackages() +
      "</div></div></section>" +
      '<section class="section section-alt" id="menu">' +
      '<div class="wrap">' +
      '<div class="section-head">' +
      '<p class="kicker">' +
      escapeHtml(SITE.menuIntro.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.menuIntro.heading) +
      "</h2>" +
      '<p class="lede">' +
      escapeHtml(SITE.menuIntro.lede) +
      "</p></div>" +
      '<div class="menu-grid">' +
      renderMenu() +
      "</div></div></section>" +
      '<section class="section" id="gallery">' +
      '<div class="wrap">' +
      '<div class="section-head">' +
      '<p class="kicker">' +
      escapeHtml(SITE.galleryIntro.kicker) +
      "</p>" +
      "<h2>" +
      escapeHtml(SITE.galleryIntro.heading) +
      "</h2>" +
      '<p class="lede">' +
      escapeHtml(SITE.galleryIntro.lede) +
      "</p></div>" +
      '<div class="gallery-grid">' +
      renderGallery() +
      "</div></div></section>" +
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
      '<section class="section section-alt quote-section" id="reserve">' +
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
      "<li><span class='label'>Location</span><span>" +
      escapeHtml(SITE.locationNote || SITE.city) +
      "</span></li>" +
      "</ul></div>" +
      '<div class="form-card" id="reserve-card">' +
      '<form class="quote-form" id="reserve-form" action="#" method="post" novalidate>' +
      '<div class="form-error" id="form-error" hidden></div>' +
      '<div class="field"><label for="name">Full name <span class="req" aria-hidden="true">*</span></label>' +
      '<input id="name" name="name" autocomplete="name" required></div>' +
      '<div class="field"><label for="email">Email <span class="req" aria-hidden="true">*</span></label>' +
      '<input id="email" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="phone">Phone <span class="optional">(optional)</span></label>' +
      '<input id="phone" name="phone" type="tel" autocomplete="tel"></div>' +
      '<div class="field"><label for="service">Package <span class="req" aria-hidden="true">*</span></label>' +
      '<select id="service" name="service" required>' +
      renderPackageOptions() +
      "</select></div>" +
      '<div class="field-row">' +
      '<div class="field"><label for="partySize">' +
      escapeHtml(SITE.form.partyLabel || "Party size") +
      ' <span class="req" aria-hidden="true">*</span></label>' +
      '<input id="partySize" name="partySize" type="number" min="1" max="80" required></div>' +
      '<div class="field"><label for="date">' +
      escapeHtml(SITE.form.dateLabel || "Preferred date") +
      ' <span class="optional">(optional)</span></label>' +
      '<input id="date" name="date" type="date"></div>' +
      "</div>" +
      '<div class="field"><label for="message">Message <span class="optional">(optional)</span></label>' +
      '<textarea id="message" name="message" placeholder="' +
      escapeHtml(SITE.form.messagePlaceholder) +
      '"></textarea></div>' +
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
      '<div class="footer-disclaimer">' +
      escapeHtml(SITE.footer.credit) +
      "</div></div>" +
      "<div>" +
      '<a href="' +
      escapeHtml(SITE.phoneHref) +
      '">' +
      escapeHtml(SITE.phone) +
      "</a> · <a href='mailto:" +
      escapeHtml(SITE.email) +
      "'>" +
      escapeHtml(SITE.email) +
      "</a><br>" +
      escapeHtml(SITE.locationNote || SITE.city) +
      "</div></div></footer>";

    document.getElementById("app").innerHTML = html;
    document.title = SITE.name + " — " + SITE.city;
    var desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        SITE.tagline +
          " " +
          (SITE.demo && SITE.demo.enabled ? SITE.demo.banner : "")
      );
    }
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
      document.documentElement.style.setProperty(
        "--header-offset",
        Math.round(header.offsetHeight) + "px"
      );
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

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function bindCountdown() {
    var root = document.getElementById("gameday-countdown");
    if (!root || !SITE.nextGameDay) return;
    var target = new Date(SITE.nextGameDay.iso);
    var daysEl = document.getElementById("cd-days");
    var hoursEl = document.getElementById("cd-hours");
    var minsEl = document.getElementById("cd-mins");
    var secsEl = document.getElementById("cd-secs");
    var statusEl = document.getElementById("cd-status");
    var timerId = null;

    function showZero() {
      daysEl.textContent = "00";
      hoursEl.textContent = "00";
      minsEl.textContent = "00";
      secsEl.textContent = "00";
    }

    function tick() {
      if (isNaN(target.getTime())) {
        showZero();
        if (statusEl) {
          statusEl.textContent =
            SITE.nextGameDay.note ||
            "This countdown uses a sample date for the demo.";
        }
        return false;
      }
      var diff = target.getTime() - Date.now();
      if (diff <= 0) {
        showZero();
        root.classList.add("is-past");
        if (statusEl) {
          statusEl.textContent =
            SITE.nextGameDay.pastMessage ||
            "This sample game day has passed.";
        }
        return false;
      }
      var total = Math.floor(diff / 1000);
      daysEl.textContent = pad2(Math.floor(total / 86400));
      hoursEl.textContent = pad2(Math.floor((total % 86400) / 3600));
      minsEl.textContent = pad2(Math.floor((total % 3600) / 60));
      secsEl.textContent = pad2(total % 60);
      return true;
    }

    if (tick()) {
      timerId = setInterval(function () {
        if (!tick() && timerId) clearInterval(timerId);
      }, 1000);
    }
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
    var card = document.getElementById("reserve-card");
    var form = document.getElementById("reserve-form");
    var errorEl = document.getElementById("form-error");
    var thanks = document.getElementById("thanks");
    var another = document.getElementById("send-another");
    if (!form || !card) return;

    function showError(message) {
      errorEl.hidden = !message;
      errorEl.textContent = message || "";
    }

    function showThanks(data, sent, opts) {
      showError("");
      document.getElementById("thanks-title").textContent = fillTemplate(
        SITE.form.thanksTitle,
        { firstName: firstName(data.name) }
      );
      document.getElementById("thanks-body").textContent = fillTemplate(
        SITE.form.thanksBody,
        { service: data.service || "your package" }
      );
      document.getElementById("thanks-note").textContent = sent
        ? SITE.form.thanksLiveNote
        : SITE.form.thanksDemoNote;
      card.classList.add("is-thanks");
      if (!(opts && opts.silent)) {
        thanks.focus();
      }
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
        partySize: form.partySize.value.trim(),
        date: form.date.value,
        message: form.message.value.trim(),
      };

      var endpoint = String(SITE.FORM_ENDPOINT || "").trim();
      if (!endpoint) {
        showThanks(data, false);
        return;
      }

      var payload = mappedPayload(data);
      var body = new FormData();
      Object.keys(payload).forEach(function (key) {
        body.append(key, payload[key]);
      });

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

    /* Optional preview for screenshots: ?preview=thanks */
    try {
      if (new URLSearchParams(window.location.search).get("preview") === "thanks") {
        showThanks(
          { name: "Alex Rivera", service: "Watch-party table" },
          false,
          { silent: true }
        );
        /* Skip focusing the thanks region so a preview screenshot stays clean. */
      }
    } catch (err) {
      /* ignore */
    }
  }

  applyColors(SITE.colors);
  renderPage();
  bindNav();
  bindFaqs();
  bindCountdown();
  bindForm();
})();
