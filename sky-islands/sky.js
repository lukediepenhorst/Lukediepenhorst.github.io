import * as THREE from "three";

const coarse = matchMedia("(pointer: coarse)").matches;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const note = document.getElementById("controls-note");
note.textContent = coarse
  ? "Drag the joystick to fly. Boost is the button beside it. Pinch is not used."
  : "WASD or arrows fly. Space boosts. Drag looks, scroll is unused.";

const renderer = new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById("view").appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec8ef);
scene.fog = new THREE.Fog(0x8ec8ef, 30, 120);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6aa0c8, 1.1));
const sun = new THREE.DirectionalLight(0xfff8ee, 1.2);
sun.position.set(20, 30, 10);
scene.add(sun);

const islands = [
  [0, 0, 0, 6], [14, 2, -8, 4], [-12, 4, -6, 3.5], [8, -2, 16, 4.5],
  [-16, 6, 12, 3], [20, 3, 6, 3.2], [0, 8, -18, 5], [-6, -3, 18, 3],
];
const rock = new THREE.MeshLambertMaterial({ color: 0x8d7358 });
const grass = new THREE.MeshLambertMaterial({ color: 0x6fbf6a });
islands.forEach((spec) => {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(spec[3] * 0.7, spec[3], 2.2, coarse ? 6 : 8), rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(spec[3], spec[3] * 0.92, 0.5, coarse ? 6 : 8), grass);
  top.position.y = 1.2;
  g.add(base, top);
  g.position.set(spec[0], spec[1], spec[2]);
  scene.add(g);
});

const crystalGeo = new THREE.OctahedronGeometry(0.35, 0);
const crystalMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, 8);
const crystalPos = [];
for (let i = 0; i < 8; i += 1) {
  const island = islands[i];
  const p = new THREE.Vector3(island[0] + 1.2, island[1] + 2.4, island[2] + 0.4);
  crystalPos.push(p);
  const dummy = new THREE.Object3D();
  dummy.position.copy(p);
  dummy.updateMatrix();
  crystals.setMatrixAt(i, dummy.matrix);
}
scene.add(crystals);
const rings = [];
[[6, 3, -4], [-8, 6, 4], [16, 1, 10], [2, 9, -12]].forEach((p) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.08, 6, coarse ? 10 : 16),
    new THREE.MeshBasicMaterial({ color: 0xffb15a })
  );
  ring.position.set(p[0], p[1], p[2]);
  scene.add(ring);
  rings.push(ring);
});

const glider = new THREE.Group();
const body = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0xf4f7fb }));
body.rotation.x = Math.PI / 2;
const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.45), new THREE.MeshLambertMaterial({ color: 0x3d7ec7 }));
wing.position.z = 0.1;
glider.add(body, wing);
glider.position.set(0, 3, 6);
scene.add(glider);

let playing = false;
let won = false;
let crystalsLeft = crystalPos.map(() => true);
let got = 0;
let ringsLeft = rings.map(() => true);
let clock = 0;
const vel = new THREE.Vector3();
const keys = {};
const joy = { x: 0, y: 0 };
let boosting = false;
let yaw = 0;
let quality = "high";
let slow = 0;

let audioCtx = null;
let muted = true;
function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function chime(freq) {
  if (!audioCtx || muted) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.value = freq;
  o.type = "sine";
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.26);
}

function format(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ":" + String(s).padStart(2, "0");
}
function refreshHud() {
  document.getElementById("score").textContent = "Crystals " + got + " / 8";
  document.getElementById("time").textContent = format(clock);
}
function finish(title) {
  playing = false;
  won = true;
  document.getElementById("end-title").textContent = title;
  document.getElementById("end-copy").textContent = "Time " + format(clock) + ". Crystals " + got + " / 8.";
  document.getElementById("end").hidden = false;
}
function reset() {
  glider.position.set(0, 3, 6);
  vel.set(0, 0, 0);
  yaw = 0;
  got = 0;
  clock = 0;
  crystalsLeft = crystalPos.map(() => true);
  ringsLeft = rings.map(() => true);
  won = false;
  refreshHud();
  document.getElementById("end").hidden = true;
}

addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "Space") { boosting = true; e.preventDefault(); } });
addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Space") boosting = false; });
const stick = document.getElementById("stick");
const knob = document.getElementById("knob");
function joyAt(e) {
  const r = stick.getBoundingClientRect();
  let x = (e.clientX - (r.left + r.width / 2)) / 40;
  let y = -((e.clientY - (r.top + r.height / 2)) / 40);
  const len = Math.hypot(x, y) || 1;
  if (len > 1) { x /= len; y /= len; }
  joy.x = x;
  joy.y = y;
  knob.style.transform = "translate(" + x * 24 + "px," + (-y * 24) + "px)";
}
stick.addEventListener("pointerdown", (e) => { stick.setPointerCapture(e.pointerId); joyAt(e); });
stick.addEventListener("pointermove", (e) => { if (stick.hasPointerCapture(e.pointerId)) joyAt(e); });
function joyUp() { joy.x = 0; joy.y = 0; knob.style.transform = "translate(0,0)"; }
stick.addEventListener("pointerup", joyUp);
stick.addEventListener("pointercancel", joyUp);
document.getElementById("boost").addEventListener("pointerdown", () => { boosting = true; });
document.getElementById("boost").addEventListener("pointerup", () => { boosting = false; });
if (coarse) { stick.hidden = false; document.getElementById("boost").hidden = false; }

document.getElementById("play").addEventListener("click", () => {
  unlock();
  document.getElementById("title").hidden = true;
  reset();
  playing = true;
});
document.getElementById("replay").addEventListener("click", () => {
  unlock();
  reset();
  playing = true;
});
document.getElementById("mute").addEventListener("click", () => {
  unlock();
  muted = !muted;
  const button = document.getElementById("mute");
  button.textContent = muted ? "Sound off" : "Sound on";
  button.setAttribute("aria-pressed", muted ? "true" : "false");
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock3 = new THREE.Clock();
const dummy = new THREE.Object3D();
function frame() {
  const dt = Math.min(clock3.getDelta(), 0.05);
  if (!reduce && playing) {
    if (dt > 0.04) slow += dt;
    else slow = Math.max(0, slow - dt);
    if (quality === "high" && slow > 1.4) {
      quality = "low";
      renderer.setPixelRatio(1);
    }
  }
  if (playing && !won) {
    clock += dt;
    let turn = joy.x;
    let climb = joy.y;
    if (keys.KeyA || keys.ArrowLeft) turn -= 1;
    if (keys.KeyD || keys.ArrowRight) turn += 1;
    if (keys.KeyW || keys.ArrowUp) climb += 1;
    if (keys.KeyS || keys.ArrowDown) climb -= 1;
    yaw -= turn * dt * 1.4;
    const speed = (boosting ? 14 : 7);
    vel.x = Math.sin(yaw) * speed;
    vel.z = Math.cos(yaw) * speed;
    vel.y = climb * 6;
    glider.position.addScaledVector(vel, dt);
    glider.position.y = Math.max(-6, Math.min(16, glider.position.y));
    glider.rotation.y = yaw;
    crystalPos.forEach((p, i) => {
      if (!crystalsLeft[i]) return;
      dummy.position.copy(p);
      dummy.position.y += Math.sin(clock * 2 + i) * 0.15;
      dummy.rotation.y = clock;
      dummy.updateMatrix();
      crystals.setMatrixAt(i, dummy.matrix);
      if (glider.position.distanceTo(p) < 1.3) {
        crystalsLeft[i] = false;
        got += 1;
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        crystals.setMatrixAt(i, dummy.matrix);
        chime(660);
        refreshHud();
        if (got >= 8) finish("All crystals");
      }
    });
    crystals.instanceMatrix.needsUpdate = true;
    rings.forEach((ring, i) => {
      ring.rotation.y += dt;
      if (ringsLeft[i] && glider.position.distanceTo(ring.position) < 1.5) {
        ringsLeft[i] = false;
        ring.material.color.set(0x9dffb0);
        chime(520);
      }
    });
    refreshHud();
  }
  const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  camera.position.copy(glider.position).addScaledVector(back, -7);
  camera.position.y += 2.4;
  camera.lookAt(glider.position);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
