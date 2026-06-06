/**
 * GameScene — Core gameplay engine.
 * Handles player physics, platforms, coins, spikes, levels,
 * scoring, game over, level transitions, and touch controls.
 */
import { GAME_CFG } from '../game.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    /** @type {number} Current level index (0-based) */
    this.currentLevel = data.level ?? 0;
    /** @type {number} Player score */
    this.score = data.score ?? 0;
    /** @type {number} Lives remaining */
    this.lives = data.lives ?? 3;
    /** @type {boolean} Whether the game is currently playing */
    this.isPlaying = true;
    /** @type {boolean} Whether the player is invulnerable (post-hit) */
    this.isInvulnerable = false;
  }

  create() {
    const { width, height } = this.sys.game.config;
    this.cameras.main.fadeIn(300);

    // --- Background (parallax layers) ---
    this.createBackground();

    // --- Coin group ---
    this.coins = this.physics.add.group();

    // --- Spike group ---
    this.spikes = this.physics.add.group();

    // --- Platforms ---
    this.platforms = this.physics.add.staticGroup();

    // --- Player ---
    this.player = this.physics.add.sprite(100, 300, 'player');
    this.player.setScale(1.5);
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.1);
    this.player.body.setSize(24, 28);
    this.player.body.setOffset(4, 6);

    // --- Build the level ---
    this.buildLevel(this.currentLevel);

    // --- Physics collisions ---
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
    this.physics.add.overlap(this.player, this.spikes, this.hitSpike, null, this);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, this.levelWidth, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // --- Keyboard input ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // --- Touch controls ---
    this.setupTouchControls();

    // --- UI (fixed to camera) ---
    this.createUI();

    // --- Particles emitter for coin collection ---
    this.coinParticles = this.add.particles(0, 0, 'particle', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      lifespan: 600,
      alpha: { start: 1, end: 0 },
      scale: { start: 1.5, end: 0 },
      emitting: false,
    });
  }

  // ============================================================
  //  BACKGROUND
  // ============================================================

  createBackground() {
    const { width, height } = this.sys.game.config;

    // Choose backgrounds based on level
    const bgKey = this.currentLevel === 0 ? 'bg_sky' :
                  this.currentLevel === 1 ? 'bg_cave' : 'bg_lava';
    const hillKey = this.currentLevel === 0 ? 'bg_hills' :
                    this.currentLevel === 1 ? 'bg_mountains' : 'bg_lava';

    // Far parallax (moves slowest)
    this.bgFar = this.add.image(width / 2, height / 2, bgKey)
      .setDisplaySize(800, 600)
      .setScrollFactor(0.1)
      .setDepth(-10);

    // Mid parallax
    if (this.currentLevel === 0) {
      this.bgMid = this.add.image(width / 2, height - 50, hillKey)
        .setDisplaySize(800, 300)
        .setScrollFactor(0.3)
        .setAlpha(0.5)
        .setDepth(-5);
    }

    // Near parallax (mountains)
    this.bgNear = this.add.image(width / 2, height, 'bg_mountains')
      .setDisplaySize(800, height)
      .setScrollFactor(0.5)
      .setAlpha(0.3)
      .setDepth(-3);
  }

  // ============================================================
  //  LEVEL BUILDER
  // ============================================================

  /**
   * Build platforms, coins, and spikes for a given level.
   * @param {number} levelIndex
   */
  buildLevel(levelIndex) {
    const tile = GAME_CFG.levels[levelIndex].tileSize;
    const levels = this.getLevelLayouts();

    if (levelIndex >= levels.length) {
      // Fallback: reuse last level
      levelIndex = levels.length - 1;
    }

    const layout = levels[levelIndex];
    this.levelWidth = layout.width;

    // Set world bounds
    const { height } = this.sys.game.config;
    this.physics.world.setBounds(0, 0, this.levelWidth, height);

    // Choose platform texture based on level
    const platKey = levelIndex === 0 ? 'platform' :
                    levelIndex === 1 ? 'platform_stone' : 'platform_lava';

    // Build from layout data
    for (const { type, x, y, w, h } of layout.tiles) {
      if (type === 'platform') {
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const plat = this.platforms.create(x + col * tile + tile / 2, y + row * tile + tile / 2, platKey);
            plat.setDisplaySize(tile, tile);
            plat.refreshBody();
          }
        }
      } else if (type === 'coin') {
        const coin = this.coins.create(x + tile / 2, y + tile / 2, 'coin');
        coin.setDisplaySize(tile * 0.5, tile * 0.5);
        coin.body.setAllowGravity(false);

        // Spinning animation
        this.tweens.add({
          targets: coin,
          angle: 360,
          duration: 1500,
          repeat: -1,
        });

        // Floating animation
        this.tweens.add({
          targets: coin,
          y: y + tile / 2 - 5,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (type === 'spike') {
        const spike = this.spikes.create(x + tile / 2, y + tile / 2, 'spike');
        spike.setDisplaySize(tile * 0.6, tile * 0.6);
        spike.body.setAllowGravity(false);
      }
    }

    // Set player start position
    if (layout.playerStart) {
      this.player.setPosition(layout.playerStart.x, layout.playerStart.y);
    }

    // Set level end / goal
    if (layout.endZone) {
      this.endZone = this.add.rectangle(layout.endZone.x, layout.endZone.y, 40, tile * 2, 0x44ff44, 0.2)
        .setStrokeStyle(2, 0x44ff44);
      this.endZoneLabel = this.add.text(layout.endZone.x, layout.endZone.y - 40, 'EXIT →', {
        fontSize: '14px',
        color: '#44ff44',
        fontFamily: 'Courier New',
      }).setOrigin(0.5);

      // Blinking
      this.tweens.add({
        targets: [this.endZone, this.endZoneLabel],
        alpha: { from: 1, to: 0.3 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /**
   * Returns all level layouts as data objects.
   * 3 levels of increasing difficulty.
   * @returns {Array<{width: number, playerStart: {x:number,y:number}, endZone: {x:number,y:number}, tiles: Array}>}
   */
  getLevelLayouts() {
    const T = 64; // tile size reference

    return [
      // ---- LEVEL 1: Green Hills (Easy) ----
      {
        width: 2400,
        playerStart: { x: 100, y: 500 },
        endZone: { x: 2300, y: 400 },
        tiles: [
          // Ground
          { type: 'platform', x: 0, y: 536, w: 10, h: 1 },
          { type: 'platform', x: 700, y: 536, w: 8, h: 1 },
          { type: 'platform', x: 1500, y: 536, w: 12, h: 1 },
          // Platforms
          { type: 'platform', x: 400, y: 400, w: 3, h: 1 },
          { type: 'platform', x: 600, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 900, y: 400, w: 3, h: 1 },
          { type: 'platform', x: 1100, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 1300, y: 380, w: 2, h: 1 },
          { type: 'platform', x: 1700, y: 400, w: 3, h: 1 },
          { type: 'platform', x: 1900, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 2100, y: 350, w: 2, h: 1 },
          // Coins
          { type: 'coin', x: 450, y: 360 },
          { type: 'coin', x: 510, y: 360 },
          { type: 'coin', x: 650, y: 260 },
          { type: 'coin', x: 950, y: 360 },
          { type: 'coin', x: 1150, y: 260 },
          { type: 'coin', x: 1350, y: 340 },
          { type: 'coin', x: 1750, y: 360 },
          { type: 'coin', x: 1950, y: 260 },
          // Spikes (few)
          { type: 'spike', x: 650, y: 504 },
        ],
      },

      // ---- LEVEL 2: Underground Cavern (Medium) ----
      {
        width: 3600,
        playerStart: { x: 100, y: 500 },
        endZone: { x: 3500, y: 400 },
        tiles: [
          // Ground sections with gaps
          { type: 'platform', x: 0, y: 536, w: 8, h: 1 },
          { type: 'platform', x: 700, y: 536, w: 5, h: 1 },
          { type: 'platform', x: 1100, y: 536, w: 4, h: 1 },
          { type: 'platform', x: 1500, y: 536, w: 6, h: 1 },
          { type: 'platform', x: 2000, y: 536, w: 5, h: 1 },
          { type: 'platform', x: 2400, y: 536, w: 4, h: 1 },
          { type: 'platform', x: 2800, y: 536, w: 8, h: 1 },
          // Upper platforms
          { type: 'platform', x: 300, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 500, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 800, y: 380, w: 3, h: 1 },
          { type: 'platform', x: 1000, y: 250, w: 2, h: 1 },
          { type: 'platform', x: 1200, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 1400, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 1700, y: 400, w: 3, h: 1 },
          { type: 'platform', x: 1900, y: 280, w: 2, h: 1 },
          { type: 'platform', x: 2100, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 2300, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 2600, y: 380, w: 3, h: 1 },
          { type: 'platform', x: 2900, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 3100, y: 300, w: 3, h: 1 },
          { type: 'platform', x: 3300, y: 380, w: 2, h: 1 },
          // Coins
          { type: 'coin', x: 350, y: 360 },
          { type: 'coin', x: 550, y: 260 },
          { type: 'coin', x: 850, y: 340 },
          { type: 'coin', x: 1050, y: 210 },
          { type: 'coin', x: 1250, y: 360 },
          { type: 'coin', x: 1450, y: 260 },
          { type: 'coin', x: 1750, y: 360 },
          { type: 'coin', x: 1950, y: 240 },
          { type: 'coin', x: 2150, y: 360 },
          { type: 'coin', x: 2350, y: 260 },
          { type: 'coin', x: 2650, y: 340 },
          { type: 'coin', x: 2950, y: 360 },
          { type: 'coin', x: 3150, y: 260 },
          { type: 'coin', x: 3350, y: 340 },
          // Spikes (more)
          { type: 'spike', x: 400, y: 504 },
          { type: 'spike', x: 900, y: 504 },
          { type: 'spike', x: 1600, y: 504 },
          { type: 'spike', x: 2500, y: 504 },
          { type: 'spike', x: 800, y: 348 },
          { type: 'spike', x: 1700, y: 368 },
        ],
      },

      // ---- LEVEL 3: Lava Fortress (Hard) ----
      {
        width: 4800,
        playerStart: { x: 100, y: 500 },
        endZone: { x: 4700, y: 400 },
        tiles: [
          // Small ground platforms (lots of gaps!)
          { type: 'platform', x: 0, y: 536, w: 4, h: 1 },
          { type: 'platform', x: 400, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 700, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 1000, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 1300, y: 536, w: 2, h: 1 },
          { type: 'platform', x: 1500, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 1800, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 2100, y: 536, w: 2, h: 1 },
          { type: 'platform', x: 2300, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 2600, y: 536, w: 2, h: 1 },
          { type: 'platform', x: 2800, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 3100, y: 536, w: 2, h: 1 },
          { type: 'platform', x: 3300, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 3600, y: 536, w: 2, h: 1 },
          { type: 'platform', x: 3800, y: 536, w: 3, h: 1 },
          { type: 'platform', x: 4100, y: 536, w: 2, h: 1 },
          { type: 'platform', x: 4300, y: 536, w: 4, h: 1 },
          // Complex vertical platforms
          { type: 'platform', x: 200, y: 420, w: 2, h: 1 },
          { type: 'platform', x: 350, y: 320, w: 2, h: 1 },
          { type: 'platform', x: 500, y: 250, w: 2, h: 1 },
          { type: 'platform', x: 750, y: 380, w: 2, h: 1 },
          { type: 'platform', x: 900, y: 280, w: 2, h: 1 },
          { type: 'platform', x: 1100, y: 380, w: 2, h: 1 },
          { type: 'platform', x: 1250, y: 280, w: 2, h: 1 },
          { type: 'platform', x: 1400, y: 200, w: 2, h: 1 },
          { type: 'platform', x: 1600, y: 380, w: 2, h: 1 },
          { type: 'platform', x: 1750, y: 280, w: 2, h: 1 },
          { type: 'platform', x: 1900, y: 200, w: 2, h: 1 },
          { type: 'platform', x: 2100, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 2250, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 2400, y: 220, w: 2, h: 1 },
          { type: 'platform', x: 2600, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 2750, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 2900, y: 220, w: 2, h: 1 },
          { type: 'platform', x: 3100, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 3250, y: 300, w: 2, h: 1 },
          { type: 'platform', x: 3400, y: 380, w: 2, h: 1 },
          { type: 'platform', x: 3550, y: 280, w: 2, h: 1 },
          { type: 'platform', x: 3700, y: 200, w: 2, h: 1 },
          { type: 'platform', x: 3900, y: 380, w: 2, h: 1 },
          { type: 'platform', x: 4050, y: 280, w: 2, h: 1 },
          { type: 'platform', x: 4200, y: 380, w: 2, h: 1 },
          { type: 'platform', x: 4400, y: 400, w: 2, h: 1 },
          { type: 'platform', x: 4550, y: 300, w: 2, h: 1 },
          // Coins (plenty)
          { type: 'coin', x: 250, y: 380 },
          { type: 'coin', x: 400, y: 280 },
          { type: 'coin', x: 550, y: 210 },
          { type: 'coin', x: 800, y: 340 },
          { type: 'coin', x: 950, y: 240 },
          { type: 'coin', x: 1150, y: 340 },
          { type: 'coin', x: 1300, y: 240 },
          { type: 'coin', x: 1450, y: 160 },
          { type: 'coin', x: 1650, y: 340 },
          { type: 'coin', x: 1800, y: 240 },
          { type: 'coin', x: 1950, y: 160 },
          { type: 'coin', x: 2150, y: 360 },
          { type: 'coin', x: 2300, y: 260 },
          { type: 'coin', x: 2450, y: 180 },
          { type: 'coin', x: 2650, y: 360 },
          { type: 'coin', x: 2800, y: 260 },
          { type: 'coin', x: 2950, y: 180 },
          { type: 'coin', x: 3150, y: 360 },
          { type: 'coin', x: 3300, y: 260 },
          { type: 'coin', x: 3450, y: 340 },
          { type: 'coin', x: 3600, y: 240 },
          { type: 'coin', x: 3750, y: 160 },
          { type: 'coin', x: 3950, y: 340 },
          { type: 'coin', x: 4100, y: 240 },
          { type: 'coin', x: 4450, y: 360 },
          { type: 'coin', x: 4600, y: 260 },
          // Spikes (many — on platforms too!)
          { type: 'spike', x: 200, y: 504 },
          { type: 'spike', x: 500, y: 504 },
          { type: 'spike', x: 800, y: 504 },
          { type: 'spike', x: 1400, y: 504 },
          { type: 'spike', x: 1900, y: 504 },
          { type: 'spike', x: 2400, y: 504 },
          { type: 'spike', x: 2900, y: 504 },
          { type: 'spike', x: 3400, y: 504 },
          { type: 'spike', x: 3900, y: 504 },
          { type: 'spike', x: 4400, y: 504 },
          { type: 'spike', x: 400, y: 388 },
          { type: 'spike', x: 750, y: 348 },
          { type: 'spike', x: 1000, y: 248 },
          { type: 'spike', x: 1500, y: 168 },
          { type: 'spike', x: 1800, y: 168 },
          { type: 'spike', x: 2200, y: 368 },
          { type: 'spike', x: 2600, y: 368 },
          { type: 'spike', x: 3100, y: 368 },
          { type: 'spike', x: 3550, y: 248 },
          { type: 'spike', x: 4050, y: 248 },
        ],
      },
    ];
  }

  // ============================================================
  //  TOUCH CONTROLS
  // ============================================================

  setupTouchControls() {
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;

    const controls = document.getElementById('touch-controls');
    if (!controls) return;

    // Show touch controls on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      controls.classList.add('active');
    }

    const leftBtn = document.getElementById('touch-left');
    const rightBtn = document.getElementById('touch-right');
    const jumpBtn = document.getElementById('touch-jump');

    if (leftBtn) {
      leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchLeft = true; leftBtn.classList.add('pressed'); });
      leftBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.touchLeft = false; leftBtn.classList.remove('pressed'); });
      leftBtn.addEventListener('touchcancel', (e) => { this.touchLeft = false; leftBtn.classList.remove('pressed'); });
    }
    if (rightBtn) {
      rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchRight = true; rightBtn.classList.add('pressed'); });
      rightBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.touchRight = false; rightBtn.classList.remove('pressed'); });
      rightBtn.addEventListener('touchcancel', (e) => { this.touchRight = false; rightBtn.classList.remove('pressed'); });
    }
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchJump = true; jumpBtn.classList.add('pressed'); });
      jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.touchJump = false; jumpBtn.classList.remove('pressed'); });
      jumpBtn.addEventListener('touchcancel', (e) => { this.touchJump = false; jumpBtn.classList.remove('pressed'); });
    }
  }

  // ============================================================
  //  UI
  // ============================================================

  createUI() {
    const { width } = this.sys.game.config;
    const levelName = GAME_CFG.levels[this.currentLevel]?.name ?? 'Unknown';

    // UI container — fixed to camera
    this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

    // Top bar background
    const topBar = this.add.rectangle(width / 2, 0, width, 36, 0x000000, 0.5)
      .setOrigin(0.5, 0);
    this.uiContainer.add(topBar);

    // Level name
    this.levelText = this.add.text(12, 8, `Level ${this.currentLevel + 1}: ${levelName}`, {
      fontSize: '14px',
      color: '#aaaacc',
      fontFamily: 'Courier New',
    });
    this.uiContainer.add(this.levelText);

    // Score
    this.scoreText = this.add.text(width / 2, 8, `Score: ${this.score}`, {
      fontSize: '14px',
      color: '#ffee44',
      fontFamily: 'Courier New',
    }).setOrigin(0.5, 0);
    this.uiContainer.add(this.scoreText);

    // Lives
    this.livesText = this.add.text(width - 12, 8, `♥ ${this.lives}`, {
      fontSize: '14px',
      color: '#ff6666',
      fontFamily: 'Courier New',
    }).setOrigin(1, 0);
    this.uiContainer.add(this.livesText);

    // Coin count
    const totalCoins = this.coins.getLength();
    this.coinCountText = this.add.text(12, 26, `Coins: 0 / ${totalCoins}`, {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'Courier New',
    });
    this.uiContainer.add(this.coinCountText);
  }

  updateUI() {
    this.scoreText.setText(`Score: ${this.score}`);
    this.livesText.setText(`♥ ${this.lives}`);

    const collected = this.totalCoins - this.coins.countActive();
    this.coinCountText.setText(`Coins: ${collected} / ${this.totalCoins}`);
  }

  // ============================================================
  //  UPDATE LOOP
  // ============================================================

  update() {
    if (!this.isPlaying) return;

    // --- Player Movement ---
    const speed = GAME_CFG.playerSpeed;
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;

    // Horizontal movement (keyboard)
    if (this.cursors.left.isDown || this.touchLeft) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown || this.touchRight) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Jump (keyboard)
    if ((this.cursors.up.isDown || this.spaceKey.isDown) && onGround && !this._jumpLocked) {
      this.player.setVelocityY(GAME_CFG.jumpVelocity);
      this._jumpLocked = true;
    } else if (!this.cursors.up.isDown && !this.spaceKey.isDown) {
      this._jumpLocked = false;
    }

    // Touch jump
    if (this.touchJump && onGround && !this._touchJumpLocked) {
      this.player.setVelocityY(GAME_CFG.jumpVelocity);
      this._touchJumpLocked = true;
    } else if (!this.touchJump) {
      this._touchJumpLocked = false;
    }

    // --- Check if fallen off the world ---
    const { height } = this.sys.game.config;
    if (this.player.y > height + 50) {
      this.playerDie();
    }

    // --- Check level completion ---
    if (this.endZone && Phaser.Geom.Rectangle.Overlaps(
      this.player.getBounds(),
      this.endZone.getBounds()
    )) {
      this.levelComplete();
    }
  }

  // ============================================================
  //  COLLECTIBLES & HAZARDS
  // ============================================================

  /**
   * Called when the player overlaps a coin.
   * @param {Phaser.Physics.Arcade.Sprite} _player
   * @param {Phaser.Physics.Arcade.Sprite} coin
   */
  collectCoin(_player, coin) {
    if (!coin.active) return;

    coin.disableBody(true, true);
    this.score += GAME_CFG.coinScore;

    // Coin particles at coin position
    this.coinParticles.emitParticleAt(coin.x, coin.y, 8);

    // Score popup
    const popup = this.add.text(coin.x, coin.y - 20, `+${GAME_CFG.coinScore}`, {
      fontSize: '16px',
      color: '#ffee44',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      duration: 600,
      onComplete: () => popup.destroy(),
    });

    this.updateUI();

    // Sound effect via oscillator
    this.playBeep(600, 0.1);
  }

  /**
   * Called when the player touches a spike.
   * @param {Phaser.Physics.Arcade.Sprite} _player
   * @param {Phaser.Physics.Arcade.Sprite} _spike
   */
  hitSpike(_player, _spike) {
    if (this.isInvulnerable) return;
    this.playerDie();
  }

  // ============================================================
  //  DEATH & GAME OVER
  // ============================================================

  /**
   * Handle player death (respawn or game over).
   */
  playerDie() {
    if (!this.isPlaying) return;
    this.lives--;
    this.updateUI();

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    // Play death sound
    this.playBeep(200, 0.3);

    // Flash red
    this.cameras.main.flash(300, 255, 0, 0);

    // Respawn at start of level
    const layout = this.getLevelLayouts()[this.currentLevel];
    this.player.setPosition(layout.playerStart.x, layout.playerStart.y);
    this.player.setVelocity(0, 0);

    // Brief invulnerability
    this.isInvulnerable = true;
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.isInvulnerable = false;
        this.player.setAlpha(1);
      },
    });
  }

  /**
   * Show game over screen.
   */
  gameOver() {
    this.isPlaying = false;
    this.player.setVelocity(0, 0);
    this.player.setTint(0xff0000);

    const { width, height } = this.sys.game.config;

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setScrollFactor(0)
      .setDepth(200);

    const goText = this.add.text(width / 2, height / 2 - 60, 'GAME OVER', {
      fontSize: '48px',
      color: '#ff4444',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const scoreText = this.add.text(width / 2, height / 2, `Final Score: ${this.score}`, {
      fontSize: '24px',
      color: '#ffee44',
      fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Restart button
    const restartBtn = this.add.rectangle(width / 2, height / 2 + 70, 200, 50, 0x44cc44, 0.9)
      .setStrokeStyle(2, 0x66ff66)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(201);

    const restartText = this.add.text(width / 2, height / 2 + 70, '↻  RETRY', {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

    restartBtn.on('pointerover', () => restartBtn.setFillStyle(0x55ee55, 1));
    restartBtn.on('pointerout', () => restartBtn.setFillStyle(0x44cc44, 0.9));
    restartBtn.on('pointerdown', () => {
      this.scene.restart({ level: this.currentLevel, score: 0, lives: 3 });
    });

    // Menu button
    const menuBtn = this.add.rectangle(width / 2, height / 2 + 130, 200, 40, 0x444488, 0.9)
      .setStrokeStyle(2, 0x6666cc)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(201);

    const menuText = this.add.text(width / 2, height / 2 + 130, '⌂  MENU', {
      fontSize: '18px',
      color: '#aaaaff',
      fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

    menuBtn.on('pointerover', () => menuBtn.setFillStyle(0x5555aa, 1));
    menuBtn.on('pointerout', () => menuBtn.setFillStyle(0x444488, 0.9));
    menuBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    // Keyboard retry
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.restart({ level: this.currentLevel, score: 0, lives: 3 });
    });
    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.restart({ level: this.currentLevel, score: 0, lives: 3 });
    });
  }

  // ============================================================
  //  LEVEL COMPLETE
  // ============================================================

  /**
   * Advance to the next level or show win screen.
   */
  levelComplete() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.player.setVelocity(0, 0);

    // Freeze enemies/collectibles
    this.coins.getChildren().forEach(c => c.body.setVelocity(0, 0));

    // Play win sound
    this.playBeep(800, 0.1);
    setTimeout(() => this.playBeep(1000, 0.1), 150);
    setTimeout(() => this.playBeep(1200, 0.15), 300);

    const { width, height } = this.sys.game.config;
    const nextLevel = this.currentLevel + 1;
    const isLastLevel = nextLevel >= GAME_CFG.levels.length;

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setScrollFactor(0)
      .setDepth(200);

    const title = isLastLevel ? 'YOU WIN!' : `Level ${this.currentLevel + 1} Complete!`;
    const titleColor = isLastLevel ? '#44ff44' : '#44aaff';

    this.add.text(width / 2, height / 2 - 70, title, {
      fontSize: '40px',
      color: titleColor,
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(width / 2, height / 2 - 20, `Score: ${this.score}`, {
      fontSize: '22px',
      color: '#ffee44',
      fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(width / 2, height / 2 + 10, `Lives: ${this.lives}`, {
      fontSize: '16px',
      color: '#ff8888',
      fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    if (!isLastLevel) {
      const nextBtn = this.add.rectangle(width / 2, height / 2 + 70, 200, 50, 0x4488cc, 0.9)
        .setStrokeStyle(2, 0x66aaff)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(201);

      const nextText = this.add.text(width / 2, height / 2 + 70, `Next Level →`, {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'Courier New',
        fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

      nextBtn.on('pointerover', () => nextBtn.setFillStyle(0x55aadd, 1));
      nextBtn.on('pointerout', () => nextBtn.setFillStyle(0x4488cc, 0.9));
      nextBtn.on('pointerdown', () => {
        this.scene.restart({
          level: nextLevel,
          score: this.score,
          lives: this.lives,
        });
      });
    } else {
      // Win screen — play again or menu
      const againBtn = this.add.rectangle(width / 2, height / 2 + 70, 200, 50, 0x44cc44, 0.9)
        .setStrokeStyle(2, 0x66ff66)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(201);

      const againText = this.add.text(width / 2, height / 2 + 70, '★ PLAY AGAIN', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Courier New',
        fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

      againBtn.on('pointerover', () => againBtn.setFillStyle(0x55ee55, 1));
      againBtn.on('pointerout', () => againBtn.setFillStyle(0x44cc44, 0.9));
      againBtn.on('pointerdown', () => {
        this.scene.start('MenuScene');
      });

      // Victory particles
      for (let i = 0; i < 5; i++) {
        const px = Phaser.Math.Between(100, width - 100);
        const py = Phaser.Math.Between(100, height - 100);
        this.add.particles(px, py, 'particle', {
          speed: { min: 40, max: 120 },
          angle: { min: 0, max: 360 },
          lifespan: 2000,
          alpha: { start: 0.8, end: 0 },
          scale: { start: 2, end: 0.3 },
          quantity: 2,
          frequency: 100,
        });
      }
    }
  }

  // ============================================================
  //  AUDIO HELPERS
  // ============================================================

  /**
   * Play a simple beep sound using Web Audio API.
   * @param {number} freq - Frequency in Hz
   * @param {number} duration - Duration in seconds
   */
  playBeep(freq, duration) {
    try {
      const ctx = this._audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      this._audioCtx = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio not supported, silently ignore
    }
  }
}
