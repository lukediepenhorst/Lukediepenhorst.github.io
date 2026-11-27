import * as THREE from "three";

/*
  Extra people who are not in the roster. One instanced body and one instanced
  head cover every floor. Low quality hides them.
*/

const GREETINGS = [
  "Hey boss!",
  "Great call, boss",
  "Thanks for the direction, Luke",
  "On it, Luke!",
  "Morning, CEO!",
];

const PEOPLE = [
  { floor: 42, x: 4.7, z: -4.15, sit: true, face: Math.PI },
  { floor: 42, x: 7.8, z: -4.15, sit: true, face: Math.PI },
  { floor: 42, x: 8.5, z: -6.4, sit: false, present: true, face: -Math.PI / 2 },
  { floor: 41, x: -1.1, z: -4.15, sit: true, face: Math.PI },
  { floor: 41, x: 1.1, z: -4.15, sit: true, face: Math.PI },
  { floor: 41, x: 0, z: -6.5, sit: false, present: true, face: 0 },
  { floor: 43, x: -5.2, z: 1.7, sit: true, face: 0 },
  { floor: 43, x: 6.2, z: -5.6, sit: false, present: true, face: Math.PI },
];

export function createStaff(scene) {
  const count = PEOPLE.length;
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3c4654, flatShading: true });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xe7c7a8, flatShading: true });
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), bodyMat, count);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), headMat, count);
  bodies.frustumCulled = false;
  heads.frustumCulled = false;
  bodies.raycast = function () {};
  heads.raycast = function () {};
  scene.add(bodies, heads);

  const people = PEOPLE.map((p) => ({
    floor: p.floor,
    x: p.x,
    z: p.z,
    sit: p.sit,
    present: !!p.present,
    face: p.face,
    wave: 0,
    greetYaw: p.face,
    cool: 0,
    phrase: "",
  }));

  const dummy = new THREE.Object3D();
  let shown = 42;
  let quality = "high";
  let phrase = "";
  let cheer = false;
  const cheerRooms = {
    42: { x0: 1.2, z0: -7.8, x1: 9.6, z1: -2.6 },
    41: { x0: -3.2, z0: -7.2, x1: 3.2, z1: -3.4 },
    43: { x0: 4.2, z0: -7.4, x1: 8.4, z1: -3.6 },
  };
  let cheering = false;

  function write(time) {
    const visible = quality !== "low";
    bodies.visible = visible;
    heads.visible = visible;
    if (!visible) return;
    for (let i = 0; i < people.length; i += 1) {
      const p = people[i];
      const here = p.floor === shown;
      const y = p.sit && p.wave <= 0 ? 0.55 : 0.78;
      const bob = p.present ? Math.sin(time * 2.2 + i) * 0.03 : 0;
      dummy.position.set(here ? p.x : 0, here ? y + bob : -20, here ? p.z : 0);
      dummy.rotation.set(0, p.wave > 0 ? p.greetYaw : p.face, 0);
      dummy.scale.set(here ? 1 : 0, 1, 1);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 0.48;
      dummy.rotation.z = p.wave > 0 ? Math.sin(time * 8) * 0.25 : p.present ? Math.sin(time * 1.6) * 0.08 : 0;
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  }

  function show(floor) {
    shown = floor;
    cheering = false;
  }

  function setQuality(level) {
    quality = level;
  }

  function greet(x, z, time, floor, dt) {
    phrase = "";
    cheer = false;
    const step = dt || 0.016;
    if (quality === "low" || floor !== shown) return { phrase: "", cheer: false };
    const room = cheerRooms[floor];
    const inside = room && x > room.x0 && x < room.x1 && z > room.z0 && z < room.z1;
    if (inside && !cheering) {
      cheering = true;
      cheer = true;
      people.forEach((p) => {
        if (p.floor !== floor) return;
        const near = Math.hypot(p.x - x, p.z - z) < 6 || inside;
        if (!near) return;
        p.wave = 1.8;
        p.greetYaw = Math.atan2(x - p.x, z - p.z);
        p.phrase = "Woo!";
      });
      phrase = "Woo!";
    }
    if (!inside) cheering = false;
    for (let i = 0; i < people.length; i += 1) {
      const p = people[i];
      if (p.floor !== floor) continue;
      if (p.wave > 0) p.wave = Math.max(0, p.wave - step);
      const dist = Math.hypot(p.x - x, p.z - z);
      if (dist < 2.4 && time > p.cool) {
        p.cool = time + 9;
        p.wave = 1.5;
        p.greetYaw = Math.atan2(x - p.x, z - p.z);
        p.phrase = GREETINGS[i % GREETINGS.length];
        phrase = p.phrase;
      }
    }
    return { phrase: phrase, cheer: cheer };
  }

  return { show: show, setQuality: setQuality, greet: greet, update: write, people: people };
}
