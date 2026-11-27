/*
  One place to rename the company.

  Change `name`, `tagline`, or `colors` here and the HUD, the logo wall,
  the door plaques, and the page theme all follow. The mark is drawn in
  code (no image files), so there is nothing to license.
*/

export const BRAND = {
  name: "Luke's Bot HQ",
  tagline: "Nine bots. One office.",
  floor: 42,
  colors: {
    ink: "#1c1612",
    amber: "#ffb15a",
    teal: "#1f6f86",
    cream: "#f7f1e8",
    concrete: "#cfc6ba",
    wood: "#b8895c",
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Paint the logo mark. x and y are the top-left corner. */
export function drawLogo(ctx, x, y, size) {
  const s = size;
  const c = BRAND.colors;
  ctx.save();
  ctx.translate(x, y);
  roundRect(ctx, 0, 0, s, s, s * 0.22);
  ctx.fillStyle = c.ink;
  ctx.fill();
  ctx.fillStyle = c.wood;
  ctx.fillRect(s * 0.16, s * 0.62, s * 0.68, s * 0.09);
  ctx.fillStyle = c.teal;
  roundRect(ctx, s * 0.26, s * 0.22, s * 0.48, s * 0.32, s * 0.06);
  ctx.fill();
  ctx.fillStyle = c.amber;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.8, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Push the brand colors into the page CSS so the HUD matches the 3D signs. */
export function applyBrandToPage() {
  const root = document.documentElement;
  const c = BRAND.colors;
  root.style.setProperty("--bg", c.ink);
  root.style.setProperty("--amber", c.amber);
  root.style.setProperty("--text", c.cream);
  const name = document.getElementById("brand-name");
  const tag = document.getElementById("brand-tagline");
  const mark = document.getElementById("brand-mark");
  const kicker = document.getElementById("panel-kicker");
  if (name) name.textContent = BRAND.name;
  if (tag) tag.textContent = BRAND.tagline;
  if (kicker) kicker.textContent = BRAND.name;
  document.title = BRAND.name;
  if (mark && !mark.firstChild) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    canvas.className = "logo";
    drawLogo(canvas.getContext("2d"), 0, 0, 64);
    mark.appendChild(canvas);
  }
}
