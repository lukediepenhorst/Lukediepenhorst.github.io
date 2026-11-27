/* Roster, side panel, and status.json loading. Works with or without WebGL. */
(function () {
  "use strict";

  var FALLBACK_ACCENTS = [
    "#f0b429",
    "#3ddecb",
    "#b9a2ff",
    "#b6e34a",
    "#ff7a90",
    "#6ec8ff",
    "#ff9a4a",
    "#3ddc8a",
    "#ff7ad9",
  ];

  function canonicalStatus(value) {
    var raw = String(value == null ? "" : value).trim();
    var key = raw.toLowerCase();
    if (key === "working") return "Working";
    if (key === "idle") return "Idle";
    if (key === "done") return "Done";
    if (key === "waiting" || key === "waiting on luke") return "Waiting on Luke";
    return raw || "Idle";
  }

  function statusClass(status) {
    if (status === "Working") return "is-working";
    if (status === "Idle") return "is-idle";
    if (status === "Waiting on Luke") return "is-waiting";
    if (status === "Done") return "is-done";
    return "is-idle";
  }

  function safeHex(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
  }

  function formatUpdated(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var dd = String(date.getUTCDate()).padStart(2, "0");
    var hh = String(date.getUTCHours()).padStart(2, "0");
    var mm = String(date.getUTCMinutes()).padStart(2, "0");
    return dd + " " + months[date.getUTCMonth()] + " " + date.getUTCFullYear() + ", " + hh + ":" + mm + " UTC";
  }

  window.BotStatus = {
    canonicalStatus: canonicalStatus,
    statusClass: statusClass,
    safeHex: safeHex,
    formatUpdated: formatUpdated,
  };

  var list = document.getElementById("roster-list");
  var panel = document.getElementById("panel");
  var scrim = document.getElementById("scrim");
  var panelClose = document.getElementById("panel-close");
  var panelName = document.getElementById("panel-name");
  var panelRole = document.getElementById("panel-role");
  var panelStatus = document.getElementById("panel-status");
  var panelFocus = document.getElementById("panel-focus");
  var panelSwatch = document.getElementById("panel-swatch");
  var updated = document.getElementById("updated");
  var floorCount = document.getElementById("floor-count");

  var bots = [];
  var selectedId = null;
  var openedAt = 0;

  function syncPressed() {
    var buttons = document.querySelectorAll(".roster-item");
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].setAttribute("aria-pressed", buttons[i].dataset.id === selectedId ? "true" : "false");
    }
  }

  function select(id) {
    var bot = null;
    for (var i = 0; i < bots.length; i += 1) {
      if (bots[i].id === id) bot = bots[i];
    }
    if (!bot) return;
    selectedId = id;
    panel.hidden = false;
    scrim.hidden = false;
    document.body.classList.add("is-panel-open");
    panelName.textContent = bot.name;
    panelRole.textContent = bot.role;
    panelFocus.textContent = bot.focus || "No current focus is listed.";
    var progress = document.getElementById("panel-progress");
    if (progress) {
      var amount = { Working: "68%", Idle: "24%", "Waiting on Luke": "46%", Done: "100%" };
      progress.style.width = amount[bot.status] || "40%";
    }
    panelStatus.textContent = bot.status;
    panelStatus.className = "badge " + statusClass(bot.status);
    panelSwatch.style.background = bot.accent;
    syncPressed();
    openedAt = Date.now();
    var current = document.querySelector('.roster-item[data-id="' + window.CSS.escape(id) + '"]');
    if (current && current.scrollIntoView) current.scrollIntoView({ block: "nearest" });
    document.dispatchEvent(new CustomEvent("bothq:select", { detail: { id: id } }));
    if (panelClose) panelClose.focus({ preventScroll: true });
  }

  function close() {
    if (panel.hidden && !selectedId) return;
    var returnTo = document.querySelector('.roster-item[aria-pressed="true"]');
    selectedId = null;
    panel.hidden = true;
    scrim.hidden = true;
    document.body.classList.remove("is-panel-open");
    syncPressed();
    document.dispatchEvent(new CustomEvent("bothq:close"));
    if (returnTo) returnTo.focus({ preventScroll: true });
  }

  panelClose.addEventListener("click", close);
  // The tap that opens the panel can also land on the scrim a moment later.
  // Ignore that click so the details stay open on a phone.
  scrim.addEventListener("click", function () {
    if (Date.now() - openedAt < 450) return;
    close();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") close();
  });

  function normalize(raw, index) {
    var source = raw && typeof raw === "object" ? raw : {};
    var accent = safeHex(source.accent, FALLBACK_ACCENTS[index % FALLBACK_ACCENTS.length]);
    var id = String(source.id == null ? "bot-" + (index + 1) : source.id).trim() || "bot-" + (index + 1);
    return {
      id: id,
      name: String(source.name == null ? "Bot" : source.name).trim() || "Bot",
      role: String(source.role == null ? "" : source.role).trim(),
      status: canonicalStatus(source.status),
      focus: String(source.focus == null ? "" : source.focus).trim(),
      accent: accent,
    };
  }

  function render(next) {
    bots = next;
    list.replaceChildren();
    next.forEach(function (bot) {
      var item = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "roster-item";
      button.dataset.id = bot.id;
      button.setAttribute("aria-pressed", "false");

      var swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = bot.accent;
      swatch.setAttribute("aria-hidden", "true");

      var copy = document.createElement("span");
      copy.className = "roster-copy";

      var name = document.createElement("span");
      name.className = "roster-name";
      name.textContent = bot.name;

      var focus = document.createElement("span");
      focus.className = "roster-focus";
      focus.textContent = bot.focus;

      var badge = document.createElement("span");
      badge.className = "badge " + statusClass(bot.status);
      badge.textContent = bot.status;

      copy.append(name, focus, badge);
      button.append(swatch, copy);
      button.addEventListener("click", function () {
        select(bot.id);
      });
      item.append(button);
      list.append(item);
    });
    if (floorCount) {
      floorCount.textContent = next.length === 1 ? "1 on the floor" : next.length + " on the floor";
    }
  }

  function fail(message) {
    list.replaceChildren();
    var item = document.createElement("li");
    item.className = "roster-error";
    item.textContent = message;
    list.append(item);
    window.BotHQ.ready = true;
    window.BotHQ.error = message;
    window.BotHQ.bots = [];
    document.dispatchEvent(new CustomEvent("bothq:ready"));
  }

  window.BotHQ = {
    ready: false,
    error: "",
    bots: [],
    lastUpdated: "",
    get selectedId() {
      return selectedId;
    },
    select: select,
    close: close,
  };

  fetch("status.json", { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("status " + response.status);
      return response.json();
    })
    .then(function (data) {
      var rows = data && Array.isArray(data.bots) ? data.bots : null;
      if (!rows || !rows.length) throw new Error("empty");
      var next = rows.map(normalize);
      render(next);
      var formatted = formatUpdated(data.lastUpdated);
      if (updated) {
        updated.textContent = formatted ? " Sample snapshot · " + formatted + "." : " Sample snapshot.";
      }
      window.BotHQ.ready = true;
      window.BotHQ.bots = next;
      window.BotHQ.lastUpdated = data.lastUpdated || "";
      document.dispatchEvent(new CustomEvent("bothq:ready"));
    })
    .catch(function () {
      fail("Could not load status.json.");
    });
})();
