# VoxelWorks — Agent Developer Guide

## Project Overview

**VoxelWorks** is a kid-friendly game-making ecosystem. A game about building games. No code required — drag blocks, describe assets, and publish worlds. Built entirely with vanilla HTML/CSS/JS and Phaser.js.

**Core Philosophy**: Build worlds, not code. Talk to your world. It builds itself. Every room is a self-contained HTML page that can be opened in any browser.

### Key Features
- **Hub Room** — Voxel living room with Buddy chatbot, fireplace, bookshelf, window, door (room navigation)
- **Build Studio** — Scratch-like block editor for building game logic visually
- **Asset Lab** — Prompt-to-asset gallery for sprites, backgrounds, sounds, music, stories
- **Ship Deck** — Git log timeline + deploy/share modal with QR code
- **Game Engine** — Phaser.js 3.80+ platformer with 3 levels, procedural textures, touch controls

## Architecture

### Five-Room Layout

```
                     ┌─────────────┐
                     │   Hub Room   │  ← voxel living room, Buddy chatbot, navigation
                     │  (hub-room/) │
                     └──────┬──────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
   ┌──────────────┐ ┌────────────┐ ┌──────────────┐
   │  Build Studio │ │ Asset Lab  │ │  Ship Deck   │
   │ (block-editor/)│ │(asset-lab/)│ │ (ship-deck/) │
   │ Scratch blocks │ │prompt→asset│ │ git + deploy │
   └──────────────┘ └────────────┘ └──────────────┘
                            │
                            ▼
                 ┌──────────────────┐
                 │  Game Engine      │  ← Phaser.js platformer
                 │ (game-template/)  │     3 levels, no build step
                 └──────────────────┘
```

### Room Architecture

| Room | Path | Tech | Purpose |
|------|------|------|---------|
| Hub Room | `hub-room/index.html` | Vanilla CSS/JS | Living room with Buddy chatbot, room navigation via door overlay |
| Build Studio | `block-editor/index.html` | Vanilla JS drag-drop | Scratch-like block palette → workspace, snap-to-grid stacking, "Run" executes blocks |
| Asset Lab | `asset-lab/index.html` | Canvas drawing engine | Prompt input → auto-generated procedural previews (cat, slime, forest, cavern, music waveform, story parchment) |
| Ship Deck | `ship-deck/index.html` | CSS timeline | Git-like commit timeline, "Share My World" → modal with QR code + URL |
| Game Engine | `game-template/index.html` | Phaser.js 3.80 | 3-level platformer (Green Hills, Underground Cavern, Lava Fortress), procedural textures, keyboard+touch controls |

## File Structure

```
voxelworks/
├── index.html               ← [TASK: CREATE] Master navigation hub (5 room cards, inline CSS, zero images)
├── CLAUDE.md                ← This file
├── hub-room/
│   └── index.html           ← Voxel living room, Buddy chatbot, fireplace, door, bookshelf, window
├── block-editor/
│   └── index.html           ← Scratch-like block editor: 5 categories (Motion, Looks, Control, Sound), drag-to-workspace, snap stacking, delete-to-palette, Run output
├── asset-lab/
│   └── index.html           ← Prompt-to-asset gallery: sprite/background/sound/music/story generators, autocomplete, canvas previews, lightbox, download
├── ship-deck/
│   └── index.html           ← Git log timeline, deploy/share modal with QR code, copy URL
├── game-template/
│   ├── index.html           ← Phaser.js boot page, loads CDN + module scripts
│   ├── game.js              ← createGame(), GAME_CFG config (speed, gravity, coin score, level names)
│   ├── README.md            ← Customization guide (player character, levels, physics, enemies)
│   ├── scenes/
│   │   ├── BootScene.js     ← Generates ALL textures procedurally via Graphics API (player, platforms, coins, spikes, backgrounds, particles)
│   │   ├── MenuScene.js     ← Title screen with PLAY button, level select, animated cat, particle sparkles
│   │   └── GameScene.js     ← Core gameplay: physics, collisions, coins, spikes, death/game-over, level-complete, audio beeps
│   └── assets/
│       └── .gitkeep         ← Placeholder for custom sprite PNGs
├── assets/                  ← (future) Shared assets across rooms
└── README.md                ← (future) Project README
```

## Core Systems

### Hub Room (`hub-room/index.html`)
- **Scene**: Voxel-style living room with fireplace (animated fire particles, toggle-able), window (cycle through sunset/night/forest/ocean/aurora themes), bookshelf (past projects), desk (current project status), door (room selector with travel animation)
- **Buddy Chatbot**: Click Buddy → slide-in chat panel. Keyword-based responses (platformer, cat, forest, ship). Random greetings on load. Travel-to-room flow on room selection via door overlay.
- **Navigation**: Click door → room selector overlay → travel animation → arrival overlay → "Coming Soon" placeholder. Hardcoded room list: Build Studio, Asset Lab, Ship Deck, Library.

### Build Studio (`block-editor/index.html`)
- **Palette**: 5 categories (Motion, Looks, Control, Sound) with collapsible headers. Blocks have colored shoulders + bottom bump for snap-stack visual.
- **Workspace**: Grid background (12px snap). Drag from palette creates workspace instance. Move existing blocks (entire stack follows root). 24px snap threshold for stacking.
- **Snap System**: `findSnap()` detects vertical alignment between stacks. Drag root's bottom edge snaps to another stack's top (or vice versa). `snap-indicator` CSS class highlights targets. On mouseup: re-parents blocks in linked-list chain (`parentId` / `childId`).
- **Delete**: Drop a block into the palette area to delete the entire stack.
- **Execution**: "Run" button iterates all stacks, outputs each block's label with field values filled in. Output panel with info/warn/error/done styling.
- **State**: `instances[]` array with linked-list structure. `getStackBlocks(root)` walks children. `renderStack()` positions based on computed heights.

### Asset Lab (`asset-lab/index.html`)
- **Generator**: Text input with autocomplete (12 suggestions). Type selector (sprite, background, sound, music, story). 2-second simulated generation.
- **Canvas Drawing**: `drawPreview(canvas, type, prompt)` dispatches to type-specific drawing functions. High-DPI-aware (`devicePixelRatio` handling).
- **Assets**: Procedural drawings. Cat sprite (ears, whiskers, stripes, tail), slime (blob, eyes, bubbles), wizard hat, robot. Forest (sun, mountains, trees, light shafts). Cave/underwater (gradient + bubbles). Coin/Boss/Story with waveform, piano-roll, parchment layouts.
- **Gallery**: Asset cards with heart/favorite toggle, download-to-PNG, lightbox. Re-renders on window resize (debounced).
- **Scoring**: Heart toggle per asset, download exports canvas as PNG.

### Ship Deck (`ship-deck/index.html`)
- **Project Bar**: Current project name + LIVE status badge.
- **Timeline**: CSS-animated vertical timeline with colored nodes (feat=green, fix=blue, asset=purple, deploy=gold, init=cyan). Each commit has: type, message, relative time, optional tag (Live/Building/Local).
- **Deploy Modal**: "Share My World" button → modal with QR placeholder (deterministic 9×9 grid from URL hash) + copyable URL (`https://{slug}.pages.dev`).
- **Effects**: Scanline overlay, decorative glow orbs, toast notification on copy.

### Game Engine (`game-template/`)
- **Phaser.js 3.80.1**: Loaded from CDN. ES6 modules via `<script type="module">`. Arcade physics. Procedural textures (no external images). FIT scaling for mobile+desktop.
- **3 Levels**: Green Hills (easy), Underground Cavern (medium), Lava Fortress (hard). Each defined as tile layout arrays in `getLevelLayouts()`.
- **Player**: Green voxel cat. Arrow keys + Space to move/jump. Touch controls auto-show on mobile.
- **Collectibles**: Gold coins (+100 points each, spinning + floating animation, particle burst on collect). Spikes (red triangles, instant death touch).
- **Life System**: 3 lives. Flash + invulnerability on hit. Game Over screen with retry/menu. Level complete overlay with score summary and "Next Level" button.
- **Audio**: Web Audio API beep oscillator (no audio files). Different pitch for coin collect, death, level complete.
- **Parallax**: 3-layer parallax scrolling (far sky/cave/lava, mid hills, near mountains). Background selection per level.

## How to Add a New Game Template

### Step 1: Create the template folder
```bash
mkdir -p voxelworks/game-template-{your_game}/
cd voxelworks/game-template-{your_game}/
```

### Step 2: Create the basic structure
Every template must have at minimum:
- `index.html` — single-page app entry point (no build step)
- `game.js` — game configuration and initializer
- `scenes/` — Phaser scenes or custom game logic

### Step 3: Follow the pattern
Copy `game-template/` as a starting point and customize:

**For a Phaser.js game:**
```bash
cp -r voxelworks/game-template/* voxelworks/game-template-mygame/
```

Then edit:
- `game.js` — Change `GAME_CFG` (player speed, jump height, gravity, level names)
- `scenes/BootScene.js` — Replace `createPlayerTexture()` to change character look
- `scenes/GameScene.js` — Replace `getLevelLayouts()` to design custom levels
  - Each level is `{ width, playerStart, endZone, tiles[] }`
  - Tile types: `platform` (x, y, w, h), `coin` (x, y), `spike` (x, y)
  - Player can walk on platforms, collect coins (+100), die on spikes
  - Green `endZone` rectangle triggers level completion

**For a non-Phaser game:**
Create your own `index.html` with vanilla JS. Key requirements:
- Self-contained (no external dependencies except CDN)
- Kid-friendly UI (bold colors, large text, emoji, animations)
- Works offline when cached
- Responsive (mobile + desktop)

### Step 4: Add rooms to the hub
Open `voxelworks/hub-room/index.html` and add the room to the `room-list` in the door overlay:
```html
<div class="room-item" data-room="My Game Room">
  <span class="room-icon">🎮</span> My Game Room
</div>
```

### Step 5: Add to this CLAUDE.md
Document the template in the File Structure section.

## How to Customize Existing Templates

### Hub Room Customization
- **Room list**: Edit `.room-item` divs inside `#doorOverlay` 
- **Buddy responses**: Edit the `responses` object in `<script>`:
  ```javascript
  const responses = {
    'your_keyword': "Your custom response",
  };
  ```
- **Window themes**: Add to `themes` array and create associated CSS class `.window-theme-{name}`
- **Bookshelf projects**: Edit the `.project-list` `<li>` items
- **Desk project**: Edit the current project text in `#deskOverlay`

### Build Studio Customization
- **Add categories**: Add to `CATEGORIES` array:
  ```javascript
  {
    id:'sensing', label:'Sensing', color:'#5CB1D6',
    blocks:[
      { id:'touching_edge', label:'touching edge?', args:[], color:'#5CB1D6' },
    ]
  }
  ```
- **Add block types**: Each block has: `id`, `label` (use `%1`, `%2` for fields), `args` (number/text/dropdown), `color`, `hat` (boolean)
- **Change grid snap**: Edit `GRID` (12) and `SNAP_DIST` (24) constants
- **Change physics**: Values like `playerSpeed`, `jumpVelocity`, `gravity` in `GAME_CFG` animation

### Asset Lab Customization
- **Add drawing functions**: Create a new `draw{Type}(canvas)` function and add a `case` in `drawPreview()` switch
- **Add asset types**: Add to `type-selector` buttons AND the switch in `drawPreview()`
- **Add autocomplete suggestions**: Add to `SUGGESTIONS` array
- **Add sample assets**: Add to `SAMPLES` array

### Ship Deck Customization
- **Add commits**: Modify the `commits` array (type: feat/fix/asset/deploy/init, time, tag)
- **Change deploy URL**: Edit `getShipUrl()` function (currently builds slug from `projectName`)
- **Change project name**: Edit `projectName` variable

### Game Template Customization
- **Player appearance**: Edit `createPlayerTexture()` in `BootScene.js`
- **Game physics**: Edit `GAME_CFG` in `game.js` (speed, jump, gravity, coinScore)
- **Level layouts**: Edit `getLevelLayouts()` in `GameScene.js`
- **Add new levels**: Add name to `GAME_CFG.levels` array + add layout to `getLevelLayouts()`
- **Custom textures**: Drop PNGs in `assets/` and load in `BootScene.preload()`:
  ```javascript
  this.load.image('my_texture', 'assets/my_texture.png');
  ```
- **Add enemies**: Create a physics group in `GameScene.create()` and add overlap handler
- **Sound effects**: Use `this.playBeep(freq, duration)` — Web Audio oscillator (no files needed)

## CraftMind Repo Integration Map

Each CraftMind repo follows a consistent pattern and can integrate with VoxelWorks rooms.

| Repo | Purpose | Room Integration |
|------|---------|------------------|
| **craftmind-studio** | Minecraft build planner/fabricator | **Build Studio** — block programming UI patterns, build-from-blueprint workflows |
| **craftmind-courses** | AI-powered Minecraft education with NPC teachers, adaptive learning, spaced repetition | **Hub Room** — Buddy chatbot could load course definitions and guide learning paths. **Build Studio** — course lesson flow as scratch blocks |
| **craftmind-researcher** | Minecraft data mining, block scanning, resource analysis | **Asset Lab** — resource scanning paterns for asset generation, procedural world analysis |
| **craftmind-ranch** | Minecraft animal husbandry, breeding mechanics, ranch management | **Build Studio** — state machine patterns from animal behaviors. **Game Engine** — animal spawning/despawning |
| **craftmind-herding** | Minecraft wolf/dog AI, herding behaviors, companion management | **Game Engine** — companion AI patterns (follow, stay, fetch). **Hub Room** — Buddy companion logic |
| **craftmind-circuits** | Redstone circuit building, logic gates, automated systems | **Build Studio** — block snap patterns are identical to circuit wiring. **Game Engine** — redstone-inspired puzzle levels |

### Integration Pattern

Each integration follows this pattern:
1. Import the repo's state/action model
2. Render it in the VoxelWorks room's canvas/DOM
3. Map Minecraft interactions to VoxelWorks UI events
4. Output back to the Minecraft bot system

For example, craftmind-courses' `NPCTeacher` could drive **Buddy** in the Hub Room, while craftmind-circuits' logic gate snap patterns port directly to Build Studio block stacking.

## Deployment Pipeline

```
┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────────────┐
│  Nebula   │ →  │  Claude Code │ →  │  GitHub   │ →  │ Cloudflare Pages │
│ (ideation)│    │ (generation) │    │ (source)  │    │  (production)    │
└──────────┘    └──────────────┘    └──────────┘    └──────────────────┘
```

### Step 1: Nebula (Ideation)
- User describes the game they want to build in natural language
- Nebula produces a `voxelworks-concept.html` diagram showing the room layout, flow, and interactions
- Concept is reviewed and approved before implementation

### Step 2: Claude Code (Generation)
- Claude Code reads the concept diagram and existing templates
- Generates new rooms or modifies existing ones
- Follows the fork-first workflow (see below)
- Creates self-contained HTML files — no build step, no bundled, no framework

### Step 3: GitHub (Source Control)
- All rooms are committed to `main` branch
- Each room is a folder with `index.html` as entry point
- Game templates live in `game-template-{name}/` folders
- PRs follow fork-first pattern

### Step 4: Cloudflare Pages (Production)
- Cloudflare Pages auto-deploys from GitHub
- Each `index.html` is a route:
  - `https://voxelworks.pages.dev/` → `voxelworks/index.html` (hub)
  - `https://voxelworks.pages.dev/hub-room/` → `hub-room/index.html`
  - `https://voxelworks.pages.dev/block-editor/` → `block-editor/index.html`
  - `https://voxelworks.pages.dev/asset-lab/` → `asset-lab/index.html`
  - `https://voxelworks.pages.dev/ship-deck/` → `ship-deck/index.html`
  - `https://voxelworks.pages.dev/game-template/` → `game-template/index.html`
- Zero config — Cloudflare auto-detects static HTML sites
- Each room is fully self-contained — can load independently from any room

## Fork-First Workflow

All VoxelWorks development follows a fork-first pattern:

```
           ┌──────────────┐
           │  User Request │
           └──────┬───────┘
                  │
          ┌───────▼────────┐
          │  Fork Concept   │  ← Create voxelworks-concept.html
          │  (diagram +     │     showing room layout, UX flow
          │   description)  │
          └───────┬────────┘
                  │
          ┌───────▼────────┐
          │  Approval       │  ← Review by user
          │  /reject /ask   │
          └───────┬────────┘
                  │
          ┌───────▼────────┐
          │  Generate       │  ← Claude Code creates the room
          │  Implementation │     templated from game-template/
          └───────┬────────┘
                  │
          ┌───────▼────────┐
          │  Review & Ship  │  ← Open in browser, verify functionality
          └────────────────┘
```

### When to Fork
- **New room type** (e.g., "library room", "sound studio") → Fork from closest existing room
- **New game template** → Fork from `game-template/` 
- **Bug fix to existing room** → Edit in place, no fork needed
- **UI polish** → Edit in place, no fork needed

### Forking Rules
1. Copy the closest template folder: `cp -r template-folder/ new-folder/`
2. Rename all references (room title, navigation, CSS class names)
3. Adapt the JS logic (different interaction model, different output)
4. Keep the same structural pattern (self-contained HTML, inline CSS, vanilla JS)
5. Add to hub navigation
6. Update this CLAUDE.md with the new room

## Code Conventions

### General
- **All files are vanilla HTML** — no build step, no frameworks, no bundlers
- Single `index.html` per room — inline `<style>` and `<script>` only
- ES6 modules only for Phaser game scenes (loaded via `<script type="module">`)
- CSS custom properties for theming (`:root { --bg: #...; --text: #... }`)
- Responsive: support desktop + mobile with CSS `@media` queries
- No external images — all graphics are procedural (Canvas 2D or CSS)
- Emoji icons (🎨, 🚢, 🧩, etc.) for room icons and buttons — no icon libraries

### HTML
- No `<link>` to external stylesheets except CDN fonts when needed
- `<meta name="viewport" content="width=device-width,initial-scale=1">` required
- Semantic elements (`<header>`, `<main>`, `<aside>`) preferred
- All interactive elements have cursor:pointer and hover states
- Dark theme by default (background: `#0a0a1a`..`#1a1a2e` family)

### CSS
- Inline in `<style>`, use class-based selectors (avoid IDs except for JS hooks)
- Animations use `@keyframes` with `cubic-bezier(.34,1.56,.64,1)` for playful bouncy feel
- Gradient backgrounds for depth (`linear-gradient` / `radial-gradient`)
- Backdrop blur for overlays (`backdrop-filter: blur()`)
- Transitions on hover/tap (150-300ms, `cubic-bezier`)

### JavaScript
- IIFE pattern: `(function(){ 'use strict'; ... })()` or explicit DOMContentLoaded
- DOM references stored once at init, not queried every frame
- Event delegation preferred over individual listeners
- `requestAnimationFrame` for canvas rendering
- `let` over `var`; `const` for immutable bindings
- Descriptive function names (camelCase)
- `// ===== SECTION =====` comments for visual separation

### Phaser.js Scenes
- ES6 module format: `export class XScene extends Phaser.Scene`
- Scene key as constructor string
- All textures generated in BootScene via `this.make.graphics()`
- Physics collision setup in `create()`, game logic in `update()`
- No external sprite assets — all procedural

## Current State

### What Works ✅
- **Hub Room** — Voxel living room with Buddy chatbot, fireplace, bookshelf, window (5 themes), desk, door navigation. Keyword-based chat responses. Travel animation with room arrival overlay.
- **Build Studio** — 5 categories, 18 blocks, drag from palette, snap-to-grid workspace, delete-by-dropping-on-palette, block stacking with linked-list parent/child, Run output with formatted labels.
- **Asset Lab** — 5 asset types (sprite, background, sound, music, story), autocomplete with 12 suggestions, procedurally drawn previews (cat, slime, wizard, robot, forest, cave, waveform, piano-roll, parchment), lightbox, download-to-PNG, heart favorites, window-resize redraw.
- **Ship Deck** — 5 commit timeline, animated nodes, color-coded types, deploy modal with QR placeholder + copy-to-clipboard, glow orbs, scanline overlay.
- **Game Engine** — Phaser.js 3.80, 3 levels with increasing difficulty, green voxel cat player, coin collect with particle burst, spikes, lives/score UI, parallax scrolling, touch controls, game over + level complete screens, Web Audio beeps.

### What's Stubbed / TODO 🚧
- **Library Room** — Referenced in hub door overlay but not implemented
- **Real AI Integration** — Buddy chatbot uses keyword matching, not LLM. Asset Lab uses procedural drawing, not AI generation.
- **Cloudflare Pages** — Deploy pipeline configured but site not yet deployed
- **Multi-game Templates** — Only one game template exists (platformer)
- **Sound Effects** — Ship Deck and Build Studio have no sound
- **Save/Load** — No persistence (builds, assets, game progress are session-only)
- **User Accounts** — No login, no per-user state
- **Music Jukebox** — Mentioned in concept but not built
- **Block Execution** — "Run" in Build Studio outputs text, doesn't actually execute game logic

## Key Dependencies

### Runtime
- **None for rooms** — Hub Room, Build Studio, Asset Lab, Ship Deck are all vanilla HTML/JS
- **Phaser.js 3.80.1** (`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`) — Only for `game-template/`
- **Google Fonts** (optional) — Only in `asset-lab/` and `voxelworks-concept.html` (Segoe UI system font as fallback)

### Integration Dependencies
- **Claude Code** — Code generation agent (used in deploy pipeline)
- **Nebula** — Ideation service (diagram generation)
- **Cloudflare Pages** — Static site hosting (auto-deploys from GitHub)
- **ZAI/Anthropic/OpenAI** — Future: LLM integration for Buddy chatbot and Asset Lab AI generation

## Testing

### Manual Testing (All Rooms)
- Open each `index.html` in a browser — no server required
- Test responsive layout at 375px, 768px, 1280px widths
- Verify all interactive elements have hover/active states
- Verify animations don't cause performance issues (>30fps)

### Game Template Testing
- Open `game-template/index.html` in a browser
- Test keyboard controls (arrows + space)
- Test touch controls (mobile device or dev tools emulation)
- Complete all 3 levels
- Verify game over screen (die 3 times)
- Verify score persistence across levels

### Build Studio Testing
- Drag each block type from palette to workspace
- Stack blocks (drag one stack near another, verify snap)
- Delete block stack (drag to palette zone)
- Run to verify output text
- Clear button resets workspace

## Known Issues & Patterns

### Hub Room Door Navigation
The door overlay references rooms (Build Studio, Asset Lab, Ship Deck, Library) but the travel animation only shows an "under construction" placeholder. Actual navigation to room HTML pages requires Cloudflare Pages deployment (each room at its own URL path). Until then, travel animation is a visual demo only.

### Block Snap Algorithm
The snap system in Build Studio uses `getStackVisualHeight()` to calculate stack extents. Block heights depend on rendered DOM dimensions, which can be inconsistent during drag. If snap behaves unexpectedly, check that the block's `.block-body` element has correct `offsetHeight`.

### Canvas High-DPI Handling
Asset Lab uses `devicePixelRatio` scaling for crisp canvas rendering. On window resize, all canvases are re-drawn. On very rapid resize (e.g., orientation change), debounce timer may not catch the final state — assets appear blurry until the next resize event triggers.

### Phaser CDN Loading
`game-template/index.html` loads Phaser from CDN. If the CDN is unreachable, the game won't load. No fallback bundle is provided. The game cannot run offline without a service worker.

## ROADMAP

### Short-term (Current Sprint)
- [ ] Deploy to Cloudflare Pages
- [ ] Implement Library Room
- [ ] Add sound effects to Build Studio and Ship Deck
- [ ] Integrate Buddy chatbot with LLM

### Medium-term (Next Quarters)
- [ ] Real AI generation in Asset Lab (text-to-image for sprites/backgrounds, text-to-audio for SFX/music)
- [ ] Multi-game templates (RPG, puzzle, racing, shooter)
- [ ] Save/Load system (localStorage → IndexedDB → remote)
- [ ] Persist block scripts, generated assets, and game progress
- [ ] Add the Library Room (a room for reference docs, past projects, tutorials)
- [ ] Block execution → actual Phaser game actions

### Long-term
- [ ] User accounts and multiplayer
- [ ] Community game sharing
- [ ] Course integration with craftmind-courses (learn via Buddy)
- [ ] VoxelWorks as a service — API for game creation
