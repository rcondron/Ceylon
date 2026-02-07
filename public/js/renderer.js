// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Isometric Renderer
// Player-following camera, day/night cycle, warm cozy rendering.
// ═══════════════════════════════════════════════════════════════════════════

const Renderer = (() => {
  let canvas, ctx;
  let minimapCanvas, minimapCtx;
  let width, height;

  const camera = {
    x: 0, y: 0,
    zoom: 1.2,
    targetX: 0, targetY: 0,
    targetZoom: 1.2,
  };

  const TILE_W = Sprites.TILE_W;
  const TILE_H = Sprites.TILE_H;

  let fogCanvas, fogCtx;
  let exploredSet = new Set();
  let visibleSet = new Set();
  let frameCount = 0;

  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    minimapCanvas = document.getElementById('minimap-canvas');
    minimapCtx = minimapCanvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);
    fogCanvas = document.createElement('canvas');
    fogCtx = fogCanvas.getContext('2d');
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    if (fogCanvas) { fogCanvas.width = width; fogCanvas.height = height; }
  }

  // ── Coordinate Conversions ──────────────────────────────────────────────

  function worldToScreen(wx, wy) {
    const sx = (wx - wy) * (TILE_W / 2) * camera.zoom;
    const sy = (wx + wy) * (TILE_H / 2) * camera.zoom;
    return {
      x: sx - camera.x + width / 2,
      y: sy - camera.y + height / 2,
    };
  }

  function screenToWorld(sx, sy) {
    const rx = (sx - width / 2 + camera.x) / camera.zoom;
    const ry = (sy - height / 2 + camera.y) / camera.zoom;
    const wx = (rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2;
    const wy = (ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2;
    return { x: wx, y: wy };
  }

  function tileToScreen(tx, ty) {
    return worldToScreen(tx, ty);
  }

  // ── Camera Control ──────────────────────────────────────────────────────

  function followPlayer(px, py) {
    camera.targetX = (px - py) * (TILE_W / 2) * camera.zoom;
    camera.targetY = (px + py) * (TILE_H / 2) * camera.zoom;
  }

  function centerOnTile(tx, ty) {
    camera.targetX = (tx - ty) * (TILE_W / 2) * camera.zoom;
    camera.targetY = (tx + ty) * (TILE_H / 2) * camera.zoom;
  }

  function moveCamera(dx, dy) {
    camera.targetX += dx;
    camera.targetY += dy;
  }

  function zoomCamera(delta) {
    camera.targetZoom = Math.max(0.5, Math.min(2.5, camera.targetZoom + delta));
  }

  function updateCamera() {
    camera.x += (camera.targetX - camera.x) * 0.12;
    camera.y += (camera.targetY - camera.y) * 0.12;
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;
  }

  // ── Fog of War ──────────────────────────────────────────────────────────

  function setExplored(explored) {
    exploredSet = Array.isArray(explored) ? new Set(explored) : explored;
  }

  function setVisibleFromPlayer(px, py, radius) {
    visibleSet = new Set();
    const r = radius || 12;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const key = `${Math.floor(px + dx)},${Math.floor(py + dy)}`;
          visibleSet.add(key);
          exploredSet.add(key);
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

  // ── Visible tile range ──────────────────────────────────────────────────

  function getVisibleTileRange() {
    const topLeft = screenToWorld(0, 0);
    const topRight = screenToWorld(width, 0);
    const bottomLeft = screenToWorld(0, height);
    const bottomRight = screenToWorld(width, height);

    const margin = 3;
    return {
      minX: Math.max(0, Math.floor(Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)) - margin),
      maxX: Math.min(GameMap.MAP_W - 1, Math.ceil(Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)) + margin),
      minY: Math.max(0, Math.floor(Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)) - margin),
      maxY: Math.min(GameMap.MAP_H - 1, Math.ceil(Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)) + margin),
    };
  }

  // ── Main Render ─────────────────────────────────────────────────────────

  function render(gameData) {
    frameCount++;
    updateCamera();

    // Warm background
    ctx.fillStyle = '#1a2830';
    ctx.clearRect(0, 0, width, height);
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    const range = getVisibleTileRange();

    // Render tiles back-to-front
    for (let sum = range.minX + range.minY; sum <= range.maxX + range.maxY; sum++) {
      for (let tx = Math.max(range.minX, sum - range.maxY); tx <= Math.min(range.maxX, sum - range.minY); tx++) {
        const ty = sum - tx;
        if (ty < range.minY || ty > range.maxY) continue;

        const explored = isTileExplored(tx, ty);
        if (!explored) continue;

        const visible = isTileVisible(tx, ty);
        const screen = tileToScreen(tx, ty);
        const tileName = GameMap.getTileName(tx, ty);

        ctx.globalAlpha = visible ? 1.0 : 0.45;

        const tileSprite = Sprites.getTile(tileName);
        const drawX = screen.x - (TILE_W * camera.zoom) / 2;
        const drawY = screen.y - (TILE_H * camera.zoom) / 2;
        ctx.drawImage(tileSprite, drawX, drawY, TILE_W * camera.zoom, (TILE_H + 16) * camera.zoom);

        const heightOffset = GameMap.getHeight(tx, ty) * 8 * camera.zoom;

        // Draw farm crops
        const farmPlot = GameMap.getFarmPlot(tx, ty);
        if (farmPlot && farmPlot.crop && farmPlot.stage >= 0) {
          const cropSprite = Sprites.getCrop(farmPlot.crop, farmPlot.stage);
          ctx.drawImage(
            cropSprite,
            screen.x - 8 * camera.zoom,
            screen.y - 16 * camera.zoom - heightOffset,
            16 * camera.zoom,
            24 * camera.zoom
          );
        }

        // Draw resource nodes
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

    // Draw trees
    ctx.globalAlpha = 1.0;
    for (const tree of GameMap.treeMap) {
      if (tree.x < range.minX || tree.x > range.maxX || tree.y < range.minY || tree.y > range.maxY) continue;
      if (!isTileExplored(tree.x, tree.y)) continue;

      ctx.globalAlpha = isTileVisible(tree.x, tree.y) ? 1.0 : 0.4;

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
        ctx.globalAlpha = isTileVisible(Math.floor(bld.x), Math.floor(bld.y)) ? 1.0 : 0.5;

        const color = bld.color || '#c89860';
        const sprite = Sprites.getBuilding(bld.type, color, bld.built);
        const screen = tileToScreen(bld.x, bld.y);

        const sw = sprite.width * camera.zoom;
        const sh = sprite.height * camera.zoom;
        ctx.drawImage(sprite, screen.x - sw / 2, screen.y - sh + 8 * camera.zoom, sw, sh);
      }
    }

    // Draw other players
    ctx.globalAlpha = 1.0;
    if (gameData.otherPlayers) {
      for (const op of gameData.otherPlayers) {
        if (!isTileVisible(Math.floor(op.x), Math.floor(op.y))) continue;
        const screen = tileToScreen(op.x, op.y);
        const heightOffset = GameMap.getHeight(Math.floor(op.x), Math.floor(op.y)) * 8 * camera.zoom;
        const animFrame = op.moving ? Math.floor(frameCount / 4) : 0;
        const sprite = Sprites.getOtherPlayerSprite(op.direction || 0, animFrame, op.color || '#5090c0');

        ctx.drawImage(
          sprite,
          screen.x - 12 * camera.zoom,
          screen.y - 28 * camera.zoom - heightOffset,
          24 * camera.zoom,
          32 * camera.zoom
        );

        // Name tag
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.font = `${Math.max(8, 10 * camera.zoom)}px Georgia`;
        ctx.textAlign = 'center';
        const nameY = screen.y - 34 * camera.zoom - heightOffset;
        ctx.fillText(op.name || 'Player', screen.x + 1, nameY + 1);
        ctx.fillStyle = '#f0e8d8';
        ctx.fillText(op.name || 'Player', screen.x, nameY);
      }
    }

    // Draw player character
    ctx.globalAlpha = 1.0;
    if (gameData.player) {
      const p = gameData.player;
      const screen = tileToScreen(p.x, p.y);
      const heightOffset = GameMap.getHeight(Math.floor(p.x), Math.floor(p.y)) * 8 * camera.zoom;
      const animFrame = p.moving ? Math.floor(frameCount / 4) : 0;
      const sprite = Sprites.getPlayerSprite(p.direction || 0, animFrame, p.color || '#e8d0a0', p.tool);

      ctx.drawImage(
        sprite,
        screen.x - 12 * camera.zoom,
        screen.y - 28 * camera.zoom - heightOffset,
        24 * camera.zoom,
        32 * camera.zoom
      );

      // Interaction indicator (tile highlight)
      if (gameData.interactTile) {
        const it = gameData.interactTile;
        const itScreen = tileToScreen(it.x, it.y);
        ctx.strokeStyle = 'rgba(240,216,144,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(itScreen.x, itScreen.y - TILE_H / 2 * camera.zoom);
        ctx.lineTo(itScreen.x + TILE_W / 2 * camera.zoom, itScreen.y);
        ctx.lineTo(itScreen.x, itScreen.y + TILE_H / 2 * camera.zoom);
        ctx.lineTo(itScreen.x - TILE_W / 2 * camera.zoom, itScreen.y);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Build ghost
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
    if (GameMap.colomboX && GameMap.colomboY && isTileExplored(GameMap.colomboX, GameMap.colomboY)) {
      const cs = tileToScreen(GameMap.colomboX, GameMap.colomboY);
      ctx.fillStyle = '#e8a830';
      ctx.font = `bold ${Math.max(10, 12 * camera.zoom)}px Georgia`;
      ctx.textAlign = 'center';
      ctx.fillText('Colombo Port', cs.x, cs.y - 24 * camera.zoom);
      ctx.fillStyle = '#e8a830';
      ctx.beginPath();
      ctx.arc(cs.x, cs.y - 32 * camera.zoom, 3 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // Day/night overlay
    if (gameData.timeOfDay != null) {
      const tint = Sprites.getDayNightTint(gameData.timeOfDay);
      ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Render minimap
    renderMinimap(gameData);
  }

  // ── Minimap ─────────────────────────────────────────────────────────────

  function renderMinimap(gameData) {
    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    const scaleX = mw / GameMap.MAP_W;
    const scaleY = mh / GameMap.MAP_H;

    minimapCtx.fillStyle = '#1a2830';
    minimapCtx.fillRect(0, 0, mw, mh);

    const tileColors = {
      water: '#2a5870',
      shallowWater: '#3a7890',
      sand: '#c0b070',
      grass: '#5a8a3a',
      jungle: '#2a5a2a',
      mountain: '#6a6a60',
      river: '#3a7898',
      dirt: '#8a7050',
      ricePaddy: '#70a860',
      teaHill: '#4a8a3a',
      farmSoil: '#8a6a40',
      farmSoilWet: '#6a5030',
    };

    for (let y = 0; y < GameMap.MAP_H; y++) {
      for (let x = 0; x < GameMap.MAP_W; x++) {
        if (!isTileExplored(x, y)) continue;
        const tileName = GameMap.getTileName(x, y);
        minimapCtx.fillStyle = tileColors[tileName] || '#333';
        minimapCtx.globalAlpha = isTileVisible(x, y) ? 1 : 0.5;
        minimapCtx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
        minimapCtx.globalAlpha = 1;
      }
    }

    // Buildings
    if (gameData.buildings) {
      minimapCtx.fillStyle = '#c89860';
      for (const bld of gameData.buildings.values()) {
        minimapCtx.fillRect(bld.x * scaleX - 1, bld.y * scaleY - 1, 3, 3);
      }
    }

    // Player
    if (gameData.player) {
      minimapCtx.fillStyle = '#f0e0a0';
      minimapCtx.fillRect(gameData.player.x * scaleX - 2, gameData.player.y * scaleY - 2, 4, 4);
    }

    // Other players
    if (gameData.otherPlayers) {
      for (const op of gameData.otherPlayers) {
        minimapCtx.fillStyle = op.color || '#5090c0';
        minimapCtx.fillRect(op.x * scaleX - 1, op.y * scaleY - 1, 3, 3);
      }
    }

    // Colombo
    if (GameMap.colomboX) {
      minimapCtx.fillStyle = '#e8a830';
      minimapCtx.fillRect(GameMap.colomboX * scaleX - 2, GameMap.colomboY * scaleY - 2, 5, 5);
    }

    // Camera viewport
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(width, height);
    minimapCtx.strokeStyle = '#f0d890';
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
    followPlayer,
    centerOnTile,
    moveCamera,
    zoomCamera,
    setExplored,
    setVisibleFromPlayer,
    isTileExplored,
    isTileVisible,
    getVisibleTileRange,
    get frameCount() { return frameCount; },
  };
})();
