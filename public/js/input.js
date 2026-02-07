// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Input Handler
// WASD character movement, click interactions, hotbar, camera zoom.
// ═══════════════════════════════════════════════════════════════════════════

const Input = (() => {
  let mouseX = 0, mouseY = 0;
  let mouseWorldX = 0, mouseWorldY = 0;

  const keys = {};
  let lastDirection = 0; // 0=down, 1=left, 2=up, 3=right
  let isMoving = false;

  function init() {
    const canvas = document.getElementById('game-canvas');

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Minimap click
    const minimap = document.getElementById('minimap-canvas');
    minimap.addEventListener('mousedown', onMinimapClick);
    minimap.addEventListener('mousemove', (e) => {
      if (e.buttons === 1) onMinimapClick(e);
    });
  }

  function onMouseDown(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (e.button === 0) {
      // Left click: interact with world
      const world = Renderer.screenToWorld(mouseX, mouseY);
      if (typeof game !== 'undefined') {
        game.onLeftClick(world.x, world.y, e.shiftKey);
      }
    } else if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      // Right click: secondary action / examine
      const world = Renderer.screenToWorld(mouseX, mouseY);
      if (typeof game !== 'undefined') {
        game.onRightClick(world.x, world.y);
      }
    }
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    const world = Renderer.screenToWorld(mouseX, mouseY);
    mouseWorldX = world.x;
    mouseWorldY = world.y;

    // Update build ghost
    if (typeof game !== 'undefined' && game.buildMode) {
      game.updateBuildGhost(Math.floor(world.x), Math.floor(world.y));
    }

    updateTooltip(world.x, world.y);
  }

  function onMouseUp(e) {
    // Not much needed for Stardew-style - clicks are in mousedown
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    Renderer.zoomCamera(delta);
  }

  function onKeyDown(e) {
    keys[e.key.toLowerCase()] = true;

    if (typeof game === 'undefined') return;

    // Hotbar number keys
    if (e.key >= '1' && e.key <= '9') {
      game.selectHotbarSlot(parseInt(e.key) - 1);
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'e':
      case ' ':
        e.preventDefault();
        game.interact();
        break;
      case 'tab':
        e.preventDefault();
        game.toggleInventory();
        break;
      case 'f': game.toggleCraftingMenu(); break;
      case 'b': game.toggleBuildMenu(); break;
      case 'q': game.cycleTool(-1); break;
      case 'r': game.cycleTool(1); break;
      case 'escape': game.cancelAction(); break;
      case 'm': game.toggleMapOverlay(); break;
      case 'enter': game.toggleChat(); break;
      case 'p': game.toggleMarket(); break;
    }
  }

  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }

  function onMinimapClick(e) {
    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = (mx / rect.width) * GameMap.MAP_W;
    const worldY = (my / rect.height) * GameMap.MAP_H;
    Renderer.centerOnTile(worldX, worldY);
  }

  function updateTooltip(wx, wy) {
    const tooltip = document.getElementById('tooltip');
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);

    if (tx < 0 || tx >= GameMap.MAP_W || ty < 0 || ty >= GameMap.MAP_H) {
      tooltip.style.display = 'none';
      return;
    }

    if (!Renderer.isTileExplored(tx, ty)) {
      tooltip.style.display = 'none';
      return;
    }

    // Check for farm plot
    const farmPlot = GameMap.getFarmPlot(tx, ty);
    if (farmPlot) {
      tooltip.style.display = 'block';
      tooltip.style.left = (mouseX + 16) + 'px';
      tooltip.style.top = (mouseY + 16) + 'px';
      if (farmPlot.crop) {
        const stageNames = ['Seed', 'Sprout', 'Growing', 'Mature', 'Ready to harvest!'];
        tooltip.innerHTML = `<strong>${farmPlot.crop}</strong><br>${stageNames[farmPlot.stage]}` +
          (farmPlot.watered ? '<br>Watered' : '<br>Needs water');
      } else {
        tooltip.textContent = 'Empty farm plot';
      }
      return;
    }

    // Check for resource node
    const node = GameMap.getResourceNodeAt(tx, ty, 1.5);
    if (node) {
      tooltip.style.display = 'block';
      tooltip.style.left = (mouseX + 16) + 'px';
      tooltip.style.top = (mouseY + 16) + 'px';
      const typeNames = {
        gemDeposit: 'Gem Deposit',
        stoneDeposit: 'Stone Deposit',
        woodPile: 'Forest',
        teaPlant: 'Wild Tea',
        cinnamonTree: 'Cinnamon Tree',
        ruin: 'Ancient Ruins',
      };
      tooltip.innerHTML = `<strong>${typeNames[node.type] || node.type}</strong><br>` +
        `${node.resourceType}: ${node.amount} remaining`;
      return;
    }

    // Terrain tooltip
    const tileName = GameMap.getTileName(tx, ty);
    const tileDisplayNames = {
      water: 'Deep Ocean',
      shallowWater: 'Shallow Water',
      sand: 'Sandy Shore',
      grass: 'Grassland',
      jungle: 'Dense Jungle',
      mountain: 'Misty Mountains',
      river: 'River',
      dirt: 'Cleared Ground',
      ricePaddy: 'Rice Paddy',
      teaHill: 'Tea Hillside',
      farmSoil: 'Farm Plot',
      farmSoilWet: 'Farm Plot (Watered)',
    };

    tooltip.style.display = 'block';
    tooltip.style.left = (mouseX + 16) + 'px';
    tooltip.style.top = (mouseY + 16) + 'px';
    tooltip.textContent = tileDisplayNames[tileName] || tileName;
  }

  // ── Movement (called each frame) ───────────────────────────────────────

  function getMovement() {
    let dx = 0, dy = 0;

    // WASD / Arrow keys → isometric movement
    const up = keys['w'] || keys['arrowup'];
    const down = keys['s'] || keys['arrowdown'];
    const left = keys['a'] || keys['arrowleft'];
    const right = keys['d'] || keys['arrowright'];

    // In isometric space, "up" on screen = move NW (x--, y--)
    // "down" = SE (x++, y++), "left" = SW (x--, y++), "right" = NE (x++, y--)
    if (up) { dx -= 1; dy -= 1; }
    if (down) { dx += 1; dy += 1; }
    if (left) { dx -= 1; dy += 1; }
    if (right) { dx += 1; dy -= 1; }

    isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
      // Determine facing direction
      if (dx > 0 && dy > 0) lastDirection = 0; // down (SE)
      else if (dx < 0 && dy > 0) lastDirection = 1; // left (SW)
      else if (dx < 0 && dy < 0) lastDirection = 2; // up (NW)
      else if (dx > 0 && dy < 0) lastDirection = 3; // right (NE)
      else if (dy > 0) lastDirection = 0;
      else if (dy < 0) lastDirection = 2;
      else if (dx > 0) lastDirection = 3;
      else if (dx < 0) lastDirection = 1;

      // Normalize diagonal movement
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    return { dx, dy, moving: isMoving, direction: lastDirection };
  }

  return {
    init,
    getMovement,
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseWorldX() { return mouseWorldX; },
    get mouseWorldY() { return mouseWorldY; },
    get direction() { return lastDirection; },
    get isMoving() { return isMoving; },
    keys,
  };
})();
