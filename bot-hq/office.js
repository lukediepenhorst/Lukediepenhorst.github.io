import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BRAND, drawLogo } from "./brand.js";

/*
  Builds the office and the walking graph.

  One unit is one meter. Bots are a bit short on purpose so they look cute.
  Static furniture is merged into a few meshes (one draw call each) so a
  phone does not have to draw every desk leg separately.

  Floor plan, looking down (z grows toward the bottom of this picture):

    z=-8  +------------------+----------------------+
          | records / racks  | meeting room         |
    z=-2.5+--------+---------+-----------+----------+
           door                         door
          |  desks   desks   desks                 |
          |  desks   desks   desks      lounge     |
          |  desks   desks   desks                 |
          |                               +--------+
          |                               | break  |
    z=8   +----------- door --------------+--------+
          |  LOBBY   reception   logo wall          |
    z=13  +----------------------------------------+

  Bots only walk between named points (the graph below). Dotted hallways
  stay clear of desks. Add ?debug=1 to the page URL to see those paths.
  If you move a desk onto a hallway, the console will warn you.
*/

const T = 0.18;
const WALL_H = 2.48;
const X0 = -10;
const X1 = 10;
const Z0 = -8;
const Z1 = 8;
const NORTH_Z = -2.5;
const SPLIT_X = 0.6;
const BREAK_X = 5.0;
const BREAK_Z = 2.2;

const REC_DOOR = { x0: -6.7, x1: -5.1 };
const MEET_DOOR = { x0: 2.8, x1: 4.4 };
const BREAK_DOOR = { z0: 3.5, z1: 5.1 };

const AX = [-9.1, -5.9, -2.5, 1.2, 3.6];
const AZ = [-1.65, 1.25, 4.3, 7.15];
const DESK_X = [-7.6, -4.2, -0.8];
const DESK_Z = [-0.55, 2.55, 5.55];
const DESK_IDS = [
  "chief-of-staff",
  "inbox-manager",
  "texts",
  "business-lab",
  "personal-shopper",
  "content-coach",
  "opportunity-scout",
  "money-manager",
  "goal-tracker",
];

// How close a bot's center may get to solid furniture. Bots are slim.
const BOT_R = 0.18;

const C = {
  grass: "#7ea86b",
  grassDark: "#68945c",
  walk: "#e4d5c0",
  wood: "#c99566",
  woodDark: "#8d5a3a",
  carpet: "#6e8f78",
  tileDark: "#3a4250",
  tileBreak: "#f3e6d6",
  wall: "#f6f1e8",
  wallDeep: "#e7d9c8",
  trim: "#c48958",
  desk: "#6b4330",
  chair: "#2c313a",
  metal: "#9098a4",
  metalDark: "#262c34",
  cabinet: "#6d7582",
  drawer: "#5c6572",
  plant: "#3e914c",
  plantDark: "#2b6a38",
  pot: "#d06842",
  trunk: "#7a5340",
  rug: "#2c6d84",
  rugMeet: "#d4b48c",
  rugBreak: "#e07b5f",
  runner: "#d08a48",
  sofa: "#d15d4c",
  paper: "#f4efe4",
  bezel: "#1a1e26",
  bulb: "#fff3cc",
  shade: "#f4e2c4",
  fridge: "#d5dee8",
  counter: "#4e5852",
  counterBody: "#efe6da",
  book: ["#e15b4a", "#3d7ec7", "#f0b429", "#7a5cff", "#3caf7a", "#ee7aa8"],
  frame: "#2c313c",
};

const MARK = {
  "chief-of-staff": "antenna",
  "inbox-manager": "mail",
  texts: "nubs",
  "business-lab": "lamp",
  "personal-shopper": "bag",
  "content-coach": "headset",
  "opportunity-scout": "radar",
  "money-manager": "coin",
  "goal-tracker": "fin",
};

function gid(x, z) {
  return "g:" + x + ":" + z;
}

function paint(geo, color) {
  const c = new THREE.Color(color);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

function makeTex(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeRectTex(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function windowTexture() {
  return makeRectTex(256, 128, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#8eb4d4");
    sky.addColorStop(0.55, "#f2d7b0");
    sky.addColorStop(1, "#e7c48a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(196, 36, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7e9a62";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, 86);
    ctx.quadraticCurveTo(70, 60, 140, 90);
    ctx.quadraticCurveTo(200, 70, w, 88);
    ctx.lineTo(w, h);
    ctx.fill();
    ctx.fillStyle = "#5f7d52";
    ctx.fillRect(0, 100, w, h);
  });
}

function screenTexture() {
  // Mostly white so the bot's accent color shows through. Gray bars tint it.
  return makeRectTex(128, 80, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(12, 18, 28, 0.18)";
    ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = "rgba(12, 18, 28, 0.28)";
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(10, 24 + i * 12, 70 - i * 8, 6);
    }
  });
}

function shadowTexture() {
  return makeTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(40, 24, 16, 0.45)");
    g.addColorStop(1, "rgba(40, 24, 16, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function whiteboardTexture() {
  return makeRectTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2f6f86";
    ctx.font = "700 28px sans-serif";
    ctx.fillText("TODAY", 16, 36);
    ctx.strokeStyle = "#e15b4a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 58);
    ctx.lineTo(150, 58);
    ctx.moveTo(16, 84);
    ctx.lineTo(200, 78);
    ctx.moveTo(16, 110);
    ctx.lineTo(120, 116);
    ctx.stroke();
    ctx.strokeStyle = "#3d7ec7";
    ctx.beginPath();
    ctx.moveTo(16, 132);
    ctx.bezierCurveTo(60, 120, 90, 150, 160, 136);
    ctx.stroke();
    ctx.fillStyle = "#f6d56a";
    ctx.fillRect(188, 18, 52, 44);
  });
}

function posterTexture() {
  return makeTex(256, (ctx, s) => {
    ctx.fillStyle = "#1f4f5c";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#f0b429";
    ctx.beginPath();
    ctx.moveTo(24, 200);
    ctx.lineTo(70, 70);
    ctx.lineTo(116, 200);
    ctx.fill();
    ctx.fillStyle = "#f7f3ea";
    ctx.font = "700 72px sans-serif";
    ctx.fillText("HQ", 108, 150);
    ctx.font = "600 22px sans-serif";
    ctx.fillStyle = "#f4e2c4";
    ctx.fillText("nine bots", 112, 186);
  });
}

function clockTexture() {
  return makeTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#f7f4ee";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2c313c";
    ctx.lineWidth = 4;
    ctx.stroke();
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const inner = i % 3 === 0 ? 38 : 44;
      ctx.lineWidth = i % 3 === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * inner, s / 2 + Math.sin(a) * inner);
      ctx.lineTo(s / 2 + Math.cos(a) * 52, s / 2 + Math.sin(a) * 52);
      ctx.stroke();
    }
  });
}

/**
 * @param {THREE.Scene} scene
 * @param {{id: string, accent: string}[]} bots
 * @param {{debug?: boolean}} [options]
 */
export function buildOffice(scene, bots, options) {
  const debug = !!(options && options.debug);
  // Everything you can walk through lives on this group, so other floors can
  // hide Floor 42 without hiding the skyline.
  const interior = new THREE.Group();
  interior.name = "floor-42";
  scene.add(interior);
  const lit = [];
  const glow = [];
  const glass = [];
  const panes = [];
  const signs = [];
  const shadows = [];
  const blocks = [];
  const leds = [];
  const screens = [];
  const nodes = {};
  const neighbors = {};
  const edgeList = [];
  const desks = {};
  const accentOf = {};
  bots.forEach((bot) => {
    accentOf[bot.id] = bot.accent;
  });

  function addBox(list, color, w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    if (color) paint(g, color);
    list.push(g);
  }

  function addCyl(list, color, rTop, rBot, h, x, y, z, seg) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg || 7);
    g.translate(x, y, z);
    if (color) paint(g, color);
    list.push(g);
  }

  function addCone(list, color, r, h, x, y, z) {
    const g = new THREE.ConeGeometry(r, h, 6);
    g.translate(x, y, z);
    if (color) paint(g, color);
    list.push(g);
  }

  function addSphere(list, color, r, x, y, z) {
    const g = new THREE.SphereGeometry(r, 7, 5);
    g.translate(x, y, z);
    if (color) paint(g, color);
    list.push(g);
  }

  function addPlane(list, w, h, x, y, z, rotY) {
    const g = new THREE.PlaneGeometry(w, h);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    list.push(g);
  }

  function addShadow(x, z, w, d) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0.045, z);
    shadows.push(g);
  }

  function block(name, x0, z0, x1, z1) {
    blocks.push({
      name: name,
      x0: Math.min(x0, x1),
      x1: Math.max(x0, x1),
      z0: Math.min(z0, z1),
      z1: Math.max(z0, z1),
    });
  }

  function node(id, x, z, face) {
    nodes[id] = { id: id, x: x, z: z, face: face };
  }

  function link(a, b) {
    if (!nodes[a] || !nodes[b]) {
      console.warn("Missing path node", a, b);
      return;
    }
    if (!neighbors[a]) neighbors[a] = [];
    if (!neighbors[b]) neighbors[b] = [];
    if (neighbors[a].indexOf(b) !== -1) return;
    neighbors[a].push(b);
    neighbors[b].push(a);
    edgeList.push([a, b]);
  }

  function solidX(z, x0, x1, name, color) {
    const w = Math.abs(x1 - x0);
    if (w < 0.02) return;
    addBox(lit, color || C.wall, w, WALL_H, T, (x0 + x1) / 2, WALL_H / 2, z);
    block(name, x0, z - T / 2, x1, z + T / 2);
  }

  // A wall you can see through, but not walk through. The block stays solid.
  function glassWallX(z, x0, x1, name) {
    const w = Math.abs(x1 - x0);
    if (w < 0.02) return;
    const cx = (x0 + x1) / 2;
    addBox(lit, C.wall, w, 0.85, T, cx, 0.42, z);
    addBox(lit, C.trim, w, 0.16, T + 0.04, cx, 2.28, z);
    addBox(lit, C.trim, 0.08, 1.3, T + 0.05, x0, 1.5, z);
    addBox(lit, C.trim, 0.08, 1.3, T + 0.05, x1, 1.5, z);
    addPlane(panes, w - 0.12, 1.2, cx, 1.5, z, 0);
    block(name, x0, z - T / 2, x1, z + T / 2);
  }

  function glassWallZ(x, z0, z1, name) {
    const d = Math.abs(z1 - z0);
    if (d < 0.02) return;
    const cz = (z0 + z1) / 2;
    addBox(lit, C.wall, T, 0.85, d, x, 0.42, cz);
    addBox(lit, C.trim, T + 0.04, 0.16, d, x, 2.28, cz);
    addBox(lit, C.trim, T + 0.05, 1.3, 0.08, x, 1.5, z0);
    addBox(lit, C.trim, T + 0.05, 1.3, 0.08, x, 1.5, z1);
    addPlane(panes, d - 0.12, 1.2, x, 1.5, cz, Math.PI / 2);
    block(name, x - T / 2, z0, x + T / 2, z1);
  }

  function solidZ(x, z0, z1, name, color) {
    const d = Math.abs(z1 - z0);
    if (d < 0.02) return;
    addBox(lit, color || C.wall, T, WALL_H, d, x, WALL_H / 2, (z0 + z1) / 2);
    block(name, x - T / 2, z0, x + T / 2, z1);
  }

  function doorX(z, x0, x1) {
    addBox(lit, C.trim, 0.12, 2.16, T + 0.08, x0, 1.08, z);
    addBox(lit, C.trim, 0.12, 2.16, T + 0.08, x1, 1.08, z);
    addBox(lit, C.trim, x1 - x0, 0.24, T + 0.08, (x0 + x1) / 2, 2.28, z);
    addBox(lit, C.runner, 0.9, 0.02, 0.7, (x0 + x1) / 2, 0.03, z + 0.55);
  }

  function doorZ(x, z0, z1) {
    addBox(lit, C.trim, T + 0.08, 2.16, 0.12, x, 1.08, z0);
    addBox(lit, C.trim, T + 0.08, 2.16, 0.12, x, 1.08, z1);
    addBox(lit, C.trim, T + 0.08, 0.24, z1 - z0, x, 2.28, (z0 + z1) / 2);
    addBox(lit, C.runner, 0.7, 0.02, 0.9, x - 0.55, 0.03, (z0 + z1) / 2);
  }

  // Slice a wall and leave window holes. The sill stays, so bots cannot walk out.
  function wallRunX(z, x0, x1, windows) {
    const cuts = [x0, x1];
    windows.forEach((w) => {
      if (w.x0 > x0 && w.x0 < x1) cuts.push(w.x0);
      if (w.x1 > x0 && w.x1 < x1) cuts.push(w.x1);
    });
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const a = cuts[i];
      const b = cuts[i + 1];
      if (b - a < 0.04) continue;
      const mid = (a + b) / 2;
      const win = windows.find((w) => mid > w.x0 + 0.01 && mid < w.x1 - 0.01);
      const cx = (a + b) / 2;
      const width = b - a;
      if (!win) {
        addBox(lit, C.wall, width, WALL_H, T, cx, WALL_H / 2, z);
      } else {
        addBox(lit, C.wall, width, win.y0, T, cx, win.y0 / 2, z);
        const top = WALL_H - win.y1;
        addBox(lit, C.wall, width, top, T, cx, win.y1 + top / 2, z);
        addPlane(glass, width - 0.08, win.y1 - win.y0 - 0.08, cx, (win.y0 + win.y1) / 2, z, 0);
      }
    }
  }

  function wallRunZ(x, z0, z1, windows) {
    const cuts = [z0, z1];
    windows.forEach((w) => {
      if (w.z0 > z0 && w.z0 < z1) cuts.push(w.z0);
      if (w.z1 > z0 && w.z1 < z1) cuts.push(w.z1);
    });
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const a = cuts[i];
      const b = cuts[i + 1];
      if (b - a < 0.04) continue;
      const mid = (a + b) / 2;
      const win = windows.find((w) => mid > w.z0 + 0.01 && mid < w.z1 - 0.01);
      const cz = (a + b) / 2;
      const depth = b - a;
      if (!win) {
        addBox(lit, C.wall, T, WALL_H, depth, x, WALL_H / 2, cz);
      } else {
        addBox(lit, C.wall, T, win.y0, depth, x, win.y0 / 2, cz);
        const top = WALL_H - win.y1;
        addBox(lit, C.wall, T, top, depth, x, win.y1 + top / 2, cz);
        // After a 90° yaw, the plane's width runs along the wall (z) and its height stays vertical.
        addPlane(glass, depth - 0.08, win.y1 - win.y0 - 0.08, x, (win.y0 + win.y1) / 2, cz, Math.PI / 2);
      }
    }
  }

  // Floor-to-ceiling glass. Mullions are thin metal; the glass itself is one merged sheet.
  function curtainX(z, x0, x1) {
    const w = Math.abs(x1 - x0);
    if (w < 0.08) return;
    const cx = (x0 + x1) / 2;
    addBox(lit, "#e4dfd8", w, 0.12, T + 0.02, cx, 0.06, z);
    addBox(lit, C.metalDark, w, 0.06, T + 0.04, cx, WALL_H - 0.03, z);
    const posts = Math.max(1, Math.round(w / 2.6));
    for (let i = 0; i <= posts; i += 1) {
      const x = x0 + (w * i) / posts;
      addBox(lit, C.metalDark, 0.05, WALL_H - 0.16, 0.08, x, (WALL_H * 0.5) + 0.02, z);
    }
    addPlane(panes, Math.max(0.2, w - 0.12), WALL_H - 0.22, cx, WALL_H * 0.52, z, 0);
  }

  function curtainZ(x, z0, z1) {
    const d = Math.abs(z1 - z0);
    if (d < 0.08) return;
    const cz = (z0 + z1) / 2;
    addBox(lit, "#e4dfd8", T + 0.02, 0.12, d, x, 0.06, cz);
    addBox(lit, C.metalDark, T + 0.04, 0.06, d, x, WALL_H - 0.03, cz);
    const posts = Math.max(1, Math.round(d / 2.6));
    for (let i = 0; i <= posts; i += 1) {
      const z = z0 + (d * i) / posts;
      addBox(lit, C.metalDark, 0.08, WALL_H - 0.16, 0.05, x, (WALL_H * 0.5) + 0.02, z);
    }
    addPlane(panes, Math.max(0.2, d - 0.12), WALL_H - 0.22, x, WALL_H * 0.52, cz, Math.PI / 2);
  }

  function addPlant(x, z, scale, name) {
    const s = scale;
    addCyl(lit, C.pot, 0.16 * s, 0.12 * s, 0.18 * s, x, 0.09 * s, z, 6);
    addCyl(lit, C.trunk, 0.035 * s, 0.045 * s, 0.22 * s, x, 0.26 * s, z, 5);
    addSphere(lit, C.plant, 0.2 * s, x, 0.48 * s, z);
    addSphere(lit, C.plantDark, 0.14 * s, x + 0.12 * s, 0.4 * s, z + 0.06 * s);
    addSphere(lit, C.plant, 0.12 * s, x - 0.1 * s, 0.36 * s, z - 0.04 * s);
    if (name) block(name, x - 0.16 * s, z - 0.16 * s, x + 0.16 * s, z + 0.16 * s);
    addShadow(x, z, 0.42 * s, 0.36 * s);
  }

  function addLamp(x, z) {
    addCyl(lit, C.metalDark, 0.015, 0.015, 0.7, x, WALL_H - 0.35, z, 4);
    addCyl(lit, C.shade, 0.26, 0.16, 0.14, x, WALL_H - 0.78, z, 8);
    addSphere(glow, C.bulb, 0.06, x, WALL_H - 0.82, z);
  }

  function addCabinet(x, z, w, d, name) {
    addBox(lit, C.cabinet, w, 1.12, d, x, 0.56, z);
    for (let i = 0; i < 3; i += 1) {
      const y = 0.28 + i * 0.34;
      // Drawer lines on the +x face (cabinets on the west wall face the room).
      addBox(lit, C.drawer, 0.02, 0.22, d * 0.78, x + w / 2 + 0.01, y, z);
    }
    addBox(lit, C.book[0], 0.16, 0.05, 0.2, x - 0.05, 1.15, z - 0.08);
    addBox(lit, C.book[2], 0.16, 0.05, 0.2, x + 0.02, 1.2, z + 0.08);
    block(name, x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    addShadow(x, z, w, d);
  }

  function addRack(x, z, w, d) {
    addBox(lit, C.metalDark, w, 1.5, d, x, 0.75, z);
    addBox(lit, "#1a222c", w * 0.82, 1.2, 0.02, x, 0.78, z + d / 2 + 0.01);
    for (let i = 0; i < 4; i += 1) {
      leds.push({
        x: x + (i % 2 === 0 ? -0.12 : 0.12),
        y: 0.42 + i * 0.26,
        z: z + d / 2 + 0.03,
        color: i % 2 ? "#ffb14a" : "#3dff8a",
        blink: true,
      });
    }
    block("rack", x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    addShadow(x, z, w * 0.9, d * 0.9);
  }

  function addShelf(x, z, w, d, name) {
    addBox(lit, C.woodDark, w, 1.28, d, x, 0.66, z);
    const colors = C.book;
    const count = Math.max(3, Math.floor(w / 0.14));
    for (let i = 0; i < count; i += 1) {
      const bx = x - w / 2 + 0.12 + i * ((w - 0.2) / count);
      addBox(lit, colors[i % colors.length], 0.07, 0.26, d * 0.55, bx, 0.4, z + 0.02);
      addBox(lit, colors[(i + 3) % colors.length], 0.07, 0.3, d * 0.55, bx, 0.92, z + 0.02);
    }
    block(name, x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    addShadow(x, z, w, d);
  }

  function addDesk(id, x, z, accent) {
    addBox(lit, "#2a241e", 1.42, 0.06, 0.68, x, 0.74, z);
    addBox(glow, accent, 1.28, 0.02, 0.025, x, 0.78, z + 0.34);
    [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]].forEach((p) => {
      addBox(lit, C.metalDark, 0.05, 0.7, 0.05, x + p[0], 0.35, z + p[1]);
    });
    [-0.3, 0.3].forEach((dx, i) => {
      addBox(lit, C.bezel, 0.5, 0.34, 0.04, x + dx, 1.08, z - 0.2);
      addBox(lit, C.metalDark, 0.045, 0.18, 0.045, x + dx, 0.86, z - 0.2);
      screens.push({
        id: id,
        x: x + dx,
        y: 1.08,
        z: z - 0.17,
        accent: accent,
        phase: screens.length * 0.65 + i,
        speed: 2,
      });
    });
    addBox(lit, C.metalDark, 0.32, 0.02, 0.12, x, 0.79, z + 0.02);
    addCyl(lit, accent, 0.045, 0.038, 0.07, x - 0.48, 0.82, z + 0.16, 6);
    addBox(lit, C.paper, 0.16, 0.012, 0.2, x + 0.42, 0.785, z - 0.08);
    block("desk:" + id, x - 0.7, z - 0.34, x + 0.7, z + 0.34);
    addShadow(x, z + 0.15, 1.5, 1.15);
  }

  function addChair(x, z, accent, facing) {
    // facing "north" means the sitter looks toward -z, so the backrest is on +z.
    let bx = x;
    let bz = z;
    if (facing === "north") bz = z + 0.16;
    else if (facing === "south") bz = z - 0.16;
    else if (facing === "east") bx = x + 0.16;
    else if (facing === "west") bx = x - 0.16;
    const backW = facing === "east" || facing === "west" ? 0.06 : 0.38;
    const backD = facing === "east" || facing === "west" ? 0.38 : 0.06;
    addBox(lit, C.chair, 0.38, 0.06, 0.38, x, 0.48, z);
    addBox(lit, C.chair, 0.06, 0.36, 0.06, x, 0.28, z);
    addBox(lit, accent, backW, 0.4, backD, bx, 0.78, bz);
  }

  // --- floors --------------------------------------------------------------
  // The slab is dark wood. Lobby and the executive office get a lighter stone on top.
  // The city itself is built far below this floor, not around it at ground level.

  addBox(lit, "#3e281c", 20.3, 0.12, 16.3, 0, 0.02, 0);
  // Room floors sit a hair above the wood so each room reads as its own material.
  addBox(lit, C.tileDark, 10.5, 0.025, 5.4, (X0 + SPLIT_X) / 2, 0.035, (Z0 + NORTH_Z) / 2);
  addBox(lit, C.carpet, 9.3, 0.025, 5.4, (SPLIT_X + X1) / 2, 0.035, (Z0 + NORTH_Z) / 2);
  addBox(lit, C.tileBreak, 4.9, 0.025, 5.7, (BREAK_X + X1) / 2, 0.035, (BREAK_Z + Z1) / 2);
  addBox(lit, C.rug, 8.8, 0.02, 7.5, -3.9, 0.04, 2.55);
  addBox(lit, C.rugMeet, 4.4, 0.02, 3.3, 6.3, 0.04, -5.15);
  addBox(lit, C.rugBreak, 2.2, 0.02, 1.6, 7.7, 0.04, 3.5);
  addBox(lit, C.runner, 1.35, 0.015, 8.2, 4.15, 0.04, 2.4);
  addBox(lit, "#e7c9a4", 3.4, 0.015, 2.4, 8.1, 0.04, -0.15);

  // --- walls ---------------------------------------------------------------

  const winY = { y0: 1.02, y1: 2.08 };
  block("outer-n", X0, Z0 - T / 2, X1, Z0 + T / 2);
  block("outer-s-a", X0, Z1 - T / 2, -3.3, Z1 + T / 2);
  block("outer-s-b", -1.7, Z1 - T / 2, X1, Z1 + T / 2);
  block("outer-w", X0 - T / 2, Z0, X0 + T / 2, Z1);
  block("outer-e", X1 - T / 2, Z0, X1 + T / 2, Z1);

  curtainX(Z0, X0, X1);
  curtainX(Z1, X0, -3.3);
  curtainX(Z1, -1.7, BREAK_X);
  curtainX(Z1, BREAK_X, X1);
  doorX(Z1, -3.3, -1.7);
  curtainZ(X0, Z0 + T / 2, Z1 - T / 2);
  curtainZ(X1, Z0 + T / 2, Z1 - T / 2);

  solidX(NORTH_Z, X0, REC_DOOR.x0, "wall-rec-w");
  solidX(NORTH_Z, REC_DOOR.x1, MEET_DOOR.x0, "wall-mid");
  glassWallX(NORTH_Z, MEET_DOOR.x1, X1, "wall-meet-e");
  doorX(NORTH_Z, REC_DOOR.x0, REC_DOOR.x1);
  doorX(NORTH_Z, MEET_DOOR.x0, MEET_DOOR.x1);
  glassWallZ(SPLIT_X, Z0, NORTH_Z, "wall-split");

  solidZ(BREAK_X, BREAK_Z, BREAK_DOOR.z0, "wall-break-a");
  solidZ(BREAK_X, BREAK_DOOR.z1, Z1, "wall-break-b");
  solidX(BREAK_Z, BREAK_X, X1, "wall-break-n");
  doorZ(BREAK_X, BREAK_DOOR.z0, BREAK_DOOR.z1);

  // --- records room --------------------------------------------------------

  addCabinet(-9.25, -4.35, 0.46, 0.68, "cab-a");
  addCabinet(-9.25, -5.6, 0.46, 0.68, "cab-b");
  addCabinet(-9.25, -6.85, 0.46, 0.68, "cab-c");
  addRack(-7.4, -7.52, 0.7, 0.4);
  addRack(-4.6, -7.52, 0.7, 0.4);
  addRack(-2.2, -7.52, 0.7, 0.4);
  addShelf(-3.4, -4.05, 1.35, 0.32, "shelf-rec");
  addPlant(-8.6, -3.55, 0.85, "plant-rec");
  addLamp(-5.9, -6.2);
  addLamp(-3.2, -4.6);

  // --- boardroom (glass walls, long table) --------------------------------

  addBox(lit, "#241c18", 4.05, 0.08, 1.2, 6.3, 0.74, -5.2);
  addBox(glow, BRAND.colors.teal, 3.5, 0.018, 0.06, 6.3, 0.79, -5.2);
  [[-1.9, -0.48], [1.9, -0.48], [-1.9, 0.48], [1.9, 0.48]].forEach((p) => {
    addBox(lit, C.metalDark, 0.07, 0.7, 0.07, 6.3 + p[0], 0.35, -5.2 + p[1]);
  });
  block("table", 4.28, -5.8, 8.32, -4.6);
  addShadow(6.3, -5.2, 4.2, 1.4);
  [4.7, 5.8, 6.8, 7.8].forEach((x) => {
    addChair(x, -4.05, C.chair, "north");
    addChair(x, -6.35, C.chair, "south");
  });
  addPlant(1.35, -6.7, 1.05, "plant-meet-w");
  addPlant(9.2, -4.15, 0.75, "plant-meet-e");
  addLamp(4.2, -6.4);
  addLamp(7.4, -6.7);
  // Against the east wall, clear of the hallway at x = 8.8.
  addBox(lit, C.woodDark, 0.4, 0.72, 1.35, 9.64, 0.36, -6.15);
  block("credenza", 9.44, -6.82, 9.84, -5.48);

  // --- break room ----------------------------------------------------------

  addBox(lit, "#2c333c", 0.55, 0.92, 2.15, 9.45, 0.46, 6.35);
  addBox(lit, "#d9c7a4", 0.6, 0.05, 2.2, 9.45, 0.94, 6.35);
  addBox(glow, BRAND.colors.amber, 0.46, 0.02, 2.0, 9.22, 0.97, 6.35);
  block("counter", 9.15, 5.25, 9.78, 7.45);
  addBox(lit, C.fridge, 0.62, 1.45, 0.58, 9.4, 0.74, 2.95);
  block("fridge", 9.08, 2.66, 9.72, 3.24);
  addBox(lit, "#1c222c", 0.32, 0.36, 0.28, 9.42, 1.16, 5.55);
  addBox(glow, "#ffb15a", 0.06, 0.05, 0.04, 9.24, 1.22, 5.55);
  addCyl(lit, "#e23b4a", 0.045, 0.045, 0.2, 9.42, 1.08, 7.05, 6);
  addCyl(lit, "#f0b429", 0.045, 0.045, 0.2, 9.42, 1.08, 6.72, 6);
  addCyl(lit, "#6dcea0", 0.045, 0.045, 0.2, 9.42, 1.08, 6.4, 6);
  addCyl(lit, "#f7f1e8", 0.045, 0.035, 0.07, 9.15, 1.0, 6.15, 6);
  addCyl(lit, "#f7f1e8", 0.045, 0.035, 0.07, 9.15, 1.0, 5.9, 6);
  addBox(lit, C.metalDark, 0.28, 0.32, 0.32, 8.95, 1.12, 6.9);
  addCyl(lit, C.pot, 0.09, 0.07, 0.08, 8.7, 0.99, 6.15, 6);
  leds.push({ x: 9.05, y: 1.22, z: 6.9, color: "#ff5a4a", blink: false });
  addCyl(lit, C.woodDark, 0.52, 0.52, 0.06, 7.7, 0.62, 3.5, 8);
  addCyl(lit, C.woodDark, 0.06, 0.08, 0.58, 7.7, 0.3, 3.5, 6);
  block("cafe-table", 7.18, 2.98, 8.22, 4.02);
  addShadow(7.7, 3.5, 1.15, 1.15);
  addCyl(lit, C.chair, 0.16, 0.16, 0.06, 7.05, 0.48, 3.5, 6);
  addCyl(lit, C.metalDark, 0.04, 0.04, 0.42, 7.05, 0.22, 3.5, 5);
  addCyl(lit, C.chair, 0.16, 0.16, 0.06, 8.35, 0.48, 3.15, 6);
  addCyl(lit, C.metalDark, 0.04, 0.04, 0.42, 8.35, 0.22, 3.15, 5);
  addPlant(6.15, 7.35, 0.8, "plant-break");
  addLamp(7.6, 6.4);

  // --- open office desks ---------------------------------------------------

  const screenMap = screenTexture();
  DESK_IDS.forEach((id, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = DESK_X[col];
    const z = DESK_Z[row];
    const accent = accentOf[id] || "#88aacc";
    addDesk(id, x, z, accent);
    addChair(x, z + 0.74, accent, "north");
    if (index % 2 === 0) {
      addCyl(lit, C.pot, 0.05, 0.04, 0.05, x + 0.46, 0.815, z - 0.16, 5);
      addSphere(lit, C.plant, 0.055, x + 0.46, 0.89, z - 0.16);
    }
  });

  // Lounge: a long couch against the glass, a return seat, and a coffee table.
  addBox(lit, "#3d4c66", 0.7, 0.32, 1.35, 9.15, 0.28, 0.65);
  addBox(lit, "#2e3b52", 0.16, 0.42, 1.35, 9.48, 0.5, 0.65);
  addBox(lit, "#4d6280", 0.28, 0.1, 0.55, 9.05, 0.46, 0.35);
  addBox(lit, "#4d6280", 0.28, 0.1, 0.55, 9.05, 0.46, 0.98);
  addBox(lit, "#3d4c66", 1.15, 0.32, 0.55, 8.35, 0.28, 1.45);
  addBox(lit, "#2e3b52", 1.15, 0.38, 0.14, 8.35, 0.52, 1.68);
  block("sofa-back", 9.38, 0.0, 9.62, 1.35);
  block("sofa-return", 7.75, 1.55, 8.95, 1.78);
  addShadow(9.1, 0.7, 0.9, 1.4);
  addBox(lit, "#cbb89a", 0.7, 0.05, 0.42, 8.35, 0.36, 1.2);
  addBox(lit, C.metalDark, 0.04, 0.3, 0.04, 8.1, 0.16, 1.05);
  addBox(lit, C.metalDark, 0.04, 0.3, 0.04, 8.6, 0.16, 1.35);
  block("lounge-table", 8.0, 0.99, 8.7, 1.41);
  addPlant(7.55, 1.85, 0.75, "plant-lounge");
  addLamp(8.15, 0.15);

  // Arcade cabinet against the boardroom wall. The player stands south of it.
  addBox(lit, "#161b22", 0.62, 1.45, 0.42, 9.35, 0.74, -2.22);
  addBox(lit, C.bezel, 0.46, 0.32, 0.04, 9.35, 1.15, -2.0);
  addBox(glow, "#3ddecb", 0.36, 0.22, 0.02, 9.35, 1.15, -1.97);
  addBox(glow, BRAND.colors.amber, 0.5, 0.03, 0.08, 9.35, 0.55, -1.98);
  block("arcade", 9.04, -2.43, 9.66, -2.01);

  // A small pause spot between the desk rows and the east corridor.
  addPlant(2.35, 2.75, 1.15, "plant-mid");
  // Ping-pong table between the desk aisles. Players stand off the walk lines.
  addBox(lit, "#1e6b4a", 1.02, 0.05, 1.85, 2.35, 0.76, 5.55);
  addBox(lit, "#f4f7f2", 1.02, 0.012, 0.025, 2.35, 0.79, 5.55);
  addBox(lit, "#f7f3ea", 0.02, 0.14, 1.02, 2.35, 0.88, 5.55);
  [[-0.42, -0.78], [0.42, -0.78], [-0.42, 0.78], [0.42, 0.78]].forEach((p) => {
    addBox(lit, C.metalDark, 0.05, 0.7, 0.05, 2.35 + p[0], 0.38, 5.55 + p[1]);
  });
  block("pong", 1.84, 4.62, 2.86, 6.48);
  addPlant(-9.55, 3.2, 0.8, "plant-west");
  addPlant(6.2, 5.55, 0.7, "plant-bar");

  // East file cabinet, against the break-room wall and clear of the aisle.
  addBox(lit, C.cabinet, 0.42, 1.12, 0.7, 4.58, 0.56, 2.75);
  for (let i = 0; i < 3; i += 1) {
    addBox(lit, C.drawer, 0.02, 0.22, 0.52, 4.58 - 0.22, 0.28 + i * 0.34, 2.75);
  }
  block("cab-east-mesh", 4.37, 2.4, 4.79, 3.1);
  addShadow(4.58, 2.75, 0.5, 0.8);

  // Water cooler in the southwest corner of the open office.
  addBox(lit, "#d5dee8", 0.32, 1.05, 0.32, -9.72, 0.55, 6.05);
  addBox(lit, "#9fd0ea", 0.22, 0.28, 0.04, -9.55, 0.85, 6.05);
  block("cooler", -9.88, 5.89, -9.56, 6.21);

  addLamp(-6.2, 0.3);
  addLamp(-3.4, 4.4);
  addLamp(2.2, 0.1);

  // Poster on the west wall of the open office, clear of the command screen.
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({ map: posterTexture() })
  );
  poster.position.set(X0 + 0.16, 1.55, 4.4);
  poster.rotation.y = Math.PI / 2;
  poster.raycast = function () {};
  interior.add(poster);
  addBox(lit, C.trim, 0.04, 0.95, 0.95, X0 + 0.12, 1.55, 4.4);

  // Clock sits above the right end of the command wall.
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.26, 20),
    new THREE.MeshBasicMaterial({ map: clockTexture() })
  );
  clockFace.position.set(2.15, 2.05, NORTH_Z + T / 2 + 0.03);
  interior.add(clockFace);
  const clockHands = new THREE.Group();
  clockHands.position.copy(clockFace.position);
  clockHands.position.z += 0.02;
  const handMat = new THREE.MeshBasicMaterial({ color: 0x2c313c });
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.01), handMat);
  hourHand.geometry.translate(0, 0.05, 0);
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.2, 0.01), handMat);
  minuteHand.geometry.translate(0, 0.08, 0);
  clockHands.add(hourHand, minuteHand);
  interior.add(clockHands);

  // --- lobby / reception ---------------------------------------------------
  // South of the main floor. The door lines up with the aisle at x = -2.5.

  const LZ = 13.15;
  const LX1 = 5;
  addBox(lit, "#f7f3ea", 14.9, 0.05, 5.35, (X0 + LX1) / 2, 0.1, (Z1 + LZ) / 2);
  addBox(lit, "#cfc6b8", 14.9, 0.012, 0.18, (X0 + LX1) / 2, 0.132, Z1 + 0.2);
  addBox(lit, "#e3ddd2", 6.2, 0.012, 0.12, -1.5, 0.14, 10.8);
  addBox(lit, "#d4cdc3", 8, 0.012, 0.08, -2, 0.09, 10.6);
  addBox(lit, C.rug, 3.2, 0.02, 2.2, -6.4, 0.07, 11.3);
  addBox(lit, "#e7d3b4", 2.4, 0.02, 1.6, 1.55, 0.07, 10.2);

  block("lb-w", X0 - T / 2, Z1, X0 + T / 2, LZ);
  // Door into the corner office sits in this wall. The gap is the walkway.
  block("lb-e-a", LX1 - T / 2, Z1, LX1 + T / 2, 8.85);
  block("lb-e-b", LX1 - T / 2, 10.25, LX1 + T / 2, LZ);
  block("lb-s", X0, LZ - T / 2, LX1, LZ + T / 2);
  curtainZ(X0, Z1 + T / 2, LZ - T / 2);
  curtainX(LZ, X0 + T / 2, LX1 - T / 2);
  // Dark crown above the south glass. The exterior sign hangs on this face.
  addBox(lit, "#1a222c", 12.6, 1.85, 0.42, 0.05, 4.05, LZ + 0.08);
  // Glass partition with a door, facing the lobby. glassWallX only runs along x, so this one is built by hand.
  addBox(lit, "#e4dfd8", T + 0.02, 0.12, 8.85 - Z1, LX1, 0.06, (Z1 + 8.85) / 2);
  addBox(lit, "#e4dfd8", T + 0.02, 0.12, LZ - 10.25, LX1, 0.06, (10.25 + LZ) / 2);
  addPlane(panes, 8.85 - Z1 - 0.1, WALL_H - 0.28, LX1, 1.3, (Z1 + 8.85) / 2, Math.PI / 2);
  addPlane(panes, LZ - 10.25 - 0.1, WALL_H - 0.28, LX1, 1.3, (10.25 + LZ) / 2, Math.PI / 2);
  doorZ(LX1, 8.85, 10.25);

  // Elevator bank on the south glass, inside the lobby. Paths stay north of z = 11.
  addBox(lit, "#232830", 0.62, 2.15, 0.08, -1.55, 1.12, LZ - 0.22);
  addBox(lit, "#232830", 0.62, 2.15, 0.08, -0.85, 1.12, LZ - 0.22);
  addBox(glow, BRAND.colors.amber, 0.04, 1.7, 0.02, -1.2, 1.15, LZ - 0.28);
  addBox(lit, C.metal, 0.08, 0.08, 0.08, -1.2, 1.05, LZ - 0.3);

  // Corner executive office, east of the lobby, with glass on the city side.
  addBox(lit, "#f7f3ea", 5.2, 0.05, 5.2, 7.5, 0.1, (Z1 + LZ) / 2);
  addBox(lit, "#cfc6b8", 5.2, 0.012, 0.16, 7.5, 0.132, Z1 + 0.16);
  addBox(lit, "#5c3d2e", 2.05, 0.08, 0.95, 8.15, 0.8, 11.55);
  [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]].forEach((p) => {
    addBox(lit, C.woodDark, 0.08, 0.72, 0.08, 8.15 + p[0], 0.38, 11.55 + p[1]);
  });
  block("exec-desk", 7.1, 11.05, 9.2, 12.05);
  addShadow(8.15, 11.55, 2.2, 1.15);
  addChair(6.85, 11.55, BRAND.colors.amber, "east");
  addPlant(9.15, 9.35, 0.9, "plant-exec");
  addBox(lit, C.rug, 2.6, 0.015, 1.8, 7.6, 0.07, 11.2);
  curtainZ(X1, Z1 + T / 2, LZ - T / 2);
  curtainX(LZ, LX1 + T / 2, X1 - T / 2);
  block("ex-e", X1 - T / 2, Z1, X1 + T / 2, LZ);
  block("ex-s", LX1, LZ - T / 2, X1, LZ + T / 2);

  // Reception desk. Kept east of the x = -2.5 hallway.
  addBox(lit, C.desk, 1.7, 0.08, 0.62, 1.55, 0.78, 10.75);
  [[-0.7, -0.22], [0.7, -0.22], [-0.7, 0.22], [0.7, 0.22]].forEach((p) => {
    addBox(lit, C.woodDark, 0.07, 0.7, 0.07, 1.55 + p[0], 0.38, 10.75 + p[1]);
  });
  addBox(glow, BRAND.colors.amber, 1.55, 0.035, 0.03, 1.55, 0.74, 11.08);
  addBox(lit, C.bezel, 0.46, 0.3, 0.04, 1.55, 1.08, 10.52);
  addBox(glow, BRAND.colors.teal, 0.36, 0.2, 0.015, 1.55, 1.08, 10.55);
  block("reception", 0.7, 10.44, 2.4, 11.06);
  addShadow(1.55, 10.75, 1.8, 0.8);
  addPlant(3.55, 12.45, 1.05, "plant-lb-e");
  addPlant(-8.7, 12.45, 1.0, "plant-lb-w");
  addPlant(-8.55, 9.15, 0.85, "plant-lb-door");
  addChair(-7.3, 11.55, C.chair, "south");
  addChair(-6.15, 11.85, C.chair, "south");
  block("wait-a", -7.55, 11.3, -7.05, 11.85);
  block("wait-b", -6.4, 11.6, -5.9, 12.15);
  addLamp(-4.2, 11.6);
  addLamp(1.5, 12.2);

  // Glowing logo wall on the lobby side of the office wall, west of the door.
  addBox(glow, BRAND.colors.amber, 2.9, 1.55, 0.03, -6.45, 1.48, Z1 + 0.12);
  addBox(lit, "#14110e", 2.7, 1.38, 0.05, -6.45, 1.48, Z1 + 0.15);
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = 512;
  logoCanvas.height = 256;
  const lg = logoCanvas.getContext("2d");
  lg.fillStyle = "#14110e";
  lg.fillRect(0, 0, 512, 256);
  drawLogo(lg, 28, 48, 150);
  lg.fillStyle = BRAND.colors.cream;
  lg.font = "700 42px sans-serif";
  lg.fillText(BRAND.name, 200, 110);
  lg.fillStyle = BRAND.colors.amber;
  lg.font = "500 22px sans-serif";
  lg.fillText(BRAND.tagline, 200, 152);
  lg.fillRect(200, 176, 220, 4);
  const logoTex = new THREE.CanvasTexture(logoCanvas);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTex });
  const logoWall = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 1.18), logoMat);
  logoWall.position.set(-6.45, 1.48, Z1 + 0.2);
  logoWall.raycast = function () {};
  interior.add(logoWall);

  // Emissive strips: ceilings, baseboards, and the boardroom glass line.
  // They share the glow mesh, so they do not add lights or draw calls.
  addBox(glow, BRAND.colors.amber, 7.5, 0.04, 0.045, -4.2, 2.36, NORTH_Z + 0.14);
  addBox(glow, "#3ddecb", 6.2, 0.04, 0.045, 6.4, 2.36, NORTH_Z + 0.14);
  addBox(glow, BRAND.colors.amber, 8.5, 0.035, 0.04, -3.2, 2.38, 2.4);
  addBox(glow, "#3ddecb", 6.4, 0.035, 0.04, 6.6, 2.38, -5.3);
  addBox(glow, BRAND.colors.amber, 8, 0.03, 0.035, -4, 2.36, 10.7);
  addBox(glow, "#ffb15a", 16.5, 0.04, 0.035, -1, 0.12, Z0 + 0.22);
  addBox(glow, "#3ddecb", 0.035, 0.04, 12, X0 + 0.22, 0.12, 0.4);
  addBox(glow, "#ffb15a", 0.035, 0.04, 10, X1 - 0.22, 0.12, 1.2);
  addBox(glow, BRAND.colors.amber, 6.5, 0.03, 0.03, -2.2, 0.12, Z1 - 0.16);

  // Dark baseboards read as contact shadow where the wall meets the floor.
  addBox(lit, "#b3aa9f", 20, 0.08, 0.06, 0, 0.06, Z0 + 0.14);
  addBox(lit, "#b3aa9f", 0.06, 0.08, 15.6, X0 + 0.14, 0.06, 0);
  addBox(lit, "#b3aa9f", 0.06, 0.08, 15.6, X1 - 0.14, 0.06, 0);

  // --- signs (one texture, one draw) ---------------------------------------

  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 256;
  const sctx = signCanvas.getContext("2d");
  sctx.fillStyle = BRAND.colors.ink;
  sctx.fillRect(0, 0, 512, 256);
  drawLogo(sctx, 16, 16, 96);
  sctx.fillStyle = BRAND.colors.cream;
  sctx.font = "700 36px sans-serif";
  sctx.fillText(BRAND.name, 128, 58);
  sctx.fillStyle = BRAND.colors.amber;
  sctx.font = "500 20px sans-serif";
  sctx.fillText(BRAND.tagline, 128, 92);
  const plaques = ["LOBBY", "RECORDS", "MEETING", "BREAK", "STUDIO"];
  plaques.forEach((label, i) => {
    const x = 16 + (i % 3) * 160;
    const y = 140 + Math.floor(i / 3) * 52;
    sctx.fillStyle = BRAND.colors.cream;
    sctx.fillRect(x, y, 148, 40);
    sctx.fillStyle = BRAND.colors.ink;
    sctx.font = "700 16px sans-serif";
    sctx.fillText(label, x + 12, y + 26);
  });
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.needsUpdate = true;

  function addSign(x, y, z, w, h, rotY, u0, v0, u1, v1) {
    const g = new THREE.PlaneGeometry(w, h);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    signs.push(g);
  }

  // Canvas y grows down; with flipY the top of the canvas is v = 1.
  // Logo block occupies y 0–128 of 256, so v 0.5–1.
  addSign(1.7, 1.55, Z1 + 0.14, 2.3, 1.15, 0, 0, 0.5, 0.72, 1);
  // Plaques sit in y 140–232. v = 1 - y/256.
  const plaqueV = [
    [0.03, 0.45, 0.32, 0.30],
    [0.34, 0.45, 0.63, 0.30],
    [0.66, 0.45, 0.95, 0.30],
    [0.03, 0.25, 0.32, 0.10],
    [0.34, 0.25, 0.63, 0.10],
  ];
  // LOBBY, RECORDS, MEETING face +z. BREAK faces -x (into the office). STUDIO faces +z.
  addSign(-4.15, 1.7, Z1 + 0.14, 0.7, 0.22, 0, plaqueV[0][0], plaqueV[0][3], plaqueV[0][2], plaqueV[0][1]);
  addSign(-8.15, 1.7, NORTH_Z + 0.14, 0.78, 0.22, 0, plaqueV[1][0], plaqueV[1][3], plaqueV[1][2], plaqueV[1][1]);
  addSign(6.4, 1.7, NORTH_Z + 0.14, 0.86, 0.22, 0, plaqueV[2][0], plaqueV[2][3], plaqueV[2][2], plaqueV[2][1]);
  addSign(BREAK_X - 0.14, 1.7, 6.35, 0.62, 0.22, -Math.PI / 2, plaqueV[3][0], plaqueV[3][3], plaqueV[3][2], plaqueV[3][1]);
  addSign(-4.2, 2.05, NORTH_Z + 0.14, 0.7, 0.22, 0, plaqueV[4][0], plaqueV[4][3], plaqueV[4][2], plaqueV[4][1]);

  // One canvas feeds the command wall and the boardroom screen.
  const dashCanvas = document.createElement("canvas");
  dashCanvas.width = 1024;
  dashCanvas.height = 512;
  const dashCtx = dashCanvas.getContext("2d");
  const dashTex = new THREE.CanvasTexture(dashCanvas);
  dashTex.colorSpace = THREE.SRGBColorSpace;
  const dashMat = new THREE.MeshBasicMaterial({ map: dashTex });
  let dashEvery = 3;
  let dashFrame = 0;
  let qualityLevel = "high";

  function drawDashboard(time) {
    const ctx = dashCtx;
    const w = dashCanvas.width;
    const h = dashCanvas.height;
    ctx.fillStyle = "#10141c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = BRAND.colors.amber;
    ctx.fillRect(0, 0, w, 10);
    ctx.fillStyle = "#3ddecb";
    ctx.fillRect(0, 10, w, 4);
    ctx.fillStyle = BRAND.colors.cream;
    ctx.font = "700 28px sans-serif";
    ctx.fillText(BRAND.name, 24, 52);
    ctx.fillStyle = "#9fb0c0";
    ctx.font = "500 16px sans-serif";
    ctx.fillText("FLOOR " + BRAND.floor, 24, 78);

    const bars = [0.42, 0.68, 0.36, 0.82, 0.55, 0.48, 0.74, 0.6];
    bars.forEach((base, i) => {
      const wobble = 0.55 + 0.45 * Math.sin(time * 1.3 + i * 0.7);
      const bh = (0.3 + 0.7 * base * wobble) * 250;
      ctx.fillStyle = i % 2 ? "#3ddecb" : BRAND.colors.amber;
      ctx.fillRect(28 + i * 42, 360 - bh, 26, bh);
    });
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.strokeRect(16, 96, 360, 276);

    // Bot status grid.
    bots.forEach((bot, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i % 5;
      const x = 410 + col * 300;
      const y = 120 + row * 48;
      ctx.fillStyle = "#1c2430";
      ctx.fillRect(x, y, 270, 40);
      ctx.fillStyle = bot.accent || BRAND.colors.amber;
      ctx.fillRect(x, y, 8, 40);
      ctx.fillStyle = "#e7eef4";
      ctx.font = "600 16px sans-serif";
      ctx.fillText(bot.name, x + 18, y + 26);
      ctx.fillStyle = "#9fb0c0";
      ctx.font = "14px sans-serif";
      ctx.fillText(bot.status, x + 150, y + 26);
    });

    // Radar. Low quality draws the dish without the sweep trail.
    const cx = 860;
    const cy = 250;
    ctx.strokeStyle = "#3ddecb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 78, cy);
    ctx.lineTo(cx + 78, cy);
    ctx.moveTo(cx, cy - 78);
    ctx.lineTo(cx, cy + 78);
    ctx.stroke();
    if (qualityLevel !== "low") {
      const ang = time * 1.4;
      ctx.strokeStyle = BRAND.colors.amber;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * 74, cy + Math.sin(ang) * 74);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffb15a";
    ctx.beginPath();
    ctx.arc(cx + 22, cy - 18, 4, 0, Math.PI * 2);
    ctx.arc(cx - 30, cy + 20, 3, 0, Math.PI * 2);
    ctx.fill();

    // Ticker along the bottom.
    ctx.fillStyle = "#0c1016";
    ctx.fillRect(0, h - 48, w, 48);
    ctx.fillStyle = BRAND.colors.amber;
    ctx.fillRect(0, h - 48, w, 3);
    ctx.fillStyle = BRAND.colors.cream;
    ctx.font = "600 20px sans-serif";
    const ticker = bots.map((bot) => bot.name + "  " + bot.status).join("     ·     ") + "     ·     ";
    const shift = Math.floor(time * 70) % 640;
    ctx.fillText(ticker, 20 - shift, h - 16);
    ctx.fillText(ticker, 660 - shift, h - 16);
  }
  drawDashboard(0);

  function addDashboard(x, y, z, w, h) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dashMat);
    mesh.position.set(x, y, z);
    mesh.raycast = function () {};
    interior.add(mesh);
    addBox(lit, C.bezel, w + 0.1, h + 0.1, 0.05, x, y, z - 0.04);
    addBox(glow, BRAND.colors.amber, w + 0.16, 0.025, 0.02, x, y - h / 2 - 0.04, z);
  }
  // Command wall, facing the open office. Boardroom screen faces into the glass room.
  addDashboard(-1.15, 1.32, NORTH_Z + 0.18, 5.6, 1.15);
  addDashboard(6.3, 1.48, Z0 + 0.16, 2.4, 1.05);

  // Framed art and the coffee-bar menu share one texture.
  const artCanvas = document.createElement("canvas");
  artCanvas.width = 512;
  artCanvas.height = 256;
  const ag = artCanvas.getContext("2d");
  ag.fillStyle = "#1f4f5c";
  ag.fillRect(0, 0, 256, 256);
  ag.fillStyle = "#f0b429";
  ag.beginPath();
  ag.moveTo(40, 210);
  ag.lineTo(90, 40);
  ag.lineTo(150, 210);
  ag.fill();
  ag.fillStyle = "#f7f3ea";
  ag.beginPath();
  ag.arc(180, 90, 36, 0, Math.PI * 2);
  ag.fill();
  ag.fillStyle = "#14323c";
  ag.fillRect(256, 0, 256, 256);
  ag.fillStyle = "#ffb15a";
  ag.font = "700 42px sans-serif";
  ag.fillText("COFFEE", 280, 110);
  ag.fillStyle = "#6dcea0";
  ag.fillText("JUICE", 300, 168);
  const artTex = new THREE.CanvasTexture(artCanvas);
  artTex.colorSpace = THREE.SRGBColorSpace;
  const artMat = new THREE.MeshBasicMaterial({ map: artTex });
  const artGeos = [];
  function addArt(x, y, z, w, h, rotY, u0, u1) {
    const g = new THREE.PlaneGeometry(w, h);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), uv.getY(i));
    }
    artGeos.push(g);
    addBox(lit, C.trim, rotY ? 0.04 : w + 0.08, h + 0.08, rotY ? w + 0.08 : 0.04, x, y, z);
  }
  addArt(7.15, 1.7, NORTH_Z + 0.16, 0.7, 0.7, 0, 0, 0.5);
  addArt(9.12, 1.7, 6.35, 0.62, 0.55, -Math.PI / 2, 0.5, 1);
  const artMerged = mergeGeometries(artGeos, false);
  artGeos.forEach((g) => g.dispose());
  const artMesh = new THREE.Mesh(artMerged, artMat);
  artMesh.raycast = function () {};
  interior.add(artMesh);

  // --- walking graph -------------------------------------------------------

  for (let ix = 0; ix < AX.length; ix += 1) {
    for (let iz = 0; iz < AZ.length; iz += 1) {
      const id = gid(AX[ix], AZ[iz]);
      node(id, AX[ix], AZ[iz]);
      if (ix > 0) link(id, gid(AX[ix - 1], AZ[iz]));
      if (iz > 0) link(id, gid(AX[ix], AZ[iz - 1]));
    }
  }

  const brackets = [
    [AX[0], AX[1]],
    [AX[1], AX[2]],
    [AX[2], AX[3]],
  ];
  DESK_IDS.forEach((id, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = DESK_X[col];
    const z = DESK_Z[row];
    const seat = "seat:" + id;
    const front = "front:" + id;
    const frontZ = AZ[row + 1];
    node(seat, x, z + 0.74, Math.PI);
    node(front, x, frontZ, Math.PI);
    link(seat, front);
    link(front, gid(brackets[col][0], frontZ));
    link(front, gid(brackets[col][1], frontZ));
    desks[id] = { id: id, x: x, z: z, seat: seat, front: front, mark: MARK[id] || "antenna" };
  });

  node("sv-door", -5.9, -3.2);
  node("sv-mid", -5.9, -5.4);
  node("sv-files", -8.35, -5.6, -Math.PI / 2);
  node("sv-rack", -4.2, -6.55, Math.PI);
  link("sv-door", gid(-5.9, AZ[0]));
  link("sv-door", "sv-mid");
  link("sv-mid", "sv-files");
  link("sv-mid", "sv-rack");

  node("mt-door", 3.6, -3.15);
  node("mt-s-door", 3.6, -3.3);
  node("mt-s-west", 2.4, -3.3);
  node("mt-s-mid", 6.3, -3.3, Math.PI);
  node("mt-s-east", 8.8, -3.3);
  node("mt-east", 8.8, -5.2);
  node("mt-ne", 8.8, -7.05);
  node("mt-north", 6.3, -7.05, Math.PI);
  node("mt-nw", 2.4, -7.05);
  node("mt-west", 2.4, -5.2);
  link("mt-door", gid(3.6, AZ[0]));
  link("mt-door", "mt-s-door");
  link("mt-s-west", "mt-s-door");
  link("mt-s-door", "mt-s-mid");
  link("mt-s-mid", "mt-s-east");
  link("mt-s-east", "mt-east");
  link("mt-east", "mt-ne");
  link("mt-ne", "mt-north");
  link("mt-north", "mt-nw");
  link("mt-nw", "mt-west");
  link("mt-west", "mt-s-west");

  node("br-door", 6.25, 4.3);
  node("br-hang", 6.45, 3.25, Math.PI / 2);
  node("br-coffee", 8.35, 6.45, Math.PI / 2);
  link("br-door", gid(3.6, 4.3));
  link("br-door", "br-hang");
  link("br-door", "br-coffee");

  node("cab-east", 3.6, 2.75, Math.PI / 2);
  link("cab-east", gid(3.6, AZ[1]));
  link("cab-east", gid(3.6, AZ[2]));

  node("ln-n", 6.5, -1.65);
  node("ln-mid", 6.5, -0.3);
  node("ln-s", 6.5, 1.25);
  node("ln-seat", 8.95, 0.65, -Math.PI / 2);
  node("gm-arcade", 8.15, -1.55, Math.PI / 2);
  node("pp-n", 2.35, 3.85, 0);
  node("pp-s", 2.35, 6.85, Math.PI);
  link("ln-n", gid(3.6, AZ[0]));
  link("ln-n", "ln-mid");
  link("ln-mid", "ln-s");
  link("ln-s", gid(3.6, AZ[1]));
  link("ln-mid", "ln-seat");
  link("ln-n", "gm-arcade");
  link("pp-n", gid(1.2, 4.3));
  link("pp-n", gid(3.6, 4.3));
  link("pp-s", gid(1.2, 7.15));
  link("pp-s", gid(3.6, 7.15));

  node("lb-door", -2.5, 8.55);
  node("lb-mid", -2.5, 10.15);
  node("lb-wait", -6.6, 10.4, Math.PI);
  node("lb-logo", 0.35, 9.55, Math.PI);
  link("lb-door", gid(-2.5, AZ[3]));
  link("lb-door", "lb-mid");
  link("lb-mid", "lb-wait");
  link("lb-mid", "lb-logo");
  node("ex-hall", 3.5, 9.55);
  node("ex-door", 5.75, 9.55);
  node("ex-view", 6.55, 10.55, Math.PI / 2);
  link("lb-logo", "ex-hall");
  link("ex-hall", "ex-door");
  link("ex-door", "ex-view");

  function pointBlocked(x, z) {
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (x > b.x0 - BOT_R && x < b.x1 + BOT_R && z > b.z0 - BOT_R && z < b.z1 + BOT_R) {
        return b.name;
      }
    }
    return "";
  }

  const pathErrors = [];
  edgeList.forEach((pair) => {
    const a = nodes[pair[0]];
    const b = nodes[pair[1]];
    const steps = 18;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const hit = pointBlocked(x, z);
      if (hit) {
        pathErrors.push(pair[0] + " → " + pair[1] + " hits " + hit);
        break;
      }
    }
  });

  function findPath(fromId, toId) {
    if (!nodes[fromId] || !nodes[toId]) return null;
    if (fromId === toId) return [fromId];
    const queue = [fromId];
    const prev = {};
    prev[fromId] = "";
    for (let q = 0; q < queue.length; q += 1) {
      const cur = queue[q];
      const nexts = neighbors[cur] || [];
      for (let i = 0; i < nexts.length; i += 1) {
        const nxt = nexts[i];
        if (prev[nxt] !== undefined) continue;
        prev[nxt] = cur;
        if (nxt === toId) {
          const out = [toId];
          let p = cur;
          while (p) {
            out.push(p);
            p = prev[p];
          }
          out.reverse();
          return out;
        }
        queue.push(nxt);
      }
    }
    return null;
  }

  const spotIds = ["sv-files", "sv-rack", "cab-east", "br-hang", "br-coffee", "mt-north", "mt-s-mid", "ln-seat", "gm-arcade", "pp-n", "pp-s", "lb-wait", "lb-logo", "ex-view"];
  Object.keys(desks).forEach((id) => {
    spotIds.push(desks[id].seat, desks[id].front);
  });
  for (let i = 0; i < spotIds.length; i += 1) {
    for (let j = i + 1; j < spotIds.length; j += 1) {
      if (!findPath(spotIds[i], spotIds[j])) {
        pathErrors.push("no route " + spotIds[i] + " → " + spotIds[j]);
      }
    }
  }

  if (pathErrors.length) {
    console.warn("Bot HQ walking paths run into furniture:", pathErrors);
  }

  // --- merge static meshes -------------------------------------------------
  // One material per bucket. Vertex colors carry the different paints,
  // so the whole room is a handful of draw calls.

  function merge(list, material) {
    if (!list.length) return null;
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) {
      console.error("Could not merge office geometry.");
      return null;
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    // Clicks use invisible boxes on the bots, not the building.
    mesh.raycast = function () {};
    interior.add(mesh);
    return mesh;
  }

  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const glassMat = new THREE.MeshBasicMaterial({
    map: windowTexture(),
    side: THREE.DoubleSide,
  });
  const paneMat = new THREE.MeshBasicMaterial({
    color: 0xd5eef8,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  merge(lit, litMat);
  merge(glow, glowMat);

  let screenMesh = null;
  if (screens.length) {
    screenMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.4, 0.26),
      new THREE.MeshBasicMaterial({ map: screenMap }),
      screens.length
    );
    const screenDummy = new THREE.Object3D();
    screens.forEach((spot, i) => {
      spot.base = new THREE.Color(spot.accent);
      screenDummy.position.set(spot.x, spot.y, spot.z);
      screenDummy.rotation.set(0, 0, 0);
      screenDummy.updateMatrix();
      screenMesh.setMatrixAt(i, screenDummy.matrix);
      screenMesh.setColorAt(i, spot.base);
    });
    screenMesh.instanceMatrix.needsUpdate = true;
    if (screenMesh.instanceColor) screenMesh.instanceColor.needsUpdate = true;
    screenMesh.frustumCulled = false;
    screenMesh.raycast = function () {};
    interior.add(screenMesh);
  }
  merge(glass, glassMat);
  merge(panes, paneMat);
  merge(signs, signMat);
  merge(shadows, shadowMat);

  let ledMesh = null;
  if (leds.length) {
    ledMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.035, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      leds.length
    );
    const dummy = new THREE.Object3D();
    leds.forEach((led, i) => {
      led.on = new THREE.Color(led.color);
      led.off = led.on.clone().multiplyScalar(0.18);
      dummy.position.set(led.x, led.y, led.z);
      dummy.updateMatrix();
      ledMesh.setMatrixAt(i, dummy.matrix);
      ledMesh.setColorAt(i, led.on);
    });
    ledMesh.instanceMatrix.needsUpdate = true;
    ledMesh.frustumCulled = false;
    ledMesh.raycast = function () {};
    interior.add(ledMesh);
  }

  if (debug) addDebug(interior, nodes, edgeList, pathErrors);

  const towerTex = document.createElement("canvas");
  towerTex.width = 64;
  towerTex.height = 128;
  const tg = towerTex.getContext("2d");
  tg.fillStyle = "#243040";
  tg.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 10) {
    for (let x = 5; x < 60; x += 9) {
      const litWindow = ((x * 3 + y * 5) % 13) > 5;
      tg.fillStyle = litWindow ? "#f6e2b0" : "#10151c";
      tg.fillRect(x, y, 4, 6);
    }
  }
  const towerMap = new THREE.CanvasTexture(towerTex);
  towerMap.colorSpace = THREE.SRGBColorSpace;
  towerMap.wrapS = THREE.RepeatWrapping;
  towerMap.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshLambertMaterial({
    color: 0xb7c0cc,
    map: towerMap,
    emissive: 0xffe6bf,
    emissiveMap: towerMap,
    emissiveIntensity: 0.16,
  });
  // Nearby towers rise through this floor and past it, so the overhead view
  // sees them beyond the glass. Their bases sit well below the slab.
  const nearTowers = [
    [20, 0, 5.5, 5, 36],
    [24, -10, 4.5, 6, 28],
    [18, 8, 6, 4.5, 24],
    [-22, 0, 5, 6, 40],
    [-18, -10, 6, 4, 30],
    [2, -24, 7, 5, 42],
    [-10, -22, 5, 5, 26],
    [24, 16, 5, 5, 32],
    [-18, 18, 6, 4.5, 34],
    [28, 4, 4, 4, 22],
  ];
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), towerMat, nearTowers.length);
  towers.raycast = function () {};
  const towerDummy = new THREE.Object3D();
  nearTowers.forEach((spec, i) => {
    const h = spec[4];
    const base = -14;
    towerDummy.position.set(spec[0], base + h / 2, spec[1]);
    towerDummy.scale.set(spec[2], h, spec[3]);
    towerDummy.rotation.set(0, 0, 0);
    towerDummy.updateMatrix();
    towers.setMatrixAt(i, towerDummy.matrix);
  });
  towers.instanceMatrix.needsUpdate = true;
  scene.add(towers);

  // The floor sits on top of its own shaft, so the slab reads as a high floor
  // rather than a building standing on the ground.
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(14, 36, 18), towerMat);
  shaft.position.set(0, -18, 1.2);
  shaft.raycast = function () {};
  scene.add(shaft);

  // Shorter blocks and a street grid, far below the floor.
  const lowMat = new THREE.MeshLambertMaterial({
    color: 0x6a7380,
    map: towerMap,
    emissive: 0xffe6bf,
    emissiveMap: towerMap,
    emissiveIntensity: 0.05,
  });
  const lowCount = 28;
  const lows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lowMat, lowCount);
  lows.raycast = function () {};
  let seed = 19;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed % 1000) / 1000;
  }
  for (let i = 0; i < lowCount; i += 1) {
    const h = 6 + rnd() * 12;
    const x = -40 + rnd() * 80;
    const z = -40 + rnd() * 80;
    towerDummy.position.set(x, -36 + h / 2, z);
    towerDummy.scale.set(4 + rnd() * 7, h, 4 + rnd() * 7);
    towerDummy.rotation.set(0, 0, 0);
    towerDummy.updateMatrix();
    lows.setMatrixAt(i, towerDummy.matrix);
  }
  lows.instanceMatrix.needsUpdate = true;
  scene.add(lows);

  const streetCanvas = document.createElement("canvas");
  streetCanvas.width = 256;
  streetCanvas.height = 256;
  const sg = streetCanvas.getContext("2d");
  sg.fillStyle = "#3a4048";
  sg.fillRect(0, 0, 256, 256);
  sg.fillStyle = "#2a3036";
  for (let i = 0; i < 4; i += 1) {
    sg.fillRect(i * 64, 0, 48, 256);
    sg.fillRect(0, i * 64, 256, 48);
  }
  sg.strokeStyle = "#d8d2c4";
  sg.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    sg.strokeRect(i * 64 + 8, 8, 32, 240);
  }
  const streetMap = new THREE.CanvasTexture(streetCanvas);
  streetMap.colorSpace = THREE.SRGBColorSpace;
  streetMap.wrapS = THREE.RepeatWrapping;
  streetMap.wrapT = THREE.RepeatWrapping;
  streetMap.repeat.set(8, 8);
  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshLambertMaterial({ map: streetMap, color: 0x9aa0a6 })
  );
  street.rotation.x = -Math.PI / 2;
  street.position.y = -48;
  street.raycast = function () {};
  scene.add(street);

  const exterior = document.createElement("canvas");
  exterior.width = 512;
  exterior.height = 128;
  const eg = exterior.getContext("2d");
  eg.fillStyle = BRAND.colors.ink;
  eg.fillRect(0, 0, 512, 128);
  drawLogo(eg, 16, 16, 96);
  eg.fillStyle = BRAND.colors.cream;
  eg.font = "700 42px sans-serif";
  eg.fillText(BRAND.name, 130, 62);
  eg.fillStyle = BRAND.colors.amber;
  eg.font = "500 22px sans-serif";
  eg.fillText("Floor " + BRAND.floor, 130, 98);
  const exteriorTex = new THREE.CanvasTexture(exterior);
  exteriorTex.colorSpace = THREE.SRGBColorSpace;
  const exteriorSign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.2, 2.05),
    new THREE.MeshBasicMaterial({ map: exteriorTex, side: THREE.DoubleSide })
  );
  exteriorSign.position.set(0.05, 4.05, LZ + 0.36);
  exteriorSign.raycast = function () {};
  scene.add(exteriorSign);

  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = 128;
  floorCanvas.height = 128;
  const fg = floorCanvas.getContext("2d");
  fg.fillStyle = BRAND.colors.ink;
  fg.fillRect(0, 0, 128, 128);
  fg.fillStyle = BRAND.colors.amber;
  fg.font = "700 64px sans-serif";
  fg.textAlign = "center";
  fg.fillText(String(BRAND.floor), 64, 78);
  fg.font = "600 16px sans-serif";
  fg.fillStyle = BRAND.colors.cream;
  fg.fillText("FLOOR", 64, 108);
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const floorSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({ map: floorTex })
  );
  floorSign.position.set(0.15, 1.55, LZ - 0.28);
  floorSign.raycast = function () {};
  interior.add(floorSign);

  // Three clickable floor buttons beside the elevator. Only this floor's
  // panel is pickable while Floor 42 is showing.
  const elevatorButtons = [];
  [44, 43, 42, 41].forEach((level, i) => {
    const button = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.04),
      new THREE.MeshBasicMaterial({ color: level === 42 ? 0xffb15a : 0x24303c })
    );
    button.position.set(-0.42, 1.72 - i * 0.26, LZ - 0.16);
    button.userData.floor = level;
    elevatorButtons.push(button);
    interior.add(button);
  });

  const gloss = new THREE.Mesh(
    new THREE.PlaneGeometry(19.6, 20.6),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.18,
      roughness: 0.45,
      transparent: true,
      opacity: 0,
      envMapIntensity: 0.8,
    })
  );
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.set(0, 0.09, 2.2);
  gloss.receiveShadow = true;
  gloss.raycast = function () {};
  interior.add(gloss);

  function setQuality(level) {
    qualityLevel = level;
    dashEvery = level === "low" ? 12 : 3;
    if (artMesh) artMesh.visible = level !== "low";
    const high = level === "high";
    gloss.material.opacity = high ? 0.16 : 0;
    gloss.material.envMapIntensity = high ? 0.8 : 0;
    interior.traverse((obj) => {
      if (obj.isMesh) obj.receiveShadow = high;
    });
  }

  function setNight(amount) {
    const k = amount === true ? 1 : amount === false ? 0 : amount;
    towerMat.emissiveIntensity = 0.2 + k * 2.4;
    towerMat.color.set(k > 0.45 ? 0xffffff : 0xc9d2dc);
    lowMat.emissiveIntensity = 0.05 + k * 1.05;
    lowMat.color.set(k > 0.45 ? 0xfff4dc : 0x6a7380);
    glowMat.color.setRGB(1 + k * 1.15, 1 + k * 0.85, 1 + k * 0.35);
    if (logoMat) logoMat.color.setRGB(1 + k * 0.45, 1 + k * 0.28, 1 + k * 0.05);
  }

  const screenPulse = new THREE.Color();
  function update(time) {
    dashFrame += 1;
    if (dashFrame % dashEvery === 0) {
      drawDashboard(time);
      dashTex.needsUpdate = true;
    }
    const screenStep = qualityLevel === "low" ? 4 : 1;
    if (screenMesh && dashFrame % screenStep === 0) {
      for (let i = 0; i < screens.length; i += 1) {
        const s = screens[i];
        const pulse = 0.78 + 0.22 * Math.sin(time * s.speed + s.phase);
        screenPulse.copy(s.base).multiplyScalar(pulse);
        screenMesh.setColorAt(i, screenPulse);
      }
      if (screenMesh.instanceColor) screenMesh.instanceColor.needsUpdate = true;
    }
    if (ledMesh) {
      for (let i = 0; i < leds.length; i += 1) {
        const led = leds[i];
        const on = !led.blink || Math.sin(time * 5 + i) > -0.35;
        ledMesh.setColorAt(i, on ? led.on : led.off);
      }
      if (ledMesh.instanceColor) ledMesh.instanceColor.needsUpdate = true;
    }
    const now = new Date();
    const mins = now.getMinutes() + now.getSeconds() / 60;
    const hours = (now.getHours() % 12) + mins / 60;
    // Negative Z rotation is clockwise when you look at the clock face.
    hourHand.rotation.z = -(hours / 12) * Math.PI * 2;
    minuteHand.rotation.z = -(mins / 60) * Math.PI * 2;
  }

  return {
    nodes: nodes,
    neighbors: neighbors,
    desks: desks,
    findPath: findPath,
    pathsOk: pathErrors.length === 0,
    pathErrors: pathErrors,
    pointBlocked: pointBlocked,
    interior: interior,
    gloss: gloss,
    elevatorButtons: elevatorButtons,
    screens: screens,
    update: update,
    setQuality: setQuality,
    setNight: setNight,
    botRadius: BOT_R,
  };
}

function addDebug(scene, nodes, edgeList, pathErrors) {
  const bad = {};
  pathErrors.forEach((line) => {
    const parts = line.split(" hits ")[0].split(" → ");
    if (parts.length === 2) bad[parts[0] + "|" + parts[1]] = true;
  });
  const positions = [];
  const colors = [];
  edgeList.forEach((pair) => {
    const a = nodes[pair[0]];
    const b = nodes[pair[1]];
    positions.push(a.x, 0.12, a.z, b.x, 0.12, b.z);
    const key = pair[0] + "|" + pair[1];
    const alt = pair[1] + "|" + pair[0];
    const color = bad[key] || bad[alt] ? [1, 0.2, 0.2] : [0.2, 0.85, 0.45];
    colors.push(color[0], color[1], color[2], color[0], color[1], color[2]);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const lines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ vertexColors: true })
  );
  lines.raycast = function () {};
  scene.add(lines);

  const ids = Object.keys(nodes);
  const dots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.08, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xfff1c4 }),
    ids.length
  );
  const dummy = new THREE.Object3D();
  ids.forEach((id, i) => {
    dummy.position.set(nodes[id].x, 0.12, nodes[id].z);
    dummy.updateMatrix();
    dots.setMatrixAt(i, dummy.matrix);
  });
  dots.raycast = function () {};
  scene.add(dots);
}

export { MARK };
