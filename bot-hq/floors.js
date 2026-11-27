import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BRAND } from "./brand.js";

/*
  Floor 41 (sales and clients) and Floor 43 (innovation lab).

  Only one interior is visible at a time. The other floors stay on the tower
  as an exterior elevator core, so the phone does not draw three offices.
*/

const BOT_R = 0.18;

function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

function box(list, color, w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  paint(g, color);
  list.push(g);
}

function merge(list, material, parent) {
  if (!list.length) return null;
  const geo = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(geo, material);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.raycast = function () {};
  parent.add(mesh);
  return mesh;
}

function windowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a2433";
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      ctx.fillStyle = (x + y) % 24 === 0 ? "#f6e2b0" : "#243044";
      ctx.fillRect(x, y, 6, 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function elevatorButtons(parent, z) {
  const buttons = [];
  [43, 42, 41].forEach((level, i) => {
    const button = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.04),
      new THREE.MeshBasicMaterial({ color: level === 42 ? 0xffb15a : 0x2a313c })
    );
    button.position.set(-0.35, 1.55 - i * 0.28, z);
    button.userData.floor = level;
    parent.add(button);
    buttons.push(button);
  });
  return buttons;
}

function makeFloor(kind) {
  const group = new THREE.Group();
  group.name = kind === "sales" ? "floor-41" : "floor-43";
  group.visible = false;
  const lit = [];
  const glow = [];
  const panes = [];
  const blocks = [];
  function block(x0, z0, x1, z1) {
    blocks.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  const sales = kind === "sales";
  const floor = sales ? "#1c2838" : "#e6ded0";
  const accent = sales ? "#3ddecb" : "#ffb15a";
  const wall = sales ? "#d5dde6" : "#fffdf8";

  box(lit, floor, 20.2, 0.12, 21, 0, 0.02, 2.4);
  if (sales) box(lit, "#f4efe4", 14.6, 0.04, 5.1, -2.5, 0.1, 10.6);
  else box(lit, "#f7f3ea", 14.6, 0.04, 5.1, -2.5, 0.1, 10.6);

  // Perimeter, with a lobby door and a north-room door.
  block(-10, -8.1, 10, -7.85);
  block(-10.1, -8, -9.85, 13);
  block(9.85, -8, 10.1, 13);
  block(-10, 12.9, 10, 13.15);
  block(-10, 7.9, -3.4, 8.15);
  block(-1.6, 7.9, 10, 8.15);
  block(-4.2, -2.7, -1.5, -2.45);
  block(1.6, -2.7, 10, -2.45);

  box(lit, wall, 20, 2.4, 0.16, 0, 1.2, -8);
  box(lit, wall, 0.16, 2.4, 21, -10, 1.2, 2.5);
  box(lit, wall, 0.16, 2.4, 21, 10, 1.2, 2.5);
  box(lit, wall, 20, 0.2, 0.16, 0, 2.3, 13);
  box(lit, wall, 6.4, 2.2, 0.14, -6.7, 1.1, 8);
  box(lit, wall, 11.4, 2.2, 0.14, 4.2, 1.1, 8);
  box(glow, accent, 12, 0.04, 0.04, -1, 2.32, -2.5);
  box(glow, accent, 14, 0.035, 0.03, 0, 0.12, -7.7);

  if (sales) {
    // Client lounge along the west glass.
    box(lit, "#c4554a", 0.7, 0.32, 2.4, -8.5, 0.28, 2.2);
    box(lit, "#9a3d36", 0.16, 0.42, 2.4, -8.8, 0.48, 2.2);
    box(lit, "#d8c4a4", 0.9, 0.05, 0.5, -7.4, 0.32, 2.2);
    block(-9.1, 1.0, -8.2, 3.4);
    block(-7.9, 1.9, -6.9, 2.5);
    // Pitch room table. Listeners sit south of it.
    box(lit, "#15202c", 3.2, 0.08, 1.1, 0, 0.74, -5.3);
    box(glow, accent, 2.6, 0.02, 0.06, 0, 0.8, -5.3);
    block(-1.7, -5.9, 1.7, -4.7);
    // Sales desks.
    [-4.5, -1.5, 2.2, 5.2].forEach((x) => {
      box(lit, "#243044", 1.2, 0.06, 0.6, x, 0.74, 3.4);
      box(glow, accent, 1.05, 0.02, 0.02, x, 0.78, 3.68);
      box(lit, "#10161e", 0.42, 0.28, 0.04, x - 0.22, 1.05, 3.12);
      box(lit, "#10161e", 0.42, 0.28, 0.04, x + 0.22, 1.05, 3.12);
      block(x - 0.65, 3.05, x + 0.65, 3.75);
    });
    box(lit, "#f2efe6", 1.4, 0.9, 0.5, 2.2, 0.5, 10.6);
    block(1.5, 10.3, 2.9, 10.95);
  } else {
    // Lab benches and a studio wall.
    [-5.2, -2.2, 1.2].forEach((x) => {
      box(lit, "#f7f4ee", 1.6, 0.08, 0.7, x, 0.78, 2.4);
      box(glow, "#3ddecb", 1.3, 0.02, 0.08, x, 0.84, 2.4);
      box(lit, "#1c2430", 0.5, 0.32, 0.04, x, 1.12, 2.1);
      block(x - 0.85, 2.0, x + 0.85, 2.8);
    });
    box(lit, "#1a120c", 2.4, 1.5, 0.12, 6.4, 1.1, -6.6);
    box(glow, accent, 2.1, 0.04, 0.03, 6.4, 1.9, -6.5);
    box(lit, "#2a2118", 2.2, 0.08, 0.9, 6.2, 0.74, -4.8);
    box(glow, accent, 1.6, 0.02, 0.05, 6.2, 0.8, -4.8);
    block(5.0, -5.3, 7.4, -4.3);
    block(6.2, -6.8, 6.7, -6.4);
    box(lit, "#6aa84f", 0.4, 0.5, 0.4, -8.2, 0.4, 5.5);
    box(lit, "#3d7a32", 0.7, 0.35, 0.7, 8.4, 0.35, 5.2);
  }

  // Glass sheets. One merged mesh, a light tint.
  function pane(w, h, x, y, z, rot) {
    const g = new THREE.PlaneGeometry(w, h);
    if (rot) g.rotateY(rot);
    g.translate(x, y, z);
    panes.push(g);
  }
  pane(18, 2.1, 0, 1.2, -7.9, 0);
  pane(18, 2.1, 0, 1.2, 12.9, 0);
  pane(20, 2.1, -9.9, 1.2, 2.5, Math.PI / 2);
  pane(20, 2.1, 9.9, 1.2, 2.5, Math.PI / 2);

  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const paneMat = new THREE.MeshBasicMaterial({
    color: sales ? 0x9ad7e4 : 0xf0d7b0,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  merge(lit, litMat, group);
  merge(glow, glowMat, group);
  merge(panes, paneMat, group);
  const buttons = elevatorButtons(group, 12.95);

  function pointBlocked(x, z) {
    if (x < -9.6 || x > 9.6 || z < -7.6 || z > 12.7) return "edge";
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (x > b.x0 - BOT_R && x < b.x1 + BOT_R && z > b.z0 - BOT_R && z < b.z1 + BOT_R) return "furniture";
    }
    return "";
  }

  return {
    group: group,
    glowMat: glowMat,
    elevatorButtons: buttons,
    pointBlocked: pointBlocked,
    // Where a meeting is gathered, so the CEO can get a cheer.
    meeting: sales
      ? { x0: -3.2, z0: -7.2, x1: 3.2, z1: -3.4 }
      : { x0: 4.2, z0: -7.4, x1: 8.4, z1: -3.6 },
  };
}

export function buildExtraFloors(scene) {
  const sales = makeFloor("sales");
  const lab = makeFloor("lab");
  scene.add(sales.group);
  scene.add(lab.group);

  // Elevator core above the lobby. It sits higher than the sign so the
  // intro still reads "Luke's Bot HQ", and it shows two more floors outside.
  const coreTex = windowTexture();
  const coreMat = new THREE.MeshLambertMaterial({
    color: 0xb7c0cc,
    map: coreTex,
    emissive: 0xffe6bf,
    emissiveMap: coreTex,
    emissiveIntensity: 0.35,
  });
  const core = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.4, 1.6), coreMat);
  core.position.set(-1.2, 9.6, 11.9);
  core.raycast = function () {};
  scene.add(core);
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xffb15a });
  [7.2, 9.2, 11.2].forEach((y) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.08, 1.68), bandMat);
    band.position.set(-1.2, y, 11.9);
    band.raycast = function () {};
    scene.add(band);
  });

  const byId = { 41: sales, 43: lab };

  function show(id) {
    sales.group.visible = id === 41;
    lab.group.visible = id === 43;
  }

  function active(id) {
    return byId[id] || null;
  }

  function setNight(on) {
    sales.glowMat.color.setRGB(on ? 1.8 : 1, on ? 2.1 : 1, on ? 1.9 : 1);
    lab.glowMat.color.setRGB(on ? 2.1 : 1, on ? 1.7 : 1, on ? 1.2 : 1);
    coreMat.emissiveIntensity = on ? 1.4 : 0.35;
  }

  return {
    show: show,
    active: active,
    setNight: setNight,
    buttons: sales.elevatorButtons.concat(lab.elevatorButtons),
  };
}
