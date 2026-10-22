import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7db8ff);
scene.fog = new THREE.Fog(0x7db8ff, 35, 140);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 26, 32);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();

const world = new THREE.Group();
scene.add(world);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const aimPoint = new THREE.Vector3(0, 0, 0);

let score = 0;
let health = 100;
let weaponIndex = 0;
const weapons = [
  { name: 'Pistol', damage: 15, fireRate: 0.4, color: 0x7cc7ff },
  { name: 'SMG', damage: 10, fireRate: 0.18, color: 0x64f1b2 },
  { name: 'Shotgun', damage: 28, fireRate: 0.7, color: 0xffb347 },
];

let lastShot = 0;
let inCar = false;
let carVelocity = 0;
let carTurn = 0;
let cash = 0;
let messageTimer = 0;

const ui = {
  cash: document.getElementById('cash'),
  health: document.getElementById('health'),
  weapon: document.getElementById('weapon'),
  status: document.getElementById('car-status'),
  message: document.getElementById('message-box'),
};

const worldSize = 120;

function createGround() {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize),
    new THREE.MeshStandardMaterial({ color: 0x3ea45c, roughness: 0.9, metalness: 0.1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.1;
  world.add(grass);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e2f35, roughness: 0.7 });
  const roadWidth = 10;
  const roadLength = 100;

  const roads = [
    [0, 0, roadWidth, roadLength],
    [0, 0, roadLength, roadWidth],
    [-26, 0, roadWidth, 26],
    [26, 0, roadWidth, 26],
    [0, 34, roadLength, roadWidth],
    [0, -34, roadLength, roadWidth],
  ];

  roads.forEach(([x, z, w, d]) => {
    const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), roadMat);
    road.position.set(x, 0.02, z);
    world.add(road);
  });

  const lane = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.05, 100),
    new THREE.MeshStandardMaterial({ color: 0xffff66 })
  );
  lane.position.set(0, 0.04, 0);
  world.add(lane);
}

function addBuilding(x, z, w, d, h, color = 0x7d8ea5) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.15 })
  );
  mesh.position.set(x, h / 2, z);
  world.add(mesh);
}

function createCity() {
  const colors = [0x8fc1d8, 0x9aa5bf, 0xb7c3c6, 0xd9b896, 0xad8bc4];

  for (let i = -5; i <= 5; i++) {
    const x = i * 15;
    const z = 18;
    const size = 10 + (Math.abs(i) % 3) * 2;
    addBuilding(x, z, 10, 10, 14 + (i % 4) * 4, colors[(i + 6) % colors.length]);
  }

  for (let i = -5; i <= 5; i++) {
    const x = i * 15;
    const z = -18;
    addBuilding(x, z, 10, 10, 16 + (i % 5) * 3, colors[(i + 4) % colors.length]);
  }

  addBuilding(-32, -40, 18, 18, 22, 0xc6a97a);
  addBuilding(32, -40, 18, 18, 18, 0xa6bc8b);
  addBuilding(-32, 40, 18, 18, 18, 0xd7a7a7);
  addBuilding(32, 40, 18, 18, 26, 0xb5c5e9);

  const casinoBase = new THREE.Mesh(
    new THREE.BoxGeometry(18, 12, 18),
    new THREE.MeshStandardMaterial({ color: 0x5229d3, emissive: 0x190a44, roughness: 0.7 })
  );
  casinoBase.position.set(0, 6, -42);
  world.add(casinoBase);

  const casinoSign = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf5d742, emissive: 0x775a00 })
  );
  casinoSign.position.set(0, 12, -42.8);
  world.add(casinoSign);

  const gunShopBase = new THREE.Mesh(
    new THREE.BoxGeometry(18, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8, metalness: 0.3 })
  );
  gunShopBase.position.set(0, 4, 42);
  world.add(gunShopBase);

  const gunSign = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xd62d2d, emissive: 0x440000 })
  );
  gunSign.position.set(0, 9, 42.8);
  world.add(gunSign);

  for (let i = 0; i < 20; i++) {
    const light = new THREE.PointLight(0xffffdd, 0.9, 18, 2);
    const angle = (i / 20) * Math.PI * 2;
    const radius = 48;
    light.position.set(Math.cos(angle) * radius, 13, Math.sin(angle) * radius);
    scene.add(light);
  }
}

function createPlayer() {
  const body = new THREE.Group();

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.8, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x3d88ff })
  );
  torso.position.y = 1.6;
  body.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf5d0a9 })
  );
  head.position.y = 3;
  body.add(head);

  return body;
}

const player = createPlayer();
player.position.set(0, 0, 0);
world.add(player);

function createCar() {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 1.3, 2),
    new THREE.MeshStandardMaterial({ color: 0xf44336, metalness: 0.5, roughness: 0.3 })
  );
  body.position.y = 1.2;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x2f3542, metalness: 0.4, roughness: 0.3 })
  );
  cabin.position.set(0.2, 2, 0);
  car.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.5, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 });

  const wheelPositions = [
    [-1.2, 0.5, 1.2],
    [1.2, 0.5, 1.2],
    [-1.2, 0.5, -1.2],
    [1.2, 0.5, -1.2],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    car.add(wheel);
  });

  return car;
}

const car = createCar();
car.position.set(10, 0, 18);
world.add(car);

function updateHUD() {
  ui.cash.textContent = `$${cash}`;
  ui.health.textContent = `${Math.max(0, Math.round(health))}`;
  ui.weapon.textContent = weapons[weaponIndex].name;
  ui.status.textContent = inCar ? 'Driving' : 'Away';
}

function setMessage(text, duration = 2) {
  ui.message.textContent = text;
  messageTimer = duration;
}

function addPickup(x, z, amount) {
  const pickup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.35, 18),
    new THREE.MeshStandardMaterial({ color: 0x51f05a, emissive: 0x0b5f1c, roughness: 0.5 })
  );
  pickup.rotation.x = Math.PI / 2;
  pickup.position.set(x, 1.2, z);
  pickup.userData = { amount };
  world.add(pickup);
  return pickup;
}

const cashPickups = [
  addPickup(-18, -8, 50),
  addPickup(24, 12, 80),
  addPickup(-12, 32, 60),
  addPickup(30, -28, 100),
  addPickup(0, 0, 75),
  addPickup(-30, 43, 125),
  addPickup(28, 42, 140),
  addPickup(0, -52, 200),
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
    new THREE.SphereGeometry(0.42, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xefd6b6 })
  );
  head.position.y = 2.9;
  enemy.add(head);

  enemy.position.set(x, 0, z);
  enemy.userData = {
    hp: 40,
    speed: 2 + Math.random() * 1.5,
    drift: Math.random() * Math.PI * 2,
  };
  world.add(enemy);
  return enemy;
}

const enemies = [
  createEnemy(-18, 12),
  createEnemy(18, 22),
  createEnemy(-28, -18),
  createEnemy(28, -18),
  createEnemy(0, 30),
];

const keys = {};
window.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

function getPlayerWorldPosition() {
  return inCar ? car.position.clone() : player.position.clone();
}

function getInputVector() {
  const move = new THREE.Vector3();
  if (keys['w']) move.z -= 1;
  if (keys['s']) move.z += 1;
  if (keys['a']) move.x -= 1;
  if (keys['d']) move.x += 1;
  if (move.lengthSq() > 0) move.normalize();
  return move;
}

function tryInteract() {
  const pos = getPlayerWorldPosition();
  const distToCar = pos.distanceTo(car.position);
  const distToCasino = pos.distanceTo(new THREE.Vector3(0, 0, -42));
  const distToGunStore = pos.distanceTo(new THREE.Vector3(0, 0, 42));

  if (distToCar < 6) {
    if (inCar) {
      inCar = false;
      carVelocity = 0;
      player.position.copy(car.position);
      player.position.y = 0;
      player.visible = true;
      car.rotation.y = 0;
      setMessage('You exited the car.');
    } else {
      inCar = true;
      player.visible = false;
      setMessage('You are driving the car.');
    }
    return;
  }

  if (distToCasino < 14) {
    if (cash >= 50) {
      const gain = Math.random() < 0.5 ? 120 : -80;
      cash += gain;
      setMessage(gain >= 0 ? `Casino win! +$${gain}` : `Casino loss. $${Math.abs(gain)} lost`);
      if (cash < 0) cash = 0;
    } else {
      setMessage('Need at least $50 to gamble at the casino.');
    }
    return;
  }

  if (distToGunStore < 14) {
    if (cash >= 200) {
      weaponIndex = Math.min(weaponIndex + 1, weapons.length - 1);
      cash -= 200;
      setMessage(`Upgraded to ${weapons[weaponIndex].name}!`);
    } else {
      setMessage('Gun store: $200 needed for the next weapon.');
    }
    return;
  }

  setMessage('Nothing nearby to interact with.');
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'f' || event.key === 'F') {
    tryInteract();
  }
  if (event.key === 'e' || event.key === 'E') {
    if (!inCar && getPlayerWorldPosition().distanceTo(car.position) < 6) {
      inCar = true;
      player.visible = false;
      setMessage('You entered the car.');
    } else if (inCar) {
      inCar = false;
      player.visible = true;
      player.position.copy(car.position);
      player.position.y = 0;
      setMessage('You left the car.');
    }
  }
});

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('mousedown', () => {
  const now = performance.now();
  if (now - lastShot < weapons[weaponIndex].fireRate * 1000) return;
  lastShot = now;

  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hitPoint);

  if (inCar) {
    const shotOrigin = car.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const direction = hitPoint.clone().sub(shotOrigin).normalize();
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      new THREE.MeshStandardMaterial({ color: weapons[weaponIndex].color })
    );
    muzzle.position.copy(shotOrigin);
    world.add(muzzle);
    setTimeout(() => world.remove(muzzle), 120);

    const affected = enemies.filter((enemy) => enemy.position.distanceTo(shotOrigin) < 22);
    affected.forEach((enemy) => {
      const dist = enemy.position.distanceTo(shotOrigin);
      const damage = weapons[weaponIndex].damage * (1 - Math.min(dist / 22, 0.9));
      enemy.userData.hp -= damage;
    });

    const enemy = affected.sort((a, b) => a.position.distanceTo(shotOrigin) - b.position.distanceTo(shotOrigin))[0];
    if (enemy) {
      setMessage(`Hit enemy for ${weapons[weaponIndex].damage} damage.`);
    }
  } else {
    const shotOrigin = player.position.clone().add(new THREE.Vector3(0, 2, 0));
    const direction = hitPoint.clone().sub(shotOrigin).normalize();
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      new THREE.MeshStandardMaterial({ color: weapons[weaponIndex].color })
    );
    muzzle.position.copy(shotOrigin);
    world.add(muzzle);
    setTimeout(() => world.remove(muzzle), 120);

    const affected = enemies.filter((enemy) => enemy.position.distanceTo(shotOrigin) < 22);
    affected.forEach((enemy) => {
      const dist = enemy.position.distanceTo(shotOrigin);
      const damage = weapons[weaponIndex].damage * (1 - Math.min(dist / 22, 0.9));
      enemy.userData.hp -= damage;
    });

    const target = affected.sort((a, b) => a.position.distanceTo(shotOrigin) - b.position.distanceTo(shotOrigin))[0];
    if (target) {
      setMessage(`Shot fired at ${target.userData.hp > 0 ? 'target' : 'enemy'}!`);
    }
  }

  aimPoint.copy(hitPoint);
});

function updatePlayer(dt) {
  const move = getInputVector();
  if (inCar) {
    carVelocity += (keys['w'] ? 1 : 0) * 8 * dt;
    carVelocity -= (keys['s'] ? 1 : 0) * 8 * dt;
    carVelocity *= 0.92;
    carVelocity = THREE.MathUtils.clamp(carVelocity, -14, 18);

    const steer = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
    carTurn += steer * 1.4 * dt;
    carTurn *= 0.88;
    car.rotation.y += carTurn * dt * 3;
    car.position.x += Math.sin(car.rotation.y) * carVelocity * dt;
    car.position.z += Math.cos(car.rotation.y) * carVelocity * dt;
    car.position.x = THREE.MathUtils.clamp(car.position.x, -50, 50);
    car.position.z = THREE.MathUtils.clamp(car.position.z, -50, 50);

    camera.position.lerp(new THREE.Vector3(car.position.x - Math.sin(car.rotation.y) * 7, 10, car.position.z - Math.cos(car.rotation.y) * 7), 0.08);
    camera.lookAt(car.position.x, 2, car.position.z);
    return;
  }

  const speed = 14;
  player.position.x += move.x * speed * dt;
  player.position.z += move.z * speed * dt;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -50, 50);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -50, 50);

  if (move.lengthSq() > 0) {
    player.rotation.y = Math.atan2(move.x, move.z);
  }

  const cameraTarget = new THREE.Vector3(player.position.x, 0, player.position.z);
  camera.position.lerp(new THREE.Vector3(player.position.x + 9, 18, player.position.z + 11), 0.08);
  camera.lookAt(cameraTarget.x, 1.5, cameraTarget.z);
}

function updatePickups() {
  cashPickups.forEach((pickup) => {
    pickup.rotation.y += 0.02;
    const playerPos = getPlayerWorldPosition();
    if (pickup.position.distanceTo(playerPos) < 2.8) {
      cash += pickup.userData.amount;
      world.remove(pickup);
      const idx = cashPickups.indexOf(pickup);
      if (idx >= 0) {
        cashPickups.splice(idx, 1);
      }
      setMessage(`Picked up $${pickup.userData.amount}!`);
    }
  });
}

function updateEnemies(dt) {
  enemies.forEach((enemy) => {
    if (enemy.userData.hp <= 0) {
      world.remove(enemy);
      return;
    }

    const toPlayer = getPlayerWorldPosition().clone().sub(enemy.position);
    const dist = toPlayer.length();
    if (dist > 0.1) {
      const dir = toPlayer.normalize();
      enemy.position.addScaledVector(dir, Math.min(enemy.userData.speed * dt, dist));
      enemy.rotation.y = Math.atan2(dir.x, dir.z);
    }

    const playerPos = getPlayerWorldPosition();
    if (enemy.position.distanceTo(playerPos) < 2.4) {
      health -= 20 * dt;
    }
  });

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.userData.hp <= 0) {
      cash += 60;
      enemies.splice(i, 1);
      setMessage('Enemy defeated! +$60');
    }
  }

  if (enemies.length < 5) {
    const x = (Math.random() - 0.5) * 70;
    const z = (Math.random() - 0.5) * 70;
    enemies.push(createEnemy(x, z));
  }
}

function updateEffects() {
  if (messageTimer > 0) {
    messageTimer -= 0.016;
    if (messageTimer <= 0) {
      ui.message.textContent = 'Explore the city. Press E near a car. Press F near a store.';
    }
  }

  if (health <= 0) {
    health = 100;
    cash = Math.max(0, cash - 150);
    setMessage('You were knocked out! Spawned back with a penalty.');
    player.position.set(0, 0, 0);
    car.position.set(10, 0, 18);
    inCar = false;
    player.visible = true;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);

  updatePlayer(dt);
  updatePickups();
  updateEnemies(dt);
  updateEffects();
  updateHUD();

  renderer.render(scene, camera);
}

createGround();
createCity();
updateHUD();
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setMessage('Welcome to the city. Steal cash, buy guns, and survive.');
