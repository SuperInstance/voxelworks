/**
 * BootScene — Generates all textures procedurally.
 * No external image assets needed. Everything is drawn via Phaser Graphics
 * and converted to textures for use in the game.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Show loading text
    const { width, height } = this.sys.game.config;
    const loadText = this.add.text(width / 2, height / 2, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Courier New',
    }).setOrigin(0.5);

    // Simulate a brief load for visual polish
    this.load.on('complete', () => loadText.destroy());
  }

  create() {
    this.createPlayerTexture();
    this.createPlatformTexture();
    this.createCoinTexture();
    this.createSpikeTexture();
    this.createBackgroundTextures();
    this.createParticleTexture();

    this.scene.start('MenuScene');
  }

  /**
   * Creates the player character texture.
   * A cute voxel cat: green square body with triangular ears.
   */
  createPlayerTexture() {
    const size = 32;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Body — bright green voxel
    g.fillStyle(0x44cc44);
    g.fillRect(2, 8, 28, 24);

    // Body highlight (top)
    g.fillStyle(0x55ee55);
    g.fillRect(2, 8, 28, 4);

    // Body shadow (bottom)
    g.fillStyle(0x339933);
    g.fillRect(2, 28, 28, 4);

    // Head — slightly darker green
    g.fillStyle(0x33bb33);
    g.fillRect(6, 0, 20, 12);

    // Head highlight
    g.fillStyle(0x44dd44);
    g.fillRect(6, 0, 20, 3);

    // Left ear — triangle
    g.fillStyle(0x33bb33);
    g.fillTriangle(4, 8, 8, -2, 12, 8);

    // Right ear — triangle
    g.fillStyle(0x33bb33);
    g.fillTriangle(20, 8, 24, -2, 28, 8);

    // Inner ears (pinkish)
    g.fillStyle(0xff88aa);
    g.fillTriangle(6, 7, 9, 1, 11, 7);
    g.fillTriangle(21, 7, 23, 1, 26, 7);

    // Eyes — white with black pupils
    g.fillStyle(0xffffff);
    g.fillRect(10, 4, 5, 5);
    g.fillRect(17, 4, 5, 5);
    g.fillStyle(0x000000);
    g.fillRect(12, 5, 3, 4);
    g.fillRect(19, 5, 3, 4);

    // Nose
    g.fillStyle(0xff8888);
    g.fillRect(14, 8, 4, 2);

    // Tail (hanging behind, pixel-style)
    g.fillStyle(0x44cc44);
    g.fillRect(0, 14, 2, 6);
    g.fillRect(0, 10, 2, 2);

    g.generateTexture('player', size, size + 2);
    g.destroy();
  }

  /**
   * Creates platform tile textures.
   * Brown voxel blocks with subtle top highlight and bottom shadow.
   */
  createPlatformTexture() {
    // Normal platform
    this._makeTile('platform', 0x8b5e3c, 0xa5764a, 0x6b4426);

    // Stone platform (used in cavern level)
    this._makeTile('platform_stone', 0x666666, 0x888888, 0x444444);

    // Lava brick platform (used in lava level)
    this._makeTile('platform_lava', 0xcc4400, 0xff6622, 0x992200);
  }

  /**
   * Helper to generate a tile texture with highlight and shadow.
   */
  _makeTile(key, base, light, dark) {
    const size = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Grid lines for voxel look
    g.fillStyle(dark);
    g.fillRect(0, 0, size, size);

    // Main face
    g.fillStyle(base);
    g.fillRect(1, 1, size - 2, size - 2);

    // Top highlight
    g.fillStyle(light);
    g.fillRect(1, 1, size - 2, 4);

    // Bottom shadow
    g.fillStyle(dark);
    g.fillRect(1, size - 5, size - 2, 4);

    // Subtle pixel grid
    g.lineStyle(1, 0x000000, 0.15);
    for (let i = 0; i <= size; i += 8) {
      g.lineBetween(i, 0, i, size);
      g.lineBetween(0, i, size, i);
    }

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /**
   * Creates the collectible coin texture.
   * Yellow/gold square with a shining effect.
   */
  createCoinTexture() {
    const size = 24;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Outer glow
    g.fillStyle(0xffdd44);
    g.fillRect(0, 0, size, size);

    // Inner brighter
    g.fillStyle(0xffee66);
    g.fillRect(2, 2, size - 4, size - 4);

    // Center star/dot
    g.fillStyle(0xffcc00);
    g.fillRect(4, 4, size - 8, size - 8);

    // Shine highlight
    g.fillStyle(0xffffaa);
    g.fillRect(4, 4, 6, 6);

    // Dollar sign or star symbol
    g.fillStyle(0xff9900);
    g.fillRect(9, 6, 6, 12);
    g.fillRect(7, 9, 10, 6);
    g.fillRect(11, 5, 2, 14);

    g.generateTexture('coin', size, size);
    g.destroy();
  }

  /**
   * Creates the spike hazard texture.
   * Red triangle pointing upward.
   */
  createSpikeTexture() {
    const size = 32;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Shadow
    g.fillStyle(0x880000);
    g.fillTriangle(4, size, size / 2, 2, size - 4, size);

    // Main spike
    g.fillStyle(0xff3333);
    g.fillTriangle(6, size - 2, size / 2, 4, size - 6, size - 2);

    // Highlight
    g.fillStyle(0xff6666);
    g.fillTriangle(size / 2 - 4, size - 4, size / 2, 8, size / 2 + 4, size - 4);

    g.generateTexture('spike', size, size);
    g.destroy();
  }

  /**
   * Creates background layer textures for parallax scrolling.
   */
  createBackgroundTextures() {
    // Sky gradient (far background)
    this._makeBackground('bg_sky', [
      { color: 0x1a1a4e, y: 0, h: 300 },
      { color: 0x2a2a6e, y: 300, h: 200 },
      { color: 0x3a3a8e, y: 500, h: 100 },
    ]);

    // Hills (mid background)
    this._makeBackground('bg_hills', [
      { color: 0x2d5a27, y: 0, h: 400 },
      { color: 0x3a7a33, y: 400, h: 100 },
      { color: 0x4a8a43, y: 500, h: 100 },
    ]);

    // Underground background
    this._makeBackground('bg_cave', [
      { color: 0x1a1a1a, y: 0, h: 250 },
      { color: 0x2a2a2a, y: 250, h: 200 },
      { color: 0x3a3a3a, y: 450, h: 150 },
    ]);

    // Lava background
    this._makeBackground('bg_lava', [
      { color: 0x2a1000, y: 0, h: 200 },
      { color: 0x3a1500, y: 200, h: 200 },
      { color: 0x4a2000, y: 400, h: 200 },
    ]);

    // Mountains (far)
    const mg = this.make.graphics({ x: 0, y: 0, add: false });
    mg.fillStyle(0x1a3a1a);
    mg.beginPath();
    mg.moveTo(0, 600);
    for (let x = 0; x <= 800; x += 20) {
      const peak = 300 + Math.sin(x * 0.008) * 100 + Math.sin(x * 0.02) * 50;
      mg.lineTo(x, peak);
    }
    mg.lineTo(800, 600);
    mg.closePath();
    mg.fill();
    mg.generateTexture('bg_mountains', 800, 600);
    mg.destroy();
  }

  /**
   * Helper to generate a layered background texture.
   */
  _makeBackground(key, layers) {
    const { width } = this.sys.game.config;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    for (const layer of layers) {
      g.fillStyle(layer.color);
      g.fillRect(0, layer.y, width, layer.h);
    }

    // Add some pixel clouds/stars
    g.fillStyle(0xffffff);
    g.fillRect(50, 30, 20, 8);
    g.fillRect(60, 25, 16, 12);
    g.fillRect(200, 60, 30, 8);
    g.fillRect(600, 40, 24, 8);

    g.generateTexture(key, width, 600);
    g.destroy();
  }

  /**
   * Creates a simple particle texture.
   */
  createParticleTexture() {
    const size = 8;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff);
    g.fillRect(1, 1, size - 2, size - 2);
    g.fillStyle(0xffffaa);
    g.fillRect(2, 2, size - 4, size - 4);
    g.generateTexture('particle', size, size);
    g.destroy();
  }
}
