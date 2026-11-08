// League of Towers
// All of the rules live here: placement, the five waves, each champion's attack, and scoring.
// index.html is the page. This file is the game.

const VIEW_W = 900;
const VIEW_H = 500;
const START_LIVES = 12;
const START_GOLD = 120;
const ROUND_CLEAR_SCORE = 50;
const LIFE_BONUS = 20;
const PLACE_GAP = 52;
const TAU = Math.PI * 2;

const TOWER_ORDER = ["garen", "teemo", "anivia", "vayne", "caitlyn"];

const TOWER_TYPES = {
  garen: {
    name: "Garen",
    mark: "G",
    cost: 40,
    range: 74,
    color: "#d4b15a",
    damage: 10,
    interval: 0.36,
    blurb: "Short range. A spin that damages every enemy nearby."
  },
  teemo: {
    name: "Teemo",
    mark: "T",
    cost: 50,
    range: 125,
    color: "#e28a3a",
    interval: 1.2,
    shroomRadius: 56,
    shroomLife: 4.2,
    shroomDamage: 7,
    shroomTick: 0.4,
    slow: 0.45,
    slowDuration: 0.8,
    blurb: "Drops shrooms that slow enemies in an area."
  },
  anivia: {
    name: "Anivia",
    mark: "A",
    cost: 100,
    range: 180,
    color: "#8fd0e0",
    interval: 2.5,
    stormRadius: 96,
    stormLife: 1.6,
    stormDamage: 12,
    stormTick: 0.32,
    slow: 0.34,
    slowDuration: 0.55,
    blurb: "Large storm. Damages and slows a crowd."
  },
  vayne: {
    name: "Vayne",
    mark: "V",
    cost: 70,
    range: 152,
    color: "#c3aadf",
    damage: 11,
    interval: 0.45,
    ramp: 0.55,
    maxMult: 3.2,
    blurb: "Single target. Damage ramps while she stays on one enemy."
  },
  caitlyn: {
    name: "Caitlyn",
    mark: "C",
    cost: 85,
    range: 265,
    color: "#6d8fd6",
    damage: 32,
    interval: 0.9,
    blurb: "Very long range. Heavy single-target shots."
  }
};

const ENEMY_TYPES = {
  minion: {
    name: "Minion",
    plural: "Minions",
    hp: 36,
    speed: 165,
    gold: 8,
    score: 10,
    leak: 1,
    radius: 11,
    color: "#d25b52"
  },
  swift: {
    name: "Swift",
    plural: "Swifts",
    hp: 20,
    speed: 215,
    gold: 11,
    score: 16,
    leak: 1,
    radius: 8,
    color: "#f0a05a"
  },
  cannon: {
    name: "Cannon",
    plural: "Cannons",
    hp: 180,
    speed: 82,
    gold: 26,
    score: 50,
    leak: 2,
    radius: 15,
    color: "#a8b0b8"
  },
  siege: {
    name: "Siege",
    plural: "Sieges",
    hp: 380,
    speed: 68,
    gold: 50,
    score: 120,
    leak: 3,
    radius: 18,
    color: "#b14d8a"
  }
};

const ROUNDS = [
  { interval: 0.68, groups: [["minion", 8]] },
  { interval: 0.52, groups: [["minion", 5], ["swift", 4]] },
  { interval: 0.48, groups: [["minion", 5], ["swift", 4], ["cannon", 1]] },
  { interval: 0.44, groups: [["minion", 4], ["swift", 5], ["cannon", 2]] },
  { interval: 0.42, groups: [["minion", 4], ["swift", 5], ["cannon", 2], ["siege", 1]] }
];

// One lane. Enemies walk these points in order, then hit the nexus.
const WAYPOINTS = [
  { x: -10, y: 230 },
  { x: 130, y: 230 },
  { x: 130, y: 100 },
  { x: 450, y: 100 },
  { x: 450, y: 400 },
  { x: 930, y: 400 }
];

const TREES = [
  [58, 52],
  [70, 455],
  [250, 40],
  [280, 470],
  [620, 48],
  [640, 210],
  [800, 55],
  [830, 160],
  [760, 470]
];

const segments = [];
let pathLength = 0;

for (let i = 0; i < WAYPOINTS.length - 1; i += 1) {
  const a = WAYPOINTS[i];
  const b = WAYPOINTS[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  segments.push({ a, b, len, start: pathLength });
  pathLength += len;
}

const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d", { alpha: false });
const livesEl = document.querySelector("#lives");
const roundEl = document.querySelector("#round");
const scoreEl = document.querySelector("#score");
const goldEl = document.querySelector("#gold");
const shopEl = document.querySelector("#shop");
const previewEl = document.querySelector("#preview");
const statusEl = document.querySelector("#status");
const startBtn = document.querySelector("#start-round");
const restartBtn = document.querySelector("#restart");
const summaryEl = document.querySelector("#summary");
const summaryKicker = document.querySelector("#summary-kicker");
const summaryTitle = document.querySelector("#summary-title");
const summaryStats = document.querySelector("#summary-stats");
const summaryRestart = document.querySelector("#summary-restart");
const shopButtons = [];

let state = freshState();
let lastTime = 0;

setupCanvas();
const scenery = buildScenery();
init();

function freshState() {
  return {
    phase: "build",
    round: 1,
    lives: START_LIVES,
    score: 0,
    gold: START_GOLD,
    defeated: 0,
    roundsCleared: 0,
    built: 0,
    elapsed: 0,
    victory: false,
    towers: [],
    enemies: [],
    shrooms: [],
    storms: [],
    bolts: [],
    bursts: [],
    floaties: [],
    queue: [],
    spawnTimer: 0,
    selected: "garen",
    pointer: null,
    banner: "",
    bannerTime: 0,
    nexusFlash: 0,
    status: "Garen is selected. Click along the lane, then start round 1.",
    nextId: 1
  };
}

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VIEW_W * dpr;
  canvas.height = VIEW_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildScenery() {
  const items = [];
  for (let i = 0; i < 90; i += 1) {
    const x = seeded(i + 1) * VIEW_W;
    const y = seeded(i + 90) * VIEW_H;
    if (distanceToPath(x, y) < 48) continue;
    items.push({
      x,
      y,
      r: 1.1 + seeded(i + 200) * 2.3,
      rock: seeded(i + 300) > 0.6
    });
  }
  return items;
}

function pointOnPath(distance) {
  if (distance <= 0) return { x: WAYPOINTS[0].x, y: WAYPOINTS[0].y };
  if (distance >= pathLength) {
    const end = WAYPOINTS[WAYPOINTS.length - 1];
    return { x: end.x, y: end.y };
  }
  for (const seg of segments) {
    if (distance <= seg.start + seg.len) {
      const t = (distance - seg.start) / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t
      };
    }
  }
  const end = WAYPOINTS[WAYPOINTS.length - 1];
  return { x: end.x, y: end.y };
}

function tangentAt(distance) {
  const here = pointOnPath(distance);
  const ahead = pointOnPath(Math.min(pathLength, distance + 6));
  return Math.atan2(ahead.y - here.y, ahead.x - here.x);
}

function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

function distanceToPath(x, y) {
  let best = Infinity;
  for (const seg of segments) {
    best = Math.min(best, distanceToSegment(x, y, seg.a, seg.b));
  }
  return best;
}

function init() {
  buildShop();
  selectTower("garen");
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", () => {
    state.pointer = null;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  startBtn.addEventListener("click", startRound);
  restartBtn.addEventListener("click", restart);
  summaryRestart.addEventListener("click", restart);
  window.addEventListener("keydown", onKeyDown);
  syncHud();
  requestAnimationFrame(loop);
}

function buildShop() {
  shopEl.replaceChildren();
  TOWER_ORDER.forEach((type, index) => {
    const spec = TOWER_TYPES[type];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tower-btn";
    button.dataset.tower = type;
    button.style.setProperty("--swatch", spec.color);
    button.addEventListener("click", () => selectTower(type));

    const top = document.createElement("span");
    top.className = "tower-top";
    const name = document.createElement("span");
    name.className = "tower-name";
    name.textContent = spec.name;
    const key = document.createElement("kbd");
    key.textContent = String(index + 1);
    top.append(name, key);

    const cost = document.createElement("span");
    cost.className = "tower-cost";
    cost.textContent = spec.cost + "g";

    const blurb = document.createElement("span");
    blurb.className = "tower-blurb";
    blurb.textContent = spec.blurb;

    button.append(top, cost, blurb);
    shopEl.append(button);
    shopButtons.push(button);
  });
}

function selectTower(type) {
  if (!TOWER_TYPES[type]) return;
  state.selected = type;
  for (const button of shopButtons) {
    const on = button.dataset.tower === type;
    button.classList.toggle("is-selected", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function onKeyDown(event) {
  const map = { 1: "garen", 2: "teemo", 3: "anivia", 4: "vayne", 5: "caitlyn" };
  if (map[event.key]) {
    selectTower(map[event.key]);
    return;
  }
  if (event.key === "Enter" && state.phase === "build") startRound();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * VIEW_W) / rect.width,
    y: ((event.clientY - rect.top) * VIEW_H) / rect.height
  };
}

function onPointerDown(event) {
  if (state.phase === "summary") return;
  const point = canvasPoint(event);
  if (event.button === 2) trySell(point.x, point.y);
  else tryPlace(point.x, point.y);
}

function onPointerMove(event) {
  state.pointer = canvasPoint(event);
}

function placementCheck(x, y) {
  const spec = TOWER_TYPES[state.selected];
  if (!spec) return { ok: false, reason: "Select a champion first." };
  if (x < 18 || y < 18 || x > VIEW_W - 18 || y > VIEW_H - 18) {
    return { ok: false, reason: "Keep champions on the map." };
  }
  if (distanceToPath(x, y) > spec.range) {
    return { ok: false, reason: spec.name + " can't reach the lane from there. Place closer." };
  }
  for (const tower of state.towers) {
    if (Math.hypot(tower.x - x, tower.y - y) < PLACE_GAP) {
      return { ok: false, reason: "Too close to another champion." };
    }
  }
  if (state.gold < spec.cost) {
    return {
      ok: false,
      reason: spec.name + " costs " + spec.cost + "g. You have " + state.gold + "g."
    };
  }
  return { ok: true, reason: "" };
}

function tryPlace(x, y) {
  const check = placementCheck(x, y);
  if (!check.ok) {
    if (check.reason) state.status = check.reason;
    return;
  }
  const spec = TOWER_TYPES[state.selected];
  state.gold -= spec.cost;
  state.built += 1;
  state.towers.push({
    id: state.nextId++,
    type: state.selected,
    name: spec.name,
    cost: spec.cost,
    x,
    y,
    range: spec.range,
    cooldown: 0,
    spin: Math.random() * TAU,
    focusId: null,
    focusTime: 0
  });
  state.status = spec.name + " placed for " + spec.cost + "g.";
}

function towerAt(x, y) {
  let best = null;
  let bestDist = 24;
  for (const tower of state.towers) {
    const dist = Math.hypot(tower.x - x, tower.y - y);
    if (dist <= bestDist) {
      best = tower;
      bestDist = dist;
    }
  }
  return best;
}

function trySell(x, y) {
  const tower = towerAt(x, y);
  if (!tower) return;
  if (state.phase !== "build") {
    state.status = "You can sell champions between rounds.";
    return;
  }
  state.gold += tower.cost;
  state.towers = state.towers.filter((item) => item.id !== tower.id);
  state.status = "Sold " + tower.name + " for " + tower.cost + "g.";
}

function startRound() {
  if (state.phase !== "build") return;
  const round = ROUNDS[state.round - 1];
  state.queue = [];
  for (const [type, count] of round.groups) {
    for (let i = 0; i < count; i += 1) state.queue.push(type);
  }
  state.spawnTimer = 0.25;
  state.phase = "combat";
  state.banner = "Round " + state.round;
  state.bannerTime = 1.15;
  state.status = "Round " + state.round + " started.";
}

function restart() {
  const selected = state.selected;
  state = freshState();
  state.selected = selected;
  summaryEl.hidden = true;
  summaryEl.classList.remove("is-victory", "is-defeat");
  selectTower(selected);
  syncHud();
}

function waveLabel(roundNumber) {
  const round = ROUNDS[roundNumber - 1];
  if (!round) return "";
  return round.groups
    .map(([type, count]) => {
      const spec = ENEMY_TYPES[type];
      return count + " " + (count > 1 ? spec.plural : spec.name);
    })
    .join(" · ");
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return minutes + ":" + String(remain).padStart(2, "0");
}

function loop(now) {
  const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
  lastTime = now;
  update(dt);
  draw();
  syncHud();
  requestAnimationFrame(loop);
}

function update(dt) {
  fadeTransient(dt);
  if (state.phase === "summary") return;

  state.elapsed += dt;
  if (state.phase === "combat") spawnWave(dt);
  moveEnemies(dt);
  if (state.phase === "summary") return;

  for (const tower of state.towers) {
    ATTACKS[tower.type](tower, dt);
  }
  updateShrooms(dt);
  updateStorms(dt);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0 && !enemy.leaked);
  checkWave();
}

function spawnWave(dt) {
  if (!state.queue.length) return;
  state.spawnTimer -= dt;
  const interval = ROUNDS[state.round - 1].interval;
  while (state.spawnTimer <= 0 && state.queue.length) {
    state.enemies.push(makeEnemy(state.queue.shift()));
    state.spawnTimer += interval;
  }
}

function makeEnemy(type) {
  const spec = ENEMY_TYPES[type];
  const pos = pointOnPath(0);
  return {
    id: state.nextId++,
    type,
    name: spec.name,
    hp: spec.hp,
    maxHp: spec.hp,
    speed: spec.speed,
    gold: spec.gold,
    score: spec.score,
    leak: spec.leak,
    radius: spec.radius,
    color: spec.color,
    progress: 0,
    x: pos.x,
    y: pos.y,
    angle: 0,
    slow: 0,
    slowTimer: 0,
    hitFlash: 0,
    leaked: false
  };
}

function moveEnemies(dt) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.leaked) continue;
    let speed = enemy.speed;
    if (enemy.slowTimer > 0) {
      speed *= 1 - enemy.slow;
      enemy.slowTimer -= dt;
    }
    if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
    enemy.progress += speed * dt;
    const pos = pointOnPath(Math.min(enemy.progress, pathLength));
    enemy.x = pos.x;
    enemy.y = pos.y;
    enemy.angle = tangentAt(Math.min(enemy.progress, pathLength));
    if (enemy.progress >= pathLength) leakEnemy(enemy);
  }
}

function leakEnemy(enemy) {
  if (enemy.leaked) return;
  enemy.leaked = true;
  state.lives -= enemy.leak;
  if (state.lives < 0) state.lives = 0;
  state.nexusFlash = 0.5;
  state.status = enemy.name + " reached the nexus (−" + enemy.leak + " lives).";
  if (state.lives <= 0) endGame(false);
}

function checkWave() {
  if (state.phase !== "combat") return;
  if (state.queue.length > 0 || state.enemies.length > 0) return;

  state.roundsCleared = state.round;
  state.score += ROUND_CLEAR_SCORE;
  const bonus = 20 + state.round * 6;
  state.gold += bonus;
  state.shrooms = [];
  state.storms = [];
  state.bolts = [];

  if (state.round >= ROUNDS.length) {
    state.status = "All 5 rounds cleared.";
    endGame(true);
    return;
  }

  const finished = state.round;
  state.round += 1;
  state.phase = "build";
  state.banner = "Cleared";
  state.bannerTime = 0.8;
  state.status = "Round " + finished + " cleared. +" + bonus + " gold. Place champions, then start round " + state.round + ".";
}

function endGame(victory) {
  if (state.phase === "summary") return;
  state.phase = "summary";
  state.victory = victory;
  if (!victory) state.status = "The nexus fell. Press Restart to try again.";
  fillSummary(victory);
}

function fillSummary(victory) {
  const lifeBonus = victory ? state.lives * LIFE_BONUS : 0;
  summaryEl.classList.toggle("is-victory", victory);
  summaryEl.classList.toggle("is-defeat", !victory);
  summaryKicker.textContent = victory ? "All 5 rounds cleared" : "Run ended on round " + state.round;
  summaryTitle.textContent = victory ? "The nexus holds" : "The nexus fell";

  const rows = [
    ["Time", formatTime(state.elapsed)],
    ["Rounds cleared", state.roundsCleared + " / 5"],
    ["Enemies defeated", String(state.defeated)],
    ["Champions built", String(state.built)],
    ["Lives remaining", String(state.lives)],
    ["Score", String(state.score)]
  ];
  if (victory) {
    rows.push(["Life bonus", String(lifeBonus)]);
    rows.push(["Total", String(state.score + lifeBonus)]);
  }

  summaryStats.replaceChildren();
  for (const [label, value] of rows) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    item.append(name, number);
    summaryStats.append(item);
  }

  summaryEl.hidden = false;
  summaryRestart.focus();
}

function enemiesInRange(tower) {
  const list = [];
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.leaked) continue;
    if (Math.hypot(enemy.x - tower.x, enemy.y - tower.y) <= tower.range) list.push(enemy);
  }
  return list;
}

function nearestEnemy(list, tower) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of list) {
    const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
    if (dist < bestDist) {
      best = enemy;
      bestDist = dist;
    }
  }
  return best;
}

function damageEnemy(enemy, amount) {
  if (enemy.hp <= 0 || enemy.leaked) return;
  enemy.hp -= amount;
  enemy.hitFlash = 0.1;
  if (enemy.hp > 0) return;
  enemy.hp = 0;
  state.score += enemy.score;
  state.gold += enemy.gold;
  state.defeated += 1;
  state.floaties.push({
    x: enemy.x,
    y: enemy.y - 12,
    text: "+" + enemy.gold,
    life: 0.7,
    max: 0.7,
    color: "#e0b15a"
  });
}

function applySlow(enemy, amount, duration) {
  if (enemy.hp <= 0 || enemy.leaked) return;
  if (enemy.slowTimer > 0 && enemy.slow > amount) {
    enemy.slowTimer = Math.max(enemy.slowTimer, duration);
    return;
  }
  enemy.slow = amount;
  enemy.slowTimer = duration;
}

function addBolt(tower, enemy, color, width) {
  state.bolts.push({
    x1: tower.x,
    y1: tower.y,
    x2: enemy.x,
    y2: enemy.y,
    life: 0.14,
    max: 0.14,
    color,
    width
  });
}

// Garen: short range, every spin hits all enemies inside the circle.
function attackGaren(tower, dt) {
  const spec = TOWER_TYPES.garen;
  const targets = enemiesInRange(tower);
  tower.spin += dt * (targets.length ? 14 : 2.2);
  if (!targets.length) return;
  tower.cooldown -= dt;
  if (tower.cooldown > 0) return;
  for (const enemy of targets) damageEnemy(enemy, spec.damage);
  tower.cooldown = spec.interval;
  state.bursts.push({
    x: tower.x,
    y: tower.y,
    life: 0.16,
    max: 0.16,
    radius: tower.range
  });
}

// Teemo: drops a shroom on the nearest enemy. The shroom slows and nicks anyone standing in it.
function attackTeemo(tower, dt) {
  const spec = TOWER_TYPES.teemo;
  const target = nearestEnemy(enemiesInRange(tower), tower);
  if (!target) return;
  tower.cooldown -= dt;
  if (tower.cooldown > 0) return;
  for (const shroom of state.shrooms) {
    if (Math.hypot(shroom.x - target.x, shroom.y - target.y) < 42) {
      tower.cooldown = 0.2;
      return;
    }
  }
  state.shrooms.push({
    x: target.x,
    y: target.y,
    life: spec.shroomLife,
    max: spec.shroomLife,
    tick: 0,
    radius: spec.shroomRadius,
    damage: spec.shroomDamage,
    slow: spec.slow,
    slowDuration: spec.slowDuration,
    tickEvery: spec.shroomTick
  });
  tower.cooldown = spec.interval;
}

// Anivia: plants a storm on the thickest group in range. It damages and slows until it expires.
function attackAnivia(tower, dt) {
  const spec = TOWER_TYPES.anivia;
  tower.cooldown -= dt;
  let active = false;
  for (const storm of state.storms) {
    if (storm.towerId === tower.id) active = true;
  }
  if (active || tower.cooldown > 0) return;

  const target = densestEnemy(tower);
  if (!target) {
    tower.cooldown = 0;
    return;
  }
  state.storms.push({
    id: state.nextId++,
    towerId: tower.id,
    x: target.x,
    y: target.y,
    life: spec.stormLife,
    max: spec.stormLife,
    tick: 0,
    spin: 0,
    radius: spec.stormRadius,
    damage: spec.stormDamage,
    slow: spec.slow,
    slowDuration: spec.slowDuration,
    tickEvery: spec.stormTick
  });
  tower.cooldown = spec.interval;
}

function densestEnemy(tower) {
  const nearby = enemiesInRange(tower);
  let best = null;
  let bestScore = -1;
  const radius = TOWER_TYPES.anivia.stormRadius;
  for (const enemy of nearby) {
    let score = 0;
    for (const other of state.enemies) {
      if (other.hp <= 0 || other.leaked) continue;
      if (Math.hypot(other.x - enemy.x, other.y - enemy.y) <= radius) score += 1;
    }
    score += enemy.progress / pathLength;
    if (score > bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
}

// Vayne: locks one enemy. The longer that lock lasts, the harder each shot hits.
function attackVayne(tower, dt) {
  const spec = TOWER_TYPES.vayne;
  const inRange = enemiesInRange(tower);
  let target = null;
  for (const enemy of inRange) {
    if (enemy.id === tower.focusId) target = enemy;
  }
  if (!target) {
    for (const enemy of inRange) {
      if (!target || enemy.progress > target.progress) target = enemy;
    }
    tower.focusId = target ? target.id : null;
    tower.focusTime = 0;
  }
  if (!target) return;

  tower.focusTime += dt;
  tower.cooldown -= dt;
  if (tower.cooldown > 0) return;
  const mult = Math.min(spec.maxMult, 1 + tower.focusTime * spec.ramp);
  damageEnemy(target, spec.damage * mult);
  tower.cooldown = spec.interval;
  addBolt(tower, target, "#efe6ff", 2);
}

// Caitlyn: very long range. She shoots the enemy closest to the nexus.
function attackCaitlyn(tower, dt) {
  const spec = TOWER_TYPES.caitlyn;
  const inRange = enemiesInRange(tower);
  if (!inRange.length) return;
  tower.cooldown -= dt;
  if (tower.cooldown > 0) return;

  let target = inRange[0];
  for (const enemy of inRange) {
    if (enemy.progress > target.progress) target = enemy;
  }
  damageEnemy(target, spec.damage);
  tower.cooldown = spec.interval;
  addBolt(tower, target, "#d7e4ff", 2.6);
}

const ATTACKS = {
  garen: attackGaren,
  teemo: attackTeemo,
  anivia: attackAnivia,
  vayne: attackVayne,
  caitlyn: attackCaitlyn
};

function updateShrooms(dt) {
  for (const shroom of state.shrooms) {
    shroom.life -= dt;
    shroom.tick -= dt;
    if (shroom.tick > 0) continue;
    shroom.tick = shroom.tickEvery;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.leaked) continue;
      if (Math.hypot(enemy.x - shroom.x, enemy.y - shroom.y) <= shroom.radius) {
        damageEnemy(enemy, shroom.damage);
        applySlow(enemy, shroom.slow, shroom.slowDuration);
      }
    }
  }
  state.shrooms = state.shrooms.filter((shroom) => shroom.life > 0);
}

function updateStorms(dt) {
  for (const storm of state.storms) {
    storm.life -= dt;
    storm.spin += dt * 2.4;
    storm.tick -= dt;
    if (storm.tick > 0) continue;
    storm.tick = storm.tickEvery;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.leaked) continue;
      if (Math.hypot(enemy.x - storm.x, enemy.y - storm.y) <= storm.radius) {
        damageEnemy(enemy, storm.damage);
        applySlow(enemy, storm.slow, storm.slowDuration);
      }
    }
  }
  state.storms = state.storms.filter((storm) => storm.life > 0);
}

function fadeTransient(dt) {
  state.bannerTime = Math.max(0, state.bannerTime - dt);
  state.nexusFlash = Math.max(0, state.nexusFlash - dt);
  for (const bolt of state.bolts) bolt.life -= dt;
  state.bolts = state.bolts.filter((bolt) => bolt.life > 0);
  for (const floater of state.floaties) {
    floater.life -= dt;
    floater.y -= 24 * dt;
  }
  state.floaties = state.floaties.filter((floater) => floater.life > 0);
  for (const burst of state.bursts) burst.life -= dt;
  state.bursts = state.bursts.filter((burst) => burst.life > 0);
}

function syncHud() {
  livesEl.textContent = String(state.lives);
  roundEl.textContent = Math.min(state.round, 5) + " / 5";
  scoreEl.textContent = String(state.score);
  goldEl.textContent = String(state.gold);
  startBtn.disabled = state.phase !== "build";
  startBtn.textContent = state.phase === "combat" ? "Round in progress" : "Start Round " + state.round;
  if (statusEl.textContent !== state.status) statusEl.textContent = state.status;

  if (state.phase === "summary") {
    previewEl.textContent = state.victory ? "You defended all 5 rounds." : "The run ended before the nexus was safe.";
  } else if (state.phase === "combat") {
    previewEl.textContent = "On the lane: " + state.enemies.length + " · still spawning: " + state.queue.length;
  } else {
    previewEl.textContent = "Round " + state.round + " enemies — " + waveLabel(state.round);
  }
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawBackground();
  drawLane();
  drawChevrons();
  drawShrooms();
  drawStorms();
  drawRanges();
  drawBursts();
  drawTowers();
  drawPortal();
  drawNexus();
  drawEnemies();
  drawBolts();
  drawFloaties();
  drawBanner();
  drawHint();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#14261c");
  sky.addColorStop(1, "#0c1410");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  for (const item of scenery) {
    ctx.fillStyle = item.rock ? "#243028" : "#1b4a32";
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.r, 0, TAU);
    ctx.fill();
  }

  for (const [x, y] of TREES) {
    if (distanceToPath(x, y) < 56) continue;
    drawTree(x, y);
  }
}

function drawTree(x, y) {
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(x - 2, y + 6, 4, 12);
  ctx.fillStyle = "#1e4a32";
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + 13, y + 10);
  ctx.lineTo(x - 13, y + 10);
  ctx.fill();
  ctx.fillStyle = "#2f6b48";
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x + 9, y - 2);
  ctx.lineTo(x - 9, y - 2);
  ctx.fill();
}

function tracePath() {
  ctx.beginPath();
  ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
  for (let i = 1; i < WAYPOINTS.length; i += 1) {
    ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
  }
}

function drawLane() {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  tracePath();
  ctx.strokeStyle = "#241c12";
  ctx.lineWidth = 68;
  ctx.stroke();
  tracePath();
  ctx.strokeStyle = "#3e523c";
  ctx.lineWidth = 48;
  ctx.stroke();
  tracePath();
  ctx.strokeStyle = "rgba(243, 234, 216, 0.28)";
  ctx.lineWidth = 2;
  ctx.setLineDash([1, 16]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawChevrons() {
  ctx.strokeStyle = "rgba(243, 234, 216, 0.4)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let distance = 70; distance < pathLength - 50; distance += 90) {
    const pos = pointOnPath(distance);
    const angle = tangentAt(distance);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(-7, 6);
    ctx.stroke();
    ctx.restore();
  }
}

function drawRange(x, y, radius, stroke, fill) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawRanges() {
  const spec = TOWER_TYPES[state.selected];
  if (spec && state.phase !== "summary") {
    for (const tower of state.towers) {
      if (tower.type !== state.selected) continue;
      drawRange(tower.x, tower.y, tower.range, "rgba(224, 177, 90, 0.28)", "rgba(224, 177, 90, 0.05)");
    }
  }

  if (!state.pointer || state.phase === "summary" || !spec) return;
  const hover = towerAt(state.pointer.x, state.pointer.y);
  if (hover) {
    drawRange(hover.x, hover.y, hover.range, "rgba(243, 234, 216, 0.55)", "rgba(243, 234, 216, 0.05)");
  }

  const check = placementCheck(state.pointer.x, state.pointer.y);
  drawRange(
    state.pointer.x,
    state.pointer.y,
    spec.range,
    check.ok ? "rgba(224, 177, 90, 0.95)" : "rgba(225, 93, 79, 0.85)",
    check.ok ? "rgba(224, 177, 90, 0.12)" : "rgba(225, 93, 79, 0.08)"
  );
  ctx.save();
  ctx.globalAlpha = 0.65;
  drawTowerShape(state.selected, state.pointer.x, state.pointer.y, 0);
  ctx.restore();
}

function drawBursts() {
  for (const burst of state.bursts) {
    const t = 1 - burst.life / burst.max;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, burst.radius * (0.55 + t * 0.45), 0, TAU);
    ctx.strokeStyle = "rgba(255, 236, 190, " + (1 - t) * 0.8 + ")";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawTowers() {
  for (const tower of state.towers) {
    drawTowerShape(tower.type, tower.x, tower.y, tower.spin);
    if (tower.type !== "vayne" || tower.focusTime < 0.2) continue;
    const spec = TOWER_TYPES.vayne;
    const mult = Math.min(spec.maxMult, 1 + tower.focusTime * spec.ramp);
    ctx.save();
    ctx.fillStyle = "#efe6ff";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mult.toFixed(1) + "x", tower.x, tower.y - 32);
    ctx.restore();
  }
}

function drawTowerShape(type, x, y, spin) {
  const spec = TOWER_TYPES[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 12, 5, 0, 0, TAU);
  ctx.fill();

  if (type === "garen") {
    ctx.strokeStyle = "#fff6d8";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 20, spin, spin + 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 20, spin + Math.PI, spin + Math.PI + 1.15);
    ctx.stroke();
  }

  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.stroke();

  if (type === "teemo") {
    ctx.fillStyle = "#2f6b3a";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(8, -6);
    ctx.lineTo(-8, -6);
    ctx.fill();
  } else if (type === "anivia") {
    ctx.strokeStyle = "#e7f7fb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.quadraticCurveTo(-8, -10, 0, 0);
    ctx.moveTo(16, 2);
    ctx.quadraticCurveTo(8, -10, 0, 0);
    ctx.stroke();
  } else if (type === "caitlyn") {
    ctx.strokeStyle = "#d7e4ff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(24, -2);
    ctx.stroke();
  }

  ctx.fillStyle = "#1a140c";
  ctx.font = "700 12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spec.mark, 0, 1);
  ctx.restore();
}

function drawShrooms() {
  for (const shroom of state.shrooms) {
    ctx.save();
    ctx.globalAlpha = shroom.life < 0.4 ? shroom.life / 0.4 : 1;
    ctx.translate(shroom.x, shroom.y);
    ctx.fillStyle = "rgba(226, 138, 58, 0.13)";
    ctx.beginPath();
    ctx.arc(0, 0, shroom.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(226, 138, 58, 0.45)";
    ctx.stroke();
    drawMushroom(0, 0, 1);
    ctx.restore();
  }
}

function drawMushroom(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f4e2c4";
  ctx.fillRect(-2, -1, 4, 8);
  ctx.fillStyle = "#e28a3a";
  ctx.beginPath();
  ctx.ellipse(0, -3, 8, 6, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = "#f4e2c4";
  ctx.beginPath();
  ctx.arc(-3, -5, 1.3, 0, TAU);
  ctx.arc(2.5, -4, 1.1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawStorms() {
  for (const storm of state.storms) {
    const fade = storm.life < 0.25 ? storm.life / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(storm.x, storm.y);
    ctx.fillStyle = "rgba(143, 208, 224, 0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, storm.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(210, 242, 248, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, storm.radius, storm.spin, storm.spin + 1.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, storm.radius * 0.62, storm.spin + 2, storm.spin + 3.4);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPortal() {
  const pos = pointOnPath(48);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = "#070d0a";
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 30, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#8d6cff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "rgba(180, 160, 255, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 18, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawNexus() {
  const pos = pointOnPath(pathLength - 48);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  if (state.nexusFlash > 0) {
    ctx.fillStyle = "rgba(225, 93, 79, " + state.nexusFlash * 0.7 + ")";
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, TAU);
    ctx.fill();
  }
  const broken = state.phase === "summary" && !state.victory;
  ctx.fillStyle = broken ? "#66727a" : "#7ed4e4";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(16, 0);
  ctx.lineTo(0, 26);
  ctx.lineTo(-16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6, 0);
  ctx.lineTo(0, 12);
  ctx.lineTo(-6, 0);
  ctx.closePath();
  ctx.fill();
  if (broken) {
    ctx.strokeStyle = "#1a140c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(3, 2);
    ctx.lineTo(-2, 14);
    ctx.stroke();
  }
  ctx.fillStyle = state.lives <= 3 ? "#e15d4f" : "#f3ead8";
  ctx.font = "700 13px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(String(state.lives), 0, 30);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);
    ctx.fillStyle = enemy.color;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 2;
    if (enemy.type === "swift") {
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 3, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius);
      ctx.lineTo(-enemy.radius, enemy.radius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (enemy.type === "cannon") {
      roundRect(-enemy.radius, -enemy.radius + 2, enemy.radius * 2, enemy.radius * 1.5, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4e555c";
      ctx.fillRect(0, -3, enemy.radius + 8, 6);
    } else if (enemy.type === "siege") {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#f3ead8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius - 5, 0, TAU);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    if (enemy.slowTimer > 0) {
      ctx.strokeStyle = "rgba(143, 208, 224, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 5, 0, TAU);
      ctx.stroke();
    }
    if (enemy.hitFlash > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, TAU);
      ctx.fill();
    }
    drawHealthBar(enemy);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHealthBar(enemy) {
  const width = 28;
  const height = 4;
  const x = enemy.x - width / 2;
  const y = enemy.y - enemy.radius - 12;
  const pct = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = pct > 0.55 ? "#8fbf73" : pct > 0.28 ? "#e0b15a" : "#e15d4f";
  ctx.fillRect(x, y, width * pct, height);
}

function drawBolts() {
  for (const bolt of state.bolts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, bolt.life / bolt.max);
    ctx.strokeStyle = bolt.color;
    ctx.lineWidth = bolt.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bolt.x1, bolt.y1);
    ctx.lineTo(bolt.x2, bolt.y2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFloaties() {
  ctx.save();
  ctx.font = "700 13px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const floater of state.floaties) {
    ctx.globalAlpha = Math.max(0, floater.life / floater.max);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.restore();
}

function drawBanner() {
  if (state.bannerTime <= 0 || !state.banner) return;
  const alpha = Math.min(1, state.bannerTime / 0.25);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#f3ead8";
  ctx.font = "40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.banner, VIEW_W / 2, 46);
  ctx.restore();
}

function drawHint() {
  if (state.towers.length > 0 || state.phase !== "build") return;
  ctx.save();
  ctx.fillStyle = "rgba(243, 234, 216, 0.88)";
  ctx.font = "15px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Click along the lane to place " + TOWER_TYPES[state.selected].name, VIEW_W / 2, VIEW_H - 22);
  ctx.restore();
}
