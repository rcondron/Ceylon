// =============================================================================
// Crown of Ceylon -- Game Server
// Stardew Valley x Age of Empires hybrid: multiplayer farming, crafting, trade,
// day/night cycle, cozy exploration set in 1700s Sri Lanka.
//
// Each player controls a single character (not RTS units). The server tracks
// positions, farm state, buildings, market prices, and relays everything over
// WebSocket so multiple browsers stay in sync.
// =============================================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// -- MIME types for static file serving ---------------------------------------

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// -- HTTP server (static files from /public) ----------------------------------

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  urlPath = urlPath.split('?')[0];                       // strip query strings
  const filePath = path.join(__dirname, 'public', urlPath);
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

// =============================================================================
// Constants
// =============================================================================

// Warm, cozy palette for player characters
const PLAYER_COLORS = [
  '#c07848', '#5090c0', '#80a848', '#c0a050',
  '#a06898', '#50a0a0', '#c08060', '#7080c0',
];

const TICK_RATE = 100;  // milliseconds per server tick
const STATE_BROADCAST_INTERVAL  = 5;   // broadcast full state every N ticks
const MARKET_FLUCTUATION_INTERVAL = 200; // market re-prices every N ticks

// -- Recipes (mirrors client-side RECIPES) ------------------------------------

const RECIPES = {
  driedTea:     { input: { tea: 3 },               output: { driedTea: 1 } },
  packagedTea:  { input: { driedTea: 2 },           output: { packagedTea: 1 } },
  spiceBundle:  { input: { cinnamon: 2, spice: 1 }, output: { spiceBundle: 1 } },
  milledRice:   { input: { rice: 4 },               output: { milledRice: 2 } },
  cutGem:       { input: { sapphire: 1 },           output: { cutGem: 1 } },
  cutRuby:      { input: { ruby: 1 },               output: { cutGem: 1 } },
  jewelry:      { input: { cutGem: 1, gold: 5 },    output: { jewelry: 1 } },
  food:         { input: { rice: 2 },                output: { food: 1 } },
};

// -- Building costs (mirrors client-side BUILD_COSTS) -------------------------

const BUILD_COSTS = {
  house:       { wood: 20, stone: 10 },
  farm:        { wood: 10 },
  smelter:     { stone: 15, wood: 5 },
  gemCutter:   { wood: 10, stone: 5 },
  dryingRack:  { wood: 15 },
  carpentry:   { wood: 20, stone: 5 },
  warehouse:   { wood: 25, stone: 15 },
  tradingPost: { wood: 20, stone: 10, gold: 30 },
  dock:        { wood: 30, stone: 10 },
  road:        { stone: 3 },
  well:        { stone: 10, wood: 5 },
  marketStall: { wood: 15, gold: 20 },
};

// -- Base market prices (supply/demand shifts these at runtime) ---------------

const BASE_MARKET_PRICES = {
  tea: 8,    driedTea: 18,   packagedTea: 35,
  rice: 4,   milledRice: 12,
  cinnamon: 12, spiceBundle: 30,
  sapphire: 25, ruby: 30, moonstone: 20,
  cutGem: 60,  jewelry: 120,
  wood: 3,   stone: 4,  food: 5,
};

// =============================================================================
// Colombo spawn-point finder
// Replicates the minimal procedural-noise logic from the client map generator
// (seed 42) so the server can place new players at colomboX + 4, colomboY.
// =============================================================================

function findColombo(seed) {
  const MAP_W = 128, MAP_H = 128;

  function seededRandom(v) {
    const s = Math.sin(v * 127.1 + seed * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  function noise2D(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix,        fy = y - iy;
    const a = seededRandom(ix     + iy * 57);
    const b = seededRandom(ix + 1 + iy * 57);
    const c = seededRandom(ix     + (iy + 1) * 57);
    const d = seededRandom(ix + 1 + (iy + 1) * 57);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y, octaves, lac, gain) {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise2D(x * freq, y * freq) * amp;
      max += amp;
      amp  *= gain;
      freq *= lac;
    }
    return sum / max;
  }

  function islandMask(x, y) {
    const nx = x / MAP_W, ny = y / MAP_H;
    const dx = (nx - 0.5)  * 2.2;
    const dy = (ny - 0.48) * 2.0;
    let d = dx * dx * 1.2 + dy * dy;
    if (ny < 0.3)  { d = dx * dx * (1 + (0.3 - ny) * 4) * 2 + dy * dy; }
    if (ny > 0.6)  { d *= 0.85; }
    if (nx > 0.55 && ny > 0.3 && ny < 0.6) { d += 0.05; }
    return 1 - Math.min(1, d * 1.3);
  }

  const targetY = Math.floor(MAP_H * 0.45);           // same as client
  for (let x = 0; x < MAP_W; x++) {
    const island    = islandMask(x, targetY);
    const elevation = fbm(x * 0.03, targetY * 0.03, 6, 2.0, 0.5);
    const h = elevation * island;
    // SAND (0.12-0.16) or GRASS (0.16-0.65) -- first walkable coastal tile
    if (h >= 0.12 && h < 0.65) {
      return { x, y: targetY };
    }
  }
  return { x: 30, y: targetY };                       // safe fallback
}

const colombo   = findColombo(42);
const COLOMBO_X = colombo.x;
const COLOMBO_Y = colombo.y;

// =============================================================================
// Game State
// =============================================================================

const gameState = {
  players:      new Map(),   // playerId -> player object
  buildings:    new Map(),   // buildingId -> building object
  farmPlots:    new Map(),   // "x,y" -> { crop, stage, watered, daysGrown, owner }
  market:       { ...BASE_MARKET_PRICES },
  marketSupply: {},          // resource -> cumulative units sold (drives price down)
  dayCount:     1,
  season:       'monsoon',
  tick:         0,
  nextId:       1,
  sleepVotes:   new Set(),
};

function generateId() {
  return gameState.nextId++;
}

// =============================================================================
// WebSocket Server
// =============================================================================

const wss     = new WebSocketServer({ server });
const clients = new Map();  // playerId -> ws

wss.on('connection', (ws) => {
  const playerId   = generateId();
  const colorIndex = (playerId - 1) % PLAYER_COLORS.length;

  const player = {
    id:        playerId,
    name:      `Explorer ${playerId}`,
    color:     PLAYER_COLORS[colorIndex],
    x:         COLOMBO_X + 4,
    y:         COLOMBO_Y,
    direction: 0,
    moving:    false,
    gold:      50,
    energy:    100,
    maxEnergy: 100,
    reputation: 0,
    inventory: [
      { item: 'wood', count: 10 },
      { item: 'food', count: 5 },
    ],
    online:    true,
  };

  gameState.players.set(playerId, player);
  clients.set(playerId, ws);

  console.log(`Player ${player.name} (${player.color}) connected.`);

  // -- Send initialisation packet to the new player --------------------------

  ws.send(JSON.stringify({
    type:      'init',
    playerId,
    startX:    player.x,
    startY:    player.y,
    color:     player.color,
    name:      player.name,
    gold:      player.gold,
    inventory: player.inventory,
  }));

  // -- Notify everyone else ---------------------------------------------------

  broadcast({
    type:     'player_joined',
    playerId,
    name:     player.name,
  }, playerId);

  // -- Send current world snapshot to the newcomer ----------------------------

  ws.send(JSON.stringify({
    type:         'state_update',
    players:      getPlayersStateFor(playerId),
    buildings:    Array.from(gameState.buildings.values()),
    marketPrices: gameState.market,
  }));

  // -- Incoming messages ------------------------------------------------------

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleMessage(playerId, msg);
    } catch (e) {
      console.error(`Bad message from player ${playerId}:`, e.message);
    }
  });

  // -- Disconnect -------------------------------------------------------------

  ws.on('close', () => {
    clients.delete(playerId);
    const p = gameState.players.get(playerId);
    if (p) {
      p.online = false;
      console.log(`Player ${p.name} disconnected.`);
      broadcast({ type: 'player_left', playerId, name: p.name });
    }
    gameState.sleepVotes.delete(playerId);
  });
});

// =============================================================================
// Helpers
// =============================================================================

/** Send to every connected client except `excludeId`. */
function broadcast(msg, excludeId) {
  const data = JSON.stringify(msg);
  for (const [pid, ws] of clients) {
    if (pid !== excludeId && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

/** Send to every connected client including the sender. */
function broadcastAll(msg) {
  const data = JSON.stringify(msg);
  for (const [, ws] of clients) {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  }
}

/** Send to a single player. */
function sendTo(playerId, msg) {
  const ws = clients.get(playerId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

/** Build a list of other online players for a state_update packet. */
function getPlayersStateFor(excludeId) {
  const list = [];
  for (const [id, p] of gameState.players) {
    if (id === excludeId || !p.online) continue;
    list.push({
      id:        p.id,
      name:      p.name,
      color:     p.color,
      x:         p.x,
      y:         p.y,
      direction: p.direction,
      moving:    p.moving,
    });
  }
  return list;
}

// -- Inventory helpers (server-side mirror of client logic) -------------------

function getInvCount(player, item) {
  const slot = player.inventory.find(s => s.item === item);
  return slot ? slot.count : 0;
}

function addInv(player, item, count) {
  const slot = player.inventory.find(s => s.item === item);
  if (slot) { slot.count += count; }
  else      { player.inventory.push({ item, count }); }
}

function removeInv(player, item, count) {
  const slot = player.inventory.find(s => s.item === item);
  if (!slot || slot.count < count) return false;
  slot.count -= count;
  if (slot.count <= 0) {
    player.inventory = player.inventory.filter(s => s.count > 0);
  }
  return true;
}

/** Check whether `player` owns enough of every resource in `costs`. */
function hasResources(player, costs) {
  for (const [item, amount] of Object.entries(costs)) {
    if (item === 'gold') { if (player.gold < amount) return false; }
    else                 { if (getInvCount(player, item) < amount) return false; }
  }
  return true;
}

/** Deduct `costs` from the player (gold + inventory). */
function spendResources(player, costs) {
  for (const [item, amount] of Object.entries(costs)) {
    if (item === 'gold') { player.gold -= amount; }
    else                 { removeInv(player, item, amount); }
  }
}

// =============================================================================
// Message Router
// =============================================================================

function handleMessage(playerId, msg) {
  const player = gameState.players.get(playerId);
  if (!player) return;

  switch (msg.type) {
    case 'player_move':    handlePlayerMove(player, msg);    break;
    case 'farm_action':    handleFarmAction(player, msg);    break;
    case 'gather':         handleGather(player, msg);        break;
    case 'craft':          handleCraft(player, msg);         break;
    case 'build':          handleBuild(player, msg);         break;
    case 'sell_to_market': handleSellToMarket(player, msg);  break;
    case 'trade':          handleTrade(player, msg);         break;
    case 'chat':           handleChat(player, msg);          break;
    case 'sleep':          handleSleep(player);              break;
    default: break; // unknown message -- silently ignored
  }
}

// =============================================================================
// Message Handlers
// =============================================================================

// -- Movement -----------------------------------------------------------------

function handlePlayerMove(player, msg) {
  if (typeof msg.x === 'number') player.x = msg.x;
  if (typeof msg.y === 'number') player.y = msg.y;
  if (typeof msg.direction === 'number') player.direction = msg.direction;
  if (typeof msg.moving === 'boolean')   player.moving    = msg.moving;
}

// -- Farming ------------------------------------------------------------------

function handleFarmAction(player, msg) {
  const { action, x, y, cropType } = msg;
  if (typeof x !== 'number' || typeof y !== 'number') return;
  const key = `${Math.floor(x)},${Math.floor(y)}`;

  switch (action) {
    case 'till': {
      if (!gameState.farmPlots.has(key)) {
        gameState.farmPlots.set(key, {
          crop: null, stage: 0, watered: false, daysGrown: 0, owner: player.id,
        });
      }
      broadcast({ type: 'farm_update', action: 'till', x, y }, player.id);
      break;
    }

    case 'water': {
      const plot = gameState.farmPlots.get(key);
      if (plot) {
        plot.watered = true;
        broadcast({ type: 'farm_update', action: 'water', x, y }, player.id);
      }
      break;
    }

    case 'plant': {
      const plot = gameState.farmPlots.get(key);
      if (plot && !plot.crop && cropType) {
        plot.crop      = cropType;
        plot.stage     = 0;
        plot.daysGrown = 0;
        broadcast({ type: 'farm_update', action: 'plant', x, y, cropType }, player.id);
      }
      break;
    }

    case 'harvest': {
      const plot = gameState.farmPlots.get(key);
      if (plot && plot.crop && plot.stage >= 4) {
        // Reset the plot so it can be replanted
        plot.crop      = null;
        plot.stage     = 0;
        plot.daysGrown = 0;
        broadcast({ type: 'farm_update', action: 'harvest', x, y }, player.id);
      }
      break;
    }
  }
}

// -- Gathering ----------------------------------------------------------------

function handleGather(player, msg) {
  // The client has already deducted from the local resource node and added to
  // its own inventory. The server relays the event so other clients can mirror
  // the depletion on their local maps.
  if (msg.nodeId == null) return;
  broadcast({
    type:     'gather_sync',
    playerId: player.id,
    nodeId:   msg.nodeId,
  }, player.id);
}

// -- Crafting -----------------------------------------------------------------

function handleCraft(player, msg) {
  const recipe = RECIPES[msg.recipe];
  if (!recipe) return;

  // Validate the player has the required inputs
  if (!hasResources(player, recipe.input)) return;

  // Deduct inputs
  spendResources(player, recipe.input);

  // Grant outputs
  for (const [item, count] of Object.entries(recipe.output)) {
    addInv(player, item, count);
  }

  sendTo(player.id, {
    type:      'resource_update',
    gold:      player.gold,
    inventory: player.inventory,
  });
}

// -- Building -----------------------------------------------------------------

function handleBuild(player, msg) {
  const { buildingType, x, y } = msg;
  const costs = BUILD_COSTS[buildingType];
  if (!costs) return;
  if (typeof x !== 'number' || typeof y !== 'number') return;

  // Validate resources
  if (!hasResources(player, costs)) {
    sendTo(player.id, { type: 'error', text: 'Not enough resources' });
    return;
  }

  // Deduct cost
  spendResources(player, costs);

  const building = {
    id:    generateId(),
    type:  buildingType,
    x, y,
    owner: player.id,
    built: 100,
    color: player.color,
  };
  gameState.buildings.set(building.id, building);

  // Confirm to builder and update their resources
  sendTo(player.id, { type: 'build_confirm', building });
  sendTo(player.id, {
    type:      'resource_update',
    gold:      player.gold,
    inventory: player.inventory,
  });

  // Tell everyone else about the new building
  broadcast({ type: 'build_confirm', building }, player.id);
}

// -- Sell to market -----------------------------------------------------------

function handleSellToMarket(player, msg) {
  const { resource, amount } = msg;
  if (!resource || typeof amount !== 'number' || amount <= 0) return;

  const held = getInvCount(player, resource);
  if (held < amount) {
    sendTo(player.id, { type: 'error', text: `Not enough ${resource}` });
    return;
  }

  const unitPrice = gameState.market[resource];
  if (unitPrice == null) return;

  const revenue = unitPrice * amount;
  removeInv(player, resource, amount);
  player.gold += revenue;

  // Supply pressure drives the price down
  gameState.marketSupply[resource] =
    (gameState.marketSupply[resource] || 0) + amount;
  gameState.market[resource] =
    Math.max(1, Math.floor(unitPrice * (1 - amount * 0.02)));

  sendTo(player.id, {
    type:      'resource_update',
    gold:      player.gold,
    inventory: player.inventory,
  });
  sendTo(player.id, {
    type:   'trade_complete',
    earned: revenue,
    gold:   player.gold,
  });

  broadcastAll({ type: 'market_update', prices: gameState.market });
}

// -- Player-to-player trade ---------------------------------------------------

function handleTrade(player, msg) {
  const { targetPlayerId, offer, request } = msg;
  const target = gameState.players.get(targetPlayerId);
  if (!target || !target.online) {
    sendTo(player.id, { type: 'error', text: 'Player not available' });
    return;
  }

  // Validate offering side
  for (const [item, count] of Object.entries(offer || {})) {
    if (item === 'gold') {
      if (player.gold < count) {
        sendTo(player.id, { type: 'error', text: `Not enough gold to offer` });
        return;
      }
    } else if (getInvCount(player, item) < count) {
      sendTo(player.id, { type: 'error', text: `Not enough ${item} to offer` });
      return;
    }
  }

  // Validate requesting side
  for (const [item, count] of Object.entries(request || {})) {
    if (item === 'gold') {
      if (target.gold < count) {
        sendTo(player.id, { type: 'error', text: `Other player lacks gold` });
        return;
      }
    } else if (getInvCount(target, item) < count) {
      sendTo(player.id, { type: 'error', text: `Other player lacks ${item}` });
      return;
    }
  }

  // Transfer offered resources: player -> target
  for (const [item, count] of Object.entries(offer || {})) {
    if (item === 'gold') { player.gold -= count; target.gold += count; }
    else { removeInv(player, item, count); addInv(target, item, count); }
  }

  // Transfer requested resources: target -> player
  for (const [item, count] of Object.entries(request || {})) {
    if (item === 'gold') { target.gold -= count; player.gold += count; }
    else { removeInv(target, item, count); addInv(player, item, count); }
  }

  sendTo(player.id, {
    type:      'resource_update',
    gold:      player.gold,
    inventory: player.inventory,
  });
  sendTo(target.id, {
    type:      'resource_update',
    gold:      target.gold,
    inventory: target.inventory,
  });
}

// -- Chat ---------------------------------------------------------------------

function handleChat(player, msg) {
  const text = (msg.text || '').slice(0, 200);  // enforce length limit
  if (!text) return;
  broadcastAll({
    type:     'chat',
    playerId: player.id,
    name:     player.name,
    text,
  });
}

// -- Sleep (day advance) ------------------------------------------------------

function handleSleep(player) {
  gameState.sleepVotes.add(player.id);

  // Day advances once ALL online players have requested sleep
  const onlineCount = [...gameState.players.values()].filter(p => p.online).length;
  if (onlineCount > 0 && gameState.sleepVotes.size >= onlineCount) {
    advanceDay();
  }
}

// =============================================================================
// Day / Night Cycle
// =============================================================================

function advanceDay() {
  gameState.dayCount++;
  gameState.sleepVotes.clear();

  // Rotate season every 7 in-game days
  const SEASONS = ['monsoon', 'dry', 'harvest', 'planting'];
  gameState.season = SEASONS[Math.floor((gameState.dayCount - 1) / 7) % SEASONS.length];

  // Grow crops in watered farm plots
  for (const [, plot] of gameState.farmPlots) {
    if (!plot.crop) continue;
    if (plot.watered) {
      plot.daysGrown++;
      const growthTime = { tea: 4, rice: 3, cinnamon: 6, spice: 5 };
      const needed = growthTime[plot.crop] || 4;
      plot.stage = Math.min(4, Math.floor((plot.daysGrown / needed) * 4));
    }
    plot.watered = false;          // soil dries overnight
  }

  // Restore energy for all online players
  for (const p of gameState.players.values()) {
    if (p.online) {
      p.energy = p.maxEnergy;
    }
  }

  broadcastAll({
    type:   'day_advance',
    day:    gameState.dayCount,
    season: gameState.season,
  });

  console.log(`Day ${gameState.dayCount} -- ${gameState.season} season`);
}

// =============================================================================
// Market Price Fluctuation
// =============================================================================

function fluctuateMarket() {
  for (const [resource, basePrice] of Object.entries(BASE_MARKET_PRICES)) {
    const current  = gameState.market[resource];
    const supply   = gameState.marketSupply[resource] || 0;

    // Drift toward base price (mean reversion)
    const drift = (basePrice - current) * 0.08;

    // Random noise proportional to base price
    const noise = (Math.random() - 0.5) * basePrice * 0.1;

    // Excess supply pushes price down
    const supplyPressure = -supply * 0.02;

    gameState.market[resource] =
      Math.max(1, Math.round(current + drift + noise + supplyPressure));

    // Supply gradually decays (goods absorbed by NPC economy)
    if (supply > 0) {
      gameState.marketSupply[resource] = Math.max(0, supply - 1);
    }
  }

  broadcastAll({ type: 'market_update', prices: gameState.market });
}

// =============================================================================
// Tick-Based Game Loop (100 ms)
// =============================================================================

function gameTick() {
  gameState.tick++;

  // Fluctuate market prices periodically
  if (gameState.tick % MARKET_FLUCTUATION_INTERVAL === 0) {
    fluctuateMarket();
  }

  // Broadcast full state snapshot to all players every N ticks
  if (gameState.tick % STATE_BROADCAST_INTERVAL === 0) {
    for (const [pid, ws] of clients) {
      if (ws.readyState !== 1) continue;
      ws.send(JSON.stringify({
        type:         'state_update',
        players:      getPlayersStateFor(pid),
        buildings:    Array.from(gameState.buildings.values()),
        marketPrices: gameState.market,
      }));
    }
  }
}

setInterval(gameTick, TICK_RATE);

// =============================================================================
// Start Server
// =============================================================================

server.listen(PORT, () => {
  console.log(`Crown of Ceylon server running on http://localhost:${PORT}`);
  console.log(`Colombo spawn point: (${COLOMBO_X}, ${COLOMBO_Y})`);
});
