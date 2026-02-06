const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// MIME types
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

// HTTP server for static files
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// ── Game State ──────────────────────────────────────────────────────────────

const MAP_WIDTH = 128;
const MAP_HEIGHT = 128;

const gameState = {
  players: new Map(),
  units: new Map(),
  buildings: new Map(),
  resources: new Map(),
  trades: [],
  market: {
    tea: { price: 100, supply: 0 },
    spice: { price: 150, supply: 0 },
    rice: { price: 60, supply: 0 },
    cinnamon: { price: 200, supply: 0 },
    sapphire: { price: 500, supply: 0 },
    ruby: { price: 600, supply: 0 },
    moonstone: { price: 400, supply: 0 },
  },
  nextId: 1,
  tick: 0,
};

function generateId() {
  return gameState.nextId++;
}

// ── WebSocket multiplayer ───────────────────────────────────────────────────

const wss = new WebSocketServer({ server });

const clients = new Map();

wss.on('connection', (ws) => {
  const playerId = generateId();
  const player = {
    id: playerId,
    name: `Explorer ${playerId}`,
    color: PLAYER_COLORS[playerId % PLAYER_COLORS.length],
    resources: { gold: 500, food: 200, wood: 100, stone: 50 },
    inventory: {},
    explored: new Set(),
    reputation: 0,
  };

  gameState.players.set(playerId, player);
  clients.set(playerId, ws);

  // Create starting units for this player
  const startPositions = [
    { x: 20, y: 100 }, { x: 100, y: 20 },
    { x: 100, y: 100 }, { x: 20, y: 20 },
  ];
  const startPos = startPositions[(playerId - 1) % startPositions.length];

  const startingUnits = [];
  for (let i = 0; i < 3; i++) {
    const unit = {
      id: generateId(),
      playerId,
      type: i === 0 ? 'explorer' : 'worker',
      x: startPos.x + i * 2,
      y: startPos.y,
      hp: 100,
      maxHp: 100,
      task: null,
      targetX: null,
      targetY: null,
      carryType: null,
      carryAmount: 0,
      speed: i === 0 ? 1.5 : 1.0,
    };
    gameState.units.set(unit.id, unit);
    startingUnits.push(unit);
  }

  // Reveal starting area
  revealArea(player, startPos.x, startPos.y, 8);

  // Send initial state to new player
  ws.send(JSON.stringify({
    type: 'init',
    playerId,
    player,
    units: startingUnits,
    explored: Array.from(player.explored),
    market: gameState.market,
  }));

  // Broadcast new player to others
  broadcast({
    type: 'player_joined',
    playerId,
    name: player.name,
    color: player.color,
  }, playerId);

  // Send existing state
  ws.send(JSON.stringify({
    type: 'world_state',
    units: Array.from(gameState.units.values()).filter(u => {
      const key = `${Math.floor(u.x)},${Math.floor(u.y)}`;
      return player.explored.has(key);
    }),
    buildings: Array.from(gameState.buildings.values()).filter(b => {
      const key = `${Math.floor(b.x)},${Math.floor(b.y)}`;
      return player.explored.has(key);
    }),
  }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(playerId, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(playerId);
    // Keep player data but mark offline
    const p = gameState.players.get(playerId);
    if (p) p.online = false;
    broadcast({ type: 'player_left', playerId });
  });
});

const PLAYER_COLORS = [
  '#c23616', '#0097e6', '#44bd32', '#e1b12c',
  '#8c7ae6', '#e84393', '#00cec9', '#fd79a8',
];

function revealArea(player, cx, cy, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        const tx = Math.floor(cx + dx);
        const ty = Math.floor(cy + dy);
        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
          player.explored.add(`${tx},${ty}`);
        }
      }
    }
  }
}

function broadcast(msg, excludeId) {
  const data = JSON.stringify(msg);
  for (const [pid, ws] of clients) {
    if (pid !== excludeId && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

function sendTo(playerId, msg) {
  const ws = clients.get(playerId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Message Handling ────────────────────────────────────────────────────────

function handleMessage(playerId, msg) {
  switch (msg.type) {
    case 'move_units':
      handleMoveUnits(playerId, msg);
      break;
    case 'assign_task':
      handleAssignTask(playerId, msg);
      break;
    case 'build':
      handleBuild(playerId, msg);
      break;
    case 'trade':
      handleTrade(playerId, msg);
      break;
    case 'sell_to_market':
      handleSellToMarket(playerId, msg);
      break;
    case 'chat':
      broadcast({ type: 'chat', playerId, text: msg.text });
      break;
  }
}

function handleMoveUnits(playerId, msg) {
  const { unitIds, targetX, targetY } = msg;
  for (const uid of unitIds) {
    const unit = gameState.units.get(uid);
    if (unit && unit.playerId === playerId) {
      unit.targetX = targetX;
      unit.targetY = targetY;
      unit.task = 'moving';
    }
  }
}

function handleAssignTask(playerId, msg) {
  const { unitId, task, targetId } = msg;
  const unit = gameState.units.get(unitId);
  if (!unit || unit.playerId !== playerId) return;

  if (task === 'harvest') {
    const res = gameState.resources.get(targetId);
    if (res) {
      unit.task = 'harvesting';
      unit.taskTarget = targetId;
      unit.targetX = res.x;
      unit.targetY = res.y;
    }
  } else if (task === 'build') {
    const bld = gameState.buildings.get(targetId);
    if (bld) {
      unit.task = 'building';
      unit.taskTarget = targetId;
      unit.targetX = bld.x;
      unit.targetY = bld.y;
    }
  } else if (task === 'explore') {
    unit.task = 'exploring';
    unit.targetX = msg.targetX;
    unit.targetY = msg.targetY;
  }
}

function handleBuild(playerId, msg) {
  const { buildingType, x, y } = msg;
  const player = gameState.players.get(playerId);
  if (!player) return;

  const costs = BUILDING_COSTS[buildingType];
  if (!costs) return;

  // Check resources
  for (const [res, amount] of Object.entries(costs)) {
    if ((player.resources[res] || 0) < amount) {
      sendTo(playerId, { type: 'error', text: `Not enough ${res}` });
      return;
    }
  }

  // Deduct resources
  for (const [res, amount] of Object.entries(costs)) {
    player.resources[res] -= amount;
  }

  const building = {
    id: generateId(),
    playerId,
    type: buildingType,
    x, y,
    hp: BUILDING_DATA[buildingType].maxHp,
    maxHp: BUILDING_DATA[buildingType].maxHp,
    built: 0, // 0 to 100 progress
    workers: [],
  };

  gameState.buildings.set(building.id, building);

  broadcast({
    type: 'building_placed',
    building,
  });

  sendTo(playerId, { type: 'resources_update', resources: player.resources });
}

function handleTrade(playerId, msg) {
  const { targetPlayerId, offer, request } = msg;
  const player = gameState.players.get(playerId);
  const target = gameState.players.get(targetPlayerId);
  if (!player || !target) return;

  // Simple direct trade
  for (const [res, amount] of Object.entries(offer)) {
    if ((player.resources[res] || 0) < amount) {
      sendTo(playerId, { type: 'error', text: `Not enough ${res} to trade` });
      return;
    }
  }

  for (const [res, amount] of Object.entries(offer)) {
    player.resources[res] = (player.resources[res] || 0) - amount;
    target.resources[res] = (target.resources[res] || 0) + amount;
  }
  for (const [res, amount] of Object.entries(request)) {
    target.resources[res] = (target.resources[res] || 0) - amount;
    player.resources[res] = (player.resources[res] || 0) + amount;
  }

  sendTo(playerId, { type: 'resources_update', resources: player.resources });
  sendTo(targetPlayerId, { type: 'resources_update', resources: target.resources });
}

function handleSellToMarket(playerId, msg) {
  const { resource, amount } = msg;
  const player = gameState.players.get(playerId);
  if (!player) return;

  const inv = player.inventory[resource] || 0;
  if (inv < amount) {
    sendTo(playerId, { type: 'error', text: `Not enough ${resource}` });
    return;
  }

  const market = gameState.market[resource];
  if (!market) return;

  const revenue = Math.floor(market.price * amount);
  player.inventory[resource] -= amount;
  player.resources.gold += revenue;
  market.supply += amount;

  // Price drops with supply
  market.price = Math.max(10, Math.floor(market.price * (1 - amount * 0.01)));

  sendTo(playerId, {
    type: 'resources_update',
    resources: player.resources,
    inventory: player.inventory,
  });
  broadcast({ type: 'market_update', market: gameState.market });
}

const BUILDING_COSTS = {
  camp: { wood: 30, gold: 20 },
  farm: { wood: 40, gold: 30 },
  mine: { wood: 50, stone: 30, gold: 50 },
  warehouse: { wood: 60, stone: 40, gold: 40 },
  road: { stone: 10 },
  dock: { wood: 80, stone: 50, gold: 100 },
  tradingPost: { wood: 60, stone: 30, gold: 80 },
};

const BUILDING_DATA = {
  camp: { maxHp: 200, sizeX: 2, sizeY: 2 },
  farm: { maxHp: 150, sizeX: 3, sizeY: 3 },
  mine: { maxHp: 300, sizeX: 2, sizeY: 2 },
  warehouse: { maxHp: 250, sizeX: 3, sizeY: 2 },
  road: { maxHp: 50, sizeX: 1, sizeY: 1 },
  dock: { maxHp: 300, sizeX: 3, sizeY: 3 },
  tradingPost: { maxHp: 200, sizeX: 2, sizeY: 2 },
};

// ── Game Simulation Tick ────────────────────────────────────────────────────

const TICK_RATE = 100; // ms

function gameTick() {
  gameState.tick++;

  // Update units
  for (const unit of gameState.units.values()) {
    updateUnit(unit);
  }

  // Update buildings (production)
  if (gameState.tick % 50 === 0) {
    updateProduction();
  }

  // Market fluctuation
  if (gameState.tick % 200 === 0) {
    fluctuateMarket();
  }

  // Send unit position updates
  if (gameState.tick % 3 === 0) {
    const unitPositions = [];
    for (const unit of gameState.units.values()) {
      unitPositions.push({
        id: unit.id,
        x: unit.x,
        y: unit.y,
        task: unit.task,
        carryType: unit.carryType,
        carryAmount: unit.carryAmount,
      });
    }
    broadcast({ type: 'unit_positions', units: unitPositions });
  }
}

function updateUnit(unit) {
  if (unit.targetX == null || unit.targetY == null) return;

  const dx = unit.targetX - unit.x;
  const dy = unit.targetY - unit.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.5) {
    // Arrived at target
    if (unit.task === 'moving') {
      unit.task = null;
      unit.targetX = null;
      unit.targetY = null;
    } else if (unit.task === 'harvesting') {
      harvestTick(unit);
    } else if (unit.task === 'building') {
      buildTick(unit);
    } else if (unit.task === 'exploring') {
      const player = gameState.players.get(unit.playerId);
      if (player) {
        const radius = unit.type === 'explorer' ? 10 : 6;
        revealArea(player, unit.x, unit.y, radius);
        sendTo(unit.playerId, {
          type: 'fog_reveal',
          explored: Array.from(player.explored),
        });

        // Check for discovery
        checkDiscovery(unit, player);
      }
      unit.task = null;
      unit.targetX = null;
      unit.targetY = null;
    }
    return;
  }

  // Move toward target
  const speed = unit.speed * 0.15;
  unit.x += (dx / dist) * speed;
  unit.y += (dy / dist) * speed;

  // Reveal fog as unit moves
  const player = gameState.players.get(unit.playerId);
  if (player) {
    const radius = unit.type === 'explorer' ? 8 : 4;
    revealArea(player, unit.x, unit.y, radius);
  }
}

function harvestTick(unit) {
  const res = gameState.resources.get(unit.taskTarget);
  if (!res || res.amount <= 0) {
    unit.task = null;
    unit.taskTarget = null;
    return;
  }

  if (unit.carryAmount >= 10) {
    // Need to drop off at nearest warehouse/camp
    const dropoff = findNearestDropoff(unit);
    if (dropoff) {
      unit.task = 'returning';
      unit.targetX = dropoff.x;
      unit.targetY = dropoff.y;
      unit.dropoffId = dropoff.id;
    }
    return;
  }

  const harvestRate = unit.type === 'worker' ? 1 : 0.5;
  const harvested = Math.min(harvestRate, res.amount);
  res.amount -= harvested;
  unit.carryType = res.resourceType;
  unit.carryAmount += harvested;

  if (res.amount <= 0) {
    gameState.resources.delete(res.id);
    broadcast({ type: 'resource_depleted', id: res.id });
  }
}

function buildTick(unit) {
  const bld = gameState.buildings.get(unit.taskTarget);
  if (!bld || bld.built >= 100) {
    unit.task = null;
    unit.taskTarget = null;
    return;
  }

  bld.built = Math.min(100, bld.built + 2);
  if (bld.built >= 100) {
    broadcast({ type: 'building_complete', id: bld.id });
  }
}

function findNearestDropoff(unit) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const bld of gameState.buildings.values()) {
    if (bld.playerId !== unit.playerId) continue;
    if (bld.built < 100) continue;
    if (!['camp', 'warehouse', 'tradingPost'].includes(bld.type)) continue;
    const d = Math.sqrt((bld.x - unit.x) ** 2 + (bld.y - unit.y) ** 2);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = bld;
    }
  }
  return nearest;
}

function checkDiscovery(unit, player) {
  // Chance to discover something at the explore destination
  const roll = Math.random();
  if (roll < 0.15) {
    // Discover a ruin
    const discoveries = [
      { type: 'artifact', name: 'Ancient Scroll', bonus: { reputation: 10 } },
      { type: 'artifact', name: 'Stone Idol', bonus: { reputation: 15 } },
      { type: 'lore', name: 'Temple Inscription', bonus: { reputation: 5 } },
      { type: 'resource_cache', name: 'Hidden Gem Cache', bonus: { sapphire: 5 } },
      { type: 'resource_cache', name: 'Abandoned Storehouse', bonus: { food: 100, wood: 50 } },
      { type: 'ruin', name: 'Ancient City Ruins', bonus: { reputation: 25, gold: 200 } },
    ];
    const disc = discoveries[Math.floor(Math.random() * discoveries.length)];
    player.reputation += disc.bonus.reputation || 0;
    for (const [key, val] of Object.entries(disc.bonus)) {
      if (key === 'reputation') continue;
      if (['sapphire', 'ruby', 'moonstone'].includes(key)) {
        player.inventory[key] = (player.inventory[key] || 0) + val;
      } else {
        player.resources[key] = (player.resources[key] || 0) + val;
      }
    }
    sendTo(player.id, {
      type: 'discovery',
      discovery: disc,
      x: unit.x,
      y: unit.y,
    });
    sendTo(player.id, {
      type: 'resources_update',
      resources: player.resources,
      inventory: player.inventory,
    });
  }
}

function updateProduction() {
  for (const bld of gameState.buildings.values()) {
    if (bld.built < 100) continue;
    const player = gameState.players.get(bld.playerId);
    if (!player) continue;

    if (bld.type === 'farm') {
      const produce = ['tea', 'spice', 'rice', 'cinnamon'][Math.floor(Math.random() * 4)];
      player.inventory[produce] = (player.inventory[produce] || 0) + 1;
    } else if (bld.type === 'mine') {
      const gem = ['sapphire', 'ruby', 'moonstone'][Math.floor(Math.random() * 3)];
      if (Math.random() < 0.3) {
        player.inventory[gem] = (player.inventory[gem] || 0) + 1;
      }
    }

    sendTo(bld.playerId, {
      type: 'resources_update',
      resources: player.resources,
      inventory: player.inventory,
    });
  }
}

function fluctuateMarket() {
  for (const [resource, data] of Object.entries(gameState.market)) {
    // Prices slowly recover
    const basePrice = { tea: 100, spice: 150, rice: 60, cinnamon: 200, sapphire: 500, ruby: 600, moonstone: 400 };
    const drift = (basePrice[resource] - data.price) * 0.05;
    const noise = (Math.random() - 0.5) * 20;
    data.price = Math.max(10, Math.round(data.price + drift + noise));
    data.supply = Math.max(0, data.supply - 1);
  }
  broadcast({ type: 'market_update', market: gameState.market });
}

setInterval(gameTick, TICK_RATE);

// ── Start Server ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Crown of Ceylon server running on http://localhost:${PORT}`);
});
