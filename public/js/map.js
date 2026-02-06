// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Procedural Map Generation
// Generates a Sri Lanka–inspired island with biomes, rivers, and resources.
// ═══════════════════════════════════════════════════════════════════════════

const GameMap = (() => {
  const MAP_W = 128;
  const MAP_H = 128;

  // Tile type constants
  const TILE = {
    WATER: 0,
    SHALLOW: 1,
    SAND: 2,
    GRASS: 3,
    JUNGLE: 4,
    MOUNTAIN: 5,
    RIVER: 6,
    DIRT: 7,
  };

  const TILE_NAMES = ['water', 'shallowWater', 'sand', 'grass', 'jungle', 'mountain', 'river', 'dirt'];

  let tiles = [];
  let heightMap = [];
  let moistureMap = [];
  let treeMap = []; // tree positions and variants
  let resourceNodes = []; // harvestable resource nodes

  // ── Simplex-like noise (using basic Perlin approach) ──────────────────

  function createNoise(seed) {
    // Simple seeded pseudo-random
    function seededRandom(x) {
      const s = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453123;
      return s - Math.floor(s);
    }

    function noise2D(x, y) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;

      const a = seededRandom(ix + iy * 57);
      const b = seededRandom(ix + 1 + iy * 57);
      const c = seededRandom(ix + (iy + 1) * 57);
      const d = seededRandom(ix + 1 + (iy + 1) * 57);

      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);

      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }

    function fbm(x, y, octaves, lacunarity, gain) {
      let sum = 0;
      let amp = 1;
      let freq = 1;
      let max = 0;
      for (let i = 0; i < octaves; i++) {
        sum += noise2D(x * freq, y * freq) * amp;
        max += amp;
        amp *= gain;
        freq *= lacunarity;
      }
      return sum / max;
    }

    return { noise2D, fbm };
  }

  // ── Island shape (rough Sri Lanka outline) ────────────────────────────

  function islandMask(x, y) {
    // Normalize to 0..1
    const nx = x / MAP_W;
    const ny = y / MAP_H;

    // Sri Lanka is roughly teardrop-shaped: wider in south, narrow in north
    // Center around 0.5, 0.5
    const cx = 0.5;
    const cy = 0.48;

    const dx = (nx - cx) * 2.2;
    const dy = (ny - cy) * 2.0;

    // Base ellipse
    let d = dx * dx * 1.2 + dy * dy;

    // Northern peninsula (narrowing)
    if (ny < 0.3) {
      const narrowFactor = 1 + (0.3 - ny) * 4;
      d = dx * dx * narrowFactor * 2 + dy * dy;
    }

    // Southern bulge
    if (ny > 0.6) {
      d *= 0.85;
    }

    // Eastern indent
    if (nx > 0.55 && ny > 0.3 && ny < 0.6) {
      d += 0.05;
    }

    return 1 - Math.min(1, d * 1.3);
  }

  // ── Generate Map ──────────────────────────────────────────────────────

  function generate(seed) {
    seed = seed || Math.random() * 10000;
    const noise = createNoise(seed);
    const noise2 = createNoise(seed + 42);

    tiles = new Array(MAP_W * MAP_H);
    heightMap = new Float32Array(MAP_W * MAP_H);
    moistureMap = new Float32Array(MAP_W * MAP_H);
    treeMap = [];
    resourceNodes = [];

    // Generate height and moisture
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;

        const island = islandMask(x, y);
        const elevation = noise.fbm(x * 0.03, y * 0.03, 6, 2.0, 0.5);
        const moisture = noise2.fbm(x * 0.04 + 100, y * 0.04 + 100, 4, 2.0, 0.5);

        heightMap[i] = elevation * island;
        moistureMap[i] = moisture;

        // Central mountains (Adam's Peak, etc.)
        const mcx = 0.45, mcy = 0.55;
        const mdx = (x / MAP_W - mcx);
        const mdy = (y / MAP_H - mcy);
        const mountainDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mountainDist < 0.15) {
          heightMap[i] += (0.15 - mountainDist) * 3;
        }

        // Determine tile type
        const h = heightMap[i];
        const m = moistureMap[i];

        if (h < 0.08) {
          tiles[i] = TILE.WATER;
        } else if (h < 0.12) {
          tiles[i] = TILE.SHALLOW;
        } else if (h < 0.16) {
          tiles[i] = TILE.SAND;
        } else if (h > 0.65) {
          tiles[i] = TILE.MOUNTAIN;
        } else if (m > 0.55 && h > 0.2) {
          tiles[i] = TILE.JUNGLE;
        } else {
          tiles[i] = TILE.GRASS;
        }
      }
    }

    // Generate rivers
    generateRivers(noise);

    // Generate trees
    generateTrees(noise);

    // Generate resource nodes
    generateResources(noise);

    // Colombo port area (western coast)
    markColombo();

    return { tiles, heightMap, moistureMap, treeMap, resourceNodes };
  }

  function generateRivers(noise) {
    // A few rivers flowing from central highlands to coast
    const riverStarts = [
      { x: 58, y: 70 }, // Mahaweli-like
      { x: 52, y: 65 }, // Kelani-like
      { x: 62, y: 75 }, // Southern river
    ];

    for (const start of riverStarts) {
      let rx = start.x;
      let ry = start.y;

      for (let step = 0; step < 80; step++) {
        const i = Math.floor(ry) * MAP_W + Math.floor(rx);
        if (rx < 0 || rx >= MAP_W || ry < 0 || ry >= MAP_H) break;
        if (tiles[i] === TILE.WATER || tiles[i] === TILE.SHALLOW) break;

        tiles[i] = TILE.RIVER;

        // Flow downhill with some noise
        let bestH = heightMap[i];
        let bestDx = 0, bestDy = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = Math.floor(rx + dx);
            const ny = Math.floor(ry + dy);
            if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
            const nh = heightMap[ny * MAP_W + nx];
            if (nh < bestH) {
              bestH = nh;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }

        // Add some randomness to river path
        rx += bestDx + (noise.noise2D(rx * 0.1, ry * 0.1) - 0.5) * 0.8;
        ry += bestDy + (noise.noise2D(rx * 0.1 + 50, ry * 0.1 + 50) - 0.5) * 0.5;

        // Widen river slightly
        const wi = Math.floor(ry) * MAP_W + Math.floor(rx + 1);
        if (wi >= 0 && wi < MAP_W * MAP_H && tiles[wi] !== TILE.WATER) {
          tiles[wi] = TILE.RIVER;
        }
      }
    }
  }

  function generateTrees(noise) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const tile = tiles[i];

        if (tile === TILE.JUNGLE) {
          // Dense jungle trees
          if (noise.noise2D(x * 0.5, y * 0.5) > 0.3) {
            const variant = Math.random() < 0.4 ? 'palm' : 'jungle';
            treeMap.push({ x, y, variant });
          }
        } else if (tile === TILE.GRASS) {
          // Scattered trees on grassland
          if (noise.noise2D(x * 0.3 + 100, y * 0.3 + 100) > 0.65) {
            const variant = Math.random() < 0.5 ? 'palm' : 'generic';
            treeMap.push({ x, y, variant });
          }
        } else if (tile === TILE.SAND) {
          // Occasional palm on beach
          if (Math.random() < 0.03) {
            treeMap.push({ x, y, variant: 'palm' });
          }
        }
      }
    }
  }

  function generateResources(noise) {
    let nodeId = 10000;

    for (let y = 4; y < MAP_H - 4; y += 3) {
      for (let x = 4; x < MAP_W - 4; x += 3) {
        const i = y * MAP_W + x;
        const tile = tiles[i];
        const h = heightMap[i];
        const n = noise.noise2D(x * 0.2 + 200, y * 0.2 + 200);

        if (tile === TILE.MOUNTAIN && n > 0.6) {
          resourceNodes.push({
            id: nodeId++,
            x, y,
            type: 'gemDeposit',
            resourceType: ['sapphire', 'ruby', 'moonstone'][Math.floor(Math.random() * 3)],
            amount: 20 + Math.floor(Math.random() * 30),
          });
        } else if (tile === TILE.MOUNTAIN && n > 0.4) {
          resourceNodes.push({
            id: nodeId++,
            x, y,
            type: 'stoneDeposit',
            resourceType: 'stone',
            amount: 40 + Math.floor(Math.random() * 40),
          });
        } else if (tile === TILE.JUNGLE && n > 0.55) {
          resourceNodes.push({
            id: nodeId++,
            x, y,
            type: 'woodPile',
            resourceType: 'wood',
            amount: 30 + Math.floor(Math.random() * 30),
          });
        } else if (tile === TILE.GRASS && n > 0.6 && h > 0.25) {
          resourceNodes.push({
            id: nodeId++,
            x, y,
            type: 'teaPlant',
            resourceType: 'tea',
            amount: 15 + Math.floor(Math.random() * 20),
          });
        }

        // Ruins (rare)
        if ((tile === TILE.JUNGLE || tile === TILE.GRASS) && noise.noise2D(x * 0.1 + 500, y * 0.1 + 500) > 0.85) {
          resourceNodes.push({
            id: nodeId++,
            x, y,
            type: 'ruin',
            resourceType: 'artifact',
            amount: 1,
          });
        }
      }
    }
  }

  function markColombo() {
    // Colombo is on the west coast, roughly mid-latitude
    // Find suitable coastal position
    const targetY = Math.floor(MAP_H * 0.45);

    for (let x = 0; x < MAP_W; x++) {
      const i = targetY * MAP_W + x;
      if (tiles[i] === TILE.SAND || tiles[i] === TILE.GRASS) {
        // Mark Colombo area
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ci = (targetY + dy) * MAP_W + (x + dx);
            if (ci >= 0 && ci < MAP_W * MAP_H) {
              tiles[ci] = TILE.DIRT; // cleared area for port
            }
          }
        }
        GameMap.colomboX = x;
        GameMap.colomboY = targetY;
        break;
      }
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────

  function getTile(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return TILE.WATER;
    return tiles[y * MAP_W + x];
  }

  function getTileName(x, y) {
    return TILE_NAMES[getTile(x, y)] || 'water';
  }

  function getHeight(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return 0;
    return heightMap[y * MAP_W + x];
  }

  function isWalkable(x, y) {
    const t = getTile(x, y);
    return t !== TILE.WATER && t !== TILE.MOUNTAIN;
  }

  function isWater(x, y) {
    const t = getTile(x, y);
    return t === TILE.WATER || t === TILE.SHALLOW || t === TILE.RIVER;
  }

  function getResourceNodesInArea(cx, cy, radius) {
    return resourceNodes.filter(n => {
      const d = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2);
      return d <= radius;
    });
  }

  function getResourceNodeAt(x, y, radius) {
    radius = radius || 2;
    return resourceNodes.find(n => {
      const d = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
      return d <= radius;
    });
  }

  return {
    MAP_W,
    MAP_H,
    TILE,
    TILE_NAMES,
    generate,
    getTile,
    getTileName,
    getHeight,
    isWalkable,
    isWater,
    getResourceNodesInArea,
    getResourceNodeAt,
    get tiles() { return tiles; },
    get heightMap() { return heightMap; },
    get treeMap() { return treeMap; },
    get resourceNodes() { return resourceNodes; },
    colomboX: 0,
    colomboY: 0,
  };
})();
