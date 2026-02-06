// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Input Handler
// Mouse, keyboard, drag-select, camera scroll, minimap clicks.
// ═══════════════════════════════════════════════════════════════════════════

const Input = (() => {
  let mouseX = 0, mouseY = 0;
  let mouseWorldX = 0, mouseWorldY = 0;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let isBoxSelecting = false;
  let boxStartX = 0, boxStartY = 0;
  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let panCamStartX = 0, panCamStartY = 0;

  // Keyboard state
  const keys = {};

  // Edge scrolling
  const EDGE_MARGIN = 20;
  const SCROLL_SPEED = 8;

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
    const rect = e.target.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      // Right click: command selected units
      const world = Renderer.screenToWorld(mouseX, mouseY);
      if (typeof game !== 'undefined') {
        game.onRightClick(world.x, world.y);
      }
      return;
    }

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or alt+click: pan
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panCamStartX = Renderer.camera.targetX;
      panCamStartY = Renderer.camera.targetY;
      return;
    }

    if (e.button === 0) {
      // Left click
      if (typeof game !== 'undefined' && game.buildMode) {
        // Place building
        const world = Renderer.screenToWorld(mouseX, mouseY);
        game.placeBuild(Math.floor(world.x), Math.floor(world.y));
        return;
      }

      // Start box select
      isBoxSelecting = true;
      boxStartX = e.clientX;
      boxStartY = e.clientY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    }
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    const world = Renderer.screenToWorld(mouseX, mouseY);
    mouseWorldX = world.x;
    mouseWorldY = world.y;

    if (isPanning) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      Renderer.camera.targetX = panCamStartX - dx;
      Renderer.camera.targetY = panCamStartY - dy;
      return;
    }

    if (isBoxSelecting) {
      const box = document.getElementById('select-box');
      const x1 = Math.min(boxStartX, e.clientX);
      const y1 = Math.min(boxStartY, e.clientY);
      const x2 = Math.max(boxStartX, e.clientX);
      const y2 = Math.max(boxStartY, e.clientY);

      if (x2 - x1 > 4 || y2 - y1 > 4) {
        isDragging = true;
        box.style.display = 'block';
        box.style.left = x1 + 'px';
        box.style.top = y1 + 'px';
        box.style.width = (x2 - x1) + 'px';
        box.style.height = (y2 - y1) + 'px';
      }
    }

    // Update build ghost
    if (typeof game !== 'undefined' && game.buildMode) {
      game.updateBuildGhost(Math.floor(world.x), Math.floor(world.y));
    }

    // Update tooltip
    updateTooltip(world.x, world.y);
  }

  function onMouseUp(e) {
    if (isPanning) {
      isPanning = false;
      return;
    }

    if (isBoxSelecting) {
      isBoxSelecting = false;
      const box = document.getElementById('select-box');
      box.style.display = 'none';

      if (isDragging) {
        // Box selection
        const x1 = Math.min(boxStartX, e.clientX);
        const y1 = Math.min(boxStartY, e.clientY);
        const x2 = Math.max(boxStartX, e.clientX);
        const y2 = Math.max(boxStartY, e.clientY);

        if (typeof game !== 'undefined') {
          game.boxSelect(x1, y1, x2, y2);
        }
        isDragging = false;
      } else {
        // Single click
        const world = Renderer.screenToWorld(mouseX, mouseY);
        if (typeof game !== 'undefined') {
          game.onClick(world.x, world.y, e.shiftKey);
        }
      }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    Renderer.zoomCamera(delta);
  }

  function onKeyDown(e) {
    keys[e.key.toLowerCase()] = true;

    if (typeof game !== 'undefined') {
      switch (e.key.toLowerCase()) {
        case 'm': game.actionMove(); break;
        case 'e': game.actionExplore(); break;
        case 'h': game.actionHarvest(); break;
        case 'b': game.toggleBuildMenu(); break;
        case 'escape':
          game.cancelAction();
          break;
        case 'f2':
          game.toggleMarket();
          break;
      }
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
        teaPlant: 'Tea Plantation',
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
      mountain: 'Mountain',
      river: 'River',
      dirt: 'Cleared Ground',
    };

    tooltip.style.display = 'block';
    tooltip.style.left = (mouseX + 16) + 'px';
    tooltip.style.top = (mouseY + 16) + 'px';
    tooltip.textContent = tileDisplayNames[tileName] || tileName;
  }

  // Edge scroll update (called each frame)
  function updateEdgeScroll() {
    let dx = 0, dy = 0;

    // Edge scroll
    if (mouseX < EDGE_MARGIN) dx -= SCROLL_SPEED;
    if (mouseX > window.innerWidth - EDGE_MARGIN) dx += SCROLL_SPEED;
    if (mouseY < EDGE_MARGIN + 36) dy -= SCROLL_SPEED;
    if (mouseY > window.innerHeight - EDGE_MARGIN) dy += SCROLL_SPEED;

    // Keyboard scroll
    if (keys['arrowleft'] || keys['a']) dx -= SCROLL_SPEED;
    if (keys['arrowright'] || keys['d']) dx += SCROLL_SPEED;
    if (keys['arrowup'] || keys['w']) dy -= SCROLL_SPEED;
    if (keys['arrowdown'] || keys['s']) dy += SCROLL_SPEED;

    if (dx !== 0 || dy !== 0) {
      Renderer.moveCamera(dx, dy);
    }
  }

  return {
    init,
    updateEdgeScroll,
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseWorldX() { return mouseWorldX; },
    get mouseWorldY() { return mouseWorldY; },
    keys,
  };
})();
