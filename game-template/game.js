/**
 * VoxelWorks Game Engine
 * Phaser.js 3.80+ platformer template
 *
 * A hackable foundation for kids to build their own platformer games.
 * No build step needed — just open index.html in a browser!
 */

import { BootScene } from '/game-template/scenes/BootScene.js';
import { MenuScene } from '/game-template/scenes/MenuScene.js';
import { GameScene } from '/game-template/scenes/GameScene.js';

/** Phaser scale configuration */
const scaleConfig = {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: 800,
  height: 600,
  parent: 'game-container',
};

/** Global game configuration */
export const GAME_CFG = {
  // Player physics
  playerSpeed: 200,
  jumpVelocity: -420,
  gravity: 900,

  // Coin settings
  coinScore: 100,

  // Level definitions
  levels: [
    { name: 'Green Hills', tileSize: 64 },
    { name: 'Underground Cavern', tileSize: 64 },
    { name: 'Lava Fortress', tileSize: 64 },
  ],
};

/**
 * Create and configure the Phaser game instance.
 * @returns {Phaser.Game}
 */
export function createGame() {
  const config = {
    type: Phaser.AUTO,
    ...scaleConfig,
    backgroundColor: '#1a1a2e',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: GAME_CFG.gravity },
        debug: false,
      },
    },
    scene: [BootScene, MenuScene, GameScene],
    pixelArt: true,
    input: {
      keyboard: true,
      touch: true,
    },
    scale: scaleConfig,
  };

  return new Phaser.Game(config);
}

// Boot the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => createGame());
} else {
  createGame();
}
