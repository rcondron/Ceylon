// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Isometric Renderer
// Handles camera, tile rendering, fog of war, units, buildings, and minimap.
// ═══════════════════════════════════════════════════════════════════════════

const Renderer = (() => {
  let canvas, ctx;
  let minimapCanvas, minimapCtx;
  let width, height;

  // Camera
  const camera = {
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1,
  };

  const TILE_W = Sprites.TILE_W;
  const TILE_H = Sprites.TILE_H;

  // Fog of war overlay
  let fogCanvas, fogCtx;
  let exploredSet = new Set();
  let visibleSet = new Set();

  // Animation frame counter
  let frameCount = 0;

  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    minimapCanvas = document.getElementById('minimap-canvas');
    minimapCtx = minimapCanvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    // Create fog canvas
    fogCanvas = document.createElement('canvas');
    fogCtx = fogCanvas.getContext('2d');
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    fogCanvas && (fogCanvas.width = width);
    fogCanvas && (fogCanvas.height = height);
  }

  // ── Coordinate Conversions ────────────────────────────────────────────

  function worldToScreen(wx, wy) {
    // Isometric projection
    const sx = (wx - wy) * (TILE_W / 2) * camera.zoom;
    const sy = (wx + wy) * (TILE_H / 2) * camera.zoom;
    return {
      x: sx - camera.x + width / 2,
      y: sy - camera.y + height / 2,
    };
  }

  function screenToWorld(sx, sy) {
    // Reverse isometric
    const rx = (sx - width / 2 + camera.x) / camera.zoom;
    const ry = (sy - height / 2 + camera.y) / camera.zoom;

    const wx = (rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2;
    const wy = (ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2;

    return { x: wx, y: wy };
  }

  function tileToScreen(tx, ty) {
    return worldToScreen(tx, ty);
  }

  // ── Camera Control ────────────────────────────────────────────────────

  function setCamera(x, y) {
    camera.targetX = x;
    camera.targetY = y;
  }

  function moveCamera(dx, dy) {
    camera.targetX += dx;
    camera.targetY += dy;
  }

  function zoomCamera(delta) {
    camera.targetZoom = Math.max(0.4, Math.min(2.5, camera.targetZoom + delta));
  }

  function centerOnTile(tx, ty) {
    const screen = worldToScreen(tx, ty);
    camera.targetX = (tx - ty) * (TILE_W / 2) * camera.zoom;
    camera.targetY = (tx + ty) * (TILE_H / 2) * camera.zoom;
  }

  function updateCamera() {
    camera.x += (camera.targetX - camera.x) * 0.12;
    camera.y += (camera.targetY - camera.y) * 0.12;
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;
  }

  // ── Fog of War ────────────────────────────────────────────────────────

  function setExplored(explored) {
    if (Array.isArray(explored)) {
      exploredSet = new Set(explored);
    } else {
      exploredSet = explored;
    }
  }

  function setVisible(units, playerId) {
    visibleSet = new Set();
    for (const unit of units) {
      if (unit.playerId === playerId) {
        const radius = unit.type === 'explorer' ? 8 : 4;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
              visibleSet.add(`${Math.floor(unit.x + dx)},${Math.floor(unit.y + dy)}`);
            }
          }
        }
      }
    }
  }

  function isTileExplored(tx, ty) {
    return exploredSet.has(`${tx},${ty}`);
  }

  function isTileVisible(tx, ty) {
    return visibleSet.has(`${tx},${ty}`);
  }

  // ── Rendering ─────────────────────────────────────────────────────────

  function getVisibleTileRange() {
    const topLeft = screenToWorld(0, 0);
    const topRight = screenToWorld(width, 0);
    const bottomLeft = screenToWorld(0, height);
    const bottomRight = screenToWorld(width, height);

    const margin = 3;
    const minX = Math.floor(Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)) - margin;
    const maxX = Math.ceil(Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)) + margin;
    const minY = Math.floor(Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)) - margin;
    const maxY = Math.ceil(Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)) + margin;

    return {
      minX: Math.max(0, minX),
      maxX: Math.min(GameMap.MAP_W - 1, maxX),
      minY: Math.max(0, minY),
      maxY: Math.min(GameMap.MAP_H - 1, maxY),
    };
  }

  function render(gameData) {
    frameCount++;
    updateCamera();

    ctx.fillStyle = '#0a0806';
    ctx.clearRect(0, 0, width, height);
    ctx.fillRect(0, 0, width, height);

    ctx.imageSmoothingEnabled = false;

    const range = getVisibleTileRange();

    // Sort order: render back-to-front (top-left to bottom-right in isometric)
    // We render in row order: for each row (sum of x+y), render tiles
    for (let sum = range.minX + range.minY; sum <= range.maxX + range.maxY; sum++) {
      for (let tx = Math.max(range.minX, sum - range.maxY); tx <= Math.min(range.maxX, sum - range.minY); tx++) {
        const ty = sum - tx;
        if (ty < range.minY || ty > range.maxY) continue;

        const explored = isTileExplored(tx, ty);
        if (!explored) continue;

        const visible = isTileVisible(tx, ty);
        const screen = tileToScreen(tx, ty);
        const tileName = GameMap.getTileName(tx, ty);

        // Set alpha for fog
        ctx.globalAlpha = visible ? 1.0 : 0.5;

        // Draw tile
        const tileSprite = Sprites.getTile(tileName);
        const drawX = screen.x - (TILE_W * camera.zoom) / 2;
        const drawY = screen.y - (TILE_H * camera.zoom) / 2;
        ctx.drawImage(
          tileSprite,
          drawX, drawY,
          TILE_W * camera.zoom,
          (TILE_H + 16) * camera.zoom
        );

        // Height offset for elevated terrain
        const heightOffset = GameMap.getHeight(tx, ty) * 8 * camera.zoom;

        // Draw resource nodes on this tile
        if (gameData.resourceNodes) {
          for (const node of gameData.resourceNodes) {
            if (Math.floor(node.x) === tx && Math.floor(node.y) === ty) {
              const sprite = Sprites.getResourceNode(node.type);
              ctx.drawImage(
                sprite,
                screen.x - 16 * camera.zoom,
                screen.y - 20 * camera.zoom - heightOffset,
                32 * camera.zoom,
                32 * camera.zoom
              );
            }
          }
        }
      }
    }

    // Draw trees (separate pass for correct overlap)
    ctx.globalAlpha = 1.0;
    for (const tree of GameMap.treeMap) {
      if (tree.x < range.minX || tree.x > range.maxX || tree.y < range.minY || tree.y > range.maxY) continue;
      if (!isTileExplored(tree.x, tree.y)) continue;

      const visible = isTileVisible(tree.x, tree.y);
      ctx.globalAlpha = visible ? 1.0 : 0.45;

      const screen = tileToScreen(tree.x, tree.y);
      const heightOffset = GameMap.getHeight(tree.x, tree.y) * 8 * camera.zoom;
      const sprite = Sprites.getTree(tree.variant);

      ctx.drawImage(
        sprite,
        screen.x - 16 * camera.zoom,
        screen.y - 40 * camera.zoom - heightOffset,
        32 * camera.zoom,
        48 * camera.zoom
      );
    }

    // Draw buildings
    ctx.globalAlpha = 1.0;
    if (gameData.buildings) {
      const sortedBuildings = Array.from(gameData.buildings.values()).sort((a, b) => (a.x + a.y) - (b.x + b.y));
      for (const bld of sortedBuildings) {
        if (!isTileExplored(Math.floor(bld.x), Math.floor(bld.y))) continue;

        const visible = isTileVisible(Math.floor(bld.x), Math.floor(bld.y));
        ctx.globalAlpha = visible ? 1.0 : 0.5;

        const player = gameData.players && gameData.players.get(bld.playerId);
        const color = player ? player.color : '#888';
        const sprite = Sprites.getBuilding(bld.type, color, bld.built);
        const screen = tileToScreen(bld.x, bld.y);

        const sw = sprite.width * camera.zoom;
        const sh = sprite.height * camera.zoom;
        ctx.drawImage(sprite, screen.x - sw / 2, screen.y - sh + 8 * camera.zoom, sw, sh);
      }
    }

    // Draw units
    ctx.globalAlpha = 1.0;
    if (gameData.units) {
      const sortedUnits = Array.from(gameData.units.values()).sort((a, b) => (a.x + a.y) - (b.x + b.y));
      for (const unit of sortedUnits) {
        if (!isTileExplored(Math.floor(unit.x), Math.floor(unit.y))) continue;

        const visible = isTileVisible(Math.floor(unit.x), Math.floor(unit.y));
        ctx.globalAlpha = visible ? 1.0 : 0.4;

        const player = gameData.players && gameData.players.get(unit.playerId);
        const color = player ? player.color : '#888';
        const animFrame = unit.task === 'moving' || unit.task === 'exploring' ? Math.floor(frameCount / 4) : 0;
        const sprite = Sprites.getUnit(unit.type, color, animFrame % 8);
        const screen = tileToScreen(unit.x, unit.y);
        const heightOffset = GameMap.getHeight(Math.floor(unit.x), Math.floor(unit.y)) * 8 * camera.zoom;

        const uw = 16 * camera.zoom;
        const uh = 24 * camera.zoom;
        ctx.drawImage(sprite, screen.x - uw / 2, screen.y - uh + 4 * camera.zoom - heightOffset, uw, uh);

        // Selection ring
        if (gameData.selectedUnits && gameData.selectedUnits.has(unit.id)) {
          ctx.strokeStyle = '#c8b88a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y + 2 * camera.zoom - heightOffset, 8 * camera.zoom, 4 * camera.zoom, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Carry indicator
        if (unit.carryAmount > 0) {
          const resSprite = Sprites.getResource(unit.carryType || 'wood');
          ctx.drawImage(
            resSprite,
            screen.x + 4 * camera.zoom,
            screen.y - uh - 2 * camera.zoom - heightOffset,
            10 * camera.zoom,
            10 * camera.zoom
          );
        }

        // HP bar (only if damaged)
        if (unit.hp < unit.maxHp) {
          const barW = 14 * camera.zoom;
          const barH = 2 * camera.zoom;
          const barX = screen.x - barW / 2;
          const barY = screen.y - uh - 4 * camera.zoom - heightOffset;
          ctx.fillStyle = '#300';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = '#0a0';
          ctx.fillRect(barX, barY, barW * (unit.hp / unit.maxHp), barH);
        }
      }
    }

    // Build placement ghost
    if (gameData.buildGhost) {
      ctx.globalAlpha = 0.5;
      const ghost = gameData.buildGhost;
      const sprite = Sprites.getBuilding(ghost.type, '#c8b88a', 0);
      const screen = tileToScreen(ghost.x, ghost.y);
      const sw = sprite.width * camera.zoom;
      const sh = sprite.height * camera.zoom;
      ctx.drawImage(sprite, screen.x - sw / 2, screen.y - sh + 8 * camera.zoom, sw, sh);
      ctx.globalAlpha = 1.0;
    }

    // Colombo marker
    if (GameMap.colomboX && GameMap.colomboY) {
      if (isTileExplored(GameMap.colomboX, GameMap.colomboY)) {
        const cs = tileToScreen(GameMap.colomboX, GameMap.colomboY);
        ctx.fillStyle = '#c8a832';
        ctx.font = `${Math.max(10, 12 * camera.zoom)}px Georgia`;
        ctx.textAlign = 'center';
        ctx.fillText('Colombo', cs.x, cs.y - 20 * camera.zoom);
        // Port icon
        ctx.fillStyle = '#c8a832';
        ctx.beginPath();
        ctx.arc(cs.x, cs.y - 28 * camera.zoom, 3 * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1.0;

    // Render minimap
    renderMinimap(gameData);
  }

  // ── Minimap ───────────────────────────────────────────────────────────

  function renderMinimap(gameData) {
    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    const scaleX = mw / GameMap.MAP_W;
    const scaleY = mh / GameMap.MAP_H;

    minimapCtx.fillStyle = '#0a0806';
    minimapCtx.fillRect(0, 0, mw, mh);

    const tileColors = {
      water: '#1a3848',
      shallowWater: '#2a4858',
      sand: '#8a7a50',
      grass: '#3a5a2a',
      jungle: '#1a3a1a',
      mountain: '#5a5a5a',
      river: '#2a4868',
      dirt: '#6a5030',
    };

    // Draw tiles
    for (let y = 0; y < GameMap.MAP_H; y++) {
      for (let x = 0; x < GameMap.MAP_W; x++) {
        if (!isTileExplored(x, y)) continue;
        const tileName = GameMap.getTileName(x, y);
        minimapCtx.fillStyle = tileColors[tileName] || '#333';
        if (!isTileVisible(x, y)) {
          // Darker for fog
          minimapCtx.globalAlpha = 0.5;
        }
        minimapCtx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
        minimapCtx.globalAlpha = 1;
      }
    }

    // Draw buildings
    if (gameData.buildings) {
      for (const bld of gameData.buildings.values()) {
        const player = gameData.players && gameData.players.get(bld.playerId);
        minimapCtx.fillStyle = player ? player.color : '#888';
        minimapCtx.fillRect(bld.x * scaleX - 1, bld.y * scaleY - 1, 3, 3);
      }
    }

    // Draw units
    if (gameData.units) {
      for (const unit of gameData.units.values()) {
        const player = gameData.players && gameData.players.get(unit.playerId);
        minimapCtx.fillStyle = player ? player.color : '#fff';
        minimapCtx.fillRect(unit.x * scaleX, unit.y * scaleY, 2, 2);
      }
    }

    // Colombo
    if (GameMap.colomboX) {
      minimapCtx.fillStyle = '#c8a832';
      minimapCtx.fillRect(GameMap.colomboX * scaleX - 2, GameMap.colomboY * scaleY - 2, 5, 5);
    }

    // Camera viewport box
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(width, height);
    minimapCtx.strokeStyle = '#c8b88a';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(
      topLeft.x * scaleX,
      topLeft.y * scaleY,
      (bottomRight.x - topLeft.x) * scaleX,
      (bottomRight.y - topLeft.y) * scaleY
    );
  }

  return {
    init,
    render,
    camera,
    worldToScreen,
    screenToWorld,
    tileToScreen,
    setCamera,
    moveCamera,
    zoomCamera,
    centerOnTile,
    setExplored,
    setVisible,
    isTileExplored,
    isTileVisible,
    getVisibleTileRange,
    get frameCount() { return frameCount; },
  };
})();
