// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Procedural Pixel Art Sprite System
// All sprites are generated at runtime on offscreen canvases
// to achieve the hand-painted AoE aesthetic without external assets.
// ═══════════════════════════════════════════════════════════════════════════

const Sprites = (() => {
  const cache = {};
  const TILE_W = 64;
  const TILE_H = 32;

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function getCtx(canvas) {
    return canvas.getContext('2d');
  }

  // ── Color palette (muted historical) ──────────────────────────────────

  const PAL = {
    grass1: '#5a7a3a', grass2: '#4d6b30', grass3: '#6b8a45',
    jungle1: '#2d5a2d', jungle2: '#1e4a1e', jungle3: '#3a6a35',
    sand1: '#c8b878', sand2: '#b8a868', sand3: '#d8c888',
    water1: '#3a6888', water2: '#2a5878', water3: '#4a7898',
    waterShallow: '#4a8898',
    mountain1: '#6a6a6a', mountain2: '#5a5a5a', mountain3: '#7a7a7a',
    dirt1: '#8a7050', dirt2: '#7a6040', dirt3: '#9a8060',
    stone1: '#8a8a80', stone2: '#7a7a70',

    // Units
    skin: '#c8a878', skinShadow: '#a88a60',
    hair: '#3a2a1a',
    clothWhite: '#d8d0c0', clothShadow: '#b0a890',
    clothRed: '#a83030', clothBlue: '#3050a8',
    boot: '#4a3a2a',
    hat: '#c8b878',

    // Buildings
    woodLight: '#a08050', woodDark: '#705830',
    thatch: '#c8a850', thatchDark: '#a88830',
    roofTile: '#a06040',
    whitewash: '#d8d0c0',

    // Resources
    gemSapphire: '#2855a8', gemRuby: '#a82838', gemMoon: '#b8c8d8',
    teaGreen: '#4a8a3a',
    gold: '#d8a830',
  };

  // ── Tile Sprites ──────────────────────────────────────────────────────

  function drawIsoDiamond(ctx, x, y, w, h, colors) {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();

    if (typeof colors === 'string') {
      ctx.fillStyle = colors;
      ctx.fill();
    } else {
      ctx.fillStyle = colors[0];
      ctx.fill();
    }
  }

  function addDither(ctx, x, y, w, h, color, density) {
    ctx.fillStyle = color;
    for (let i = 0; i < density; i++) {
      const px = x + Math.random() * w;
      const py = y + Math.random() * h;
      ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
    }
  }

  function generateTile(type) {
    const c = createCanvas(TILE_W, TILE_H + 16);
    const ctx = getCtx(c);

    switch (type) {
      case 'grass': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.grass1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.grass2, 30);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.grass3, 15);
        // Tiny grass tufts
        ctx.fillStyle = PAL.grass3;
        for (let i = 0; i < 4; i++) {
          const gx = 16 + Math.random() * 32;
          const gy = 6 + Math.random() * 20;
          ctx.fillRect(gx, gy, 1, 2);
          ctx.fillRect(gx + 1, gy - 1, 1, 2);
        }
        break;
      }
      case 'jungle': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.jungle1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.jungle2, 40);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.jungle3, 20);
        // Dense vegetation marks
        ctx.fillStyle = PAL.jungle3;
        for (let i = 0; i < 8; i++) {
          const gx = 12 + Math.random() * 40;
          const gy = 4 + Math.random() * 24;
          ctx.fillRect(gx, gy, 2, 1);
        }
        break;
      }
      case 'coast':
      case 'sand': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.sand1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.sand2, 25);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.sand3, 10);
        break;
      }
      case 'water': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.water1);
        // Wave lines
        ctx.strokeStyle = PAL.water3;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const wy = 8 + i * 7;
          ctx.beginPath();
          ctx.moveTo(20 + i * 3, wy);
          ctx.lineTo(28 + i * 3, wy - 1);
          ctx.lineTo(36 + i * 3, wy);
          ctx.stroke();
        }
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.water2, 15);
        break;
      }
      case 'shallowWater': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.waterShallow);
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.water1, 15);
        break;
      }
      case 'mountain': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.mountain2);
        // Mountain peak
        ctx.fillStyle = PAL.mountain3;
        ctx.beginPath();
        ctx.moveTo(32, -8);
        ctx.lineTo(42, 8);
        ctx.lineTo(22, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PAL.mountain1;
        ctx.beginPath();
        ctx.moveTo(32, -8);
        ctx.lineTo(32, 8);
        ctx.lineTo(22, 8);
        ctx.closePath();
        ctx.fill();
        // Snow cap
        ctx.fillStyle = '#d8d8d0';
        ctx.beginPath();
        ctx.moveTo(32, -8);
        ctx.lineTo(36, -2);
        ctx.lineTo(28, -2);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'river': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.water2);
        ctx.strokeStyle = PAL.water3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, 16);
        ctx.quadraticCurveTo(32, 10, 48, 16);
        ctx.stroke();
        addDither(ctx, 10, 4, TILE_W - 20, TILE_H - 8, PAL.waterShallow, 10);
        break;
      }
      case 'dirt': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.dirt1);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.dirt2, 20);
        addDither(ctx, 8, 4, TILE_W - 16, TILE_H - 8, PAL.dirt3, 10);
        break;
      }
      default: {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, '#555');
        break;
      }
    }
    return c;
  }

  // ── Tree Sprites ──────────────────────────────────────────────────────

  function generateTree(variant) {
    const c = createCanvas(32, 48);
    const ctx = getCtx(c);

    if (variant === 'palm') {
      // Trunk
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(14, 20, 4, 28);
      ctx.fillStyle = PAL.woodLight;
      ctx.fillRect(15, 20, 2, 28);
      // Slightly curved trunk segments
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === 0 ? PAL.woodDark : PAL.woodLight;
        ctx.fillRect(14, 20 + i * 5, 4, 2);
      }
      // Fronds
      const frondColor = PAL.jungle1;
      const frondLight = PAL.jungle3;
      ctx.fillStyle = frondColor;
      // Left frond
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(4, 10, 0, 18);
      ctx.quadraticCurveTo(6, 12, 16, 18);
      ctx.fill();
      // Right frond
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(28, 10, 32, 18);
      ctx.quadraticCurveTo(26, 12, 16, 18);
      ctx.fill();
      // Top frond
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(10, 2, 16, 0);
      ctx.quadraticCurveTo(22, 2, 16, 16);
      ctx.fill();
      // Highlights
      ctx.fillStyle = frondLight;
      ctx.fillRect(8, 12, 2, 1);
      ctx.fillRect(22, 12, 2, 1);
      ctx.fillRect(15, 4, 2, 1);
    } else if (variant === 'jungle') {
      // Dense jungle tree
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(14, 24, 4, 24);
      // Canopy (large, rounded)
      ctx.fillStyle = PAL.jungle2;
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.jungle1;
      ctx.beginPath();
      ctx.arc(14, 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.jungle3;
      addDither(ctx, 4, 4, 24, 24, PAL.jungle3, 20);
    } else {
      // Generic tropical tree
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(14, 22, 4, 26);
      ctx.fillStyle = PAL.woodLight;
      ctx.fillRect(15, 22, 2, 26);
      // Canopy
      ctx.fillStyle = PAL.grass1;
      ctx.beginPath();
      ctx.arc(16, 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.grass2;
      ctx.beginPath();
      ctx.arc(14, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      addDither(ctx, 6, 4, 20, 20, PAL.grass3, 15);
    }
    return c;
  }

  // ── Unit Sprites ──────────────────────────────────────────────────────

  function generateUnit(type, playerColor, frame) {
    const c = createCanvas(16, 24);
    const ctx = getCtx(c);
    frame = frame || 0;

    const bounce = Math.sin(frame * 0.3) * 1;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(8, 22, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = PAL.boot;
    const legOffset = Math.sin(frame * 0.4) * 2;
    ctx.fillRect(5, 17 + bounce, 2, 4);
    ctx.fillRect(9, 17 + bounce - legOffset * 0.3, 2, 4);

    // Body
    ctx.fillStyle = playerColor || PAL.clothWhite;
    ctx.fillRect(4, 10 + bounce, 8, 8);
    // Shade
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(4, 10 + bounce, 3, 8);

    // Arms
    ctx.fillStyle = PAL.skin;
    ctx.fillRect(2, 11 + bounce, 2, 5);
    ctx.fillRect(12, 11 + bounce, 2, 5);

    // Head
    ctx.fillStyle = PAL.skin;
    ctx.fillRect(5, 4 + bounce, 6, 6);
    ctx.fillStyle = PAL.skinShadow;
    ctx.fillRect(5, 8 + bounce, 6, 2);

    // Hair
    ctx.fillStyle = PAL.hair;
    ctx.fillRect(5, 3 + bounce, 6, 2);

    if (type === 'explorer') {
      // Explorer hat (pith helmet)
      ctx.fillStyle = PAL.hat;
      ctx.fillRect(3, 2 + bounce, 10, 3);
      ctx.fillRect(5, 1 + bounce, 6, 2);
      // Binoculars hint
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(12, 12 + bounce, 2, 3);
    } else if (type === 'worker') {
      // Headband
      ctx.fillStyle = playerColor || PAL.clothRed;
      ctx.fillRect(5, 3 + bounce, 6, 1);
      // Tool
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(13, 9 + bounce, 1, 8);
      ctx.fillStyle = PAL.stone1;
      ctx.fillRect(12, 8 + bounce, 3, 2);
    } else if (type === 'cart') {
      // Cart is wider
      ctx.clearRect(0, 0, 16, 24);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(2, 20, 12, 3);
      ctx.fillStyle = PAL.woodLight;
      ctx.fillRect(1, 14, 14, 6);
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(1, 14, 14, 1);
      ctx.fillRect(1, 19, 14, 1);
      // Wheels
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.arc(3, 21, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(13, 21, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    return c;
  }

  // ── Building Sprites ──────────────────────────────────────────────────

  function generateBuilding(type, playerColor, progress) {
    const data = {
      camp: { w: 48, h: 48 },
      farm: { w: 64, h: 64 },
      mine: { w: 48, h: 48 },
      warehouse: { w: 64, h: 48 },
      road: { w: 64, h: 32 },
      dock: { w: 64, h: 64 },
      tradingPost: { w: 48, h: 48 },
    };

    const dim = data[type] || { w: 48, h: 48 };
    const c = createCanvas(dim.w, dim.h + 16);
    const ctx = getCtx(c);
    const incomplete = progress != null && progress < 100;

    if (incomplete) {
      ctx.globalAlpha = 0.5 + (progress / 100) * 0.5;
    }

    switch (type) {
      case 'camp': {
        // Tent
        ctx.fillStyle = PAL.thatch;
        ctx.beginPath();
        ctx.moveTo(24, 4);
        ctx.lineTo(44, 28);
        ctx.lineTo(4, 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PAL.thatchDark;
        ctx.beginPath();
        ctx.moveTo(24, 4);
        ctx.lineTo(24, 28);
        ctx.lineTo(4, 28);
        ctx.closePath();
        ctx.fill();
        // Pole
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(23, 2, 2, 28);
        // Flag
        ctx.fillStyle = playerColor || PAL.clothRed;
        ctx.fillRect(25, 2, 8, 5);
        // Ground
        ctx.fillStyle = PAL.dirt1;
        ctx.fillRect(2, 28, 44, 4);
        break;
      }
      case 'farm': {
        // Plowed field
        ctx.fillStyle = PAL.dirt2;
        drawIsoDiamond(ctx, 2, 8, 60, 30, PAL.dirt1);
        // Crop rows
        ctx.fillStyle = PAL.teaGreen;
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 6; col++) {
            const fx = 14 + col * 6 + (row % 2) * 3;
            const fy = 14 + row * 5;
            ctx.fillRect(fx, fy, 3, 2);
          }
        }
        // Small hut
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(4, 32, 16, 12);
        ctx.fillStyle = PAL.thatch;
        ctx.beginPath();
        ctx.moveTo(2, 32);
        ctx.lineTo(12, 24);
        ctx.lineTo(22, 32);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'mine': {
        // Mine entrance
        ctx.fillStyle = PAL.mountain2;
        ctx.fillRect(8, 10, 32, 28);
        ctx.fillStyle = PAL.mountain1;
        ctx.beginPath();
        ctx.moveTo(8, 10);
        ctx.lineTo(24, 0);
        ctx.lineTo(40, 10);
        ctx.closePath();
        ctx.fill();
        // Entrance
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(16, 18, 16, 20);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(14, 16, 20, 3);
        ctx.fillRect(14, 16, 3, 22);
        ctx.fillRect(31, 16, 3, 22);
        // Cart track
        ctx.fillStyle = PAL.stone2;
        ctx.fillRect(16, 38, 16, 2);
        break;
      }
      case 'warehouse': {
        // Stone base
        ctx.fillStyle = PAL.stone1;
        ctx.fillRect(4, 24, 56, 20);
        // Wooden upper
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(4, 8, 56, 18);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(4, 8, 56, 2);
        // Roof
        ctx.fillStyle = PAL.roofTile;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(32, 0);
        ctx.lineTo(64, 10);
        ctx.closePath();
        ctx.fill();
        // Door
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(26, 26, 12, 18);
        // Player flag
        ctx.fillStyle = playerColor || '#c23616';
        ctx.fillRect(50, 2, 8, 5);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(49, 0, 2, 10);
        break;
      }
      case 'road': {
        drawIsoDiamond(ctx, 0, 0, TILE_W, TILE_H, PAL.dirt2);
        ctx.fillStyle = PAL.stone2;
        for (let i = 0; i < 6; i++) {
          const rx = 12 + i * 7 + Math.random() * 3;
          const ry = 10 + Math.random() * 12;
          ctx.fillRect(rx, ry, 4 + Math.random() * 3, 2 + Math.random() * 2);
        }
        break;
      }
      case 'dock': {
        // Water base
        ctx.fillStyle = PAL.water2;
        ctx.fillRect(0, 32, 64, 32);
        // Wooden pier
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(8, 16, 48, 24);
        ctx.fillStyle = PAL.woodDark;
        // Planks
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(8, 16 + i * 4, 48, 1);
        }
        // Posts
        ctx.fillRect(8, 12, 4, 28);
        ctx.fillRect(52, 12, 4, 28);
        // Shelter
        ctx.fillStyle = PAL.thatch;
        ctx.fillRect(16, 4, 32, 14);
        ctx.fillStyle = PAL.thatchDark;
        ctx.fillRect(16, 4, 32, 2);
        break;
      }
      case 'tradingPost': {
        // Main building
        ctx.fillStyle = PAL.whitewash;
        ctx.fillRect(6, 12, 36, 28);
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(6, 12, 36, 2);
        // Roof
        ctx.fillStyle = PAL.roofTile;
        ctx.beginPath();
        ctx.moveTo(2, 14);
        ctx.lineTo(24, 2);
        ctx.lineTo(46, 14);
        ctx.closePath();
        ctx.fill();
        // Door
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(20, 24, 8, 16);
        // Sign
        ctx.fillStyle = PAL.woodLight;
        ctx.fillRect(34, 18, 12, 8);
        ctx.fillStyle = playerColor || PAL.gold;
        ctx.fillRect(36, 20, 8, 4);
        break;
      }
    }

    ctx.globalAlpha = 1;

    if (incomplete) {
      // Scaffolding overlay
      ctx.strokeStyle = PAL.woodDark;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(2, 2, dim.w - 4, dim.h - 4);
      ctx.setLineDash([]);
      // Progress text
      ctx.fillStyle = '#c8b88a';
      ctx.font = '10px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(Math.floor(progress) + '%', dim.w / 2, dim.h + 12);
    }

    return c;
  }

  // ── Resource Sprites ──────────────────────────────────────────────────

  function generateResource(type) {
    const c = createCanvas(20, 20);
    const ctx = getCtx(c);

    switch (type) {
      case 'wood': {
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(4, 4, 4, 14);
        ctx.fillStyle = PAL.grass1;
        ctx.beginPath();
        ctx.arc(6, 6, 5, 0, Math.PI * 2);
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
      case 'gem':
      case 'sapphire': {
        ctx.fillStyle = PAL.gemSapphire;
        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(16, 8);
        ctx.lineTo(14, 16);
        ctx.lineTo(6, 16);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5080d0';
        ctx.fillRect(9, 6, 3, 3);
        break;
      }
      case 'ruby': {
        ctx.fillStyle = PAL.gemRuby;
        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(16, 8);
        ctx.lineTo(14, 16);
        ctx.lineTo(6, 16);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d05060';
        ctx.fillRect(9, 6, 3, 3);
        break;
      }
      case 'moonstone': {
        ctx.fillStyle = PAL.gemMoon;
        ctx.beginPath();
        ctx.arc(10, 10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d0d8e8';
        ctx.beginPath();
        ctx.arc(8, 8, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'tea': {
        ctx.fillStyle = PAL.teaGreen;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(6 + i * 4, 10 + (i % 2) * 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'spice': {
        ctx.fillStyle = '#c87830';
        ctx.fillRect(6, 6, 8, 10);
        ctx.fillStyle = '#a86020';
        ctx.fillRect(6, 6, 8, 2);
        break;
      }
      case 'food': {
        ctx.fillStyle = '#d8c080';
        ctx.fillRect(4, 8, 12, 8);
        ctx.fillStyle = '#c8a860';
        ctx.fillRect(4, 8, 12, 2);
        break;
      }
      case 'gold': {
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(10, 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c89020';
        ctx.beginPath();
        ctx.arc(10, 10, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = '#888';
        ctx.fillRect(4, 4, 12, 12);
      }
    }
    return c;
  }

  // ── Resource Node Sprites (map objects) ───────────────────────────────

  function generateResourceNode(type) {
    const c = createCanvas(32, 32);
    const ctx = getCtx(c);

    switch (type) {
      case 'gemDeposit': {
        // Rock with gems
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
        // Gem sparkles
        ctx.fillStyle = PAL.gemSapphire;
        ctx.fillRect(10, 10, 3, 3);
        ctx.fillStyle = PAL.gemRuby;
        ctx.fillRect(18, 16, 3, 3);
        ctx.fillStyle = PAL.gemMoon;
        ctx.fillRect(14, 20, 2, 2);
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
        ctx.fillStyle = '#3a7a2a';
        ctx.beginPath();
        ctx.arc(12, 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(15, 20, 2, 10);
        break;
      }
      case 'ruin': {
        // Broken pillars
        ctx.fillStyle = PAL.stone1;
        ctx.fillRect(4, 8, 6, 20);
        ctx.fillRect(22, 12, 6, 16);
        // Broken top
        ctx.fillRect(2, 6, 10, 3);
        // Vines
        ctx.fillStyle = PAL.jungle3;
        ctx.fillRect(6, 10, 2, 4);
        ctx.fillRect(24, 14, 2, 3);
        // Mystery glow
        ctx.fillStyle = 'rgba(200, 168, 50, 0.3)';
        ctx.beginPath();
        ctx.arc(16, 18, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    return c;
  }

  // ── HUD Icons ─────────────────────────────────────────────────────────

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
        ctx.fillStyle = '#c89020';
        ctx.font = 'bold 9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('G', 8, 11);
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
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

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

  function getUnit(type, color, frame) {
    const key = `unit_${type}_${color}_${frame || 0}`;
    if (!cache[key]) cache[key] = generateUnit(type, color, frame);
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

  return {
    TILE_W,
    TILE_H,
    PAL,
    getTile,
    getTree,
    getUnit,
    getBuilding,
    getResource,
    getResourceNode,
    drawHudIcon,
  };
})();
