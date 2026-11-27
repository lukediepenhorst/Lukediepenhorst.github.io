import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BRAND } from "./brand.js";

/*
  Floors other than 42. Only the active interior is visible.

  41  sales floor: call desks, a pipeline screen, a deal bell, a client lounge.
  43  innovation lab: benches, a 3D printer, a robot arm, racks, a holo table.
  44  penthouse: Luke's desk, a terrace lounge, and a helipad.
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

function cyl(list, color, rTop, rBot, h, x, y, z, seg) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg || 8);
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
  mesh.receiveShadow = true;
  mesh.raycast = function () {};
  parent.add(mesh);
  return mesh;
}

function elevatorButtons(parent, z) {
  const buttons = [];
  [44, 43, 42, 41].forEach((level, i) => {
    const button = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.04),
      new THREE.MeshBasicMaterial({ color: level === 42 ? 0xffb15a : 0x24303c })
    );
    button.position.set(-0.42, 1.72 - i * 0.26, z);
    button.userData.floor = level;
    parent.add(button);
    buttons.push(button);
  });
  return buttons;
}

function shell(lit, glow, blocks, accent, wall, floorColor) {
  function block(x0, z0, x1, z1) {
    blocks.push({
      x0: Math.min(x0, x1),
      z0: Math.min(z0, z1),
      x1: Math.max(x0, x1),
      z1: Math.max(z0, z1),
    });
  }
  box(lit, floorColor, 20.2, 0.1, 21.2, 0, 0.02, 2.5);
  block(-10, -8.1, 10, -7.82);
  block(-10.15, -8, -9.82, 13);
  block(9.82, -8, 10.15, 13);
  block(-10, 12.85, 10, 13.15);
  block(-10, 7.85, -3.5, 8.15);
  block(-1.5, 7.85, 10, 8.15);
  box(lit, wall, 20, 2.45, 0.14, 0, 1.22, -8);
  box(lit, wall, 0.14, 2.45, 21, -10, 1.22, 2.5);
  box(lit, wall, 0.14, 2.45, 21, 10, 1.22, 2.5);
  box(lit, wall, 6.4, 2.3, 0.12, -6.75, 1.15, 8);
  box(lit, wall, 11.2, 2.3, 0.12, 4.3, 1.15, 8);
  box(glow, accent, 16, 0.035, 0.04, 0, 2.36, -7.85);
  box(glow, accent, 16, 0.03, 0.03, 0, 0.1, -7.75);
  box(glow, "#ffb15a", 8, 0.03, 0.03, -2, 2.34, 7.9);
  return block;
}

function panesFor(panes) {
  function pane(w, h, x, y, z, rot) {
    const g = new THREE.PlaneGeometry(w, h);
    if (rot) g.rotateY(rot);
    g.translate(x, y, z);
    panes.push(g);
  }
  pane(19.4, 2.15, 0, 1.2, -7.9, 0);
  pane(19.4, 2.15, 0, 1.2, 12.9, 0);
  pane(20.4, 2.15, -9.9, 1.2, 2.4, Math.PI / 2);
  pane(20.4, 2.15, 9.9, 1.2, 2.4, Math.PI / 2);
}

function screenMesh(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.7), mat);
  mesh.raycast = function () {};
  return { canvas: canvas, ctx: ctx, tex: tex, mat: mat, mesh: mesh, draw: draw };
}

function drawPipeline(ctx, time) {
  const w = 512;
  const h = 288;
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#3ddecb";
  ctx.fillRect(0, 0, w, 8);
  ctx.fillStyle = "#f7f1e8";
  ctx.font = "700 28px sans-serif";
  ctx.fillText("PIPELINE", 20, 48);
  const stages = ["Lead", "Call", "Demo", "Close"];
  stages.forEach((name, i) => {
    const wobble = 0.45 + 0.4 * Math.sin(time * 0.8 + i);
    const bh = 40 + wobble * 140;
    ctx.fillStyle = i % 2 ? "#ffb15a" : "#3ddecb";
    ctx.fillRect(36 + i * 110, 230 - bh, 70, bh);
    ctx.fillStyle = "#d5dde6";
    ctx.font = "600 16px sans-serif";
    ctx.fillText(name, 40 + i * 110, 258);
  });
}

function drawHolo(ctx, time) {
  const w = 512;
  const h = 288;
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#7ee0ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(160, 150, 70, 0, Math.PI * 2);
  ctx.stroke();
  const a = time * 1.4;
  ctx.beginPath();
  ctx.moveTo(160, 150);
  ctx.lineTo(160 + Math.cos(a) * 66, 150 + Math.sin(a) * 66);
  ctx.stroke();
  ctx.fillStyle = "#ffb15a";
  ctx.font = "700 26px sans-serif";
  ctx.fillText("LAB 43", 280, 70);
  ctx.fillStyle = "#9ad7e4";
  ctx.font = "500 18px sans-serif";
  ctx.fillText("prototype  ·  live", 280, 110);
  for (let i = 0; i < 5; i += 1) {
    const y = 150 + i * 22;
    ctx.fillStyle = i % 2 ? "#3ddecb" : "#ffb15a";
    ctx.fillRect(280, y, 40 + ((i * 37 + time * 20) % 140), 10);
  }
}

function buildKind(kind) {
  const group = new THREE.Group();
  group.name = "floor-" + kind;
  group.visible = false;
  const lit = [];
  const glow = [];
  const panes = [];
  const blocks = [];
  const sales = kind === "sales";
  const lab = kind === "lab";
  const accent = sales ? "#3ddecb" : lab ? "#7ee0ff" : "#ffb15a";
  const wall = sales ? "#e7eef5" : lab ? "#f3f6f4" : "#f7f1e8";
  const floorColor = sales ? "#243246" : lab ? "#d9d3c6" : "#c4b49a";
  const block = shell(lit, glow, blocks, accent, wall, floorColor);
  panesFor(panes);

  let live = null;
  let arm = null;
  const blink = [];

  if (sales) {
    box(lit, "#f6f1e8", 14.8, 0.04, 5, -2.4, 0.1, 10.55);
    // Client lounge.
    box(lit, "#e15b4a", 0.75, 0.34, 2.6, -8.45, 0.3, 2.4);
    box(lit, "#9a3a32", 0.16, 0.46, 2.6, -8.8, 0.5, 2.4);
    box(lit, "#e7d3b4", 1.1, 0.06, 0.55, -7.3, 0.34, 2.4);
    box(lit, "#2f6f4e", 0.4, 0.55, 0.4, -8.6, 0.4, 5.3);
    block(-9.05, 1.05, -8.05, 3.75);
    block(-7.9, 2.1, -6.7, 2.75);
    // Pitch table.
    box(lit, "#15202c", 3.4, 0.08, 1.15, 0.2, 0.76, -5.2);
    box(glow, accent, 2.8, 0.02, 0.06, 0.2, 0.82, -5.2);
    block(-1.6, -5.85, 2.0, -4.55);
    // Call desks with dual bezels.
    [-5.4, -2.4, 0.8, 4.2].forEach((x) => {
      box(lit, "#1c2836", 1.25, 0.06, 0.62, x, 0.74, 3.35);
      box(glow, accent, 1.1, 0.018, 0.02, x, 0.78, 3.64);
      box(lit, "#10161e", 0.4, 0.3, 0.04, x - 0.24, 1.08, 3.08);
      box(lit, "#10161e", 0.4, 0.3, 0.04, x + 0.24, 1.08, 3.08);
      box(lit, "#3a4654", 0.36, 0.08, 0.36, x, 0.46, 4.15);
      block(x - 0.68, 3.0, x + 0.68, 3.72);
    });
    // Deal bell on the reception plinth.
    cyl(lit, "#c9a227", 0.16, 0.18, 0.08, 2.4, 1.02, 10.5, 10);
    cyl(lit, "#8a6a12", 0.06, 0.06, 0.12, 2.4, 0.9, 10.5, 8);
    box(lit, "#f4efe6", 1.5, 0.86, 0.5, 2.3, 0.48, 10.55);
    block(1.5, 10.25, 3.15, 10.9);
    live = screenMesh(drawPipeline);
    live.mesh.position.set(-1.2, 1.45, -7.72);
    group.add(live.mesh);
    box(lit, "#10161e", 3.4, 1.9, 0.06, -1.2, 1.45, -7.84);
  } else if (lab) {
    box(lit, "#f7f4ee", 14.8, 0.04, 5, -2.4, 0.1, 10.55);
    [-6.2, -3.2, -0.2].forEach((x) => {
      box(lit, "#f7f4ee", 1.7, 0.08, 0.7, x, 0.8, 2.2);
      box(glow, "#7ee0ff", 1.4, 0.02, 0.08, x, 0.86, 2.2);
      box(lit, "#1c2430", 0.46, 0.3, 0.04, x, 1.12, 1.9);
      block(x - 0.9, 1.8, x + 0.9, 2.6);
    });
    // 3D printer.
    box(lit, "#2c3440", 0.7, 0.7, 0.55, 3.4, 0.5, 2.3);
    box(glow, "#ffb15a", 0.4, 0.04, 0.4, 3.4, 0.88, 2.3);
    box(lit, "#10161e", 0.08, 0.45, 0.08, 3.4, 1.15, 2.3);
    block(3.0, 1.95, 3.85, 2.7);
    // Server racks.
    [8.2, 8.2].forEach((x, i) => {
      const z = -1.2 + i * 1.5;
      box(lit, "#1a222c", 0.55, 1.5, 0.4, x, 0.8, z);
      for (let n = 0; n < 4; n += 1) blink.push({ x: x - 0.1, y: 0.4 + n * 0.28, z: z + 0.22 });
    });
    box(lit, "#1a222c", 0.55, 1.5, 0.4, 8.2, 0.8, 0.5);
    for (let n = 0; n < 4; n += 1) blink.push({ x: 8.1, y: 0.4 + n * 0.28, z: 0.72 });
    block(7.85, -1.5, 8.55, 0.8);
    // Holo table and whiteboard wall.
    box(lit, "#102028", 2.2, 0.1, 1.1, 6.2, 0.72, -4.7);
    box(glow, "#7ee0ff", 1.5, 0.03, 0.7, 6.2, 0.8, -4.7);
    block(5.0, -5.35, 7.4, -4.05);
    box(lit, "#f7f7f2", 2.6, 1.3, 0.08, 2.2, 1.4, -7.8);
    box(glow, accent, 2.2, 0.03, 0.02, 2.2, 2.1, -7.74);
    live = screenMesh(drawHolo);
    live.mesh.position.set(6.2, 1.15, -4.1);
    live.mesh.rotation.x = -0.9;
    group.add(live.mesh);
    // Robot arm, three pieces so the forearm can swing.
    arm = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 8), new THREE.MeshLambertMaterial({ color: 0x2a3340 }));
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), new THREE.MeshLambertMaterial({ color: 0xffb15a }));
    upper.position.y = 0.4;
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), new THREE.MeshLambertMaterial({ color: 0x7ee0ff }));
    fore.position.set(0.15, 0.7, 0);
    arm.add(base, upper, fore);
    arm.position.set(5.4, 0.86, 2.4);
    group.add(arm);
    block(5.1, 2.1, 5.8, 2.75);
  } else {
    // Penthouse. Open terrace, stone floor, glass rail already in the shell.
    box(lit, "#f7f3ea", 18, 0.04, 18, 0, 0.08, 2);
    box(lit, "#1d3557", 2.4, 0.08, 1.05, -1.2, 0.78, -4.6);
    box(glow, "#ffb15a", 2.1, 0.02, 0.04, -1.2, 0.84, -4.1);
    box(lit, "#10161e", 0.7, 0.4, 0.04, -1.2, 1.15, -4.95);
    block(-2.5, -5.2, 0.1, -4.0);
    // Lounge.
    box(lit, "#c4554a", 2.2, 0.32, 0.7, 4.2, 0.28, 1.2);
    box(lit, "#8d3a32", 2.2, 0.4, 0.14, 4.2, 0.5, 1.5);
    box(lit, "#e7d3b4", 0.9, 0.06, 0.5, 4.2, 0.34, 0.3);
    block(3.0, 0.85, 5.4, 1.6);
    // Helipad.
    cyl(lit, "#2a3138", 2.1, 2.1, 0.04, 5.6, 0.08, 6.2, 20);
    cyl(glow, "#ffb15a", 1.55, 1.55, 0.02, 5.6, 0.11, 6.2, 20);
    box(lit, "#f4efe6", 0.7, 0.04, 0.15, 5.6, 0.12, 6.2);
    // Planters along the terrace.
    box(lit, "#2f6f4e", 0.45, 0.4, 0.45, -8.2, 0.3, 5.2);
    box(lit, "#3d7a32", 0.55, 0.35, 0.55, 8.3, 0.28, -2.2);
    box(lit, "#6b4a32", 0.5, 0.7, 0.5, -6.5, 0.4, 10.4);
  }

  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const paneMat = new THREE.MeshBasicMaterial({
    color: sales ? 0x9ad7e4 : lab ? 0xc6f1ff : 0xf0e2c8,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  merge(lit, litMat, group);
  merge(glow, glowMat, group);
  merge(panes, paneMat, group);

  const gloss = new THREE.Mesh(
    new THREE.PlaneGeometry(19.6, 20.4),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.42,
      transparent: true,
      opacity: 0,
      envMapIntensity: 0.8,
    })
  );
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.set(0, 0.085, 2.5);
  gloss.receiveShadow = true;
  gloss.raycast = function () {};
  group.add(gloss);

  let leds = null;
  if (blink.length) {
    leds = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x7ee0ff }),
      blink.length
    );
    leds.raycast = function () {};
    const dummy = new THREE.Object3D();
    blink.forEach((led, i) => {
      dummy.position.set(led.x, led.y, led.z);
      dummy.updateMatrix();
      leds.setMatrixAt(i, dummy.matrix);
    });
    group.add(leds);
  }

  const buttons = elevatorButtons(group, 12.92);
  const stations = sales
    ? {
      "opportunity-scout": { x: -5.4, z: 4.25, face: Math.PI, pose: "sit" },
      "personal-shopper": { x: -2.4, z: 4.25, face: Math.PI, pose: "sit" },
      "money-manager": { x: 0.2, z: -6.55, face: 0, pose: "present" },
    }
    : lab
      ? {
        "business-lab": { x: -6.2, z: 3.15, face: Math.PI, pose: "sit" },
        "content-coach": { x: -3.2, z: 3.15, face: Math.PI, pose: "sit" },
        "goal-tracker": { x: 7.6, z: -5.7, face: Math.PI, pose: "present" },
      }
      : {};

  function pointBlocked(x, z) {
    if (x < -9.6 || x > 9.6 || z < -7.6 || z > 12.7) return "edge";
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (x > b.x0 - BOT_R && x < b.x1 + BOT_R && z > b.z0 - BOT_R && z < b.z1 + BOT_R) return "furniture";
    }
    return "";
  }

  function update(time) {
    if (!group.visible) return;
    if (live) {
      live.draw(live.ctx, time);
      live.tex.needsUpdate = true;
    }
    if (arm) arm.rotation.y = Math.sin(time * 0.7) * 0.6;
    if (leds) {
      const on = Math.sin(time * 5) > -0.2;
      leds.material.color.set(on ? 0x9af6ff : 0x1a3a44);
    }
  }

  return {
    id: sales ? 41 : lab ? 43 : 44,
    group: group,
    glowMat: glowMat,
    gloss: gloss,
    elevatorButtons: buttons,
    pointBlocked: pointBlocked,
    stations: stations,
    meeting: sales
      ? { x0: -2.2, z0: -7.2, x1: 2.4, z1: -3.6 }
      : lab
        ? { x0: 4.4, z0: -7.2, x1: 8.6, z1: -3.6 }
        : { x0: 2.6, z0: 0.2, x1: 6.2, z1: 2.2 },
    update: update,
  };
}

function exteriorCore(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a2433";
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      ctx.fillStyle = (x + y) % 20 === 0 ? "#f6e2b0" : "#243044";
      ctx.fillRect(x, y, 6, 7);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshLambertMaterial({
    color: 0xb7c0cc,
    map: tex,
    emissive: 0xffe6bf,
    emissiveMap: tex,
    emissiveIntensity: 0.35,
  });
  const core = new THREE.Mesh(new THREE.BoxGeometry(2.1, 5.2, 1.5), mat);
  core.position.set(-1.2, 9.5, 11.7);
  core.raycast = function () {};
  scene.add(core);
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xffb15a });
  [7.3, 9.2, 11.1].forEach((y) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.07, 1.56), bandMat);
    band.position.set(-1.2, y, 11.7);
    band.raycast = function () {};
    scene.add(band);
  });
  return mat;
}

export function buildExtraFloors(scene) {
  const sales = buildKind("sales");
  const lab = buildKind("lab");
  const pent = buildKind("pent");
  scene.add(sales.group, lab.group, pent.group);
  const coreMat = exteriorCore(scene);
  const byId = { 41: sales, 43: lab, 44: pent };
  const glosses = [sales.gloss, lab.gloss, pent.gloss];

  function show(id) {
    sales.group.visible = id === 41;
    lab.group.visible = id === 43;
    pent.group.visible = id === 44;
  }

  function setNight(amount) {
    const k = amount === true ? 1 : amount === false ? 0 : amount;
    sales.glowMat.color.setRGB(1 + k * 0.4, 1 + k * 0.9, 1 + k * 0.7);
    lab.glowMat.color.setRGB(1 + k * 0.2, 1 + k * 0.5, 1 + k * 0.8);
    pent.glowMat.color.setRGB(1 + k * 0.9, 1 + k * 0.5, 1 + k * 0.15);
    coreMat.emissiveIntensity = 0.25 + k * 1.3;
  }

  function setQuality(level) {
    const high = level === "high";
    glosses.forEach((mesh) => {
      mesh.material.opacity = high ? 0.2 : 0;
      mesh.material.envMapIntensity = high ? 0.85 : 0;
    });
  }

  function update(time) {
    sales.update(time);
    lab.update(time);
    pent.update(time);
  }

  return {
    show: show,
    active: function (id) { return byId[id] || null; },
    setNight: setNight,
    setQuality: setQuality,
    update: update,
    glosses: glosses,
    buttons: sales.elevatorButtons.concat(lab.elevatorButtons, pent.elevatorButtons),
  };
}
