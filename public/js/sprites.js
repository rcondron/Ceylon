// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Procedural Pixel Art Sprite System
// Warm, cozy Stardew Valley × Age of Empires hybrid aesthetic.
// All sprites generated at runtime with hand-painted pixel look.
// ═══════════════════════════════════════════════════════════════════════════

const Sprites = (() => {
  const cache = {};
  const TILE_W = 64;
  const TILE_H = 32;

  // Character sprite dimensions (used by renderer for positioning)
  const CHAR_W = 48;
  const CHAR_H = 76;
  // How far (in CHAR_H units) the feet/ground-plane is from the sprite bottom.
  // The renderer uses this to anchor the character to the tile.
  const CHAR_FOOT_OFFSET = 6;

  // ── Sprite Sheet System ─────────────────────────────────────────────────
  // Loads an external sprite sheet PNG for the player character.
  // Falls back to procedural pixel art if the sheet fails to load.

  const SHEET = {
    image: null,
    loaded: false,
    cols: 6,       // frames per row
    rows: 8,       // total rows in sheet
    frameW: 0,     // auto-calculated on load
    frameH: 0,
    // Map game directions to sprite sheet rows (isometric mapping):
    //   Game direction 0 = South (SE on screen) → front-right walk
    //   Game direction 1 = West  (SW on screen) → front-left walk
    //   Game direction 2 = North (NW on screen) → back-left walk
    //   Game direction 3 = East  (NE on screen) → back-right walk
    directionRows: {
      0: 4,   // South → row 4 (front-right facing, SE walk)
      1: 0,   // West  → row 0 (front-left facing, SW walk)
      2: 1,   // North → row 1 (back-left facing, NW walk)
      3: 3,   // East  → row 3 (back-right facing, NE walk)
    },
    idleFrame: 0,       // column index for idle pose
    walkStart: 1,       // first walk frame column
    walkEnd: 5,         // last walk frame column
    sleepRow: 7,        // collapse/sleep animation row
    specialRow: 6,      // special poses row (binoculars etc.)
  };

  // Attempt to load the character sprite sheet
  (function loadCharacterSheet() {
    const img = new Image();
    img.onload = function () {
      SHEET.image = img;
      SHEET.frameW = Math.floor(img.width / SHEET.cols);
      SHEET.frameH = Math.floor(img.height / SHEET.rows);
      SHEET.loaded = true;
      // Clear any cached procedural player sprites so sheet versions are used
      for (const key of Object.keys(cache)) {
        if (key.startsWith('player_') || key.startsWith('otherp_')) {
          delete cache[key];
        }
      }
      console.log(`Character sheet loaded: ${img.width}x${img.height}, frame: ${SHEET.frameW}x${SHEET.frameH}`);
    };
    img.onerror = function () {
      console.log('Character sprite sheet not found, using procedural sprites.');
    };
    img.src = 'assets/character.png';
  })();

  // Extra pixels to grab below each frame to capture legs/shadows that
  // overflow past the row boundary in the sprite sheet.
  const SHEET_OVERFLOW_Y = 30;

  // Extract a single frame from the sprite sheet and scale to CHAR_W x CHAR_H
  function extractSheetFrame(row, col) {
    const key = `sheet_${row}_${col}`;
    if (cache[key]) return cache[key];

    const srcX = col * SHEET.frameW;
    const srcY = row * SHEET.frameH;
    // Grab the frame plus overflow, clamped to image bounds
    const srcH = Math.min(SHEET.frameH + SHEET_OVERFLOW_Y, SHEET.image.height - srcY);

    const c = createCanvas(CHAR_W, CHAR_H);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; // smooth scaling for detailed art
    ctx.drawImage(
      SHEET.image,
      srcX, srcY,
      SHEET.frameW, srcH,
      0, 0, CHAR_W, CHAR_H
    );
    cache[key] = c;
    return c;
  }

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function getCtx(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  // ── Warm cozy palette ───────────────────────────────────────────────────

  const PAL = {
    // Terrain - warm, lush greens and earth tones
    grass1: '#6b9e4a', grass2: '#5d8e3c', grass3: '#7db05a',
    grassDry: '#a8b060',
    jungle1: '#3a7a3a', jungle2: '#2d6a2d', jungle3: '#4a8a45',
    sand1: '#e8d8a0', sand2: '#d8c890', sand3: '#f0e0b0',
    water1: '#4a90b0', water2: '#3a80a0', water3: '#5aa0c0',
    waterShallow: '#60b0c0', waterDeep: '#2a6080',
    mountain1: '#8a8878', mountain2: '#7a7868', mountain3: '#9a9888',
    mountainSnow: '#e8e4d8',
    dirt1: '#b09060', dirt2: '#a08050', dirt3: '#c0a070',
    river: '#4a98b8',
    stone1: '#9a9890', stone2: '#8a8880',

    // Farmland
    soil: '#8a6a40', soilWet: '#6a5030', soilTilled: '#7a5a38',
    ricePaddy: '#88b860', ricePaddyWater: '#70a8a0',

    // Player character - warm friendly
    skin: '#e8c8a0', skinShadow: '#c8a880', skinBlush: '#e0a890',
    hair1: '#5a3a20', hair2: '#8a6030', hair3: '#c89050',
    clothWhite: '#f0e8d8', clothShadow: '#d0c8b0',
    boot: '#6a4a2a', bootLight: '#8a6a4a',

    // Buildings - warm colonial/tropical
    woodLight: '#c89860', woodMid: '#a88050', woodDark: '#806038',
    thatch: '#d8b860', thatchDark: '#b89840', thatchLight: '#e8c870',
    roofTile: '#c07048', roofTileDark: '#a06038',
    whitewash: '#f0e8d8', whitewashShadow: '#d8d0c0',
    brick: '#c08060', brickDark: '#a06848',

    // Resources & goods
    gemSapphire: '#3868c0', gemRuby: '#c03848', gemMoon: '#c0d0e0',
    teaGreen: '#5a9a40', teaDried: '#a08030',
    cinnamonBark: '#a06830', cinnamonDried: '#c88040',
    spice: '#d89030', rice: '#f0e8c0',
    gold: '#e8b830',

    // UI accent colors
    uiWarm: '#f0d890', uiBg: '#3a2818', uiBorder: '#8a7050',
    uiAccent: '#e8a830',
    uiHealth: '#70b848', uiEnergy: '#58a0d0',

    // Nature accents
    flower1: '#e880a0', flower2: '#e8d060', flower3: '#a080d0',
    flower4: '#f0a060', flower5: '#80c0e0',
    butterfly: '#e0a0d0',
  };

  // ── Utility drawing functions ───────────────────────────────────────────

  function drawIsoDiamond(ctx, x, y, w, h, color) {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    ctx.fillStyle = typeof color === 'string' ? color : color[0];
    ctx.fill();
  }

  function addDither(ctx, x, y, w, h, color, density) {
    ctx.fillStyle = color;
    for (let i = 0; i < density; i++) {
      const px = x + Math.random() * w;
      const py = y + Math.random() * h;
      ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
    }
  }

  function drawPixelCircle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) {
          ctx.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
  }

  // ── Tile Sprites ────────────────────────────────────────────────────────

  function generateTile(type) {
    const c = createCanvas(TILE_W, TILE_H + 16);
    const ctx = getCtx(c);

    switch (type) {
      case 'grass': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.grass1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.grass2, 25);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.grass3, 20);
        // Tiny flowers scattered
        const flowerColors = [PAL.flower1, PAL.flower2, PAL.flower4];
        for (let i = 0; i < 3; i++) {
          const fx = 16 + Math.random() * 32;
          const fy = 6 + Math.random() * 20;
          ctx.fillStyle = flowerColors[Math.floor(Math.random() * flowerColors.length)];
          ctx.fillRect(fx, fy, 1, 1);
          ctx.fillRect(fx + 1, fy, 1, 1);
        }
        // Grass tufts
        ctx.fillStyle = PAL.grass3;
        for (let i = 0; i < 5; i++) {
          const gx = 14 + Math.random() * 36;
          const gy = 5 + Math.random() * 22;
          ctx.fillRect(gx, gy, 1, 2);
        }
        break;
      }
      case 'jungle': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.jungle1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.jungle2, 35);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.jungle3, 25);
        // Dense undergrowth
        for (let i = 0; i < 6; i++) {
          const gx = 12 + Math.random() * 40;
          const gy = 4 + Math.random() * 24;
          ctx.fillStyle = PAL.jungle3;
          ctx.fillRect(gx, gy, 2, 1);
          ctx.fillRect(gx + 1, gy + 1, 1, 1);
        }
        break;
      }
      case 'sand': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.sand1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.sand2, 20);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.sand3, 15);
        // Shell / pebble details
        ctx.fillStyle = PAL.sand3;
        for (let i = 0; i < 2; i++) {
          const sx = 18 + Math.random() * 28;
          const sy = 8 + Math.random() * 16;
          ctx.fillRect(sx, sy, 2, 1);
        }
        break;
      }
      case 'water': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.water1);
        // Soft wave highlights
        ctx.strokeStyle = PAL.water3;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const wy = 8 + i * 7;
          ctx.beginPath();
          ctx.moveTo(20 + i * 3, wy);
          ctx.quadraticCurveTo(28 + i * 2, wy - 2, 38 + i * 2, wy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.water2, 12);
        break;
      }
      case 'shallowWater': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.waterShallow);
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.water1, 12);
        // Sand showing through
        addDither(ctx, 12, 6, TILE_W - 24, TILE_H - 12, PAL.sand2, 5);
        break;
      }
      case 'mountain': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.mountain2);
        // Mountain peak
        ctx.fillStyle = PAL.mountain3;
        ctx.beginPath();
        ctx.moveTo(32, -8);
        ctx.lineTo(44, 8);
        ctx.lineTo(20, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PAL.mountain1;
        ctx.beginPath();
        ctx.moveTo(32, -8);
        ctx.lineTo(32, 8);
        ctx.lineTo(20, 8);
        ctx.closePath();
        ctx.fill();
        // Snow cap with warmth
        ctx.fillStyle = PAL.mountainSnow;
        ctx.beginPath();
        ctx.moveTo(32, -8);
        ctx.lineTo(37, -2);
        ctx.lineTo(27, -2);
        ctx.closePath();
        ctx.fill();
        // Misty base
        ctx.fillStyle = 'rgba(230,220,200,0.15)';
        ctx.fillRect(16, 20, 32, 6);
        break;
      }
      case 'river': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.river);
        ctx.strokeStyle = PAL.water3;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, 16);
        ctx.quadraticCurveTo(32, 10, 48, 16);
        ctx.stroke();
        ctx.globalAlpha = 1;
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.waterShallow, 8);
        break;
      }
      case 'dirt': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.dirt1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.dirt2, 18);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.dirt3, 10);
        break;
      }
      case 'farmSoil': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.soil);
        // Tilled rows
        ctx.fillStyle = PAL.soilTilled;
        for (let i = 0; i < 6; i++) {
          const ry = 6 + i * 4;
          ctx.fillRect(16 + i * 2, ry, 28 - i * 4, 1);
        }
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.soilWet, 8);
        break;
      }
      case 'farmSoilWet': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.soilWet);
        ctx.fillStyle = PAL.soil;
        for (let i = 0; i < 6; i++) {
          const ry = 6 + i * 4;
          ctx.fillRect(16 + i * 2, ry, 28 - i * 4, 1);
        }
        // Water sheen
        ctx.fillStyle = 'rgba(100,160,200,0.1)';
        ctx.fillRect(12, 6, 40, 20);
        break;
      }
      case 'ricePaddy': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.ricePaddyWater);
        // Rice plants
        ctx.fillStyle = PAL.ricePaddy;
        for (let i = 0; i < 8; i++) {
          const rx = 14 + Math.random() * 36;
          const ry = 5 + Math.random() * 22;
          ctx.fillRect(rx, ry, 1, 3);
          ctx.fillRect(rx + 1, ry + 1, 1, 2);
        }
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.waterShallow, 6);
        break;
      }
      case 'teaHill': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.grass2);
        // Tea bush rows
        ctx.fillStyle = PAL.teaGreen;
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 5; col++) {
            const tx = 14 + col * 8 + (row % 2) * 4;
            const ty = 6 + row * 5;
            ctx.fillRect(tx, ty, 4, 2);
            ctx.fillStyle = '#4a8a30';
            ctx.fillRect(tx, ty + 2, 4, 1);
            ctx.fillStyle = PAL.teaGreen;
          }
        }
        break;
      }
      default: {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, '#666');
        break;
      }
    }
    return c;
  }

  // ── Tree Sprites ────────────────────────────────────────────────────────

  function generateTree(variant) {
    const c = createCanvas(32, 48);
    const ctx = getCtx(c);

    if (variant === 'palm') {
      // Warm palm tree
      ctx.fillStyle = PAL.woodMid;
      ctx.fillRect(14, 20, 4, 28);
      ctx.fillStyle = PAL.woodLight;
      ctx.fillRect(15, 20, 2, 28);
      // Trunk segments
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === 0 ? PAL.woodDark : PAL.woodMid;
        ctx.fillRect(14, 20 + i * 5, 4, 2);
      }
      // Lush fronds
      ctx.fillStyle = PAL.jungle1;
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(3, 10, 0, 20);
      ctx.quadraticCurveTo(6, 14, 16, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(29, 10, 32, 20);
      ctx.quadraticCurveTo(26, 14, 16, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(10, 2, 16, 0);
      ctx.quadraticCurveTo(22, 2, 16, 16);
      ctx.fill();
      // Coconuts
      ctx.fillStyle = '#8a6a30';
      ctx.fillRect(14, 18, 2, 2);
      ctx.fillRect(17, 19, 2, 2);
      // Frond highlights
      ctx.fillStyle = PAL.jungle3;
      ctx.fillRect(8, 12, 2, 1);
      ctx.fillRect(22, 12, 2, 1);
      ctx.fillRect(15, 4, 2, 1);
    } else if (variant === 'jungle') {
      // Dense canopy tree
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(14, 24, 4, 24);
      // Large rounded canopy
      ctx.fillStyle = PAL.jungle2;
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.jungle1;
      ctx.beginPath();
      ctx.arc(14, 14, 12, 0, Math.PI * 2);
      ctx.fill();
      // Dappled light
      addDither(ctx, 4, 4, 24, 24, PAL.jungle3, 18);
      addDither(ctx, 6, 6, 20, 16, '#5a9a48', 6);
    } else if (variant === 'cinnamon') {
      // Cinnamon tree - distinctive reddish bark
      ctx.fillStyle = PAL.cinnamonBark;
      ctx.fillRect(13, 18, 6, 30);
      ctx.fillStyle = '#905828';
      ctx.fillRect(14, 18, 4, 30);
      // Canopy
      ctx.fillStyle = PAL.grass1;
      ctx.beginPath();
      ctx.arc(16, 12, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.grass2;
      ctx.beginPath();
      ctx.arc(14, 10, 9, 0, Math.PI * 2);
      ctx.fill();
      addDither(ctx, 6, 3, 20, 18, PAL.grass3, 12);
    } else {
      // Generic friendly tropical tree
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(14, 22, 4, 26);
      ctx.fillStyle = PAL.woodLight;
      ctx.fillRect(15, 22, 2, 26);
      // Round friendly canopy
      ctx.fillStyle = PAL.grass1;
      ctx.beginPath();
      ctx.arc(16, 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.grass2;
      ctx.beginPath();
      ctx.arc(13, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      addDither(ctx, 6, 4, 20, 18, PAL.grass3, 14);
      // Warm highlight
      addDither(ctx, 8, 5, 12, 8, '#8aba5a', 4);
    }
    return c;
  }

  // ── Player Character Sprites ────────────────────────────────────────────

  function generatePlayerCharacter(direction, frame, playerColor, toolEquipped) {
    const c = createCanvas(24, 32);
    const ctx = getCtx(c);

    const bounce = Math.abs(Math.sin(frame * 0.5)) * 1.5;
    const isMoving = frame > 0;
    const legSwing = isMoving ? Math.sin(frame * 0.6) * 2 : 0;

    // Direction: 0=down, 1=left, 2=up, 3=right
    const facingRight = direction === 3;
    const facingLeft = direction === 1;
    const facingUp = direction === 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(12, 29, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = PAL.boot;
    if (isMoving) {
      ctx.fillRect(8, 23 + bounce - legSwing * 0.3, 3, 5);
      ctx.fillRect(13, 23 + bounce + legSwing * 0.3, 3, 5);
    } else {
      ctx.fillRect(8, 23, 3, 5);
      ctx.fillRect(13, 23, 3, 5);
    }
    // Boot detail
    ctx.fillStyle = PAL.bootLight;
    ctx.fillRect(8, 26 + (isMoving ? bounce - legSwing * 0.3 : 0), 3, 1);
    ctx.fillRect(13, 26 + (isMoving ? bounce + legSwing * 0.3 : 0), 3, 1);

    // Pants
    ctx.fillStyle = '#7a6848';
    ctx.fillRect(7, 19 + (isMoving ? bounce : 0), 10, 5);

    // Body / shirt
    ctx.fillStyle = playerColor || PAL.clothWhite;
    ctx.fillRect(6, 12 + (isMoving ? bounce : 0), 12, 8);
    // Shirt shade
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(6, 12 + (isMoving ? bounce : 0), 4, 8);
    // Shirt highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(14, 13 + (isMoving ? bounce : 0), 3, 5);

    // Suspender / belt detail
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(7, 19 + (isMoving ? bounce : 0), 10, 1);

    // Arms
    const armBounce = isMoving ? bounce : 0;
    ctx.fillStyle = PAL.skin;
    if (facingUp) {
      ctx.fillRect(4, 13 + armBounce, 2, 6);
      ctx.fillRect(18, 13 + armBounce, 2, 6);
    } else {
      ctx.fillRect(4, 13 + armBounce, 3, 7);
      ctx.fillRect(17, 13 + armBounce, 3, 7);
    }

    // Head
    const headY = 4 + (isMoving ? bounce * 0.5 : 0);
    ctx.fillStyle = PAL.skin;
    ctx.fillRect(7, headY, 10, 8);
    // Cheek blush
    ctx.fillStyle = PAL.skinBlush;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(7, headY + 4, 2, 2);
    ctx.fillRect(15, headY + 4, 2, 2);
    ctx.globalAlpha = 1;
    // Face shadow
    ctx.fillStyle = PAL.skinShadow;
    ctx.fillRect(7, headY + 6, 10, 2);

    if (!facingUp) {
      // Eyes
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(9, headY + 3, 2, 2);
      ctx.fillRect(13, headY + 3, 2, 2);
      // Eye shine
      ctx.fillStyle = '#fff';
      ctx.fillRect(9, headY + 3, 1, 1);
      ctx.fillRect(13, headY + 3, 1, 1);
      // Mouth
      ctx.fillStyle = PAL.skinShadow;
      ctx.fillRect(10, headY + 6, 4, 1);
    }

    // Hair
    ctx.fillStyle = PAL.hair1;
    ctx.fillRect(6, headY - 1, 12, 3);
    ctx.fillRect(7, headY + 1, 10, 1);
    if (facingLeft || facingUp) {
      ctx.fillRect(6, headY + 1, 2, 4);
    }
    if (facingRight || facingUp) {
      ctx.fillRect(16, headY + 1, 2, 4);
    }

    // Hat (straw sunhat - cozy explorer)
    ctx.fillStyle = PAL.thatch;
    ctx.fillRect(4, headY - 3, 16, 3);
    ctx.fillStyle = PAL.thatchDark;
    ctx.fillRect(6, headY - 4, 12, 2);
    ctx.fillStyle = PAL.thatchLight;
    ctx.fillRect(7, headY - 4, 10, 1);

    // Tool in hand (if equipped)
    if (toolEquipped) {
      const toolY = 14 + armBounce;
      switch (toolEquipped) {
        case 'hoe':
          ctx.fillStyle = PAL.woodDark;
          ctx.fillRect(19, toolY - 2, 2, 10);
          ctx.fillStyle = '#8a8a80';
          ctx.fillRect(18, toolY - 3, 4, 2);
          break;
        case 'wateringCan':
          ctx.fillStyle = '#7090a0';
          ctx.fillRect(18, toolY + 2, 5, 4);
          ctx.fillStyle = '#608898';
          ctx.fillRect(20, toolY, 2, 3);
          break;
        case 'pickaxe':
          ctx.fillStyle = PAL.woodDark;
          ctx.fillRect(19, toolY - 2, 2, 10);
          ctx.fillStyle = '#8a8a80';
          ctx.fillRect(17, toolY - 4, 6, 2);
          break;
        case 'axe':
          ctx.fillStyle = PAL.woodDark;
          ctx.fillRect(19, toolY - 2, 2, 10);
          ctx.fillStyle = '#8a8a80';
          ctx.fillRect(18, toolY - 3, 5, 3);
          break;
        case 'machete':
          ctx.fillStyle = '#a0a098';
          ctx.fillRect(19, toolY - 4, 2, 12);
          ctx.fillStyle = PAL.woodDark;
          ctx.fillRect(19, toolY + 6, 2, 3);
          break;
      }
    }

    return c;
  }

  // ── NPC/Other Player Sprites ────────────────────────────────────────────

  function generateOtherPlayer(direction, frame, playerColor) {
    // Simpler version of player character for other players
    return generatePlayerCharacter(direction, frame, playerColor, null);
  }

  // ── Crop Sprites ────────────────────────────────────────────────────────

  function generateCrop(cropType, stage) {
    // Stages: 0=seed, 1=sprout, 2=growing, 3=mature, 4=harvestable
    const c = createCanvas(16, 24);
    const ctx = getCtx(c);

    const colors = {
      tea: { leaf: PAL.teaGreen, dark: '#3a7a2a', accent: '#7aba5a' },
      rice: { leaf: '#90b848', dark: '#6a9830', accent: PAL.rice },
      cinnamon: { leaf: PAL.cinnamonBark, dark: '#805020', accent: '#d09048' },
      spice: { leaf: '#c08830', dark: '#906020', accent: '#e0a840' },
    };

    const col = colors[cropType] || colors.tea;

    switch (stage) {
      case 0: // Seed
        ctx.fillStyle = PAL.soil;
        ctx.fillRect(6, 20, 4, 2);
        ctx.fillStyle = '#a08050';
        ctx.fillRect(7, 20, 2, 1);
        break;
      case 1: // Sprout
        ctx.fillStyle = '#80b040';
        ctx.fillRect(7, 16, 2, 6);
        ctx.fillRect(6, 17, 1, 1);
        ctx.fillRect(9, 18, 1, 1);
        break;
      case 2: // Growing
        ctx.fillStyle = col.dark;
        ctx.fillRect(7, 12, 2, 10);
        ctx.fillStyle = col.leaf;
        ctx.fillRect(4, 11, 4, 3);
        ctx.fillRect(8, 13, 4, 3);
        ctx.fillRect(5, 9, 6, 3);
        break;
      case 3: // Mature
        ctx.fillStyle = col.dark;
        ctx.fillRect(7, 8, 2, 14);
        ctx.fillStyle = col.leaf;
        ctx.fillRect(3, 6, 5, 4);
        ctx.fillRect(8, 8, 5, 4);
        ctx.fillRect(4, 10, 8, 3);
        ctx.fillRect(5, 4, 6, 4);
        ctx.fillStyle = col.accent;
        ctx.fillRect(5, 5, 2, 2);
        ctx.fillRect(9, 7, 2, 2);
        break;
      case 4: // Harvestable (with sparkle)
        ctx.fillStyle = col.dark;
        ctx.fillRect(7, 6, 2, 16);
        ctx.fillStyle = col.leaf;
        ctx.fillRect(2, 4, 6, 5);
        ctx.fillRect(8, 6, 6, 5);
        ctx.fillRect(3, 9, 10, 4);
        ctx.fillRect(4, 2, 8, 4);
        ctx.fillStyle = col.accent;
        ctx.fillRect(4, 3, 3, 2);
        ctx.fillRect(10, 5, 3, 2);
        ctx.fillRect(6, 8, 2, 2);
        // Sparkle
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(3, 2, 1, 1);
        ctx.fillRect(12, 4, 1, 1);
        ctx.globalAlpha = 1;
        break;
    }
    return c;
  }

  // ── Building Sprites ────────────────────────────────────────────────────

  function generateBuilding(type, playerColor, progress) {
    const dims = {
      house: { w: 56, h: 56 },
      farm: { w: 64, h: 48 },
      smelter: { w: 40, h: 44 },
      gemCutter: { w: 40, h: 40 },
      dryingRack: { w: 48, h: 36 },
      carpentry: { w: 48, h: 44 },
      warehouse: { w: 56, h: 48 },
      tradingPost: { w: 52, h: 48 },
      dock: { w: 60, h: 56 },
      road: { w: 64, h: 32 },
      well: { w: 28, h: 36 },
      marketStall: { w: 44, h: 40 },
    };

    const dim = dims[type] || { w: 48, h: 48 };
    const c = createCanvas(dim.w, dim.h + 16);
    const ctx = getCtx(c);
    const incomplete = progress != null && progress < 100;

    if (incomplete) {
      ctx.globalAlpha = 0.5 + (progress / 100) * 0.5;
    }

    switch (type) {
      case 'house': {
        // Cozy colonial cottage
        const bx = 6, by = 16;
        // Stone foundation
        ctx.fillStyle = PAL.stone1;
        ctx.fillRect(bx, by + 28, 44, 6);
        // Whitewashed walls
        ctx.fillStyle = PAL.whitewash;
        ctx.fillRect(bx + 2, by + 8, 40, 22);
        ctx.fillStyle = PAL.whitewashShadow;
        ctx.fillRect(bx + 2, by + 8, 14, 22);
        // Tiled roof
        ctx.fillStyle = PAL.roofTile;
        ctx.beginPath();
        ctx.moveTo(bx - 2, by + 10);
        ctx.lineTo(bx + 22, by - 4);
        ctx.lineTo(bx + 46, by + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PAL.roofTileDark;
        ctx.beginPath();
        ctx.moveTo(bx - 2, by + 10);
        ctx.lineTo(bx + 22, by - 4);
        ctx.lineTo(bx + 22, by + 10);
        ctx.closePath();
        ctx.fill();
        // Roof ridge detail
        ctx.fillStyle = PAL.thatch;
        ctx.fillRect(bx + 10, by - 4, 24, 2);
        // Door
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(bx + 16, by + 18, 10, 12);
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(bx + 17, by + 19, 8, 10);
        // Door handle
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(bx + 23, by + 24, 1, 1);
        // Windows
        ctx.fillStyle = '#a0c8d8';
        ctx.fillRect(bx + 6, by + 14, 6, 6);
        ctx.fillRect(bx + 30, by + 14, 6, 6);
        // Window frames
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(bx + 5, by + 13, 8, 1);
        ctx.fillRect(bx + 5, by + 20, 8, 1);
        ctx.fillRect(bx + 8, by + 14, 1, 6);
        ctx.fillRect(bx + 29, by + 13, 8, 1);
        ctx.fillRect(bx + 29, by + 20, 8, 1);
        ctx.fillRect(bx + 32, by + 14, 1, 6);
        // Window light glow
        ctx.fillStyle = 'rgba(255,230,150,0.3)';
        ctx.fillRect(bx + 6, by + 14, 6, 6);
        ctx.fillRect(bx + 30, by + 14, 6, 6);
        // Chimney
        ctx.fillStyle = PAL.brick;
        ctx.fillRect(bx + 36, by - 2, 6, 10);
        ctx.fillStyle = PAL.brickDark;
        ctx.fillRect(bx + 36, by - 2, 6, 1);
        // Flower box
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(bx + 5, by + 20, 8, 2);
        ctx.fillStyle = PAL.flower1;
        ctx.fillRect(bx + 6, by + 19, 2, 1);
        ctx.fillStyle = PAL.flower2;
        ctx.fillRect(bx + 9, by + 19, 2, 1);
        ctx.fillStyle = PAL.flower4;
        ctx.fillRect(bx + 12, by + 19, 1, 1);
        // Path stones
        ctx.fillStyle = PAL.stone2;
        ctx.fillRect(bx + 18, by + 30, 6, 4);
        ctx.fillRect(bx + 20, by + 34, 4, 2);
        break;
      }
      case 'farm': {
        // Plowed field with cozy hut
        drawIsoDiamond(ctx, 2, 8, 60, 28, PAL.soil);
        // Crop rows
        ctx.fillStyle = PAL.teaGreen;
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 6; col++) {
            const fx = 14 + col * 7 + (row % 2) * 3;
            const fy = 12 + row * 5;
            ctx.fillRect(fx, fy, 3, 2);
            ctx.fillStyle = '#4a8a30';
            ctx.fillRect(fx + 1, fy + 2, 2, 1);
            ctx.fillStyle = PAL.teaGreen;
          }
        }
        // Small wooden shelter
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(2, 32, 18, 12);
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(2, 32, 18, 1);
        ctx.fillStyle = PAL.thatch;
        ctx.beginPath();
        ctx.moveTo(0, 33);
        ctx.lineTo(11, 24);
        ctx.lineTo(22, 33);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'smelter': {
        // Stone furnace
        ctx.fillStyle = PAL.stone1;
        ctx.fillRect(6, 14, 28, 24);
        ctx.fillStyle = PAL.stone2;
        ctx.fillRect(6, 14, 28, 2);
        // Chimney
        ctx.fillStyle = PAL.brick;
        ctx.fillRect(10, 4, 8, 12);
        ctx.fillStyle = PAL.brickDark;
        ctx.fillRect(10, 4, 8, 1);
        // Fire opening
        ctx.fillStyle = '#1a0a00';
        ctx.fillRect(14, 26, 12, 12);
        // Fire glow
        ctx.fillStyle = '#e08020';
        ctx.fillRect(16, 30, 4, 4);
        ctx.fillStyle = '#f0a030';
        ctx.fillRect(20, 28, 3, 5);
        ctx.fillStyle = 'rgba(255,150,50,0.3)';
        ctx.fillRect(12, 24, 16, 14);
        // Smoke hint
        ctx.fillStyle = 'rgba(150,140,130,0.3)';
        ctx.fillRect(12, 2, 4, 3);
        break;
      }
      case 'gemCutter': {
        // Workbench with gems
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(4, 16, 32, 18);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(4, 16, 32, 2);
        // Legs
        ctx.fillRect(6, 34, 3, 6);
        ctx.fillRect(31, 34, 3, 6);
        // Gems on table
        ctx.fillStyle = PAL.gemSapphire;
        ctx.fillRect(10, 20, 3, 3);
        ctx.fillStyle = PAL.gemRuby;
        ctx.fillRect(18, 21, 3, 3);
        ctx.fillStyle = PAL.gemMoon;
        ctx.fillRect(26, 20, 3, 3);
        // Cutting tool
        ctx.fillStyle = '#a0a098';
        ctx.fillRect(14, 18, 1, 6);
        // Lamp
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(30, 10, 4, 6);
        ctx.fillStyle = 'rgba(255,230,150,0.3)';
        ctx.beginPath();
        ctx.arc(32, 18, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dryingRack': {
        // Wooden drying rack
        ctx.fillStyle = PAL.woodDark;
        // Posts
        ctx.fillRect(4, 8, 3, 26);
        ctx.fillRect(41, 8, 3, 26);
        // Beams
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(4, 8, 40, 2);
        ctx.fillRect(4, 16, 40, 2);
        ctx.fillRect(4, 24, 40, 2);
        // Hanging items (tea leaves, spices)
        ctx.fillStyle = PAL.teaGreen;
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(8 + i * 7, 10, 4, 5);
        }
        ctx.fillStyle = PAL.cinnamonBark;
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(8 + i * 7, 18, 4, 5);
        }
        // Thatch roof
        ctx.fillStyle = PAL.thatch;
        ctx.fillRect(2, 4, 44, 5);
        ctx.fillStyle = PAL.thatchDark;
        ctx.fillRect(2, 4, 44, 1);
        break;
      }
      case 'carpentry': {
        // Workbench with wood
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(6, 18, 36, 16);
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(6, 18, 36, 2);
        // Legs
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(8, 34, 3, 8);
        ctx.fillRect(37, 34, 3, 8);
        // Roof
        ctx.fillStyle = PAL.thatch;
        ctx.beginPath();
        ctx.moveTo(2, 18);
        ctx.lineTo(24, 6);
        ctx.lineTo(46, 18);
        ctx.closePath();
        ctx.fill();
        // Tools on wall
        ctx.fillStyle = '#8a8a80';
        ctx.fillRect(12, 22, 2, 8);
        ctx.fillRect(18, 24, 2, 6);
        // Wood pieces
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(28, 22, 8, 3);
        ctx.fillRect(30, 26, 6, 3);
        break;
      }
      case 'warehouse': {
        // Large storage building
        ctx.fillStyle = PAL.stone1;
        ctx.fillRect(4, 24, 48, 20);
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(4, 8, 48, 18);
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(4, 8, 48, 2);
        // Roof
        ctx.fillStyle = PAL.roofTile;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(28, 0);
        ctx.lineTo(56, 10);
        ctx.closePath();
        ctx.fill();
        // Door
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(22, 26, 12, 18);
        // Crate
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(40, 30, 8, 8);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(40, 30, 8, 1);
        // Flag
        ctx.fillStyle = playerColor || PAL.uiAccent;
        ctx.fillRect(46, 2, 8, 5);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(45, 0, 2, 10);
        break;
      }
      case 'tradingPost': {
        // Trading post with sign
        ctx.fillStyle = PAL.whitewash;
        ctx.fillRect(6, 12, 40, 28);
        ctx.fillStyle = PAL.whitewashShadow;
        ctx.fillRect(6, 12, 14, 28);
        // Roof
        ctx.fillStyle = PAL.roofTile;
        ctx.beginPath();
        ctx.moveTo(2, 14);
        ctx.lineTo(26, 2);
        ctx.lineTo(50, 14);
        ctx.closePath();
        ctx.fill();
        // Door
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(20, 24, 10, 16);
        // Sign
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(36, 16, 14, 10);
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(38, 18, 10, 6);
        // Awning
        ctx.fillStyle = '#c05038';
        ctx.fillRect(4, 11, 44, 3);
        break;
      }
      case 'dock': {
        // Wooden dock/pier
        ctx.fillStyle = PAL.water2;
        ctx.fillRect(0, 36, 60, 20);
        // Pier planks
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(8, 18, 44, 24);
        ctx.fillStyle = PAL.woodMid;
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(8, 18 + i * 4, 44, 1);
        }
        // Posts
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(8, 14, 4, 28);
        ctx.fillRect(48, 14, 4, 28);
        // Shelter
        ctx.fillStyle = PAL.thatch;
        ctx.fillRect(14, 6, 32, 14);
        ctx.fillStyle = PAL.thatchDark;
        ctx.fillRect(14, 6, 32, 2);
        // Rope
        ctx.strokeStyle = PAL.woodDark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(12, 16);
        ctx.lineTo(20, 12);
        ctx.stroke();
        break;
      }
      case 'road': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.dirt2);
        ctx.fillStyle = PAL.stone2;
        for (let i = 0; i < 7; i++) {
          const rx = 10 + i * 7 + Math.random() * 2;
          const ry = 10 + Math.random() * 12;
          ctx.fillRect(rx, ry, 3 + Math.random() * 3, 2 + Math.random());
        }
        break;
      }
      case 'well': {
        // Stone well
        ctx.fillStyle = PAL.stone1;
        ctx.fillRect(6, 16, 16, 16);
        ctx.fillStyle = PAL.stone2;
        ctx.fillRect(6, 16, 16, 2);
        // Water inside
        ctx.fillStyle = PAL.water1;
        ctx.fillRect(8, 20, 12, 8);
        // Roof posts
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(7, 6, 2, 12);
        ctx.fillRect(19, 6, 2, 12);
        // Roof
        ctx.fillStyle = PAL.thatch;
        ctx.beginPath();
        ctx.moveTo(4, 8);
        ctx.lineTo(14, 0);
        ctx.lineTo(24, 8);
        ctx.closePath();
        ctx.fill();
        // Bucket
        ctx.fillStyle = PAL.woodMid;
        ctx.fillRect(12, 10, 4, 4);
        break;
      }
      case 'marketStall': {
        // Colorful market stall
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(4, 20, 36, 16);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(4, 20, 36, 2);
        // Legs
        ctx.fillRect(6, 36, 2, 4);
        ctx.fillRect(36, 36, 2, 4);
        // Awning (colorful stripes)
        const awningColors = ['#c05038', '#e8c040', '#c05038', '#e8c040'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = awningColors[i];
          ctx.fillRect(2, 12 + i * 2, 40, 2);
        }
        // Goods on display
        ctx.fillStyle = PAL.teaGreen;
        ctx.fillRect(8, 24, 6, 4);
        ctx.fillStyle = PAL.spice;
        ctx.fillRect(18, 24, 6, 4);
        ctx.fillStyle = PAL.cinnamonBark;
        ctx.fillRect(28, 24, 6, 4);
        break;
      }
    }

    ctx.globalAlpha = 1;

    if (incomplete) {
      ctx.strokeStyle = PAL.woodDark;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(2, 2, dim.w - 4, dim.h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = PAL.uiWarm;
      ctx.font = '9px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(Math.floor(progress) + '%', dim.w / 2, dim.h + 12);
    }

    return c;
  }

  // ── Resource & Item Sprites ─────────────────────────────────────────────

  function generateResource(type) {
    const c = createCanvas(20, 20);
    const ctx = getCtx(c);

    switch (type) {
      case 'wood': {
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(4, 6, 4, 12);
        ctx.fillStyle = PAL.grass1;
        ctx.beginPath();
        ctx.arc(6, 7, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'stone': {
        ctx.fillStyle = PAL.stone1;
        ctx.beginPath();
        ctx.arc(10, 12, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.stone2;
        ctx.beginPath();
        ctx.arc(8, 10, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sapphire': {
        ctx.fillStyle = PAL.gemSapphire;
        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(17, 8);
        ctx.lineTo(14, 16);
        ctx.lineTo(6, 16);
        ctx.lineTo(3, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5890e0';
        ctx.fillRect(8, 6, 4, 4);
        break;
      }
      case 'ruby': {
        ctx.fillStyle = PAL.gemRuby;
        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(17, 8);
        ctx.lineTo(14, 16);
        ctx.lineTo(6, 16);
        ctx.lineTo(3, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e06070';
        ctx.fillRect(8, 6, 4, 4);
        break;
      }
      case 'moonstone': {
        ctx.fillStyle = PAL.gemMoon;
        ctx.beginPath();
        ctx.arc(10, 10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d8e0f0';
        ctx.beginPath();
        ctx.arc(8, 8, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'tea': case 'teaLeaves': {
        ctx.fillStyle = PAL.teaGreen;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(6 + i * 4, 10 + (i % 2) * 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'driedTea': {
        ctx.fillStyle = PAL.teaDried;
        ctx.fillRect(4, 6, 12, 10);
        ctx.fillStyle = '#908028';
        ctx.fillRect(4, 6, 12, 2);
        break;
      }
      case 'packagedTea': {
        ctx.fillStyle = '#d8c890';
        ctx.fillRect(3, 4, 14, 12);
        ctx.fillStyle = PAL.teaGreen;
        ctx.fillRect(5, 6, 10, 8);
        ctx.fillStyle = '#c0b080';
        ctx.fillRect(3, 4, 14, 1);
        break;
      }
      case 'cinnamon': {
        ctx.fillStyle = PAL.cinnamonBark;
        ctx.fillRect(4, 4, 12, 4);
        ctx.fillRect(6, 8, 10, 4);
        ctx.fillRect(4, 12, 12, 4);
        ctx.fillStyle = PAL.cinnamonDried;
        ctx.fillRect(5, 5, 10, 2);
        break;
      }
      case 'spice': case 'spiceBundle': {
        ctx.fillStyle = PAL.spice;
        ctx.fillRect(5, 5, 10, 12);
        ctx.fillStyle = '#c08028';
        ctx.fillRect(5, 5, 10, 2);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(8, 3, 4, 2);
        break;
      }
      case 'rice': {
        ctx.fillStyle = PAL.rice;
        ctx.fillRect(4, 6, 12, 10);
        ctx.fillStyle = '#e0d8b0';
        ctx.fillRect(4, 6, 12, 2);
        break;
      }
      case 'milledRice': {
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(3, 4, 14, 14);
        ctx.fillStyle = '#d8d0b8';
        ctx.fillRect(3, 4, 14, 2);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(7, 2, 6, 3);
        break;
      }
      case 'cutGem': {
        ctx.fillStyle = PAL.gemSapphire;
        ctx.beginPath();
        ctx.moveTo(10, 1);
        ctx.lineTo(18, 8);
        ctx.lineTo(15, 17);
        ctx.lineTo(5, 17);
        ctx.lineTo(2, 8);
        ctx.closePath();
        ctx.fill();
        // Facets
        ctx.fillStyle = '#5890e0';
        ctx.fillRect(7, 5, 6, 6);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(8, 4, 2, 2);
        ctx.globalAlpha = 1;
        break;
      }
      case 'jewelry': {
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(10, 10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c89820';
        ctx.beginPath();
        ctx.arc(10, 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.gemSapphire;
        ctx.fillRect(8, 8, 4, 4);
        break;
      }
      case 'food': {
        ctx.fillStyle = '#e0c080';
        ctx.fillRect(4, 8, 12, 8);
        ctx.fillStyle = '#d0b068';
        ctx.fillRect(4, 8, 12, 2);
        break;
      }
      case 'gold': {
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(10, 10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c89820';
        ctx.beginPath();
        ctx.arc(10, 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0c040';
        ctx.font = 'bold 9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('G', 10, 13);
        break;
      }
      default: {
        ctx.fillStyle = '#888';
        ctx.fillRect(4, 4, 12, 12);
      }
    }
    return c;
  }

  // ── Resource Node Sprites (world objects) ───────────────────────────────

  function generateResourceNode(type) {
    const c = createCanvas(32, 32);
    const ctx = getCtx(c);

    switch (type) {
      case 'gemDeposit': {
        // Sparkly rock with visible gems
        ctx.fillStyle = PAL.stone1;
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(28, 14);
        ctx.lineTo(24, 28);
        ctx.lineTo(8, 28);
        ctx.lineTo(4, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PAL.stone2;
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(16, 28);
        ctx.lineTo(4, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PAL.gemSapphire;
        ctx.fillRect(10, 10, 3, 3);
        ctx.fillStyle = PAL.gemRuby;
        ctx.fillRect(18, 16, 3, 3);
        ctx.fillStyle = PAL.gemMoon;
        ctx.fillRect(14, 20, 2, 2);
        // Sparkles
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(11, 9, 1, 1);
        ctx.fillRect(19, 15, 1, 1);
        ctx.globalAlpha = 1;
        break;
      }
      case 'stoneDeposit': {
        ctx.fillStyle = PAL.stone1;
        ctx.beginPath();
        ctx.arc(16, 18, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.stone2;
        ctx.beginPath();
        ctx.arc(12, 14, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.mountain3;
        ctx.fillRect(14, 12, 4, 3);
        break;
      }
      case 'woodPile': {
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(4, 16, 24, 12);
        ctx.fillStyle = PAL.woodLight;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(8 + i * 6, 16, 3, Math.PI, 0);
          ctx.fill();
        }
        break;
      }
      case 'teaPlant': {
        ctx.fillStyle = PAL.teaGreen;
        ctx.beginPath();
        ctx.arc(16, 14, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a8a30';
        ctx.beginPath();
        ctx.arc(13, 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(15, 20, 2, 10);
        // Tea leaf highlights
        addDither(ctx, 8, 6, 16, 14, '#6aaa48', 6);
        break;
      }
      case 'cinnamonTree': {
        ctx.fillStyle = PAL.cinnamonBark;
        ctx.fillRect(14, 14, 4, 18);
        ctx.fillStyle = PAL.grass1;
        ctx.beginPath();
        ctx.arc(16, 10, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.grass2;
        ctx.beginPath();
        ctx.arc(14, 8, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ruin': {
        ctx.fillStyle = PAL.stone1;
        ctx.fillRect(4, 8, 6, 20);
        ctx.fillRect(22, 12, 6, 16);
        ctx.fillRect(2, 6, 10, 3);
        // Overgrown vines
        ctx.fillStyle = PAL.jungle3;
        ctx.fillRect(6, 10, 2, 4);
        ctx.fillRect(24, 14, 2, 3);
        ctx.fillStyle = PAL.grass3;
        ctx.fillRect(3, 24, 4, 2);
        // Mystery warm glow
        ctx.fillStyle = 'rgba(232, 184, 48, 0.25)';
        ctx.beginPath();
        ctx.arc(16, 18, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    return c;
  }

  // ── Tool Sprites ────────────────────────────────────────────────────────

  function generateToolIcon(tool) {
    const c = createCanvas(20, 20);
    const ctx = getCtx(c);

    switch (tool) {
      case 'hoe': {
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(4, 4, 2, 14);
        ctx.fillStyle = '#8a8a80';
        ctx.fillRect(2, 2, 6, 3);
        break;
      }
      case 'wateringCan': {
        ctx.fillStyle = '#6088a0';
        ctx.fillRect(4, 8, 10, 8);
        ctx.fillStyle = '#507890';
        ctx.fillRect(12, 6, 4, 3);
        // Spout
        ctx.fillRect(14, 9, 4, 2);
        // Handle
        ctx.fillRect(2, 6, 3, 2);
        break;
      }
      case 'pickaxe': {
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(8, 4, 2, 14);
        ctx.fillStyle = '#8a8a80';
        ctx.fillRect(4, 2, 10, 3);
        break;
      }
      case 'axe': {
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(8, 4, 2, 14);
        ctx.fillStyle = '#8a8a80';
        ctx.beginPath();
        ctx.moveTo(6, 2);
        ctx.lineTo(14, 2);
        ctx.lineTo(14, 7);
        ctx.lineTo(8, 7);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'machete': {
        ctx.fillStyle = '#a0a098';
        ctx.fillRect(6, 2, 3, 12);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(5, 14, 5, 4);
        break;
      }
      case 'seeds': {
        ctx.fillStyle = '#a08848';
        ctx.fillRect(4, 6, 12, 10);
        ctx.fillStyle = '#90783a';
        ctx.fillRect(4, 6, 12, 2);
        // Seeds visible
        ctx.fillStyle = '#705828';
        ctx.fillRect(6, 10, 2, 2);
        ctx.fillRect(10, 11, 2, 2);
        ctx.fillRect(8, 8, 2, 2);
        break;
      }
    }
    return c;
  }

  // ── HUD Icons ───────────────────────────────────────────────────────────

  function drawHudIcon(canvasId, type) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 16, 16);

    switch (type) {
      case 'gold':
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(8, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c89820';
        ctx.font = 'bold 9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('G', 8, 11);
        break;
      case 'energy':
        ctx.fillStyle = PAL.uiEnergy;
        ctx.beginPath();
        ctx.arc(8, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4090c0';
        ctx.font = 'bold 9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('E', 8, 11);
        break;
      case 'food':
        ctx.fillStyle = '#8aaa4a';
        ctx.beginPath();
        ctx.arc(8, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6a8a2a';
        ctx.font = 'bold 9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('F', 8, 11);
        break;
      case 'wood':
        ctx.fillStyle = PAL.woodLight;
        ctx.beginPath();
        ctx.arc(8, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.woodDark;
        ctx.font = 'bold 9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('W', 8, 11);
        break;
      case 'stone':
        ctx.fillStyle = PAL.stone1;
        ctx.beginPath();
        ctx.arc(8, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a5a50';
        ctx.font = 'bold 9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('S', 8, 11);
        break;
      case 'reputation':
        ctx.fillStyle = PAL.uiAccent;
        ctx.beginPath();
        ctx.moveTo(8, 2);
        ctx.lineTo(10, 6);
        ctx.lineTo(14, 7);
        ctx.lineTo(11, 10);
        ctx.lineTo(12, 14);
        ctx.lineTo(8, 12);
        ctx.lineTo(4, 14);
        ctx.lineTo(5, 10);
        ctx.lineTo(2, 7);
        ctx.lineTo(6, 6);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }

  // ── Day/Night overlay tint ──────────────────────────────────────────────

  function getDayNightTint(timeOfDay) {
    // timeOfDay: 0-1 where 0.25 = 6am, 0.5 = noon, 0.75 = 6pm
    // Returns { r, g, b, a } for overlay tint
    if (timeOfDay < 0.2) {
      // Night: deep blue
      return { r: 20, g: 25, b: 60, a: 0.35 };
    } else if (timeOfDay < 0.3) {
      // Dawn: warm orange
      const t = (timeOfDay - 0.2) / 0.1;
      return {
        r: Math.floor(20 + t * 40),
        g: Math.floor(25 + t * 30),
        b: Math.floor(60 - t * 40),
        a: 0.35 - t * 0.2,
      };
    } else if (timeOfDay < 0.7) {
      // Day: warm golden light
      const t = Math.sin((timeOfDay - 0.3) / 0.4 * Math.PI);
      return { r: 255, g: 240, b: 200, a: 0.03 + t * 0.02 };
    } else if (timeOfDay < 0.8) {
      // Dusk: orange-pink
      const t = (timeOfDay - 0.7) / 0.1;
      return {
        r: Math.floor(255 - t * 200),
        g: Math.floor(200 - t * 150),
        b: Math.floor(150 - t * 80),
        a: 0.05 + t * 0.2,
      };
    } else {
      // Night
      const t = Math.min(1, (timeOfDay - 0.8) / 0.15);
      return {
        r: Math.floor(55 - t * 35),
        g: Math.floor(50 - t * 25),
        b: Math.floor(70 - t * 10),
        a: 0.25 + t * 0.1,
      };
    }
  }

  // ── Public API with caching ─────────────────────────────────────────────

  function getTile(type) {
    const key = `tile_${type}`;
    if (!cache[key]) cache[key] = generateTile(type);
    return cache[key];
  }

  function getTree(variant) {
    const key = `tree_${variant}`;
    if (!cache[key]) cache[key] = generateTree(variant);
    return cache[key];
  }

  function getPlayerSprite(direction, frame, color, tool) {
    if (SHEET.loaded) {
      const row = SHEET.directionRows[direction] != null ? SHEET.directionRows[direction] : 0;
      let col;
      if (frame > 0) {
        // Walking: cycle through walk frames
        const walkRange = SHEET.walkEnd - SHEET.walkStart + 1;
        col = SHEET.walkStart + (Math.floor(frame) % walkRange);
      } else {
        col = SHEET.idleFrame;
      }
      return extractSheetFrame(row, col);
    }
    // Fallback to procedural sprites
    const f = Math.floor(frame) % 8;
    const key = `player_${direction}_${f}_${color}_${tool || 'none'}`;
    if (!cache[key]) cache[key] = generatePlayerCharacter(direction, f, color, tool);
    return cache[key];
  }

  function getOtherPlayerSprite(direction, frame, color) {
    if (SHEET.loaded) {
      const row = SHEET.directionRows[direction] != null ? SHEET.directionRows[direction] : 0;
      let col;
      if (frame > 0) {
        const walkRange = SHEET.walkEnd - SHEET.walkStart + 1;
        col = SHEET.walkStart + (Math.floor(frame) % walkRange);
      } else {
        col = SHEET.idleFrame;
      }
      return extractSheetFrame(row, col);
    }
    const f = Math.floor(frame) % 8;
    const key = `otherp_${direction}_${f}_${color}`;
    if (!cache[key]) cache[key] = generateOtherPlayer(direction, f, color);
    return cache[key];
  }

  function getCrop(cropType, stage) {
    const key = `crop_${cropType}_${stage}`;
    if (!cache[key]) cache[key] = generateCrop(cropType, stage);
    return cache[key];
  }

  function getBuilding(type, color, progress) {
    const pKey = progress != null && progress < 100 ? Math.floor(progress / 10) * 10 : 100;
    const key = `bld_${type}_${color}_${pKey}`;
    if (!cache[key]) cache[key] = generateBuilding(type, color, progress);
    return cache[key];
  }

  function getResource(type) {
    const key = `res_${type}`;
    if (!cache[key]) cache[key] = generateResource(type);
    return cache[key];
  }

  function getResourceNode(type) {
    const key = `resnode_${type}`;
    if (!cache[key]) cache[key] = generateResourceNode(type);
    return cache[key];
  }

  function getToolIcon(tool) {
    const key = `tool_${tool}`;
    if (!cache[key]) cache[key] = generateToolIcon(tool);
    return cache[key];
  }

  // Keep old getUnit for compatibility during transition
  function getUnit(type, color, frame) {
    return getPlayerSprite(0, frame || 0, color, null);
  }

  return {
    TILE_W,
    TILE_H,
    CHAR_W,
    CHAR_H,
    CHAR_FOOT_OFFSET,
    PAL,
    SHEET,
    getTile,
    getTree,
    getPlayerSprite,
    getOtherPlayerSprite,
    getCrop,
    getBuilding,
    getResource,
    getResourceNode,
    getToolIcon,
    drawHudIcon,
    getDayNightTint,
    getUnit,
  };
})();
