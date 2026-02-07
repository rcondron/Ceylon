// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Game Controller
// Stardew Valley × Age of Empires hybrid: farming, crafting, trade routes,
// day/night cycle, cozy exploration, multiplayer economy.
// ═══════════════════════════════════════════════════════════════════════════

const game = (() => {
  // ── Player State ────────────────────────────────────────────────────────

  const player = {
    x: 0, y: 0,
    direction: 0,
    moving: false,
    speed: 0.06,
    color: '#e8d0a0',
    name: 'Explorer',

    gold: 50,
    energy: 100,
    maxEnergy: 100,
    reputation: 0,

    inventory: [],
    maxInventory: 24,
    hotbarSlot: 0,

    tools: ['hoe', 'wateringCan', 'pickaxe', 'axe', 'machete', 'seeds'],
    currentTool: 'hoe',
    toolLevel: { hoe: 1, wateringCan: 1, pickaxe: 1, axe: 1, machete: 1 },
    selectedSeed: 'tea',
  };

  // ── World State ─────────────────────────────────────────────────────────

  let dayCount = 1;
  let timeOfDay = 0.3;
  let timeSpeed = 0.00008;
  let season = 'monsoon';

  let buildings = new Map();
  let otherPlayers = [];

  const RECIPES = {
    driedTea: { input: { tea: 3 }, output: { driedTea: 1 }, station: 'dryingRack', time: 2 },
    packagedTea: { input: { driedTea: 2 }, output: { packagedTea: 1 }, station: 'dryingRack', time: 1 },
    spiceBundle: { input: { cinnamon: 2, spice: 1 }, output: { spiceBundle: 1 }, station: 'dryingRack', time: 2 },
    milledRice: { input: { rice: 4 }, output: { milledRice: 2 }, station: null, time: 1 },
    cutGem: { input: { sapphire: 1 }, output: { cutGem: 1 }, station: 'gemCutter', time: 3 },
    cutRuby: { input: { ruby: 1 }, output: { cutGem: 1 }, station: 'gemCutter', time: 3 },
    jewelry: { input: { cutGem: 1, gold: 5 }, output: { jewelry: 1 }, station: 'gemCutter', time: 4 },
    food: { input: { rice: 2 }, output: { food: 1 }, station: null, time: 0 },
  };

  const BUILD_COSTS = {
    house: { wood: 20, stone: 10 },
    farm: { wood: 10 },
    smelter: { stone: 15, wood: 5 },
    gemCutter: { wood: 10, stone: 5 },
    dryingRack: { wood: 15 },
    carpentry: { wood: 20, stone: 5 },
    warehouse: { wood: 25, stone: 15 },
    tradingPost: { wood: 20, stone: 10, gold: 30 },
    dock: { wood: 30, stone: 10 },
    road: { stone: 3 },
    well: { stone: 10, wood: 5 },
    marketStall: { wood: 15, gold: 20 },
  };

  let marketPrices = {
    tea: 8, driedTea: 18, packagedTea: 35,
    rice: 4, milledRice: 12,
    cinnamon: 12, spiceBundle: 30,
    sapphire: 25, ruby: 30, moonstone: 20,
    cutGem: 60, jewelry: 120,
    wood: 3, stone: 4, food: 5,
  };

  let buildMode = null;
  let buildGhostX = 0, buildGhostY = 0;
  let showInventory = false;
  let showCrafting = false;
  let showBuildMenu = false;
  let showMarket = false;
  let chatActive = false;
  let chatMessages = [];
  let notifications = [];
  let offlineMode = false;
  let frameCount = 0;
  let lastNetworkUpdate = 0;

  // ── Initialization ──────────────────────────────────────────────────────

  async function init() {
    GameMap.generate(42);
    Renderer.init();
    Input.init();

    addToInventory('wood', 10);
    addToInventory('food', 5);

    try {
      const initData = await Network.connect();
      player.x = initData.startX || GameMap.colomboX + 4;
      player.y = initData.startY || GameMap.colomboY;
      player.color = initData.color || player.color;
      player.name = initData.name || player.name;
      if (initData.inventory) player.inventory = initData.inventory;
      if (initData.gold != null) player.gold = initData.gold;
      setupNetworkHandlers();
      addNotification('Connected! Welcome to Ceylon.');
    } catch (e) {
      console.log('Running in offline mode');
      offlineMode = true;
      player.x = GameMap.colomboX + 4;
      player.y = GameMap.colomboY;
      addNotification('Offline mode. Explore and build!');
    }

    Renderer.followPlayer(player.x, player.y);
    Renderer.setVisibleFromPlayer(player.x, player.y, 12);

    Sprites.drawHudIcon('icon-gold', 'gold');
    Sprites.drawHudIcon('icon-energy', 'energy');
    Sprites.drawHudIcon('icon-reputation', 'reputation');

    addNotification('Day ' + dayCount + ' - ' + getSeasonName());
    addNotification('WASD to move. E to interact. 1-6 for tools.');

    requestAnimationFrame(gameLoop);
  }

  function setupNetworkHandlers() {
    Network.on('state_update', (msg) => {
      if (msg.players) otherPlayers = msg.players.filter(p => p.id !== Network.playerId);
      if (msg.buildings) buildings = new Map(msg.buildings.map(b => [b.id, b]));
      if (msg.marketPrices) marketPrices = msg.marketPrices;
    });
    Network.on('player_joined', (msg) => addNotification(msg.name + ' has arrived in Ceylon!'));
    Network.on('player_left', (msg) => {
      addNotification(msg.name + ' has departed.');
      otherPlayers = otherPlayers.filter(p => p.id !== msg.playerId);
    });
    Network.on('chat', (msg) => {
      chatMessages.push({ name: msg.name, text: msg.text, time: Date.now() });
      if (chatMessages.length > 50) chatMessages.shift();
    });
    Network.on('market_update', (msg) => { if (msg.prices) marketPrices = msg.prices; });
    Network.on('discovery', (msg) => {
      addNotification('Discovery: ' + msg.description);
      if (msg.reward) {
        for (const [item, count] of Object.entries(msg.reward)) addToInventory(item, count);
      }
    });
    Network.on('day_advance', (msg) => {
      dayCount = msg.day || dayCount + 1;
      timeOfDay = 0.25;
      season = msg.season || season;
      GameMap.advanceDay();
      player.energy = player.maxEnergy;
      addNotification('Day ' + dayCount + ' - ' + getSeasonName());
    });
    Network.on('farm_update', (msg) => {
      if (msg.action === 'till') GameMap.tileFarm(msg.x, msg.y);
      else if (msg.action === 'water') GameMap.waterFarm(msg.x, msg.y);
      else if (msg.action === 'plant') GameMap.plantCrop(msg.x, msg.y, msg.cropType);
    });
    Network.on('build_confirm', (msg) => {
      buildings.set(msg.building.id, msg.building);
      addNotification('Built: ' + msg.building.type);
    });
    Network.on('resource_update', (msg) => {
      if (msg.gold != null) player.gold = msg.gold;
      if (msg.inventory) player.inventory = msg.inventory;
      if (msg.energy != null) player.energy = msg.energy;
    });
    Network.on('trade_complete', (msg) => {
      addNotification('Trade complete! Earned ' + msg.earned + ' gold.');
      if (msg.gold != null) player.gold = msg.gold;
    });
  }

  // ── Game Loop ───────────────────────────────────────────────────────────

  function gameLoop() {
    frameCount++;
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  function update() {
    timeOfDay += timeSpeed;
    if (timeOfDay >= 1) advanceDay();

    const movement = Input.getMovement();
    if (movement.moving && player.energy > 0) {
      const newX = player.x + movement.dx * player.speed;
      const newY = player.y + movement.dy * player.speed;
      if (GameMap.isWalkable(Math.floor(newX), Math.floor(newY))) {
        player.x = newX;
        player.y = newY;
        player.moving = true;
        player.direction = movement.direction;
        if (frameCount % 120 === 0) player.energy = Math.max(0, player.energy - 0.5);
      }
    } else {
      player.moving = false;
    }

    Renderer.followPlayer(player.x, player.y);
    Renderer.setVisibleFromPlayer(player.x, player.y, 12);

    if (frameCount - lastNetworkUpdate > 6) {
      lastNetworkUpdate = frameCount;
      Network.sendPlayerPosition(player.x, player.y, player.direction, player.moving);
    }

    updateHUD();
  }

  function draw() {
    const dirs = [{ dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }];
    const d = dirs[player.direction];
    const interactTile = { x: Math.floor(player.x + d.dx), y: Math.floor(player.y + d.dy) };

    Renderer.render({
      player: { x: player.x, y: player.y, direction: player.direction, moving: player.moving, color: player.color, tool: player.currentTool },
      otherPlayers,
      buildings,
      resourceNodes: GameMap.resourceNodes,
      interactTile,
      timeOfDay,
      buildGhost: buildMode ? { type: buildMode, x: buildGhostX, y: buildGhostY } : null,
    });
  }

  // ── Day/Night System ────────────────────────────────────────────────────

  function advanceDay() {
    dayCount++;
    timeOfDay = 0.25;
    player.energy = player.maxEnergy;
    GameMap.advanceDay();
    const seasons = ['monsoon', 'dry', 'harvest', 'planting'];
    season = seasons[Math.floor((dayCount - 1) / 7) % 4];
    addNotification('Day ' + dayCount + ' - ' + getSeasonName());
    Network.requestSleep();
  }

  function getSeasonName() {
    return { monsoon: 'Monsoon Season', dry: 'Dry Season', harvest: 'Harvest Season', planting: 'Planting Season' }[season] || season;
  }

  function getTimeString() {
    const totalMinutes = Math.floor(timeOfDay * 24 * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${h12}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }

  // ── Interaction System ──────────────────────────────────────────────────

  function interact() {
    if (player.energy <= 0) { addNotification('Too tired! Rest or eat food.'); return; }

    const dirs = [{ dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }];
    const d = dirs[player.direction];
    const tx = Math.floor(player.x + d.dx);
    const ty = Math.floor(player.y + d.dy);
    const tool = player.currentTool;
    const farmPlot = GameMap.getFarmPlot(tx, ty);
    const resourceNode = GameMap.getResourceNodeAt(tx, ty, 1.5);

    if (tool === 'hoe') {
      if (GameMap.isFarmable(tx, ty)) {
        if (GameMap.tileFarm(tx, ty)) {
          player.energy -= 2;
          Network.sendFarmAction('till', tx, ty);
          addNotification('Tilled soil');
        }
      } else if (farmPlot && !farmPlot.crop) {
        addNotification('Already tilled!');
      }
    } else if (tool === 'wateringCan') {
      if (farmPlot) {
        if (GameMap.waterFarm(tx, ty)) {
          player.energy -= 1;
          Network.sendFarmAction('water', tx, ty);
          addNotification('Watered crops');
        }
      }
    } else if (tool === 'seeds') {
      if (farmPlot && !farmPlot.crop) {
        if (GameMap.plantCrop(tx, ty, player.selectedSeed)) {
          player.energy -= 1;
          Network.sendFarmAction('plant', tx, ty, player.selectedSeed);
          addNotification('Planted ' + player.selectedSeed);
        }
      } else if (farmPlot && farmPlot.crop && farmPlot.stage >= 4) {
        const crop = GameMap.harvestCrop(tx, ty);
        if (crop) {
          const amounts = { tea: 3, rice: 4, cinnamon: 2, spice: 2 };
          addToInventory(crop, amounts[crop] || 2);
          player.energy -= 1;
          player.reputation += 1;
          Network.sendFarmAction('harvest', tx, ty);
          addNotification('Harvested ' + (amounts[crop] || 2) + ' ' + crop + '!');
        }
      }
    } else if (tool === 'pickaxe') {
      if (resourceNode && (resourceNode.type === 'gemDeposit' || resourceNode.type === 'stoneDeposit')) {
        const amount = Math.min(3, resourceNode.amount);
        resourceNode.amount -= amount;
        addToInventory(resourceNode.resourceType, amount);
        player.energy -= 3;
        Network.sendGather(resourceNode.id);
        addNotification('Mined ' + amount + ' ' + resourceNode.resourceType);
        if (resourceNode.amount <= 0) {
          const idx = GameMap.resourceNodes.indexOf(resourceNode);
          if (idx >= 0) GameMap.resourceNodes.splice(idx, 1);
        }
      }
    } else if (tool === 'axe') {
      if (resourceNode && resourceNode.type === 'woodPile') {
        const amount = Math.min(4, resourceNode.amount);
        resourceNode.amount -= amount;
        addToInventory('wood', amount);
        player.energy -= 2;
        Network.sendGather(resourceNode.id);
        addNotification('Chopped ' + amount + ' wood');
        if (resourceNode.amount <= 0) {
          const idx = GameMap.resourceNodes.indexOf(resourceNode);
          if (idx >= 0) GameMap.resourceNodes.splice(idx, 1);
        }
      }
    } else if (tool === 'machete') {
      if (resourceNode && (resourceNode.type === 'teaPlant' || resourceNode.type === 'cinnamonTree')) {
        const amount = Math.min(2, resourceNode.amount);
        resourceNode.amount -= amount;
        addToInventory(resourceNode.resourceType, amount);
        player.energy -= 2;
        Network.sendGather(resourceNode.id);
        addNotification('Gathered ' + amount + ' ' + resourceNode.resourceType);
        if (resourceNode.amount <= 0) {
          const idx = GameMap.resourceNodes.indexOf(resourceNode);
          if (idx >= 0) GameMap.resourceNodes.splice(idx, 1);
        }
      }
      if (resourceNode && resourceNode.type === 'ruin') {
        resourceNode.amount -= 1;
        player.reputation += 5;
        player.energy -= 5;
        addNotification('Explored ancient ruins! +5 reputation');
        const discoveries = [
          { item: 'gold', count: 10, msg: 'Found ancient gold coins!' },
          { item: 'sapphire', count: 2, msg: 'Discovered hidden sapphires!' },
          { item: 'moonstone', count: 1, msg: 'A mysterious moonstone...' },
          { item: 'ruby', count: 1, msg: 'A brilliant ruby in the rubble!' },
        ];
        const disc = discoveries[Math.floor(Math.random() * discoveries.length)];
        if (disc.item === 'gold') player.gold += disc.count;
        else addToInventory(disc.item, disc.count);
        addNotification(disc.msg);
        if (resourceNode.amount <= 0) {
          const idx = GameMap.resourceNodes.indexOf(resourceNode);
          if (idx >= 0) GameMap.resourceNodes.splice(idx, 1);
        }
      }
    }

    updateHUD();
  }

  // ── Click Handlers ──────────────────────────────────────────────────────

  function onLeftClick(wx, wy, shift) {
    const tx = Math.floor(wx), ty = Math.floor(wy);
    if (buildMode) { placeBuild(tx, ty); return; }
    for (const [id, bld] of buildings) {
      if (Math.abs(bld.x - tx) <= 1 && Math.abs(bld.y - ty) <= 1) { interactWithBuilding(bld); return; }
    }
    if (Math.abs(tx - GameMap.colomboX) <= 3 && Math.abs(ty - GameMap.colomboY) <= 3) { toggleMarket(); }
  }

  function onRightClick(wx, wy) {
    const tx = Math.floor(wx), ty = Math.floor(wy);
    const farmPlot = GameMap.getFarmPlot(tx, ty);
    if (farmPlot) {
      if (farmPlot.crop && farmPlot.stage >= 4) addNotification('Ready to harvest! Use seeds tool + E.');
      else if (farmPlot.crop) addNotification(farmPlot.crop + ' - Stage ' + farmPlot.stage + '/4' + (farmPlot.watered ? ' (watered)' : ' (needs water)'));
      else addNotification('Empty farm plot. Select seeds tool + E to plant.');
      return;
    }
    const node = GameMap.getResourceNodeAt(tx, ty, 2);
    if (node) {
      const toolNeeded = { gemDeposit: 'pickaxe', stoneDeposit: 'pickaxe', woodPile: 'axe', teaPlant: 'machete', cinnamonTree: 'machete', ruin: 'machete' };
      addNotification(node.type + ' - Use ' + (toolNeeded[node.type] || 'tool') + ' near it + E. ' + node.amount + ' left.');
    }
  }

  function interactWithBuilding(bld) {
    if (bld.type === 'dryingRack' || bld.type === 'gemCutter' || bld.type === 'smelter') {
      showCrafting = true;
      const panel = document.getElementById('crafting-panel');
      if (panel) panel.style.display = 'block';
      updateCraftingUI(bld.type);
    } else if (bld.type === 'tradingPost' || bld.type === 'marketStall') {
      toggleMarket();
    } else if (bld.type === 'warehouse') {
      toggleInventory();
    }
  }

  // ── Inventory ───────────────────────────────────────────────────────────

  function addToInventory(item, count) {
    const existing = player.inventory.find(s => s.item === item);
    if (existing) { existing.count += count; }
    else if (player.inventory.length < player.maxInventory) { player.inventory.push({ item, count }); }
    else { addNotification('Inventory full!'); return false; }
    updateInventoryUI();
    return true;
  }

  function removeFromInventory(item, count) {
    const existing = player.inventory.find(s => s.item === item);
    if (!existing || existing.count < count) return false;
    existing.count -= count;
    if (existing.count <= 0) player.inventory = player.inventory.filter(s => s.count > 0);
    updateInventoryUI();
    return true;
  }

  function getInventoryCount(item) {
    const slot = player.inventory.find(s => s.item === item);
    return slot ? slot.count : 0;
  }

  function hasResources(costs) {
    for (const [item, count] of Object.entries(costs)) {
      if (item === 'gold' ? player.gold < count : getInventoryCount(item) < count) return false;
    }
    return true;
  }

  function spendResources(costs) {
    for (const [item, count] of Object.entries(costs)) {
      if (item === 'gold') player.gold -= count;
      else removeFromInventory(item, count);
    }
  }

  // ── Crafting ────────────────────────────────────────────────────────────

  function craft(recipeName) {
    const recipe = RECIPES[recipeName];
    if (!recipe) return;
    for (const [item, count] of Object.entries(recipe.input)) {
      if (item === 'gold' ? player.gold < count : getInventoryCount(item) < count) {
        addNotification('Not enough ' + item + '!'); return;
      }
    }
    for (const [item, count] of Object.entries(recipe.input)) {
      if (item === 'gold') player.gold -= count; else removeFromInventory(item, count);
    }
    for (const [item, count] of Object.entries(recipe.output)) addToInventory(item, count);
    player.energy -= 2;
    Network.sendCraft(recipeName);
    addNotification('Crafted: ' + recipeName);
    updateHUD();
  }

  // ── Building ────────────────────────────────────────────────────────────

  function startBuild(type) {
    if (!BUILD_COSTS[type]) return;
    if (!hasResources(BUILD_COSTS[type])) { addNotification('Not enough resources!'); return; }
    buildMode = type;
    addNotification('Click to place ' + type + '. ESC to cancel.');
  }

  function placeBuild(tx, ty) {
    if (!buildMode) return;
    if (!GameMap.isWalkable(tx, ty)) { addNotification('Cannot build here!'); return; }
    const cost = BUILD_COSTS[buildMode];
    if (!hasResources(cost)) { addNotification('Not enough resources!'); return; }
    spendResources(cost);
    const id = Date.now() + Math.random();
    const bld = { id, type: buildMode, x: tx, y: ty, owner: Network.playerId || 'local', built: 100, color: player.color };
    buildings.set(id, bld);
    Network.sendBuild(buildMode, tx, ty);
    addNotification('Built ' + buildMode + '!');
    buildMode = null;
    player.energy -= 5;
    updateHUD();
  }

  function updateBuildGhost(tx, ty) { buildGhostX = tx; buildGhostY = ty; }

  // ── Market ──────────────────────────────────────────────────────────────

  function sellItem(resource, amount) {
    amount = amount || 1;
    if (getInventoryCount(resource) < amount) { addNotification('Not enough ' + resource + '!'); return; }
    const price = marketPrices[resource] || 1;
    const total = price * amount;
    removeFromInventory(resource, amount);
    player.gold += total;
    Network.sellToMarket(resource, amount);
    addNotification('Sold ' + amount + ' ' + resource + ' for ' + total + 'g');
    updateHUD();
    updateMarketUI();
  }

  // ── Tools ───────────────────────────────────────────────────────────────

  function selectHotbarSlot(slot) {
    if (slot >= 0 && slot < player.tools.length) {
      player.hotbarSlot = slot;
      player.currentTool = player.tools[slot];
      updateHotbarUI();
    }
  }

  function cycleTool(dir) {
    let idx = player.tools.indexOf(player.currentTool);
    idx = (idx + dir + player.tools.length) % player.tools.length;
    player.currentTool = player.tools[idx];
    player.hotbarSlot = idx;
    updateHotbarUI();
  }

  function selectSeed(seedType) {
    if (['tea', 'rice', 'cinnamon', 'spice'].includes(seedType)) {
      player.selectedSeed = seedType;
      addNotification('Selected ' + seedType + ' seeds');
    }
  }

  // ── UI Toggles ──────────────────────────────────────────────────────────

  function toggleInventory() {
    showInventory = !showInventory;
    document.getElementById('inventory-panel').style.display = showInventory ? 'block' : 'none';
    if (showInventory) updateInventoryUI();
  }

  function toggleCraftingMenu() {
    showCrafting = !showCrafting;
    document.getElementById('crafting-panel').style.display = showCrafting ? 'block' : 'none';
    if (showCrafting) updateCraftingUI();
  }

  function toggleBuildMenu() {
    showBuildMenu = !showBuildMenu;
    document.getElementById('build-panel').style.display = showBuildMenu ? 'block' : 'none';
    if (showBuildMenu) updateBuildUI();
  }

  function toggleMarket() {
    showMarket = !showMarket;
    document.getElementById('market-panel').style.display = showMarket ? 'block' : 'none';
    if (showMarket) updateMarketUI();
  }

  function toggleMapOverlay() {}

  function toggleChat() {
    const chatInput = document.getElementById('chat-input');
    if (!chatActive) { chatActive = true; chatInput.style.display = 'block'; chatInput.focus(); }
    else {
      const text = chatInput.value.trim();
      if (text) { Network.chat(text); chatMessages.push({ name: player.name, text, time: Date.now() }); }
      chatInput.value = ''; chatInput.style.display = 'none'; chatActive = false;
    }
  }

  function cancelAction() {
    if (buildMode) { buildMode = null; addNotification('Build cancelled.'); }
    if (showInventory) toggleInventory();
    if (showCrafting) toggleCraftingMenu();
    if (showBuildMenu) toggleBuildMenu();
    if (showMarket) toggleMarket();
    if (chatActive) { document.getElementById('chat-input').style.display = 'none'; chatActive = false; }
  }

  // ── UI Updates ──────────────────────────────────────────────────────────

  function updateHUD() {
    const el = (id) => document.getElementById(id);
    const goldEl = el('gold-count'), energyEl = el('energy-count'), repEl = el('rep-count');
    const timeEl = el('time-display'), dayEl = el('day-display'), energyBar = el('energy-bar-fill');
    const seasonEl = el('season-display');
    if (goldEl) goldEl.textContent = player.gold;
    if (energyEl) energyEl.textContent = Math.floor(player.energy) + '/' + player.maxEnergy;
    if (repEl) repEl.textContent = player.reputation;
    if (timeEl) timeEl.textContent = getTimeString();
    if (dayEl) dayEl.textContent = 'Day ' + dayCount;
    if (energyBar) energyBar.style.width = (player.energy / player.maxEnergy * 100) + '%';
    if (seasonEl) seasonEl.textContent = getSeasonName();
    updateNotifications();
  }

  function updateHotbarUI() {
    const hotbar = document.getElementById('hotbar');
    if (!hotbar) return;
    hotbar.innerHTML = '';
    player.tools.forEach((tool, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (i === player.hotbarSlot ? ' active' : '');
      slot.onclick = () => selectHotbarSlot(i);
      const icon = Sprites.getToolIcon(tool);
      const canvas = document.createElement('canvas');
      canvas.width = 20; canvas.height = 20;
      canvas.getContext('2d').drawImage(icon, 0, 0);
      slot.appendChild(canvas);
      const label = document.createElement('span');
      label.className = 'hotbar-label'; label.textContent = (i + 1);
      slot.appendChild(label);
      const name = document.createElement('span');
      name.className = 'hotbar-name'; name.textContent = tool;
      slot.appendChild(name);
      hotbar.appendChild(slot);
    });
    const seedSel = document.getElementById('seed-selector');
    if (seedSel) seedSel.style.display = player.currentTool === 'seeds' ? 'flex' : 'none';
  }

  function updateInventoryUI() {
    const container = document.getElementById('inventory-items');
    if (!container) return;
    container.innerHTML = '';
    player.inventory.forEach(slot => {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      const icon = Sprites.getResource(slot.item);
      const canvas = document.createElement('canvas');
      canvas.width = 20; canvas.height = 20;
      canvas.getContext('2d').drawImage(icon, 0, 0);
      item.appendChild(canvas);
      const info = document.createElement('span');
      info.textContent = slot.item + ' x' + slot.count;
      item.appendChild(info);
      container.appendChild(item);
    });
    if (player.inventory.length === 0) container.innerHTML = '<div style="color:#8a7a60;padding:8px">Empty</div>';
  }

  function updateCraftingUI(stationType) {
    const container = document.getElementById('crafting-recipes');
    if (!container) return;
    container.innerHTML = '';
    for (const [name, recipe] of Object.entries(RECIPES)) {
      if (stationType && recipe.station && recipe.station !== stationType) continue;
      const div = document.createElement('div');
      div.className = 'recipe-item';
      const canCraft = Object.entries(recipe.input).every(([item, count]) => item === 'gold' ? player.gold >= count : getInventoryCount(item) >= count);
      div.classList.toggle('craftable', canCraft);
      const inputStr = Object.entries(recipe.input).map(([k, v]) => `${v} ${k}`).join(' + ');
      const outputStr = Object.entries(recipe.output).map(([k, v]) => `${v} ${k}`).join(', ');
      div.innerHTML = `<strong>${name}</strong><br><span class="recipe-input">${inputStr}</span> &rarr; <span class="recipe-output">${outputStr}</span>`;
      if (canCraft) {
        const btn = document.createElement('button');
        btn.textContent = 'Craft'; btn.className = 'craft-btn';
        btn.onclick = () => { craft(name); updateCraftingUI(stationType); };
        div.appendChild(btn);
      }
      container.appendChild(div);
    }
  }

  function updateBuildUI() {
    const container = document.getElementById('build-options');
    if (!container) return;
    container.innerHTML = '';
    for (const [type, cost] of Object.entries(BUILD_COSTS)) {
      const div = document.createElement('div');
      div.className = 'build-option';
      const canBuild = hasResources(cost);
      div.classList.toggle('buildable', canBuild);
      const costStr = Object.entries(cost).map(([k, v]) => `${v} ${k}`).join(', ');
      div.innerHTML = `<strong>${type}</strong><br><span class="build-cost">${costStr}</span>`;
      if (canBuild) { div.onclick = () => { startBuild(type); toggleBuildMenu(); }; div.style.cursor = 'pointer'; }
      container.appendChild(div);
    }
  }

  function updateMarketUI() {
    const container = document.getElementById('market-items');
    if (!container) return;
    container.innerHTML = '';
    const sellable = player.inventory.filter(s => marketPrices[s.item]);
    for (const slot of sellable) {
      const price = marketPrices[slot.item] || 1;
      const div = document.createElement('div');
      div.className = 'market-item';
      const icon = Sprites.getResource(slot.item);
      const canvas = document.createElement('canvas');
      canvas.width = 20; canvas.height = 20;
      canvas.getContext('2d').drawImage(icon, 0, 0);
      div.appendChild(canvas);
      const info = document.createElement('span');
      info.innerHTML = `${slot.item} x${slot.count} — <span class="market-price">${price}g each</span>`;
      div.appendChild(info);
      const btn = document.createElement('button');
      btn.textContent = 'Sell 1'; btn.className = 'sell-btn';
      btn.onclick = () => sellItem(slot.item, 1);
      div.appendChild(btn);
      if (slot.count >= 5) {
        const btn5 = document.createElement('button');
        btn5.textContent = 'Sell 5'; btn5.className = 'sell-btn';
        btn5.onclick = () => sellItem(slot.item, 5);
        div.appendChild(btn5);
      }
      container.appendChild(div);
    }
    if (sellable.length === 0) container.innerHTML = '<div style="color:#8a7a60;padding:8px">No tradeable goods</div>';
  }

  // ── Notifications ───────────────────────────────────────────────────────

  function addNotification(text) {
    notifications.push({ text, time: Date.now() });
    if (notifications.length > 8) notifications.shift();
    updateNotifications();
  }

  function updateNotifications() {
    const container = document.getElementById('notifications');
    if (!container) return;
    container.innerHTML = '';
    const now = Date.now();
    notifications = notifications.filter(n => now - n.time < 6000);
    for (const n of notifications) {
      const div = document.createElement('div');
      div.className = 'notification';
      div.style.opacity = Math.max(0, 1 - ((now - n.time) / 6000) * 0.8);
      div.textContent = n.text;
      container.appendChild(div);
    }
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = '';
      for (const msg of chatMessages.slice(-5)) {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<strong>${msg.name}:</strong> ${msg.text}`;
        chatContainer.appendChild(div);
      }
    }
  }

  setTimeout(() => { updateHotbarUI(); updateHUD(); }, 100);

  return {
    init, interact, onLeftClick, onRightClick,
    selectHotbarSlot, cycleTool, selectSeed,
    toggleInventory, toggleCraftingMenu, toggleBuildMenu, toggleMarket, toggleMapOverlay, toggleChat,
    cancelAction, placeBuild, updateBuildGhost, sellItem, craft, addNotification,
    get buildMode() { return buildMode; },
    get player() { return player; },
    get dayCount() { return dayCount; },
    get timeOfDay() { return timeOfDay; },
    get season() { return season; },
  };
})();

window.addEventListener('DOMContentLoaded', () => game.init());
