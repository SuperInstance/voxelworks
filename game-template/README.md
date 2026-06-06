# VoxelWorks — Platformer Game Engine

A complete, runnable Phaser.js 3.80+ platformer game template. **No build step, no server, no npm.** Just open `index.html` in a browser!

## 🎮 How to Play

1. Open `index.html` in any modern browser
2. Click **PLAY** or select a level
3. **Arrow keys** to move left/right
4. **Space bar** or **Up arrow** to jump
5. Collect coins (yellow squares) — +100 points each
6. Avoid spikes (red triangles) — you lose a life
7. Reach the green **EXIT** zone to complete the level

### Mobile

On touch devices, on-screen buttons appear automatically at the bottom of the screen.

## 🏗️ File Structure

```
game-template/
├── index.html           ← Open this in a browser to play
├── game.js              ← Phaser config + scene registration
├── scenes/
│   ├── BootScene.js     ← Generates all textures (no external images!)
│   ├── MenuScene.js     ← Title screen with level select
│   └── GameScene.js     ← Core gameplay engine
├── assets/              ← Placeholder for custom sprites
└── README.md            ← This file
```

## 🛠️ How to Customize

### Change the player character

Edit `createPlayerTexture()` in **`scenes/BootScene.js`**. Draw a different shape using Phaser's Graphics API:

```javascript
// Make a red bird!
createPlayerTexture() {
  const g = this.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xff4444);
  g.fillCircle(16, 16, 14);  // Circle body
  g.fillTriangle(4, 10, 0, 16, 8, 16); // Beak
  g.generateTexture('player', 32, 32);
  g.destroy();
}
```

### Change levels

Edit `getLevelLayouts()` in **`scenes/GameScene.js`**. Each level is an array of tiles:

```javascript
{ type: 'platform', x: 0, y: 536, w: 5, h: 1 },  // 5-wide platform
{ type: 'coin', x: 200, y: 400 },                    // A coin
{ type: 'spike', x: 300, y: 504 },                   // A spike
```

### Change game settings

Edit **`game.js`** — tweak speeds, jump height, gravity:

```javascript
export const GAME_CFG = {
  playerSpeed: 250,     // Faster player
  jumpVelocity: -500,   // Higher jumps
  gravity: 800,         // Lighter gravity
  coinScore: 200,       // More points per coin
};
```

### Add new levels

1. Add a name in `GAME_CFG.levels` array in **`game.js`**
2. Add a level layout in `getLevelLayouts()` in **`GameScene.js`** — it'll auto-appear in the level select menu!

### Custom textures

Drop PNGs in `assets/` and load them in `BootScene.js`:

```javascript
// In preload()
this.load.image('my_custom_tile', 'assets/my_tile.png');

// Use it in level builder
{ type: 'platform', texture: 'my_custom_tile', ... }
```

### Add enemies

The engine is built for extensibility. Add an `enemies` group in `GameScene.create()`:

```javascript
this.enemies = this.physics.add.group();
this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
```

Then spawn enemies in `buildLevel()` using the same layout data system.

## 🔧 Technical Notes

- **Phaser.js 3.80.1** loaded from CDN
- **ES6 modules** via `<script type="module">`
- **Arcade physics** for gravity, collisions, and overlap detection
- **All assets procedural** — no external files needed
- **Parallax scrolling** with 3 background layers
- **FIT scaling** for responsive desktop and mobile
- **Web Audio** for simple sound effects (no audio files needed)

## 🎯 Learning Goals

This template is designed to be hacked by kids learning game development:

1. **Change colors** — Easy visual customization
2. **Redesign levels** — Learn spatial thinking
3. **Tweak physics** — Understand gravity and momentum
4. **Add new items** — Extend the game logic
5. **Custom art** — Replace procedural graphics with sprites

---

Have fun building your game! 🐱
