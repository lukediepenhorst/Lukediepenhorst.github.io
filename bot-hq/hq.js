import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { buildOffice } from "./office.js";
import { buildExtraFloors } from "./floors.js";
import { createCrew } from "./actors.js";
import { createStaff } from "./staff.js";
import { createCeo } from "./ceo.js";
import { createAudio } from "./audio.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { applyBrandToPage } from "./brand.js";

/*
  Scene, camera, and clicks.

  hq.js  — this file. Renderer, orbit controls, picking, labels.
  office.js — the rooms, furniture, and the hallway graph.
  actors.js — the bots, their walk cycle, and their to-do lists.
  roster.js — loads status.json and the side panel. Works even if WebGL does not.

  Performance notes for a phone (an iPhone 13 reports devicePixelRatio 3):
  - The pixel ratio is capped at 2 so we don't shade a 3x framebuffer.
  - Furniture is merged in office.js. Bot limbs are instanced in actors.js.
  - No shadow maps. Blobs under the bots are the cheap soft shadows.
  - The draw loop pauses while the tab is hidden.
*/

const MAX_PIXEL_RATIO = 2;

const HOME = {
  wide: { fov: 34, pos: [18, 17.5, 24], target: [-1.2, 0.5, 0.4] },
  narrow: { fov: 52, pos: [12, 22, 30], target: [-0.4, 0.4, 0.6] },
};

const STATUS_SPEED = {
  Working: 3.4,
  Idle: 1.15,
  "Waiting on Luke": 2.2,
  Done: 0.75,
};

function showFallback(text) {
  const fallback = document.getElementById("fallback");
  const fallbackText = document.getElementById("fallback-text");
  const hint = document.getElementById("hint");
  const loading = document.getElementById("loading");
  if (fallbackText && fallback && fallback.hidden) fallbackText.textContent = text;
  if (fallback) fallback.hidden = false;
  if (hint) hint.hidden = true;
  if (loading) loading.hidden = true;
  window.__HQ_SETTLED__ = true;
}

function hideLoading() {
  const loading = document.getElementById("loading");
  if (loading) loading.hidden = true;
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch (err) {
    return false;
  }
}

function waitForRoster() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.BotHQ || { ready: true, error: "The roster did not load.", bots: [] });
    };
    if (window.BotHQ && window.BotHQ.ready) {
      finish();
      return;
    }
    document.addEventListener("bothq:ready", finish, { once: true });
    window.setTimeout(finish, 12000);
  });
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function startScene(botInfos) {
  applyBrandToPage();
  const viewport = document.getElementById("viewport");
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const debug = new URLSearchParams(window.location.search).has("debug");

  const renderer = new THREE.WebGLRenderer({
    antialias: !coarse,
    alpha: false,
    stencil: false,
    powerPreference: coarse ? "default" : "high-performance",
    failIfMajorPerformanceCaveat: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xa9cbe4, 1);
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9cbe4);
  scene.fog = new THREE.Fog(0xa9cbe4, 70, 170);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.08, 180);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "labels";
  viewport.appendChild(labelRenderer.domElement);

  // One finger / left mouse orbits. Two fingers pinch-zoom and pan.
  // Right mouse (or two fingers) pans. Wheel zooms on desktop.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = coarse ? 0.7 : 0.85;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;
  controls.minDistance = 3.2;
  controls.maxDistance = 48;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  const hemi = new THREE.HemisphereLight(0xfff6ea, 0xb89a78, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.35);
  sun.position.set(9, 16, 11);
  sun.castShadow = false;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  let envMap = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (err) {
    envMap = null;
  }
  const warm = new THREE.PointLight(0xffb26b, 7, 22, 2);
  warm.position.set(-1.2, 2.4, 1.4);
  const cool = new THREE.PointLight(0xc5e6ff, 4, 16, 2);
  cool.position.set(6.2, 2.3, -5);
  scene.add(warm, cool);

  const office = buildOffice(scene, botInfos, { debug: debug });
  office.screens.forEach((screen) => {
    const bot = botInfos.find((item) => item.id === screen.id);
    screen.speed = bot ? STATUS_SPEED[bot.status] || 1.6 : 1.6;
  });
  const crew = createCrew(scene, office, botInfos, { reduceMotion: reduce });
  const extra = buildExtraFloors(scene);
  const audio = createAudio();
  if (envMap) {
    office.gloss.material.envMap = envMap;
    extra.glosses.forEach((mesh) => { mesh.material.envMap = envMap; });
  }
  const staff = createStaff(scene);
  const ceo = createCeo(scene);
  const floorPick = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  floorPick.rotation.x = -Math.PI / 2;
  floorPick.position.y = 0.04;
  scene.add(floorPick);
  const confetti = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.07, 0.09, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xffb15a }),
    16
  );
  confetti.frustumCulled = false;
  confetti.raycast = function () {};
  confetti.visible = false;
  scene.add(confetti);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.54, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  ring.raycast = function () {};
  scene.add(ring);

  const narrowQuery = window.matchMedia("(max-width: 760px)");
  function narrow() {
    return narrowQuery.matches || viewport.clientWidth < 760;
  }
  function homeView() {
    return narrow() ? HOME.narrow : HOME.wide;
  }

  let quality = "high";
  let framed = false;
  function frameHome() {
    const home = homeView();
    camera.fov = home.fov;
    camera.position.set(home.pos[0], home.pos[1], home.pos[2]);
    controls.target.set(home.target[0], home.target[1], home.target[2]);
    camera.updateProjectionMatrix();
    framed = true;
  }

  let followId = null;
  let pullDist = 0;
  let tween = null;
  const focus = new THREE.Vector3();

  const followButtons = [
    document.getElementById("btn-follow"),
    document.getElementById("panel-follow"),
  ];
  const labelButton = document.getElementById("btn-labels");
  let labelsOn = true;

  function syncFollowButtons() {
    const selected = window.BotHQ && window.BotHQ.selectedId;
    followButtons.forEach((button) => {
      if (!button) return;
      if (!selected) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      const following = followId === selected;
      button.textContent = following ? "Stop following" : "Follow";
      button.setAttribute("aria-pressed", following ? "true" : "false");
    });
  }

  function stopFollow() {
    followId = null;
    pullDist = 0;
    syncFollowButtons();
  }

  function startFollow(id) {
    followId = id;
    tween = null;
    const dist = camera.position.distanceTo(controls.target);
    pullDist = dist > 11 ? 8.2 : 0;
    syncFollowButtons();
  }

  function resetView() {
    stopFollow();
    if (ceoOn) stopCeo(true);
    if (bird) setBird(false);
    const home = homeView();
    if (reduce) {
      frameHome();
      controls.update();
      return;
    }
    tween = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(home.pos[0], home.pos[1], home.pos[2]),
      fromTgt: controls.target.clone(),
      toTgt: new THREE.Vector3(home.target[0], home.target[1], home.target[2]),
      fromFov: camera.fov,
      toFov: home.fov,
    };
  }

  document.getElementById("btn-reset").addEventListener("click", resetView);
  const timeButton = document.getElementById("btn-time");
  const todLabel = document.getElementById("tod-label");
  let timeMode = "auto";
  const dayColor = new THREE.Color(0xa9cbe4);
  const nightColor = new THREE.Color(0x070b16);
  const skyColor = new THREE.Color();
  function nightAmount(elapsed) {
    if (timeMode === "day") return 0;
    if (timeMode === "night") return 1;
    const u = (elapsed % 180) / 180;
    if (u < 0.4) return 0;
    if (u < 0.55) return (u - 0.4) / 0.15;
    if (u < 0.8) return 1;
    return 1 - (u - 0.8) / 0.2;
  }
  function todName(k) {
    if (k < 0.15) return "Day";
    if (k < 0.55) return "Dusk";
    if (k < 0.85) return "Night";
    return "Dawn";
  }
  function applyTimeOfDay(elapsed) {
    const k = nightAmount(elapsed || 0);
    skyColor.copy(dayColor).lerp(nightColor, k);
    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);
    renderer.setClearColor(skyColor, 1);
    hemi.intensity = 0.95 - k * 0.67;
    sun.intensity = 1.35 - k * 1.13;
    sun.position.set(Math.cos(k * Math.PI) * 14, 5 + (1 - k) * 12, 8 + Math.sin(k * Math.PI) * 6);
    warm.intensity = 7 + k * 4;
    cool.intensity = 4 + k * 3;
    renderer.toneMappingExposure = 1.05 - k * 0.13;
    office.setNight(k);
    extra.setNight(k);
    if (timeButton) {
      const labels = { auto: "Auto", day: "Day", night: "Night" };
      timeButton.textContent = labels[timeMode];
      timeButton.setAttribute("aria-pressed", timeMode === "auto" ? "false" : "true");
    }
    if (todLabel) todLabel.textContent = timeMode === "auto" ? todName(k) : (timeMode === "night" ? "Night" : "Day");
  }
  if (timeButton) {
    timeButton.addEventListener("click", () => {
      timeMode = timeMode === "auto" ? "day" : timeMode === "day" ? "night" : "auto";
      applyTimeOfDay(0);
    });
  }
  followButtons.forEach((button) => {
    if (!button) return;
    button.addEventListener("click", () => {
      const selected = window.BotHQ && window.BotHQ.selectedId;
      if (!selected) return;
      if (followId === selected) stopFollow();
      else startFollow(selected);
    });
  });
  if (labelButton) {
    labelButton.addEventListener("click", () => {
      labelsOn = !labelsOn;
      labelButton.setAttribute("aria-pressed", labelsOn ? "true" : "false");
    });
  }

  const rosterButton = document.getElementById("btn-roster");
  const rosterClose = document.getElementById("roster-close");
  function rosterOpen() {
    return document.body.classList.contains("is-roster-open");
  }
  function syncRosterButton() {
    if (!rosterButton) return;
    rosterButton.setAttribute("aria-expanded", rosterOpen() ? "true" : "false");
  }
  function setRoster(open) {
    document.body.classList.toggle("is-roster-open", open);
    syncRosterButton();
  }
  if (window.matchMedia("(min-width: 960px)").matches) setRoster(true);
  else syncRosterButton();
  if (rosterButton) {
    rosterButton.addEventListener("click", () => setRoster(!rosterOpen()));
  }
  if (rosterClose) rosterClose.addEventListener("click", () => setRoster(false));

  document.addEventListener("bothq:select", (event) => {
    const id = event.detail && event.detail.id;
    if (id) {
      startFollow(id);
      if (crew.playTask) crew.playTask(id);
    }
    if (narrow()) setRoster(false);
  });
  document.addEventListener("bothq:close", () => stopFollow());

  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);
  const pointerNdc = new THREE.Vector2();
  let down = null;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (intro) endIntro(false);
    if (tour || tourArm) stopTour();
    down = { x: event.clientX, y: event.clientY, id: event.pointerId, type: event.pointerType };
  });
  window.addEventListener("pointerup", (event) => {
    if (!down || event.pointerId !== down.id) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    const slop = down.type === "touch" ? 22 : 6;
    const at = down;
    down = null;
    if (dx * dx + dy * dy > slop * slop) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    pointerNdc.set(
      ((at.x - rect.left) / rect.width) * 2 - 1,
      -((at.y - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const pickRay = new THREE.Raycaster();
    pickRay.setFromCamera(pointerNdc, camera);
    if (ceoOn) {
      const floorHits = pickRay.intersectObject(floorPick, false);
      if (floorHits.length) ceo.goTo(floorHits[0].point.x, floorHits[0].point.z);
      return;
    }
    const buttons = floorId === 42 ? office.elevatorButtons : extra.active(floorId) ? extra.active(floorId).elevatorButtons : [];
    const panelHits = buttons.length ? pickRay.intersectObjects(buttons, false) : [];
    if (panelHits.length && panelHits[0].object.userData.floor) {
      setFloor(panelHits[0].object.userData.floor);
      return;
    }
    const hits = raycaster.intersectObjects(crew.bots.map((bot) => bot.group), true);
    if (!hits.length) return;
    let node = hits[0].object;
    let id = "";
    while (node) {
      if (node.userData && node.userData.botId) {
        id = node.userData.botId;
        break;
      }
      node = node.parent;
    }
    if (id && window.BotHQ) window.BotHQ.select(id);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(crew.bots.map((bot) => bot.group), true);
    renderer.domElement.style.cursor = hit.length ? "pointer" : "grab";
  });
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
  renderer.domElement.addEventListener(
    "touchmove",
    (event) => {
      if (event.cancelable) event.preventDefault();
    },
    { passive: false }
  );

  const hint = document.getElementById("hint");
  function hideHint() {
    if (hint) hint.classList.add("is-gone");
  }
  controls.addEventListener("start", () => {
    tween = null;
    if (tour || tourArm) stopTour();
    hideHint();
  });
  window.setTimeout(hideHint, 7000);

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width < 2 || height < 2) return;
    if (!framed) frameHome();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const cap = quality === "low" ? 1 : MAX_PIXEL_RATIO;
    const ratio = Math.min(window.devicePixelRatio || 1, cap);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
  }
  const observer = new ResizeObserver(() => resize());
  observer.observe(viewport);
  resize();

  // A short move from outside the tower into the floor. Tap skips it.
  // Slow devices that have already dropped quality never play it.
  let intro = null;
  const introSkip = document.getElementById("intro-skip");
  if (!reduce && !debug) {
    const home = homeView();
    intro = {
      t: 0,
      fromPos: new THREE.Vector3(2.4, 7.2, 24),
      toPos: new THREE.Vector3(home.pos[0], home.pos[1], home.pos[2]),
      fromTgt: new THREE.Vector3(0.05, 4.0, 13.2),
      toTgt: new THREE.Vector3(home.target[0], home.target[1], home.target[2]),
    };
    camera.position.copy(intro.fromPos);
    controls.target.copy(intro.fromTgt);
    camera.lookAt(intro.fromTgt);
    if (introSkip) introSkip.hidden = false;
  }
  function endIntro(playTour) {
    if (!intro) return;
    intro = null;
    frameHome();
    // Same settle as Reset view, so the orbit doesn't drift off the home pose.
    for (let i = 0; i < 80; i += 1) controls.update();
    if (introSkip) introSkip.hidden = true;
    if (playTour) armTour();
  }

  // A glide through the rooms. Each stop is where the camera looks next.
  const TOUR_STOPS = [
    { pos: [18, 17.5, 24], target: [-1.2, 0.5, 0.4], dur: 1.2 },
    { pos: [6, 12, 14], target: [-2, 1.2, 4], dur: 3 },
    { pos: [-1.5, 3.6, 11.6], target: [-6.4, 1.45, 8.2], dur: 3.2 },
    { pos: [3.2, 3.4, 11.2], target: [1.5, 1.05, 10.5], dur: 2.8 },
    { pos: [5, 6.5, 8], target: [-3, 1, 2], dur: 3.4 },
    { pos: [-1.1, 2.8, 2.8], target: [-1.15, 1.3, -2.4], dur: 3.6 },
    { pos: [3.8, 3.2, -1.2], target: [6.3, 1.15, -5.3], dur: 3.4 },
    { pos: [5.2, 3.2, 2.6], target: [8.9, 0.85, 0.3], dur: 3.2 },
    { pos: [5.8, 3.0, 4.4], target: [9.2, 1.1, 6.3], dur: 2.8 },
    { pos: [18, 17.5, 24], target: [-1.2, 0.5, 0.4], dur: 2 },
  ];
  let tour = null;
  let tourArm = 0;
  const tourButton = document.getElementById("btn-tour");
  function syncTourButton() {
    if (!tourButton) return;
    const on = !!tour;
    tourButton.textContent = on ? "Stop" : "Tour";
    tourButton.setAttribute("aria-pressed", on ? "true" : "false");
  }
  function cancelArm() {
    if (tourArm) {
      window.clearTimeout(tourArm);
      tourArm = 0;
    }
  }
  function armTour() {
    if (reduce || debug) return;
    cancelArm();
    tourArm = window.setTimeout(() => {
      tourArm = 0;
      startTour();
    }, 1600);
  }
  function stopTour() {
    cancelArm();
    if (!tour) {
      syncTourButton();
      return;
    }
    tour = null;
    syncTourButton();
    controls.update();
  }
  function startTour() {
    if (reduce) return;
    cancelArm();
    if (intro) endIntro(false);
    stopFollow();
    tween = null;
    const home = homeView();
    const stops = TOUR_STOPS.map((stop, index) => {
      if (index === 0 || index === TOUR_STOPS.length - 1) {
        return {
          pos: [home.pos[0], home.pos[1], home.pos[2]],
          target: [home.target[0], home.target[1], home.target[2]],
          dur: stop.dur,
        };
      }
      return stop;
    });
    tour = { t: 0, stops: stops };
    camera.position.set(stops[0].pos[0], stops[0].pos[1], stops[0].pos[2]);
    controls.target.set(stops[0].target[0], stops[0].target[1], stops[0].target[2]);
    camera.lookAt(controls.target);
    syncTourButton();
  }
  function stepTour(raw) {
    if (!tour) return;
    tour.t += Math.min(raw, 0.05);
    let elapsed = tour.t;
    const stops = tour.stops;
    let i = 0;
    while (i < stops.length - 1 && elapsed > stops[i].dur) {
      elapsed -= stops[i].dur;
      i += 1;
    }
    if (i >= stops.length - 1) {
      camera.position.set(stops[i].pos[0], stops[i].pos[1], stops[i].pos[2]);
      controls.target.set(stops[i].target[0], stops[i].target[1], stops[i].target[2]);
      camera.lookAt(controls.target);
      tour = null;
      syncTourButton();
      for (let n = 0; n < 80; n += 1) controls.update();
      return;
    }
    const k = smoothstep(Math.min(1, elapsed / stops[i].dur));
    const a = stops[i];
    const b = stops[i + 1];
    camera.position.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * k,
      a.pos[1] + (b.pos[1] - a.pos[1]) * k,
      a.pos[2] + (b.pos[2] - a.pos[2]) * k
    );
    controls.target.set(
      a.target[0] + (b.target[0] - a.target[0]) * k,
      a.target[1] + (b.target[1] - a.target[1]) * k,
      a.target[2] + (b.target[2] - a.target[2]) * k
    );
    camera.lookAt(controls.target);
  }
  if (tourButton) {
    tourButton.addEventListener("click", () => {
      if (tour) stopTour();
      else startTour();
    });
  }

  function clampTarget() {
    const target = controls.target;
    const x = THREE.MathUtils.clamp(target.x, -8.5, 8.5);
    const y = THREE.MathUtils.clamp(target.y, 0.25, 2.4);
    const z = THREE.MathUtils.clamp(target.z, -6.8, 12);
    if (x !== target.x || y !== target.y || z !== target.z) {
      const dx = x - target.x;
      const dy = y - target.y;
      const dz = z - target.z;
      target.set(x, y, z);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
    if (camera.position.y < 0.45) camera.position.y = 0.45;
  }

  const project = new THREE.Vector3();
  function updateLabels(t) {
    const selected = window.BotHQ ? window.BotHQ.selectedId : null;
    const small = narrow();
    for (let i = 0; i < crew.bots.length; i += 1) {
      const bot = crew.bots[i];
      const el = bot.labelEl;
      const dist = camera.position.distanceTo(bot.group.position);
      project.copy(bot.group.position);
      project.y += 1.5;
      project.project(camera);
      const behind = project.z > 1;
      // On a phone, or whenever someone is selected, only that bot's name is shown
      // so the labels don't pile up. Otherwise names appear when you move in close.
      let show = labelsOn && !behind;
      if (show && (small || selected)) show = bot.id === selected;
      else if (show && dist > 12) show = false;
      el.classList.toggle("is-hidden", !show);
      el.classList.toggle("is-selected", bot.id === selected);
      if (show) {
        const scale = Math.max(0.62, Math.min(1, 10 / Math.max(dist, 0.01)));
        el.style.transform = "scale(" + scale.toFixed(3) + ")";
      }
    }
    void t;
  }

  let debugEl = null;
  if (debug) {
    debugEl = document.createElement("div");
    debugEl.id = "debug-readout";
    document.body.appendChild(debugEl);
  }

  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      showFallback("The 3D view stopped. The roster still lists every bot.");
      renderer.setAnimationLoop(null);
    },
    { once: true }
  );

  let slowTime = 0;
  let smoothTime = 0;
  const clock = new THREE.Clock();
  const followDelta = new THREE.Vector3();
  let floorId = 42;
  let floorBusy = false;
  let ceoOn = false;
  let walkOn = false;
  const walker = { x: -2.2, z: 9.2, yaw: Math.PI, pitch: 0.12 };
  let bird = false;
  let lastGreet = "";
  let confettiT = 0;
  const joy = { x: 0, y: 0 };
  const held = {};
  const floorCard = document.getElementById("elevator-card");
  const birdButton = document.getElementById("btn-bird");
  const ceoButton = document.getElementById("btn-ceo");
  const exitButton = document.getElementById("btn-ceo-exit");
  const joystick = document.getElementById("joystick");
  const joystickKnob = document.getElementById("joystick-knob");
  const confettiDummy = new THREE.Object3D();
  const camGoal = new THREE.Vector3();
  const lookGoal = new THREE.Vector3();

  function blockedCell(x, z) {
    if (floorId === 42) {
      if (x < -9.6 || x > 9.6 || z < -7.6 || z > 12.7) return true;
      return !!office.pointBlocked(x, z);
    }
    const floor = extra.active(floorId);
    return floor ? !!floor.pointBlocked(x, z) : true;
  }

  let ride = null;
  let pendingFloor = 0;
  function commitFloor(next) {
    floorId = next;
    office.interior.visible = next === 42;
    extra.show(next);
    const floor = extra.active(next);
    if (crew.setActiveFloor) crew.setActiveFloor(next, floor ? floor.stations : null);
    else crew.setVisible(next === 42);
    staff.show(next);
    if (ceoOn) ceo.place(-1.2, next === 44 ? 2.2 : next === 0 ? 4.5 : 10.4);
    if (walkOn) {
      walker.x = -1.2;
      walker.z = next === 44 ? 2.2 : next === 0 ? 4.5 : 10.4;
    }
    document.querySelectorAll("#floor-switch button").forEach((button) => {
      button.setAttribute("aria-pressed", Number(button.dataset.floor) === next ? "true" : "false");
    });
  }
  function setFloor(id) {
    const next = Number(id);
    if ([0, 41, 42, 43, 44].indexOf(next) < 0 || next === floorId) return;
    if (floorBusy) {
      if (ride && !ride.swapped) ride.next = next;
      else pendingFloor = next;
      return;
    }
    floorBusy = true;
    const names = { 0: "Lobby", 41: "Sales floor", 42: "Luke's Bot HQ", 43: "Innovation lab", 44: "Penthouse" };
    if (floorCard) {
      floorCard.hidden = false;
      floorCard.textContent = (next === 0 ? "G" : next === 44 ? "PH" : "Floor " + next) + " · " + names[next];
    }
    if (reduce) {
      commitFloor(next);
      floorBusy = false;
      if (floorCard) floorCard.hidden = true;
      return;
    }
    ride = {
      t: 0,
      next: next,
      swapped: false,
      from: camera.position.clone(),
      fromT: controls.target.clone(),
    };
  }
  function stepRide(dt) {
    if (!ride) return;
    ride.t += dt;
    const k = Math.min(1, ride.t / 1.15);
    const dip = Math.sin(k * Math.PI);
    camera.position.copy(ride.from);
    camera.position.y = Math.max(2.2, ride.from.y - dip * Math.min(8, ride.from.y * 0.45));
    controls.target.copy(ride.fromT);
    camera.lookAt(controls.target);
    if (k >= 0.45 && !ride.swapped) {
      ride.swapped = true;
      commitFloor(ride.next);
    }
    if (k >= 1) {
      ride = null;
      floorBusy = false;
      window.setTimeout(() => { if (floorCard) floorCard.hidden = true; }, 280);
      if (pendingFloor && pendingFloor !== floorId) {
        const queued = pendingFloor;
        pendingFloor = 0;
        setFloor(queued);
      }
      if (!ceoOn && !bird) {
        const home = homeView();
        tween = {
          t: 0,
          fromPos: camera.position.clone(),
          toPos: new THREE.Vector3(home.pos[0], home.pos[1], home.pos[2]),
          fromTgt: controls.target.clone(),
          toTgt: new THREE.Vector3(home.target[0], home.target[1], home.target[2]),
          fromFov: camera.fov,
          toFov: home.fov,
        };
      }
    }
  }

  function setBird(on) {
    if (on) {
      if (ceoOn) stopCeo();
      if (tour || tourArm) stopTour();
      bird = true;
      tween = {
        t: 0,
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(0.2, 26, 1.1),
        fromTgt: controls.target.clone(),
        toTgt: new THREE.Vector3(0, 0, 1),
        fromFov: camera.fov,
        toFov: camera.fov,
      };
      controls.minPolarAngle = 0.02;
      controls.maxPolarAngle = 0.32;
    } else {
      bird = false;
      controls.minPolarAngle = 0.08;
      controls.maxPolarAngle = Math.PI / 2 - 0.08;
      const home = homeView();
      tween = {
        t: 0,
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(home.pos[0], home.pos[1], home.pos[2]),
        fromTgt: controls.target.clone(),
        toTgt: new THREE.Vector3(home.target[0], home.target[1], home.target[2]),
        fromFov: camera.fov,
        toFov: home.fov,
      };
    }
    if (birdButton) birdButton.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function syncCeoUi() {
    if (ceoButton) ceoButton.setAttribute("aria-pressed", ceoOn ? "true" : "false");
    if (exitButton) exitButton.hidden = !ceoOn;
    if (joystick) joystick.hidden = !ceoOn;
    document.body.classList.toggle("is-ceo", ceoOn);
  }

  function stopCeo(skipHome) {
    if (!ceoOn) return;
    ceoOn = false;
    joy.x = 0;
    joy.y = 0;
    ceo.hide();
    controls.enabled = true;
    syncCeoUi();
    if (!bird && !skipHome) frameHome();
  }

  function startCeo() {
    if (walkOn) {
      walkOn = false;
      if (walkButton) walkButton.setAttribute("aria-pressed", "false");
    }
    if (intro) endIntro(false);
    if (tour || tourArm) stopTour();
    if (bird) setBird(false);
    stopFollow();
    ceoOn = true;
    controls.enabled = false;
    ceo.place(ceo.state.x, ceo.state.z);
    ceo.group.visible = true;
    syncCeoUi();
  }

  function stickWorld() {
    let ix = joy.x;
    let iy = joy.y;
    if (held.KeyW || held.ArrowUp) iy += 1;
    if (held.KeyS || held.ArrowDown) iy -= 1;
    if (held.KeyD || held.ArrowRight) ix += 1;
    if (held.KeyA || held.ArrowLeft) ix -= 1;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward);
    return {
      x: right.x * ix + forward.x * iy,
      z: right.z * ix + forward.z * iy,
    };
  }

  function burstConfetti() {
    if (quality === "low") return;
    confettiT = 1.15;
    confetti.visible = true;
  }

  function stepConfetti(dt) {
    if (confettiT <= 0) {
      confetti.visible = false;
      return;
    }
    confettiT -= dt;
    const originX = ceo.state.x;
    const originZ = ceo.state.z;
    for (let i = 0; i < 16; i += 1) {
      const age = 1.15 - confettiT;
      const ang = (i / 16) * Math.PI * 2;
      confettiDummy.position.set(
        originX + Math.cos(ang) * (0.4 + age * 1.6),
        1.4 + Math.sin(i) * 0.4 + age * 1.1 - age * age * 1.4,
        originZ + Math.sin(ang) * (0.4 + age * 1.6)
      );
      confettiDummy.rotation.set(age * 4, ang, 0);
      confettiDummy.updateMatrix();
      confetti.setMatrixAt(i, confettiDummy.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;
  }

  document.querySelectorAll("#floor-switch button").forEach((button) => {
    button.addEventListener("click", () => setFloor(button.dataset.floor));
  });
  const menu = document.getElementById("hud-menu");
  const menuButton = document.getElementById("btn-menu");
  if (menuButton && menu) {
    menuButton.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  const soundButton = document.getElementById("btn-sound");
  function syncSound() {
    if (!soundButton) return;
    const off = audio.isMuted();
    soundButton.textContent = off ? "Sound off" : "Sound on";
    soundButton.setAttribute("aria-pressed", off ? "false" : "true");
  }
  syncSound();
  if (soundButton) soundButton.addEventListener("click", () => { audio.toggle(); syncSound(); });
  const qualityButton = document.getElementById("btn-quality");
  let qualityLock = null;
  function syncQualityButton() {
    if (!qualityButton) return;
    qualityButton.textContent = qualityLock === "low" ? "Quality low" : "Quality auto";
    qualityButton.setAttribute("aria-pressed", qualityLock === "low" ? "true" : "false");
  }
  if (qualityButton) {
    qualityButton.addEventListener("click", () => {
      qualityLock = qualityLock === "low" ? null : "low";
      quality = qualityLock === "low" ? "low" : "high";
      office.setQuality(quality);
      extra.setQuality(quality);
      sun.castShadow = quality === "high";
      renderer.shadowMap.enabled = quality === "high";
      resize();
      syncQualityButton();
    });
  }
  renderer.domElement.addEventListener("pointerdown", () => audio.unlock());
  if (birdButton) birdButton.addEventListener("click", () => setBird(!bird));
  if (ceoButton) ceoButton.addEventListener("click", () => { if (ceoOn) stopCeo(); else startCeo(); });
  if (exitButton) exitButton.addEventListener("click", () => stopCeo());
  const walkButton = document.getElementById("btn-walk");
  const help = document.getElementById("help");
  const HELP_KEY = "bothq-help-seen";
  function setHelp(open) {
    if (!help) return;
    help.hidden = !open;
    if (!open) localStorage.setItem(HELP_KEY, "1");
  }
  if (!debug && !localStorage.getItem(HELP_KEY)) setHelp(true);
  const helpClose = document.getElementById("help-close");
  if (helpClose) helpClose.addEventListener("click", () => setHelp(false));
  function startWalk() {
    if (intro) endIntro(false);
    if (tour || tourArm) stopTour();
    if (ceoOn) stopCeo(true);
    if (bird) setBird(false);
    walkOn = true;
    controls.enabled = false;
    if (joystick) joystick.hidden = false;
    if (walkButton) walkButton.setAttribute("aria-pressed", "true");
    if (exitButton) exitButton.hidden = false;
  }
  function stopWalk() {
    if (!walkOn) return;
    walkOn = false;
    joy.x = 0;
    joy.y = 0;
    controls.enabled = true;
    if (joystick && !ceoOn) joystick.hidden = true;
    if (walkButton) walkButton.setAttribute("aria-pressed", "false");
    if (exitButton && !ceoOn) exitButton.hidden = true;
    const home = homeView();
    tween = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(home.pos[0], home.pos[1], home.pos[2]),
      fromTgt: controls.target.clone(),
      toTgt: new THREE.Vector3(home.target[0], home.target[1], home.target[2]),
      fromFov: camera.fov,
      toFov: home.fov,
    };
  }
  if (walkButton) walkButton.addEventListener("click", () => { if (walkOn) stopWalk(); else startWalk(); });
  if (exitButton) {
    exitButton.addEventListener("click", () => {
      if (walkOn) stopWalk();
    });
  }
  let lookDrag = null;
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!walkOn || !lookDrag || event.pointerId !== lookDrag.id) return;
    walker.yaw -= (event.clientX - lookDrag.x) * 0.005;
    walker.pitch = Math.max(-0.7, Math.min(0.9, walker.pitch - (event.clientY - lookDrag.y) * 0.004));
    lookDrag.x = event.clientX;
    lookDrag.y = event.clientY;
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    if (lookDrag && event.pointerId === lookDrag.id) lookDrag = null;
  });
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (walkOn && event.button === 0) lookDrag = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  renderer.domElement.addEventListener("wheel", (event) => {
    if (!walkOn) return;
    walker.pitch = Math.max(-0.7, Math.min(0.9, walker.pitch - Math.sign(event.deltaY) * 0.06));
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    held[event.code] = true;
    const floors = { Digit0: 0, Numpad0: 0, KeyG: 0, Digit1: 41, Numpad1: 41, Digit2: 42, Numpad2: 42, Digit3: 43, Numpad3: 43, Digit4: 44, Numpad4: 44, KeyP: 44 };
    if (!event.metaKey && !event.ctrlKey && floors[event.code] !== undefined) {
      setFloor(floors[event.code]);
      event.preventDefault();
    }
    if (event.key === "?" || event.key === "h" || event.key === "H") setHelp(help ? help.hidden : true);
    if ((ceoOn || walkOn) && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.code) >= 0) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => { held[event.code] = false; });

  function joyPoint(event) {
    if (!joystick) return;
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (event.clientX - cx) / (rect.width * 0.42);
    let dy = -((event.clientY - cy) / (rect.height * 0.42));
    const len = Math.hypot(dx, dy) || 1;
    if (len > 1) { dx /= len; dy /= len; }
    joy.x = dx;
    joy.y = dy;
    if (joystickKnob) joystickKnob.style.transform = "translate(" + (dx * 28) + "px, " + (-dy * 28) + "px)";
  }
  if (joystick) {
    joystick.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      event.preventDefault();
      joystick.setPointerCapture(event.pointerId);
      joyPoint(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (!joystick.hasPointerCapture(event.pointerId)) return;
      event.stopPropagation();
      joyPoint(event);
    });
    const release = (event) => {
      joy.x = 0;
      joy.y = 0;
      if (joystickKnob) joystickKnob.style.transform = "translate(0, 0)";
      if (event) event.stopPropagation();
    };
    joystick.addEventListener("pointerup", release);
    joystick.addEventListener("pointercancel", release);
  }

  let announced = false;
  let frames = 0;
  let fpsAccum = 0;

  function tick() {
    const raw = clock.getDelta();
    // Cap the simulation step so a tab hitch cannot fling a bot across the room.
    // The camera reset uses the real elapsed time so it still finishes.
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    // Drop pixel ratio if the frame time stays over ~40ms. The first second is ignored
    // so a slow startup does not immediately switch the whole office to low quality.
    if (t > 1.2 && raw < 0.5) {
      if (raw > 0.04) {
        slowTime += raw;
        smoothTime = 0;
      } else {
        smoothTime += raw;
        slowTime = Math.max(0, slowTime - raw);
      }
      if (quality === "high" && slowTime > 1.6) {
        quality = "low";
        office.setQuality("low");
        extra.setQuality("low");
        staff.setQuality("low");
        sun.castShadow = false;
        renderer.shadowMap.enabled = false;
        if (intro) endIntro(false);
        resize();
      } else if (quality === "low" && qualityLock !== "low" && smoothTime > 2.5) {
        quality = "high";
        office.setQuality("high");
        extra.setQuality("high");
        staff.setQuality("high");
        sun.castShadow = true;
        renderer.shadowMap.enabled = true;
        slowTime = 0;
        resize();
      }
    }
    office.update(t);
    extra.update(t);
    crew.update(dt, t);
    staff.update(t);
    audio.update(dt);
    applyTimeOfDay(t);
    if (ceoOn) {
      const move = stickWorld();
      ceo.update(dt, move, blockedCell);
      const fromBots = crew.greet(ceo.state.x, ceo.state.z, t);
      const fromStaff = staff.greet(ceo.state.x, ceo.state.z, t, floorId, dt);
      if (fromBots.phrase) lastGreet = fromBots.phrase;
      if (fromStaff.phrase) lastGreet = fromStaff.phrase;
      if (fromBots.cheer || fromStaff.cheer) burstConfetti();
      stepConfetti(dt);
      camGoal.set(
        ceo.state.x - Math.sin(ceo.state.yaw) * 5.6,
        4.6,
        ceo.state.z - Math.cos(ceo.state.yaw) * 5.6
      );
      lookGoal.set(ceo.state.x, 1.05, ceo.state.z);
      camera.position.lerp(camGoal, 0.18);
      controls.target.lerp(lookGoal, 0.22);
      camera.lookAt(controls.target);
    } else {
      stepConfetti(dt);
    }
    controls.enabled = !ceoOn && !walkOn;
    if (walkOn && !ride && !ceoOn) {
      let ix = joy.x;
      let iz = joy.y;
      if (held.KeyW || held.ArrowUp) iz += 1;
      if (held.KeyS || held.ArrowDown) iz -= 1;
      if (held.KeyD || held.ArrowRight) ix += 1;
      if (held.KeyA || held.ArrowLeft) ix -= 1;
      const fx = Math.sin(walker.yaw);
      const fz = Math.cos(walker.yaw);
      const mx = fx * iz + fz * ix;
      const mz = fz * iz - fx * ix;
      const len = Math.hypot(mx, mz);
      if (len > 0.05) {
        const step = Math.min(3.1 * dt, 0.45);
        const nx = walker.x + (mx / len) * step;
        const nz = walker.z + (mz / len) * step;
        if (!blockedCell(nx, nz)) {
          walker.x = nx;
          walker.z = nz;
        } else if (!blockedCell(nx, walker.z)) walker.x = nx;
        else if (!blockedCell(walker.x, nz)) walker.z = nz;
      }
      const cp = Math.cos(walker.pitch);
      camera.position.set(walker.x, 1.62, walker.z);
      controls.target.set(
        walker.x + Math.sin(walker.yaw) * cp,
        1.62 + Math.sin(walker.pitch),
        walker.z + Math.cos(walker.yaw) * cp
      );
      camera.lookAt(controls.target);
    }

    if (ride) {
      stepRide(dt);
    } else if (walkOn) {
      // Camera was placed above. Orbit stays off until Exit.
    } else if (intro) {
      intro.t += Math.min(raw, 0.05);
      // Hold on the exterior sign, then glide up to the floor.
      const hold = 0.75;
      const move = 1.65;
      const k = intro.t <= hold ? 0 : smoothstep(Math.min(1, (intro.t - hold) / move));
      camera.position.lerpVectors(intro.fromPos, intro.toPos, k);
      controls.target.lerpVectors(intro.fromTgt, intro.toTgt, k);
      camera.lookAt(controls.target);
      if (intro.t >= hold + move) endIntro(true);
    } else if (tour) {
      stepTour(raw);
    } else if (tween) {
      tween.t += raw / 0.7;
      const k = smoothstep(Math.min(1, tween.t));
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k);
      camera.lookAt(controls.target);
      camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * k;
      camera.updateProjectionMatrix();
      if (tween.t >= 1) {
        camera.position.copy(tween.toPos);
        controls.target.copy(tween.toTgt);
        camera.fov = tween.toFov;
        camera.updateProjectionMatrix();
        // Burn off leftover orbit momentum without letting it move the camera.
        for (let i = 0; i < 80; i += 1) {
          controls.update();
          camera.position.copy(tween.toPos);
          controls.target.copy(tween.toTgt);
        }
        tween = null;
      }
    } else if (followId) {
      const bot = crew.get(followId);
      if (!bot) {
        stopFollow();
      } else {
        focus.set(bot.group.position.x, 1.05, bot.group.position.z);
        followDelta.subVectors(focus, controls.target);
        controls.target.add(followDelta);
        camera.position.add(followDelta);
        if (pullDist) {
          const offset = camera.position.clone().sub(controls.target);
          const dist = offset.length();
          const next = THREE.MathUtils.damp(dist, pullDist, 2.6, dt);
          if (Math.abs(next - pullDist) < 0.08) pullDist = 0;
          offset.setLength(Math.max(next, 0.2));
          camera.position.copy(controls.target).add(offset);
        }
      }
    }

    if (!tween && !intro && !tour && !ceoOn && !bird) controls.update();
    // The opening shot and the tour look outside the orbit box.
    if (!intro && !tour && !ceoOn && !bird) clampTarget();

    const selected = window.BotHQ ? window.BotHQ.selectedId : null;
    const selectedBot = selected ? crew.get(selected) : null;
    if (selectedBot) {
      ring.visible = true;
      ring.position.x = selectedBot.group.position.x;
      ring.position.z = selectedBot.group.position.z;
      ring.material.color.set(selectedBot.accent);
      ring.material.opacity = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
    } else {
      ring.visible = false;
    }

    updateLabels(t);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);

    if (debugEl) {
      frames += 1;
      fpsAccum += dt;
      if (fpsAccum > 0.4) {
        const fps = frames / fpsAccum;
        debugEl.textContent =
          fps.toFixed(0) +
          " fps · " +
          renderer.info.render.calls +
          " draws · " +
          renderer.info.render.triangles +
          " tris · paths " +
          (office.pathsOk ? "ok" : "BROKEN") +
          " · " +
          quality;
        frames = 0;
        fpsAccum = 0;
      }
    }

    if (!announced) {
      announced = true;
      hideLoading();
      window.__HQ_READY__ = true;
      window.__HQ_SETTLED__ = true;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else renderer.setAnimationLoop(tick);
  });

  window.__HQ = {
    ready: true,
    pathsOk: office.pathsOk,
    pathErrors: office.pathErrors,
    stats: function () {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        pathsOk: office.pathsOk,
        pathErrors: office.pathErrors,
        quality: quality,
      };
    },
    bots: function () {
      return crew.snapshot();
    },
    blocked: function (x, z) {
      return office.pointBlocked(x, z);
    },
    screenPos: function (id) {
      const bot = crew.get(id);
      if (!bot) return null;
      project.copy(bot.group.position);
      project.y += 1.05;
      project.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + (project.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-project.y * 0.5 + 0.5) * rect.height,
        behind: project.z > 1,
      };
    },
    isFollowing: function () {
      return followId;
    },
    isIntro: function () {
      return !!intro;
    },
    isTour: function () {
      return !!tour;
    },
    floor: function () {
      return floorId;
    },
    setFloor: function (id) {
      setFloor(id);
    },
    bird: function (on) {
      setBird(on !== false);
      return bird;
    },
    isBird: function () {
      return bird;
    },
    playCeo: function (on) {
      if (on === false) stopCeo();
      else startCeo();
      return ceoOn;
    },
    isCeo: function () {
      return ceoOn;
    },
    setStick: function (x, y) {
      joy.x = x;
      joy.y = y;
    },
    ceoPos: function () {
      return { x: ceo.state.x, z: ceo.state.z, yaw: ceo.state.yaw };
    },
    placeCeo: function (x, z) {
      ceo.place(x, z);
    },
    lastGreet: function () {
      return lastGreet || crew.lastPhrase();
    },
    camera: function () {
      return {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        tx: controls.target.x,
        ty: controls.target.y,
        tz: controls.target.z,
      };
    },
  };

  renderer.setAnimationLoop(tick);
}

async function boot() {
  const api = await waitForRoster();
  if (!api || api.error || !api.bots || !api.bots.length) {
    showFallback(api && api.error ? api.error : "Could not load status.json.");
    return;
  }
  if (!hasWebGL()) {
    showFallback("This browser can't draw the 3D office. The roster still lists every bot.");
    return;
  }
  try {
    startScene(api.bots);
  } catch (err) {
    console.error(err);
    showFallback("The 3D office couldn't start. The roster still lists every bot.");
  }
}

window.setTimeout(() => {
  if (!window.__HQ_SETTLED__) {
    showFallback("The 3D office is taking too long. Check your connection and refresh. The roster still lists every bot.");
  }
}, 18000);

boot();
