import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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
    z=8   +-------------------------------+--------+

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
  desk: "#f8f3ea",
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
  const lit = [];
  const glow = [];
  const glass = [];
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

  function addTree(x, z, h) {
    addCyl(lit, C.trunk, 0.1, 0.16, h * 0.42, x, h * 0.21, z, 6);
    addCone(lit, C.plantDark, h * 0.38, h * 0.48, x, h * 0.5, z);
    addCone(lit, C.plant, h * 0.28, h * 0.36, x, h * 0.78, z);
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
    addBox(lit, C.desk, 1.36, 0.07, 0.66, x, 0.74, z);
    addBox(lit, accent, 1.36, 0.025, 0.035, x, 0.785, z + 0.32);
    [[-0.58, -0.26], [0.58, -0.26], [-0.58, 0.26], [0.58, 0.26]].forEach((p) => {
      addBox(lit, C.woodDark, 0.06, 0.7, 0.06, x + p[0], 0.35, z + p[1]);
    });
    addBox(lit, C.bezel, 0.56, 0.38, 0.045, x, 1.08, z - 0.2);
    addBox(lit, C.metalDark, 0.06, 0.22, 0.06, x, 0.86, z - 0.2);
    addBox(lit, C.metalDark, 0.22, 0.025, 0.14, x, 0.76, z - 0.2);
    addBox(lit, C.metalDark, 0.32, 0.02, 0.12, x, 0.79, z + 0.02);
    addBox(lit, C.metalDark, 0.05, 0.018, 0.08, x + 0.28, 0.785, z + 0.1);
    addCyl(lit, accent, 0.045, 0.038, 0.07, x - 0.48, 0.82, z + 0.16, 6);
    addBox(lit, C.paper, 0.16, 0.012, 0.2, x + 0.42, 0.785, z - 0.08);
    block("desk:" + id, x - 0.68, z - 0.33, x + 0.68, z + 0.33);
    addShadow(x, z + 0.15, 1.5, 1.15);

    const screenMat = new THREE.MeshBasicMaterial({
      map: screenMap,
      color: accent,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), screenMat);
    screen.position.set(x, 1.08, z - 0.2 + 0.03);
    screen.matrixAutoUpdate = false;
    screen.updateMatrix();
    scene.add(screen);
    screens.push({
      id: id,
      material: screenMat,
      base: new THREE.Color(accent),
      phase: screens.length * 0.8,
      speed: 2,
    });
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

  // --- outdoors and floors -------------------------------------------------

  addBox(lit, C.grass, 70, 0.2, 70, 0, -0.2, 0);
  addBox(lit, C.walk, 24.6, 0.08, 20.6, 0, -0.04, 0);
  addBox(lit, C.wood, 20.3, 0.12, 16.3, 0, 0.02, 0);
  // Room floors sit a hair above the wood so each room reads as its own material.
  addBox(lit, C.tileDark, 10.5, 0.025, 5.4, (X0 + SPLIT_X) / 2, 0.035, (Z0 + NORTH_Z) / 2);
  addBox(lit, C.carpet, 9.3, 0.025, 5.4, (SPLIT_X + X1) / 2, 0.035, (Z0 + NORTH_Z) / 2);
  addBox(lit, C.tileBreak, 4.9, 0.025, 5.7, (BREAK_X + X1) / 2, 0.035, (BREAK_Z + Z1) / 2);
  addBox(lit, C.rug, 8.8, 0.02, 7.5, -3.9, 0.04, 2.55);
  addBox(lit, C.rugMeet, 4.4, 0.02, 3.3, 6.3, 0.04, -5.15);
  addBox(lit, C.rugBreak, 2.2, 0.02, 1.6, 7.7, 0.04, 3.5);
  addBox(lit, C.runner, 1.35, 0.015, 8.2, 4.15, 0.04, 2.4);
  addBox(lit, "#e7c9a4", 3.4, 0.015, 2.4, 8.1, 0.04, -0.15);

  addTree(-13.2, -6.5, 2.4);
  addTree(13.4, -7.2, 2.7);
  addTree(-14, 6.2, 2.2);
  addTree(14.2, 5.4, 2.5);
  addTree(0.4, -12.2, 2.8);
  addSphere(lit, C.plantDark, 0.35, -12.2, 0.28, -2);
  addSphere(lit, C.plant, 0.28, 12.6, 0.22, 1.5);
  addSphere(lit, C.plantDark, 0.3, 11.8, 0.24, -2.4);

  // --- walls ---------------------------------------------------------------

  const winY = { y0: 1.02, y1: 2.08 };
  block("outer-n", X0, Z0 - T / 2, X1, Z0 + T / 2);
  block("outer-s", X0, Z1 - T / 2, X1, Z1 + T / 2);
  block("outer-w", X0 - T / 2, Z0, X0 + T / 2, Z1);
  block("outer-e", X1 - T / 2, Z0, X1 + T / 2, Z1);

  wallRunX(Z0, X0, X1, [
    { x0: -8.7, x1: -3.4, ...winY },
    { x0: 1.8, x1: 8.4, ...winY },
  ]);
  wallRunX(Z1, X0, X1, [
    { x0: -7.4, x1: -1.2, ...winY },
    { x0: 6.1, x1: 8.9, ...winY },
  ]);
  // East/west visuals fit between the north and south walls so corners do not z-fight.
  wallRunZ(X0, Z0 + T / 2, Z1 - T / 2, [
    { z0: -6.7, z1: -3.6, ...winY },
    { z0: 0.4, z1: 5.4, ...winY },
  ]);
  wallRunZ(X1, Z0 + T / 2, Z1 - T / 2, [
    { z0: -6.7, z1: -3.5, ...winY },
    { z0: 3.5, z1: 6.5, ...winY },
  ]);

  solidX(NORTH_Z, X0, REC_DOOR.x0, "wall-rec-w");
  solidX(NORTH_Z, REC_DOOR.x1, MEET_DOOR.x0, "wall-mid");
  solidX(NORTH_Z, MEET_DOOR.x1, X1, "wall-meet-e");
  doorX(NORTH_Z, REC_DOOR.x0, REC_DOOR.x1);
  doorX(NORTH_Z, MEET_DOOR.x0, MEET_DOOR.x1);
  solidZ(SPLIT_X, Z0, NORTH_Z, "wall-split");

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

  // --- meeting room --------------------------------------------------------

  addBox(lit, C.woodDark, 3.05, 0.08, 1.15, 6.3, 0.74, -5.2);
  [[-1.35, -0.42], [1.35, -0.42], [-1.35, 0.42], [1.35, 0.42]].forEach((p) => {
    addBox(lit, C.woodDark, 0.08, 0.7, 0.08, 6.3 + p[0], 0.35, -5.2 + p[1]);
  });
  block("table", 6.3 - 1.52, -5.2 - 0.58, 6.3 + 1.52, -5.2 + 0.58);
  addShadow(6.3, -5.2, 3.2, 1.4);
  [5.2, 6.3, 7.4].forEach((x) => {
    addChair(x, -4.12, C.chair, "north");
    addChair(x, -6.28, C.chair, "south");
  });
  addPlant(1.35, -6.7, 1.05, "plant-meet-w");
  addPlant(9.2, -4.15, 0.75, "plant-meet-e");
  addLamp(4.2, -6.4);
  addLamp(7.4, -6.7);
  // Against the east wall, clear of the hallway at x = 8.8.
  addBox(lit, C.woodDark, 0.4, 0.72, 1.35, 9.64, 0.36, -6.15);
  block("credenza", 9.44, -6.82, 9.84, -5.48);

  // --- break room ----------------------------------------------------------

  addBox(lit, C.counterBody, 0.55, 0.92, 2.15, 9.45, 0.46, 6.35);
  addBox(lit, C.counter, 0.6, 0.05, 2.2, 9.45, 0.94, 6.35);
  block("counter", 9.15, 5.25, 9.78, 7.45);
  addBox(lit, C.fridge, 0.62, 1.45, 0.58, 9.4, 0.74, 2.95);
  block("fridge", 9.08, 2.66, 9.72, 3.24);
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

  // Lounge alcove between the meeting room and the break room.
  addBox(lit, C.sofa, 1.25, 0.38, 0.48, 8.55, 0.28, 0.48);
  addBox(lit, C.sofa, 1.25, 0.42, 0.12, 8.55, 0.52, 0.68);
  block("sofa", 7.9, 0.22, 9.2, 0.74);
  addShadow(8.55, 0.5, 1.35, 0.7);
  addBox(lit, C.woodDark, 0.7, 0.06, 0.42, 8.7, 0.34, -1.15);
  addBox(lit, C.woodDark, 0.06, 0.28, 0.06, 8.48, 0.16, -1.28);
  addBox(lit, C.woodDark, 0.06, 0.28, 0.06, 8.92, 0.16, -1.02);
  block("lounge-table", 8.35, -1.36, 9.05, -0.94);
  addPlant(9.15, -1.8, 0.95, "plant-lounge");
  addShelf(7.9, -2.16, 1.3, 0.28, "shelf-lounge");
  addLamp(8.2, 1.15);

  // A small pause spot between the desk rows and the east corridor.
  addPlant(2.35, 2.75, 1.15, "plant-mid");
  addCyl(lit, C.metalDark, 0.04, 0.08, 1.15, 2.05, 0.58, 6.15, 5);
  addCone(lit, C.shade, 0.2, 0.16, 2.05, 1.22, 6.15);
  addSphere(glow, C.bulb, 0.05, 2.05, 1.18, 6.15);
  block("floor-lamp", 1.92, 6.02, 2.18, 6.28);
  addSphere(lit, C.sofa, 0.28, 2.45, 0.22, 5.65);
  block("beanbag", 2.2, 5.4, 2.7, 5.9);

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

  // Poster on the south face of the records/meeting wall, visible from the open office.
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({ map: posterTexture() })
  );
  poster.position.set(-3.15, 1.55, NORTH_Z + T / 2 + 0.02);
  poster.matrixAutoUpdate = false;
  poster.updateMatrix();
  scene.add(poster);
  addBox(lit, C.trim, 0.95, 0.95, 0.04, -3.15, 1.55, NORTH_Z + T / 2 + 0.005);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.15),
    new THREE.MeshBasicMaterial({ map: whiteboardTexture() })
  );
  board.position.set(6.3, 1.55, Z0 + T / 2 + 0.02);
  board.matrixAutoUpdate = false;
  board.updateMatrix();
  scene.add(board);
  addBox(lit, C.trim, 2.24, 1.28, 0.04, 6.3, 1.55, Z0 + T / 2 + 0.005);

  // Clock on the open-office side of the north rooms. Hands move in update().
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.26, 20),
    new THREE.MeshBasicMaterial({ map: clockTexture() })
  );
  clockFace.position.set(-1.15, 1.72, NORTH_Z + T / 2 + 0.03);
  scene.add(clockFace);
  const clockHands = new THREE.Group();
  clockHands.position.copy(clockFace.position);
  clockHands.position.z += 0.02;
  const handMat = new THREE.MeshBasicMaterial({ color: 0x2c313c });
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.01), handMat);
  hourHand.geometry.translate(0, 0.05, 0);
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.2, 0.01), handMat);
  minuteHand.geometry.translate(0, 0.08, 0);
  clockHands.add(hourHand, minuteHand);
  scene.add(clockHands);

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
  node("ln-seat", 7.45, -0.3, Math.PI / 2);
  link("ln-n", gid(3.6, AZ[0]));
  link("ln-n", "ln-mid");
  link("ln-mid", "ln-s");
  link("ln-s", gid(3.6, AZ[1]));
  link("ln-mid", "ln-seat");

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

  const spotIds = ["sv-files", "sv-rack", "cab-east", "br-hang", "br-coffee", "mt-north", "mt-s-mid", "ln-seat"];
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
    scene.add(mesh);
    return mesh;
  }

  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const glassMat = new THREE.MeshBasicMaterial({
    map: windowTexture(),
    side: THREE.DoubleSide,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  merge(lit, litMat);
  merge(glow, glowMat);
  merge(glass, glassMat);
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
    scene.add(ledMesh);
  }

  if (debug) addDebug(scene, nodes, edgeList, pathErrors);

  function update(time) {
    for (let i = 0; i < screens.length; i += 1) {
      const s = screens[i];
      const pulse = 0.8 + 0.2 * Math.sin(time * s.speed + s.phase);
      s.material.color.copy(s.base).multiplyScalar(pulse);
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
    screens: screens,
    update: update,
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
