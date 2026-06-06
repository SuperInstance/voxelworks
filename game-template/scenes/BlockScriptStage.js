/**
 * BlockScriptStage — Phaser scene executed when a block manifest is loaded.
 *
 * Replaces the normal platformer game with a Scratch-like stage.
 * Creates a single controllable sprite and executes compiled block timelines.
 * Supports both block-driven movement AND keyboard-controlled fallback.
 *
 * LGSP Fitness Flush: At game end, writes fitness data to localStorage.
 */
import { BlockScriptRuntime } from './BlockScriptRuntime.js';

export class BlockScriptStage extends Phaser.Scene {
  constructor() {
    super({ key: 'BlockScriptStage' });
  }

  init(data) {
    this.score = data.score || 0;
    this.lives = data.lives || 3;
    this.isPlaying = true;
    this.isInvulnerable = false;
    this.blockRuntime = null;
    this.backgroundGfx = null;
    this.executionStarted = false;
  }

  create() {
    const { width, height } = this.sys.game.config;
    this.cameras.main.fadeIn(300);

    // ── Load manifest ──
    this.manifest = window.__VOXELWORKS_BLOCKANIFEST_ACTIVE || window.__VOXELWORKS_BLOCK_MANIFEST || null;

    if (!this.manifest || !this.manifest.scripts || this.manifest.scripts.length === 0) {
      this.showNoScriptUI();
      return;
    }

    // ── Background (checkered stage) ──
    this.createBlockStageBackground(width, height);

    // ── Sprite ──
    this.player = this.physics.add.sprite(240, 160, 'player');
    this.player.setScale(2);
    this.player.setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false); // Block script mode = no gravity
    this.physics.world.setBounds(10, 10, width - 20, height - 20);

    // ── Keyboard input (for fallback movement) ──
    this.cursors = this.input.keyboard.createCursorKeys();

    // ── Block Runtime ──
    this.blockRuntime = new BlockScriptRuntime(this, this.manifest);

    // ── UI ──
    this.createBlockUI(width, height);

    // ── Stage click → trigger click scripts ──
    this.input.on('pointerdown', () => {
      if (this.blockRuntime && !this.blockRuntime.isRunning) {
        this.blockRuntime.executeClickScripts();
      }
    });

    // ── "R" key to restart scripts ──
    this.input.keyboard.on('keydown-R', () => {
      if (this.blockRuntime) {
        this.blockRuntime.abort();
        this.time.delayedCall(200, () => {
          this.blockRuntime.executeStartScripts();
        });
      }
    });

    // ── "Space" to re-execute ──
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.blockRuntime && !this.blockRuntime.isRunning) {
        this.blockRuntime.executeStartScripts();
      }
    });

    // ── Execute on_start scripts ──
    this.time.delayedCall(500, () => {
      if (this.blockRuntime) {
        console.log('[BlockScriptStage] Executing start scripts...');
        this.blockRuntime.executeStartScripts();

        // Show a prompt hint after a short delay
        const hintText = this.add.text(width / 2, height - 40, 'Press SPACE to re-run  •  R to restart  •  Click stage for click blocks', {
          fontSize: '11px',
          color: '#666688',
          fontFamily: 'Courier New',
        }).setOrigin(0.5).setDepth(50).setAlpha(0.7);
        this.time.delayedCall(5000, () => {
          this.tweens.add({ targets: hintText, alpha: 0, duration: 1000 });
        });
      }
    });

    console.log('[BlockScriptStage] Created with', this.manifest.scriptCount, 'scripts');
  }

  // =============================================================
  //  BACKGROUND
  // =============================================================

  createBlockStageBackground(width, height) {
    // Checkerboard floor
    const g = this.add.graphics();
    g.setDepth(-10);

    const tileSize = 40;
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isDark = (r + c) % 2 === 0;
        g.fillStyle(isDark ? 0x1a1a3e : 0x222250, 1);
        g.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      }
    }

    // Subtle grid border
    g.lineStyle(1, 0x444488, 0.15);
    for (let x = 0; x <= width; x += tileSize) {
      g.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += tileSize) {
      g.lineBetween(0, y, width, y);
    }

    this.backgroundGfx = g;
  }

  // =============================================================
  //  UI
  // =============================================================

  createBlockUI(width, height) {
    this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

    // Top bar
    const topBar = this.add.rectangle(width / 2, 0, width, 36, 0x000000, 0.5)
      .setOrigin(0.5, 0);
    this.uiContainer.add(topBar);

    // Manifest name
    const name = this.manifest?.displayName || 'Block Script';
    this.add.text(12, 8, '🧊 ' + name, {
      fontSize: '14px', color: '#44ff44', fontFamily: 'Courier New',
    }).setOrigin(0, 0).setDepth(101);

    // Script count
    const scriptCount = this.manifest?.scriptCount || 0;
    this.add.text(width - 12, 8, scriptCount + ' script(s)', {
      fontSize: '12px', color: '#8888aa', fontFamily: 'Courier New',
    }).setOrigin(1, 0).setDepth(101);

    // Score display (for fitness)
    this.scoreText = this.add.text(width / 2, 8, 'Score: ' + this.score, {
      fontSize: '14px', color: '#ffee44', fontFamily: 'Courier New',
    }).setOrigin(0.5, 0).setDepth(101);
    this.uiContainer.add(this.scoreText);

    // Lives
    this.livesText = this.add.text(width - 12, 26, '♥ ' + this.lives, {
      fontSize: '12px', color: '#ff6666', fontFamily: 'Courier New',
    }).setOrigin(1, 0).setDepth(101);
    this.uiContainer.add(this.livesText);

    // Mode indicator
    this.add.text(12, 26, 'Block Mode  •  Play with keyboard + click', {
      fontSize: '10px', color: '#666688', fontFamily: 'Courier New',
    }).setOrigin(0, 0).setDepth(101);

    // Back button
    const backBtn = this.add.text(width - 12, height - 12, '← Back to Studio', {
      fontSize: '13px', color: '#8888aa', fontFamily: 'Courier New',
    }).setOrigin(1, 1).setDepth(101).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#aaaaff'));
    backBtn.on('pointerout', () => backBtn.setColor('#8888aa'));
    backBtn.on('pointerdown', () => {
      // Go back to block editor (relative path from game-template/../block-editor/)
      window.location.href = '../block-editor/index.html';
    });
  }

  // =============================================================
  //  NO SCRIPT UI (fallback)
  // =============================================================

  showNoScriptUI() {
    const { width, height } = this.sys.game.config;

    this.add.text(width / 2, height / 2 - 40, 'No Block Script Found', {
      fontSize: '28px', color: '#ff6644', fontFamily: 'Courier New',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    this.add.text(width / 2, height / 2 + 10, 'Build a script in Block Studio, click "Ship to Game",\nthen open this page with ?mode=blocks', {
      fontSize: '14px', color: '#aaaacc', fontFamily: 'Courier New',
      align: 'center',
    }).setOrigin(0.5).setDepth(100);

    const goBtn = this.add.rectangle(width / 2, height / 2 + 80, 200, 40, 0x4488cc)
      .setInteractive({ useHandCursor: true }).setDepth(101);

    this.add.text(width / 2, height / 2 + 80, 'Open Block Studio', {
      fontSize: '16px', color: '#fff', fontFamily: 'Courier New',
    }).setOrigin(0.5).setDepth(102);

    goBtn.on('pointerdown', () => {
      window.location.href = '../block-editor/index.html';
    });
  }

  // =============================================================
  //  UPDATE
  // =============================================================

  update() {
    if (!this.isPlaying) return;

    // Update speech bubble position to follow player
    if (this.blockRuntime) {
      this.blockRuntime.updateSpeechFollow();
    }

    // Allow arrow keys to move sprite as fallback
    if (this.player && this.player.body) {
      this.player.setVelocity(0, 0);

      if (this.cursors.left.isDown) {
        this.player.setVelocityX(-200);
        this.player.setFlipX(true);
      } else if (this.cursors.right.isDown) {
        this.player.setVelocityX(200);
        this.player.setFlipX(false);
      }

      if (this.cursors.up.isDown) {
        this.player.setVelocityY(-200);
      } else if (this.cursors.down.isDown) {
        this.player.setVelocityY(200);
      }
    }
  }

  // =============================================================
  //  SCORE & LIVES
  // =============================================================

  addScore(points) {
    this.score += points;
    if (this.scoreText) {
      this.scoreText.setText('Score: ' + this.score);
    }
  }

  loseLife() {
    this.lives--;
    if (this.livesText) {
      this.livesText.setText('♥ ' + this.lives);
    }
    if (this.lives <= 0) {
      this.endGame(false);
    }
  }

  // =============================================================
  //  GAME END
  // =============================================================

  endGame(won = false) {
    this.isPlaying = false;

    // LGSP Fitness Flush
    if (this.blockRuntime) {
      this.blockRuntime.flushFitness({
        won,
        score: this.score,
        livesRemaining: this.lives,
        totalCoins: 0,
      });
    }

    // Show result overlay
    const { width, height } = this.sys.game.config;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(200);

    const titleColor = won ? '#44ff44' : '#ff4444';
    const titleText = won ? '✦ SCRIPT COMPLETE ✦' : '✖ GAME OVER';

    this.add.text(width / 2, height / 2 - 50, titleText, {
      fontSize: '36px', color: titleColor, fontFamily: 'Courier New',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(width / 2, height / 2, 'Score: ' + this.score, {
      fontSize: '22px', color: '#ffee44', fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(width / 2, height / 2 + 30, 'Fitness Flushed ✓', {
      fontSize: '14px', color: '#88ff88', fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Retry button
    const retryBtn = this.add.rectangle(width / 2, height / 2 + 80, 200, 50, 0x44cc44, 0.9)
      .setStrokeStyle(2, 0x66ff66).setInteractive({ useHandCursor: true })
      .setScrollFactor(0).setDepth(201);

    this.add.text(width / 2, height / 2 + 80, '↻  RETRY', {
      fontSize: '22px', color: '#fff', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

    retryBtn.on('pointerdown', () => {
      this.scene.restart({ score: 0, lives: 3 });
    });

    // Back button
    const backBtn = this.add.rectangle(width / 2, height / 2 + 140, 200, 40, 0x444488, 0.9)
      .setStrokeStyle(2, 0x6666cc).setInteractive({ useHandCursor: true })
      .setScrollFactor(0).setDepth(201);

    this.add.text(width / 2, height / 2 + 140, '← Back to Studio', {
      fontSize: '16px', color: '#aaaaff', fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

    backBtn.on('pointerdown', () => {
      window.location.href = '../block-editor/index.html';
    });

    // Keyboard retry
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.restart({ score: 0, lives: 3 });
    });

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.restart({ score: 0, lives: 3 });
    });
  }

  /**
   * Shutdown: clean up runtime
   */
  shutdown() {
    if (this.blockRuntime) {
      this.blockRuntime.abort();
      this.blockRuntime = null;
    }
  }
}
