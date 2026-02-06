// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Main Game Controller
// Ties together all systems: rendering, input, networking, UI.
// ═══════════════════════════════════════════════════════════════════════════

const game = (() => {
  // ── State ─────────────────────────────────────────────────────────────

  let playerId = null;
  let players = new Map();
  let units = new Map();
  let buildings = new Map();
  let selectedUnits = new Set();
  let explored = new Set();
  let market = {};
  let myResources = { gold: 0, food: 0, wood: 0, stone: 0 };
  let myInventory = {};
  let notifications = [];
  let buildMode = null;
  let buildGhost = null;
  let actionMode = null; // 'move', 'explore', 'harvest'
  let running = false;

  // ── Initialization ────────────────────────────────────────────────────

  async function init() {
    updateLoadBar(10);

    // Generate map
    GameMap.generate(42); // Fixed seed for consistent world
    updateLoadBar(40);

    // Init renderer
    Renderer.init();
    updateLoadBar(50);

    // Init input
    Input.init();
    updateLoadBar(60);

    // Draw HUD icons
    Sprites.drawHudIcon('icon-gold', 'gold');
    Sprites.drawHudIcon('icon-food', 'food');
    Sprites.drawHudIcon('icon-wood', 'wood');
    Sprites.drawHudIcon('icon-stone', 'stone');
    updateLoadBar(70);

    // Connect to server
    try {
      const initMsg = await Network.connect();
      playerId = initMsg.playerId;

      const player = initMsg.player;
      players.set(playerId, player);
      myResources = player.resources;
      myInventory = player.inventory || {};
      market = initMsg.market || {};

      // Set explored tiles
      if (initMsg.explored) {
        explored = new Set(initMsg.explored);
        Renderer.setExplored(explored);
      }

      // Add starting units
      if (initMsg.units) {
        for (const u of initMsg.units) {
          units.set(u.id, u);
        }
      }

      updateLoadBar(90);
    } catch (e) {
      console.warn('Could not connect to server, running in single-player mode');
      // Offline fallback
      playerId = 1;
      players.set(1, {
        id: 1,
        name: 'Explorer 1',
        color: '#c23616',
        resources: { gold: 500, food: 200, wood: 100, stone: 50 },
        inventory: {},
      });
      myResources = players.get(1).resources;

      // Create starting units manually
      const startPos = { x: 20, y: 100 };
      for (let i = 0; i < 3; i++) {
        const unit = {
          id: i + 1,
          playerId: 1,
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
        units.set(unit.id, unit);
      }

      // Reveal starting area
      for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          if (dx * dx + dy * dy <= 64) {
            explored.add(`${startPos.x + dx},${startPos.y + dy}`);
          }
        }
      }
      Renderer.setExplored(explored);

      updateLoadBar(90);
    }

    // Register network handlers
    setupNetworkHandlers();

    updateLoadBar(100);

    // Center camera on first unit
    const firstUnit = units.values().next().value;
    if (firstUnit) {
      Renderer.centerOnTile(firstUnit.x, firstUnit.y);
    }

    // Hide loading screen
    setTimeout(() => {
      document.getElementById('loading').classList.add('fade-out');
      setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
      }, 1000);
    }, 500);

    // Start game loop
    running = true;
    requestAnimationFrame(gameLoop);
  }

  function updateLoadBar(pct) {
    const bar = document.getElementById('load-bar');
    if (bar) bar.style.width = pct + '%';
  }

  // ── Network Handlers ──────────────────────────────────────────────────

  function setupNetworkHandlers() {
    Network.on('world_state', (msg) => {
      if (msg.units) {
        for (const u of msg.units) {
          if (!units.has(u.id)) {
            units.set(u.id, u);
          }
        }
      }
      if (msg.buildings) {
        for (const b of msg.buildings) {
          buildings.set(b.id, b);
        }
      }
    });

    Network.on('unit_positions', (msg) => {
      for (const update of msg.units) {
        const unit = units.get(update.id);
        if (unit) {
          unit.x = update.x;
          unit.y = update.y;
          unit.task = update.task;
          unit.carryType = update.carryType;
          unit.carryAmount = update.carryAmount;
        } else {
          units.set(update.id, update);
        }
      }
    });

    Network.on('fog_reveal', (msg) => {
      if (msg.explored) {
        explored = new Set(msg.explored);
        Renderer.setExplored(explored);
      }
    });

    Network.on('resources_update', (msg) => {
      if (msg.resources) myResources = msg.resources;
      if (msg.inventory) myInventory = msg.inventory;
    });

    Network.on('building_placed', (msg) => {
      buildings.set(msg.building.id, msg.building);
    });

    Network.on('building_complete', (msg) => {
      const bld = buildings.get(msg.id);
      if (bld) bld.built = 100;
      addNotification(`Building complete: ${bld ? bld.type : 'unknown'}`);
    });

    Network.on('resource_depleted', (msg) => {
      // Remove from local map data
      const idx = GameMap.resourceNodes.findIndex(n => n.id === msg.id);
      if (idx >= 0) GameMap.resourceNodes.splice(idx, 1);
    });

    Network.on('market_update', (msg) => {
      market = msg.market;
      updateMarketUI();
    });

    Network.on('discovery', (msg) => {
      const disc = msg.discovery;
      addNotification(`Discovery! ${disc.name}`, 'discovery');
    });

    Network.on('player_joined', (msg) => {
      players.set(msg.playerId, { id: msg.playerId, name: msg.name, color: msg.color });
      addNotification(`${msg.name} has arrived in Ceylon`);
    });

    Network.on('player_left', (msg) => {
      addNotification(`A trader has departed`);
    });

    Network.on('chat', (msg) => {
      const p = players.get(msg.playerId);
      addNotification(`${p ? p.name : 'Unknown'}: ${msg.text}`);
    });

    Network.on('error', (msg) => {
      addNotification(msg.text);
    });
  }

  // ── Game Loop ─────────────────────────────────────────────────────────

  function gameLoop(timestamp) {
    if (!running) return;

    // Edge scrolling and keyboard scroll
    Input.updateEdgeScroll();

    // Update visible tiles based on unit positions
    Renderer.setVisible(Array.from(units.values()), playerId);

    // Offline unit simulation
    if (!Network.connected) {
      offlineSimulation();
    }

    // Render
    Renderer.render({
      units,
      buildings,
      players,
      selectedUnits,
      resourceNodes: GameMap.resourceNodes,
      buildGhost,
    });

    // Update HUD
    updateHUD();

    requestAnimationFrame(gameLoop);
  }

  // ── Offline Simulation ────────────────────────────────────────────────

  function offlineSimulation() {
    for (const unit of units.values()) {
      if (unit.playerId !== playerId) continue;
      if (unit.targetX == null || unit.targetY == null) continue;

      const dx = unit.targetX - unit.x;
      const dy = unit.targetY - unit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.5) {
        if (unit.task === 'exploring') {
          // Reveal area
          const radius = unit.type === 'explorer' ? 10 : 6;
          for (let oy = -radius; oy <= radius; oy++) {
            for (let ox = -radius; ox <= radius; ox++) {
              if (ox * ox + oy * oy <= radius * radius) {
                explored.add(`${Math.floor(unit.x + ox)},${Math.floor(unit.y + oy)}`);
              }
            }
          }
          Renderer.setExplored(explored);

          // Discovery chance
          if (Math.random() < 0.15) {
            const discoveries = [
              'Ancient Scroll', 'Stone Idol', 'Temple Inscription',
              'Hidden Gem Cache', 'Abandoned Storehouse', 'Ancient City Ruins',
            ];
            const disc = discoveries[Math.floor(Math.random() * discoveries.length)];
            addNotification(`Discovery! ${disc}`, 'discovery');
            myResources.gold += Math.floor(Math.random() * 100);
          }
        }
        unit.task = null;
        unit.targetX = null;
        unit.targetY = null;
        continue;
      }

      const speed = unit.speed * 0.15;
      unit.x += (dx / dist) * speed;
      unit.y += (dy / dist) * speed;

      // Reveal fog while moving
      const radius = unit.type === 'explorer' ? 8 : 4;
      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          if (ox * ox + oy * oy <= radius * radius) {
            explored.add(`${Math.floor(unit.x + ox)},${Math.floor(unit.y + oy)}`);
          }
        }
      }
      Renderer.setExplored(explored);
    }
  }

  // ── Click Handlers ────────────────────────────────────────────────────

  function onClick(wx, wy, shiftKey) {
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);

    if (actionMode === 'harvest') {
      // Try to find resource at click location
      const node = GameMap.getResourceNodeAt(tx, ty, 2);
      if (node) {
        for (const uid of selectedUnits) {
          Network.assignTask(uid, 'harvest', node.id);
        }
        actionMode = null;
        return;
      }
    }

    // Try to select a unit at this position
    let clickedUnit = null;
    let closestDist = 2;

    for (const unit of units.values()) {
      const d = Math.sqrt((unit.x - wx) ** 2 + (unit.y - wy) ** 2);
      if (d < closestDist && unit.playerId === playerId) {
        closestDist = d;
        clickedUnit = unit;
      }
    }

    if (clickedUnit) {
      if (shiftKey) {
        // Toggle selection
        if (selectedUnits.has(clickedUnit.id)) {
          selectedUnits.delete(clickedUnit.id);
        } else {
          selectedUnits.add(clickedUnit.id);
        }
      } else {
        selectedUnits.clear();
        selectedUnits.add(clickedUnit.id);
      }
      updateSelectionPanel();
    } else if (!shiftKey) {
      // Clicked empty space — deselect
      selectedUnits.clear();
      updateSelectionPanel();
    }
  }

  function onRightClick(wx, wy) {
    if (selectedUnits.size === 0) return;

    const tx = Math.floor(wx);
    const ty = Math.floor(wy);

    // Check if clicking on a resource
    const node = GameMap.getResourceNodeAt(tx, ty, 2);
    if (node) {
      for (const uid of selectedUnits) {
        Network.assignTask(uid, 'harvest', node.id);

        // Offline fallback
        if (!Network.connected) {
          const unit = units.get(uid);
          if (unit) {
            unit.task = 'harvesting';
            unit.taskTarget = node.id;
            unit.targetX = node.x;
            unit.targetY = node.y;
          }
        }
      }
      return;
    }

    // Check if clicking on a building under construction
    for (const bld of buildings.values()) {
      if (Math.abs(bld.x - tx) <= 2 && Math.abs(bld.y - ty) <= 2 && bld.built < 100) {
        for (const uid of selectedUnits) {
          Network.assignTask(uid, 'build', bld.id);
        }
        return;
      }
    }

    // Default: move
    if (!GameMap.isWalkable(tx, ty)) return;

    const unitIds = Array.from(selectedUnits);
    Network.moveUnits(unitIds, wx, wy);

    // Offline: directly update units
    if (!Network.connected) {
      const spacing = 1.5;
      const cols = Math.ceil(Math.sqrt(unitIds.length));
      unitIds.forEach((uid, i) => {
        const unit = units.get(uid);
        if (unit) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          unit.targetX = wx + (col - cols / 2) * spacing;
          unit.targetY = wy + (row - cols / 2) * spacing;
          unit.task = 'moving';
        }
      });
    }
  }

  function boxSelect(x1, y1, x2, y2) {
    selectedUnits.clear();

    for (const unit of units.values()) {
      if (unit.playerId !== playerId) continue;
      const screen = Renderer.worldToScreen(unit.x, unit.y);
      if (screen.x >= x1 && screen.x <= x2 && screen.y >= y1 && screen.y <= y2) {
        selectedUnits.add(unit.id);
      }
    }

    updateSelectionPanel();
  }

  // ── Actions ───────────────────────────────────────────────────────────

  function actionMove() {
    actionMode = 'move';
    buildMode = null;
    buildGhost = null;
  }

  function actionExplore() {
    if (selectedUnits.size === 0) return;

    // Send units to explore a random unexplored area
    for (const uid of selectedUnits) {
      const unit = units.get(uid);
      if (!unit) continue;

      // Find nearest unexplored tile
      let targetX = unit.x + (Math.random() - 0.5) * 30;
      let targetY = unit.y + (Math.random() - 0.5) * 30;
      targetX = Math.max(2, Math.min(GameMap.MAP_W - 2, targetX));
      targetY = Math.max(2, Math.min(GameMap.MAP_H - 2, targetY));

      Network.assignTask(uid, 'explore', null, targetX, targetY);

      if (!Network.connected) {
        unit.task = 'exploring';
        unit.targetX = targetX;
        unit.targetY = targetY;
      }
    }
  }

  function actionHarvest() {
    actionMode = 'harvest';
    addNotification('Click a resource to harvest');
  }

  function toggleBuildMenu() {
    const menu = document.getElementById('build-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    if (menu.style.display !== 'block') {
      buildMode = null;
      buildGhost = null;
    }
  }

  function startBuild(type) {
    buildMode = type;
    document.getElementById('build-menu').style.display = 'none';
    addNotification(`Click to place ${type}`);
  }

  function updateBuildGhost(x, y) {
    if (!buildMode) {
      buildGhost = null;
      return;
    }
    buildGhost = { type: buildMode, x, y };
  }

  function placeBuild(x, y) {
    if (!buildMode) return;
    if (!GameMap.isWalkable(x, y)) {
      addNotification('Cannot build here');
      return;
    }

    Network.requestBuild(buildMode, x, y);

    // Offline fallback
    if (!Network.connected) {
      const costs = {
        camp: { wood: 30, gold: 20 },
        farm: { wood: 40, gold: 30 },
        mine: { wood: 50, stone: 30, gold: 50 },
        warehouse: { wood: 60, stone: 40, gold: 40 },
        road: { stone: 10 },
        dock: { wood: 80, stone: 50, gold: 100 },
        tradingPost: { wood: 60, stone: 30, gold: 80 },
      };
      const cost = costs[buildMode];
      if (cost) {
        let canAfford = true;
        for (const [res, amt] of Object.entries(cost)) {
          if ((myResources[res] || 0) < amt) canAfford = false;
        }
        if (canAfford) {
          for (const [res, amt] of Object.entries(cost)) {
            myResources[res] -= amt;
          }
          const bld = {
            id: Date.now(),
            playerId,
            type: buildMode,
            x, y,
            hp: 200,
            maxHp: 200,
            built: 0,
          };
          buildings.set(bld.id, bld);

          // Auto-complete for offline testing
          setTimeout(() => {
            bld.built = 100;
            addNotification(`${buildMode} completed!`);
          }, 5000);
        } else {
          addNotification('Not enough resources');
        }
      }
    }

    buildMode = null;
    buildGhost = null;
  }

  function cancelAction() {
    buildMode = null;
    buildGhost = null;
    actionMode = null;
    document.getElementById('build-menu').style.display = 'none';
    document.getElementById('market-panel').style.display = 'none';
  }

  // ── Market ────────────────────────────────────────────────────────────

  function toggleMarket() {
    const panel = document.getElementById('market-panel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    if (panel.style.display === 'block') {
      updateMarketUI();
    }
  }

  function updateMarketUI() {
    const container = document.getElementById('market-rows');
    container.innerHTML = '';

    const resources = ['tea', 'spice', 'rice', 'cinnamon', 'sapphire', 'ruby', 'moonstone'];

    for (const res of resources) {
      const data = market[res] || { price: 0, supply: 0 };
      const stock = myInventory[res] || 0;

      const row = document.createElement('div');
      row.className = 'market-row';
      row.innerHTML = `
        <span class="market-resource">${res}</span>
        <span class="market-stock">x${stock}</span>
        <span class="market-price">${data.price}g</span>
        <button class="market-sell-btn" onclick="game.sellResource('${res}')" ${stock <= 0 ? 'disabled' : ''}>Sell 1</button>
      `;
      container.appendChild(row);
    }
  }

  function sellResource(resource) {
    const stock = myInventory[resource] || 0;
    if (stock <= 0) return;

    Network.sellToMarket(resource, 1);

    // Offline fallback
    if (!Network.connected) {
      const data = market[resource];
      if (data) {
        const revenue = data.price;
        myInventory[resource] = (myInventory[resource] || 0) - 1;
        myResources.gold += revenue;
        data.price = Math.max(10, Math.floor(data.price * 0.99));
        addNotification(`Sold ${resource} for ${revenue} gold`);
        updateMarketUI();
      }
    }
  }

  // ── UI Updates ────────────────────────────────────────────────────────

  function updateHUD() {
    document.getElementById('res-gold').textContent = myResources.gold || 0;
    document.getElementById('res-food').textContent = myResources.food || 0;
    document.getElementById('res-wood').textContent = myResources.wood || 0;
    document.getElementById('res-stone').textContent = myResources.stone || 0;

    // Inventory bar
    const invBar = document.getElementById('inventory-bar');
    const items = Object.entries(myInventory).filter(([, v]) => v > 0);
    if (items.length > 0) {
      invBar.innerHTML = items.map(([key, val]) =>
        `<span class="inv-item">${key}: <span>${val}</span></span>`
      ).join('');
    } else {
      invBar.innerHTML = '<span class="inv-item" style="color:#5a4a2a">No trade goods in inventory</span>';
    }
  }

  function updateSelectionPanel() {
    const panel = document.getElementById('selection-panel');
    const title = document.getElementById('selection-title');
    const info = document.getElementById('selection-info');

    if (selectedUnits.size === 0) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';

    if (selectedUnits.size === 1) {
      const uid = selectedUnits.values().next().value;
      const unit = units.get(uid);
      if (!unit) return;

      const typeNames = { explorer: 'Explorer', worker: 'Worker', cart: 'Cart' };
      title.textContent = typeNames[unit.type] || unit.type;
      info.innerHTML = `
        <div>HP: ${unit.hp}/${unit.maxHp}</div>
        <div>Position: ${Math.floor(unit.x)}, ${Math.floor(unit.y)}</div>
        <div>Task: ${unit.task || 'Idle'}</div>
        ${unit.carryAmount > 0 ? `<div>Carrying: ${unit.carryType} x${unit.carryAmount}</div>` : ''}
      `;
    } else {
      title.textContent = `${selectedUnits.size} Units Selected`;
      const typeCounts = {};
      for (const uid of selectedUnits) {
        const unit = units.get(uid);
        if (unit) {
          typeCounts[unit.type] = (typeCounts[unit.type] || 0) + 1;
        }
      }
      info.innerHTML = Object.entries(typeCounts)
        .map(([type, count]) => `<div>${type}: ${count}</div>`)
        .join('');
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────

  function addNotification(text, cssClass) {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = 'notification' + (cssClass ? ` ${cssClass}` : '');
    el.textContent = text;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  }

  // ── Public API ────────────────────────────────────────────────────────

  return {
    init,
    onClick,
    onRightClick,
    boxSelect,
    actionMove,
    actionExplore,
    actionHarvest,
    toggleBuildMenu,
    startBuild,
    updateBuildGhost,
    placeBuild,
    cancelAction,
    toggleMarket,
    sellResource,
    addNotification,

    get buildMode() { return buildMode; },
    get buildGhost() { return buildGhost; },
    get playerId() { return playerId; },
    get selectedUnits() { return selectedUnits; },
  };
})();

// ── Boot ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  game.init();
});
