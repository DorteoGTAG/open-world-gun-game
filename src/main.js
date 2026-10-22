import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8da1ad);
scene.fog = new THREE.Fog(0x8da1ad, 35, 180);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 20, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ui = {
  cash: document.getElementById('cash'),
  health: document.getElementById('health'),
  weapon: document.getElementById('weapon'),
  carStatus: document.getElementById('car-status'),
  message: document.getElementById('message-box'),
};

const world = new THREE.Group();
scene.add(world);

const keys = {};
const clock = new THREE.Clock();

const state = {
  cash: 150,
  health: 100,
  weaponIndex: 0,
  inCar: false,
  messageTimer: 0,
  lastShot: 0,
  shotCooldown: 0.35,
  carSpeed: 0,
  carSteer: 0,
};

const weapons = [
  { name: 'Pistol', damage: 20, cooldown: 0.35 },
  { name: 'SMG', damage: 12, cooldown: 0.18 },
  { name: 'Shotgun', damage: 34, cooldown: 0.8 },
];

const cityColor = new THREE.Color(0x223344);

function setMessage(text, duration = 2.25) {
  ui.message.textContent = text;
  state.messageTimer = duration;
}

function updateHUD() {
  ui.cash.textContent = `$${state.cash}`;
  ui.health.textContent = `${Math.max(0, Math.round(state.health))}`;
  ui.weapon.textContent = weapons[state.weaponIndex].name;
  ui.carStatus.textContent = state.inCar ? 'Driving' : 'Away';
}

function createGround() {
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x2d6b30, roughness: 0.95 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0;
  world.add(base);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x30343b, roughness: 0.8 });
  const roadData = [
    [0, 0, 100, 12],
    [0, 0, 12, 100],
    [0, -38, 110, 12],
    [0, 38, 110, 12],
    [-38, 0, 12, 110],
    [38, 0, 12, 110],
  ];

  roadData.forEach(([x, z, w, d]) => {
    const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), roadMat);
    road.position.set(x, 0.05, z);
    world.add(road);
  });

  const lane = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.06, 100),
    new THREE.MeshStandardMaterial({ color: 0xf6e16a })
  );
  lane.position.set(0, 0.1, 0);
  world.add(lane);
}

function addBuilding(x, z, w, d, h, color = 0x9aa7b6) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function createCity() {
  const colors = [0x9ec3dd, 0x8ab7cf, 0xc4b0c7, 0xd9b690, 0x9bb59b, 0xbaa2d4];

  for (let i = -5; i <= 5; i++) {
    addBuilding(i * 14, 26, 10, 10, 12 + (i % 4) * 5, colors[(i + 3) % colors.length]);
    addBuilding(i * 14, -26, 10, 10, 10 + (i % 3) * 6, colors[(i + 5) % colors.length]);
  }

  addBuilding(-32, -40, 16, 16, 22, 0xc38d6b);
  addBuilding(32, -40, 18, 18, 18, 0x718ca7);
  addBuilding(-32, 40, 18, 18, 20, 0x6f7ac8);
  addBuilding(32, 40, 18, 18, 24, 0xbba168);

  const casino = new THREE.Mesh(
    new THREE.BoxGeometry(20, 10, 18),
    new THREE.MeshStandardMaterial({ color: 0x43208b, emissive: 0x180730, roughness: 0.75 })
  );
  casino.position.set(0, 5, -44);
  world.add(casino);

  const casinoSign = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffd85a, emissive: 0x734d00 })
  );
  casinoSign.position.set(0, 11.5, -44.9);
  world.add(casinoSign);

  const gunStore = new THREE.Mesh(
    new THREE.BoxGeometry(18, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85, metalness: 0.35 })
  );
  gunStore.position.set(0, 4, 44);
  world.add(gunStore);

  const gunSign = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xd94444, emissive: 0x4d0000 })
  );
  gunSign.position.set(0, 9.5, 44.9);
  world.add(gunSign);
}

function createPlayer() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.8, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x2e8af1 })
  );
  body.position.y = 1.6;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xf3d0a8 })
  );
  head.position.y = 3.0;
  group.add(head);

  group.position.set(0, 0, 0);
  world.add(group);
  return group;
}

function createCar() {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 1.3, 2),
    new THREE.MeshStandardMaterial({ color: 0xd62d2d, metalness: 0.4, roughness: 0.45 })
  );
  body.position.y = 1.2;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1.1, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x303a45, metalness: 0.35, roughness: 0.3 })
  );
  cabin.position.set(0.1, 2.0, 0);
  car.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.5, 18);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.8 });
  const wheelPositions = [
    [-1.25, 0.5, 1.2],
    [1.25, 0.5, 1.2],
    [-1.25, 0.5, -1.2],
    [1.25, 0.5, -1.2],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    car.add(wheel);
  });

  car.position.set(10, 0, 18);
  world.add(car);
  return car;
}

const player = createPlayer();
const car = createCar();

function createPickup(x, z, value) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.32, 18),
    new THREE.MeshStandardMaterial({ color: 0x5fe96d, emissive: 0x0c3e17, roughness: 0.45 })
  );
  mesh.position.set(x, 1.1, z);
  mesh.rotation.x = Math.PI / 2;
  world.add(mesh);
  mesh.userData = { value };
  return mesh;
}

const pickups = [
  createPickup(-22, -10, 80),
  createPickup(18, 14, 120),
  createPickup(-15, 30, 90),
  createPickup(30, -18, 130),
  createPickup(0, 0, 100),
  createPickup(-30, 42, 160),
  createPickup(22, 42, 180),
  createPickup(0, -52, 220),
];

function createEnemy(x, z) {
  const enemy = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.8, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xe74c3c })
  );
  body.position.y = 1.5;
  enemy.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xf0d2b0 })
  );
  head.position.y = 2.85;
  enemy.add(head);

  enemy.position.set(x, 0, z);
  enemy.userData = { hp: 50, speed: 2.3 + Math.random() * 1.5 };
  world.add(enemy);
  return enemy;
}

const enemies = [
  createEnemy(-18, 12),
  createEnemy(18, 28),
  createEnemy(-28, -18),
  createEnemy(28, -18),
  createEnemy(0, 32),
];

function getActorPosition() {
  return state.inCar ? car.position.clone() : player.position.clone();
}

function getActorForward() {
  if (state.inCar) return new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
  return new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));
}

function attemptInteract() {
  const pos = getActorPosition();

  if (pos.distanceTo(car.position) < 6 && !state.inCar) {
    state.inCar = true;
    player.visible = false;
    setMessage('You got in the car.');
    return;
  }

  if (pos.distanceTo(car.position) < 6 && state.inCar) {
    state.inCar = false;
    player.visible = true;
    player.position.copy(car.position);
    player.position.y = 0;
    setMessage('You left the car.');
    return;
  }

  const casinoPos = new THREE.Vector3(0, 0, -44);
  const gunPos = new THREE.Vector3(0, 0, 44);

  if (pos.distanceTo(casinoPos) < 16) {
    if (state.cash >= 50) {
      const payout = Math.random() < 0.5 ? 140 : -80;
      state.cash += payout;
      setMessage(payout >= 0 ? `Casino win! +$${payout}` : `Casino loss: -$${Math.abs(payout)}`);
      if (state.cash < 0) state.cash = 0;
    } else {
      setMessage('Need $50 to gamble at the casino.');
    }
    return;
  }

  if (pos.distanceTo(gunPos) < 16) {
    if (state.cash >= 200) {
      state.cash -= 200;
      state.weaponIndex = Math.min(state.weaponIndex + 1, weapons.length - 1);
      setMessage(`Bought ${weapons[state.weaponIndex].name}!`);
    } else {
      setMessage('Gun store: $200 for the next weapon.');
    }
    return;
  }

  setMessage('Nothing nearby to use.');
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (key === 'e') {
    attemptInteract();
  }

  if (key === 'f') {
    attemptInteract();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener('pointerdown', () => {
  const now = performance.now();
  const weapon = weapons[state.weaponIndex];
  if (now - state.lastShot < weapon.cooldown * 1000) return;
  state.lastShot = now;

  let origin = player.position.clone().add(new THREE.Vector3(0, 2, 0));
  let dir = getActorForward();
  if (state.inCar) {
    origin = car.position.clone().add(new THREE.Vector3(0, 1.8, 0));
  }

  const particles = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshStandardMaterial({ color: weapon.name === 'Pistol' ? 0x8fe3ff : weapon.name === 'SMG' ? 0x7bffb4 : 0xffd27a })
  );
  particles.position.copy(origin.clone().add(dir.clone().multiplyScalar(1.3)));
  world.add(particles);
  setTimeout(() => world.remove(particles), 90);

  for (const enemy of enemies) {
    const distance = enemy.position.distanceTo(origin);
    if (distance < 25) {
      const dx = enemy.position.clone().sub(origin);
      const dot = dx.normalize().dot(dir);
      if (dot > 0.2) {
        enemy.userData.hp -= weapon.damage;
      }
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].userData.hp <= 0) {
      world.remove(enemies[i]);
      enemies.splice(i, 1);
      state.cash += 75;
      setMessage('Enemy down! +$75');
    }
  }
});

function updatePlayer(dt) {
  if (state.inCar) {
    const throttle = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
    const steer = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);

    state.carSpeed += throttle * 16 * dt;
    state.carSpeed *= 0.94;
    state.carSpeed = THREE.MathUtils.clamp(state.carSpeed, -12, 22);

    state.carSteer += steer * 1.5 * dt;
    state.carSteer *= 0.85;
    car.rotation.y += state.carSteer * dt * 2.4;

    car.position.x += Math.sin(car.rotation.y) * state.carSpeed * dt;
    car.position.z += Math.cos(car.rotation.y) * state.carSpeed * dt;
    car.position.x = THREE.MathUtils.clamp(car.position.x, -53, 53);
    car.position.z = THREE.MathUtils.clamp(car.position.z, -53, 53);

    const offset = new THREE.Vector3(-Math.sin(car.rotation.y) * 9, 8, -Math.cos(car.rotation.y) * 9);
    camera.position.lerp(car.position.clone().add(offset), 0.08);
    camera.lookAt(car.position.x, 1.5, car.position.z);
    return;
  }

  const move = new THREE.Vector3();
  if (keys['w']) move.z -= 1;
  if (keys['s']) move.z += 1;
  if (keys['a']) move.x -= 1;
  if (keys['d']) move.x += 1;
  if (move.lengthSq() > 0) move.normalize();

  const speed = 12;
  player.position.x += move.x * speed * dt;
  player.position.z += move.z * speed * dt;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -53, 53);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -53, 53);

  if (move.lengthSq() > 0) {
    player.rotation.y = Math.atan2(move.x, move.z);
  }

  const target = new THREE.Vector3(player.position.x + 9, 14, player.position.z + 11);
  camera.position.lerp(target, 0.08);
  camera.lookAt(player.position.x, 1.6, player.position.z);
}

function updatePickups() {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    pickup.rotation.y += 0.05;

    const actorPos = getActorPosition();
    if (pickup.position.distanceTo(actorPos) < 2.2) {
      state.cash += pickup.userData.value;
      world.remove(pickup);
      pickups.splice(i, 1);
      setMessage(`Cash found! +$${pickup.userData.value}`);
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const actorPos = getActorPosition();
    const toActor = actorPos.clone().sub(enemy.position);
    const distance = toActor.length();

    if (distance > 0.01) {
      const dir = toActor.normalize();
      enemy.position.addScaledVector(dir, Math.min(enemy.userData.speed * dt, distance));
      enemy.rotation.y = Math.atan2(dir.x, dir.z);
    }

    if (distance < 2.4) {
      state.health -= 20 * dt;
    }
  }

  if (enemies.length < 6) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    enemies.push(createEnemy(x, z));
  }
}

function updateWorld() {
  if (state.messageTimer > 0) {
    state.messageTimer -= 0.016;
    if (state.messageTimer <= 0) {
      ui.message.textContent = 'Explore the city, find cash, buy guns, and survive.';
    }
  }

  if (state.health <= 0) {
    state.health = 100;
    state.cash = Math.max(0, state.cash - 150);
    player.position.set(0, 0, 0);
    car.position.set(10, 0, 18);
    state.inCar = false;
    player.visible = true;
    setMessage('You got knocked out and lost money.');
  }
}

function createLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffffff, 1.15);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  world.add(sun);

  for (let i = 0; i < 16; i++) {
    const light = new THREE.PointLight(0xffe5a5, 0.8, 30, 2);
    const angle = (i / 16) * Math.PI * 2;
    light.position.set(Math.cos(angle) * 60, 12, Math.sin(angle) * 60);
    scene.add(light);
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  updatePlayer(dt);
  updatePickups();
  updateEnemies(dt);
  updateWorld();
  updateHUD();

  renderer.render(scene, camera);
}

createGround();
createCity();
createLights();
setMessage('Welcome to the city. Drive, shoot, steal cash, and survive.', 3);
updateHUD();
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
