/**
 * MenuScene — Title screen with animations and level select.
 */
import { GAME_CFG } from '../game.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.sys.game.config;

    // --- Background ---
    this.add.image(width / 2, height / 2, 'bg_sky').setDisplaySize(width, height);

    // Floating mountains for atmosphere
    this.add.image(width / 2, height - 100, 'bg_mountains')
      .setDisplaySize(width, height)
      .setAlpha(0.6);

    // --- Title ---
    const title = this.add.text(width / 2, 100, 'VOXELWORKS', {
      fontSize: '52px',
      color: '#44ff44',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#003300',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Pulsing animation
    this.tweens.add({
      targets: title,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // --- Subtitle ---
    this.add.text(width / 2, 160, 'A Platformer Adventure', {
      fontSize: '18px',
      color: '#aaddaa',
      fontFamily: 'Courier New',
    }).setOrigin(0.5);

    // --- Animated cat character ---
    const cat = this.add.image(width / 2 - 120, 250, 'player').setScale(3);
    this.tweens.add({
      targets: cat,
      y: 240,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Coins bouncing around
    const coin = this.add.image(width / 2 + 100, 260, 'coin').setScale(2);
    this.tweens.add({
      targets: coin,
      angle: 360,
      duration: 2000,
      repeat: -1,
    });

    // --- Play Button ---
    const playBtnBg = this.add.rectangle(width / 2, 340, 220, 60, 0x44cc44, 0.9)
      .setStrokeStyle(3, 0x66ff66)
      .setInteractive({ useHandCursor: true });

    const playText = this.add.text(width / 2, 340, '▶  PLAY', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Hover effects
    playBtnBg.on('pointerover', () => {
      playBtnBg.setFillStyle(0x55ee55, 1);
      playText.setScale(1.1);
    });
    playBtnBg.on('pointerout', () => {
      playBtnBg.setFillStyle(0x44cc44, 0.9);
      playText.setScale(1);
    });
    playBtnBg.on('pointerdown', () => this.startGame());

    // --- Level Select ---
    this.add.text(width / 2, 420, '— Select Level —', {
      fontSize: '14px',
      color: '#88aa88',
      fontFamily: 'Courier New',
    }).setOrigin(0.5);

    const levelButtons = [];
    GAME_CFG.levels.forEach((level, i) => {
      const y = 455 + i * 40;
      const btn = this.add.rectangle(width / 2, y, 180, 32, 0x333366, 0.7)
        .setStrokeStyle(1, 0x5555aa)
        .setInteractive({ useHandCursor: true });

      const txt = this.add.text(width / 2, y, `Level ${i + 1}: ${level.name}`, {
        fontSize: '13px',
        color: '#aaaaff',
        fontFamily: 'Courier New',
      }).setOrigin(0.5);

      btn.on('pointerover', () => { btn.setFillStyle(0x444488, 0.9); txt.setColor('#ffffff'); });
      btn.on('pointerout', () => { btn.setFillStyle(0x333366, 0.7); txt.setColor('#aaaaff'); });
      btn.on('pointerdown', () => {
        this.startGame(i);
      });

      levelButtons.push(btn);
    });

    // --- Instructions ---
    this.add.text(width / 2, height - 50, 'Arrow Keys to Move  •  Space to Jump', {
      fontSize: '12px',
      color: '#667766',
      fontFamily: 'Courier New',
    }).setOrigin(0.5);

    // --- Keyboard shortcut ---
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard.once('keydown-ENTER', () => this.startGame());

    // --- Particle emitter for sparkles ---
    this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: width },
      y: { min: 0, max: 20 },
      speedY: { min: 20, max: 60 },
      speedX: { min: -10, max: 10 },
      lifespan: 3000,
      alpha: { start: 0.6, end: 0 },
      scale: { start: 1, end: 0.3 },
      quantity: 1,
      frequency: 200,
    });
  }

  /**
   * Start the game at the specified level index.
   * @param {number} [levelIndex=0]
   */
  startGame(levelIndex = 0) {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { level: levelIndex });
    });
  }
}
