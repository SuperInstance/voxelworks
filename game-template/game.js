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
import { BlockScriptStage } from '/game-template/scenes/BlockScriptStage.js';

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
 * Detects block script mode from window.__VOXELWORKS_BLOCK_MANIFEST
 * (set by index.html from localStorage when ?mode=blocks)
 *
 * @returns {Phaser.Game}
 */
export function createGame() {
  // Check for block script manifest
  const blockManifest = window.__VOXELWORKS_BLOCK_MANIFEST || null;
  const isBlockScriptMode = !!blockManifest;

  if (isBlockScriptMode) {
    console.log('[GameEngine] 🧊 Block Script Mode — executing compiled manifest');
    console.log('[GameEngine]   Display:', blockManifest.displayName);
    console.log('[GameEngine]   Scripts:', blockManifest.scriptCount);
  }

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
    scene: isBlockScriptMode
      ? [BootScene, BlockScriptStage]
      : [BootScene, MenuScene, GameScene],
    pixelArt: true,
    input: {
      keyboard: true,
      touch: true,
    },
    scale: scaleConfig,
  };

  const game = new Phaser.Game(config);

  // Store manifest globally for scene access
  window.__VOXELWORKS_BLOCK_MANIFEST_ACTIVE = blockManifest;

  return game;
}

// Boot the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => createGame());
} else {
  createGame();
}
