/**
 * Block → Phaser Compiler
 * Converts Block Studio block stacks into Phaser game configurations.
 * Output is LGSP-compatible JSON (Living Game State Protocol v0.1.0).
 *
 * Usage:
 *   import { compileBlockStacks, compileToPhaserConfig } from './block-compiler.js';
 *   const phaserConfig = compileBlockStacks(drag.stack.instances);
 *   // or
 *   const manifest = compileToLgspManifest(instances, { gameId: 'my-game' });
 *
 * @author VoxelWorks
 * @version 0.1.0
 */

// ─────────────────────────────────────────────
//  LGSP Protocol Constants
// ─────────────────────────────────────────────
const LGSP_PROTOCOL = 'lgsp/v0.1.0';

// ─────────────────────────────────────────────
//  Block Category Colors (match Block Studio)
// ─────────────────────────────────────────────
const CATEGORY_COLORS = {
  motion: '#4C97FF',
  looks:  '#9966FF',
  control:'#FFAB19',
  sound:  '#CF63CF',
  sensing:'#5CB1D6',
};

// ─────────────────────────────────────────────
//  Block Definition Map (copied from Block Studio)
// ─────────────────────────────────────────────
const BLOCK_DEFS = {
  // ─── Motion ───
  move_steps: {
    category: 'motion',
    label: 'move %1 steps',
    args: [{ key: '%1', type: 'number', def: 10 }],
  },
  turn_cw: {
    category: 'motion',
    label: 'turn ↻ %1 degrees',
    args: [{ key: '%1', type: 'number', def: 15 }],
  },
  turn_ccw: {
    category: 'motion',
    label: 'turn ↺ %1 degrees',
    args: [{ key: '%1', type: 'number', def: 15 }],
  },
  goto_xy: {
    category: 'motion',
    label: 'go to x:%1 y:%2',
    args: [
      { key: '%1', type: 'number', def: 0 },
      { key: '%2', type: 'number', def: 0 },
    ],
  },
  jump: {
    category: 'motion',
    label: 'jump',
    args: [],
  },

  // ─── Looks ───
  say: {
    category: 'looks',
    label: 'say %1 for %2 secs',
    args: [
      { key: '%1', type: 'text', def: 'Hello!' },
      { key: '%2', type: 'number', def: 2 },
    ],
  },
  think: {
    category: 'looks',
    label: 'think %1 for %2 secs',
    args: [
      { key: '%1', type: 'text', def: 'Hmm...' },
      { key: '%2', type: 'number', def: 2 },
    ],
  },
  show: { category: 'looks', label: 'show', args: [] },
  hide: { category: 'looks', label: 'hide', args: [] },

  // ─── Control ───
  when_clicked: {
    category: 'control',
    label: 'when clicked',
    args: [],
    hat: true,
  },
  if_then: {
    category: 'control',
    label: 'if %1 then',
    args: [{
      key: '%1', type: 'dropdown', def: 'true',
      opts: [
        { l: 'true', v: 'true' },
        { l: 'false', v: 'false' },
        { l: 'touching edge', v: 'edge' },
        { l: 'touching color', v: 'color' },
      ],
    }],
  },
  repeat: {
    category: 'control',
    label: 'repeat %1',
    args: [{ key: '%1', type: 'number', def: 10 }],
  },
  wait: {
    category: 'control',
    label: 'wait %1 secs',
    args: [{ key: '%1', type: 'number', def: 1 }],
  },

  // ─── Sound ───
  play_sound: {
    category: 'sound',
    label: 'play sound %1',
    args: [{
      key: '%1', type: 'dropdown', def: 'meow',
      opts: [
        { l: 'meow', v: 'meow' },
        { l: 'chirp', v: 'chirp' },
        { l: 'buzz', v: 'buzz' },
        { l: 'pop', v: 'pop' },
      ],
    }],
  },
  stop_sound: { category: 'sound', label: 'stop all sounds', args: [] },
  play_drum: {
    category: 'sound',
    label: 'play drum %1 for %2 beats',
    args: [
      { key: '%1', type: 'dropdown', def: 'snare',
        opts: [
          { l: 'snare', v: 'snare' },
          { l: 'kick', v: 'kick' },
          { l: 'hi-hat', v: 'hihat' },
          { l: 'cymbal', v: 'cymbal' },
        ],
      },
      { key: '%2', type: 'number', def: 0.25 },
    ],
  },
};

// ─────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────

function getBlockDef(id) {
  return BLOCK_DEFS[id] || null;
}

function findInst(instances, id) {
  return instances.find(i => i.id === id) || null;
}

function getChild(instances, inst) {
  return inst.childId !== null ? findInst(instances, inst.childId) : null;
}

function getParent(instances, inst) {
  return inst.parentId !== null ? findInst(instances, inst.parentId) : null;
}

function getRoot(instances, inst) {
  let cur = inst;
  const visited = new Set();
  while (cur.parentId !== null) {
    if (visited.has(cur.id)) break;
    visited.add(cur.id);
    const p = getParent(instances, cur);
    if (!p) break;
    cur = p;
  }
  return cur;
}

/**
 * Walk a linked-list stack from root to tail.
 */
function getStackBlocks(instances, root) {
  const arr = [];
  const visited = new Set();
  let cur = root;
  while (cur) {
    if (visited.has(cur.id)) {
      console.error('[BlockCompiler] Cycle detected in stack, breaking');
      break;
    }
    visited.add(cur.id);
    arr.push(cur);
    cur = getChild(instances, cur);
  }
  return arr;
}

/**
 * Build a human-readable description of a block.
 */
function buildBlockDesc(def, fields) {
  let label = def.label;
  let argIdx = 0;
  const args = def.args || [];
  for (const a of args) {
    const val = fields[a.key] !== undefined ? fields[a.key] : a.def;
    label = label.replace('%' + (argIdx + 1), String(val));
    argIdx++;
  }
  return label;
}

/**
 * Resolve a block's numeric field value.
 */
function getNum(fields, key, defVal) {
  const v = fields[key];
  if (v === undefined || v === null) return defVal;
  const n = parseFloat(v);
  return isNaN(n) ? defVal : n;
}

function getStr(fields, key, defVal) {
  const v = fields[key];
  return v !== undefined && v !== null ? String(v) : defVal;
}

/**
 * Generate a UUID-like ID for commands and entities.
 */
function uid() {
  return 'cmd_' + Math.random().toString(36).substring(2, 10);
}

// ─────────────────────────────────────────────
//  COMPILER CORE
// ─────────────────────────────────────────────

/**
 * Find all root blocks (no parent) in the instance array.
 */
function findRoots(instances) {
  return instances.filter(i => i.parentId === null);
}

/**
 * Compile block stacks into Phaser timeline/compatible scene configuration.
 *
 * @param {Array} instances - Array of block instance objects from Block Studio
 * @returns {Object} phaserConfig - Configuration object for Phaser game engine
 */
export function compileBlockStacks(instances) {
  const roots = findRoots(instances);

  /** @type {Array} Compiled Phaser timeline entries */
  const scripts = [];
  /** @type {Array} Compiled LGSP commands */
  const commands = [];
  /** @type {Object} Sprite state at each phase */
  const spriteStates = [];
  /** @type {Object} Evolution annotations for LGSP */
  const evolutionAnnotations = [];
  /** @type {number} Total duration estimate (ms) */
  let totalDurationMs = 0;

  for (const root of roots) {
    const blocks = getStackBlocks(instances, root);
    const firstBlock = blocks[0];
    const def = getBlockDef(firstBlock.def.id);

    if (!def) continue;

    // Determine trigger type
    let trigger = 'on_start';
    if (firstBlock.def.id === 'when_clicked') {
      trigger = 'on_click';
    } else if (firstBlock.def.id === 'when_key_pressed') {
      trigger = 'on_key';
    }

    // Build trigger info
    const triggerConfig = {};
    if (firstBlock.def.id === 'when_key_pressed') {
      const key = getStr(firstBlock.fields, '%1', 'space');
      triggerConfig.key = key;
    }

    // Compile the body (everything after the hat block)
    const bodyBlocks = firstBlock.def.hat ? blocks.slice(1) : blocks;
    const scriptLabel = firstBlock.def.hat
      ? buildBlockDesc(def, firstBlock.fields)
      : (BLOCK_DEFS[firstBlock.def.id]
        ? buildBlockDesc(BLOCK_DEFS[firstBlock.def.id], firstBlock.fields)
        : firstBlock.def.label || 'script');

    // Compile timeline actions
    const timeline = compileBlockSequence(instances, bodyBlocks);
    const commandsList = compileCommands(instances, bodyBlocks);

    const scriptEntry = {
      id: `script_${root.id}`,
      name: scriptLabel,
      trigger,
      triggerConfig: Object.keys(triggerConfig).length > 0 ? triggerConfig : undefined,
      timeline,
      durationMs: estimateDuration(bodyBlocks),
    };

    scripts.push(scriptEntry);
    commands.push(...commandsList);
    totalDurationMs += scriptEntry.durationMs;
  }

  return {
    protocol: LGSP_PROTOCOL,
    version: '0.1.0',
    compiledAt: Date.now(),
    scripts,
    commands,
    totalDurationMs,
    spriteState: extractInitialSpriteState(),
    stats: {
      scriptCount: scripts.length,
      commandCount: commands.length,
      triggerTypes: [...new Set(scripts.map(s => s.trigger))],
    },
  };
}

/**
 * Compile a sequence of blocks into Phaser timeline action objects.
 *
 * @param {Array} instances - All block instances
 * @param {Array} blocks - Ordered list of blocks in the stack body
 * @returns {Array} Timeline actions
 */
function compileBlockSequence(instances, blocks) {
  const timeline = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const def = getBlockDef(block.def.id);
    if (!def) { i++; continue; }

    const actions = compileSingleBlock(instances, block, blocks, i);
    timeline.push(...actions);

    // Skip past children of control blocks (they handle their own body)
    if (block.def.id === 'repeat' || block.def.id === 'if_then') {
      const child = getChild(instances, block);
      if (child) {
        let lastChild = child;
        while (getChild(instances, lastChild)) lastChild = getChild(instances, lastChild);
        while (i < blocks.length && blocks[i].id !== lastChild.id) i++;
      }
    }
    i++;
  }

  return timeline;
}

/**
 * Compile a single block into Phaser timeline action(s).
 *
 * @param {Array} instances
 * @param {Object} block
 * @param {Array} allBlocks
 * @param {number} index
 * @returns {Array} Timeline actions
 */
function compileSingleBlock(instances, block, allBlocks, index) {
  const id = block.def.id;
  const f = block.fields;
  const def = getBlockDef(id);
  const label = def ? buildBlockDesc(def, f) : id;
  const actions = [];

  switch (id) {
    // ────────── Motion ──────────
    case 'move_steps': {
      const steps = getNum(f, '%1', 10);
      actions.push({
        type: 'move',
        label,
        params: { steps, direction: 'current' },
        phaserAction: {
          type: 'tween',
          targets: 'sprite',
          props: {}, // resolved at runtime based on direction
          duration: 200,
          ease: 'Sine.easeInOut',
        },
        durationMs: 200,
      });
      break;
    }
    case 'turn_cw': {
      const deg = getNum(f, '%1', 15);
      actions.push({
        type: 'turn',
        label,
        params: { degrees: deg, direction: 'cw' },
        phaserAction: {
          type: 'tween',
          targets: 'sprite',
          props: { angle: `+=${deg}` },
          duration: 150,
          ease: 'Sine.easeInOut',
        },
        durationMs: 150,
      });
      break;
    }
    case 'turn_ccw': {
      const deg = getNum(f, '%1', 15);
      actions.push({
        type: 'turn',
        label,
        params: { degrees: deg, direction: 'ccw' },
        phaserAction: {
          type: 'tween',
          targets: 'sprite',
          props: { angle: `-=${deg}` },
          duration: 150,
          ease: 'Sine.easeInOut',
        },
        durationMs: 150,
      });
      break;
    }
    case 'goto_xy': {
      const x = getNum(f, '%1', 0);
      const y = getNum(f, '%2', 0);
      actions.push({
        type: 'goto',
        label,
        params: { x, y },
        phaserAction: {
          type: 'tween',
          targets: 'sprite',
          props: { x, y },
          duration: 100,
          ease: 'Power1',
        },
        durationMs: 100,
      });
      break;
    }
    case 'jump': {
      actions.push({
        type: 'jump',
        label,
        params: { height: 40 },
        phaserAction: {
          type: 'timeline',
          sequence: [
            { type: 'tween', targets: 'sprite', props: { y: '-=40' }, duration: 150, ease: 'Sine.easeOut' },
            { type: 'tween', targets: 'sprite', props: { y: '+=40' }, duration: 150, ease: 'Bounce.easeOut' },
          ],
        },
        durationMs: 300,
      });
      break;
    }

    // ────────── Looks ──────────
    case 'say': {
      const text = getStr(f, '%1', 'Hello!');
      const secs = getNum(f, '%2', 2);
      actions.push({
        type: 'say',
        label,
        params: { text, duration: secs },
        phaserAction: {
          type: 'speech',
          text,
          style: 'say',
          durationMs: secs * 1000,
        },
        durationMs: secs * 1000,
      });
      break;
    }
    case 'think': {
      const text = getStr(f, '%1', 'Hmm...');
      const secs = getNum(f, '%2', 2);
      actions.push({
        type: 'think',
        label,
        params: { text, duration: secs },
        phaserAction: {
          type: 'speech',
          text,
          style: 'think',
          durationMs: secs * 1000,
        },
        durationMs: secs * 1000,
      });
      break;
    }
    case 'show': {
      actions.push({
        type: 'show',
        label,
        params: {},
        phaserAction: {
          type: 'visibility',
          visible: true,
        },
        durationMs: 0,
      });
      break;
    }
    case 'hide': {
      actions.push({
        type: 'hide',
        label,
        params: {},
        phaserAction: {
          type: 'visibility',
          visible: false,
        },
        durationMs: 0,
      });
      break;
    }

    // ────────── Control ──────────
    case 'when_clicked': {
      // Hat marker — not an action
      break;
    }
    case 'wait': {
      const secs = getNum(f, '%1', 1);
      actions.push({
        type: 'wait',
        label,
        params: { seconds: secs },
        phaserAction: {
          type: 'delay',
          durationMs: secs * 1000,
        },
        durationMs: secs * 1000,
      });
      break;
    }
    case 'repeat': {
      const n = Math.max(0, parseInt(getNum(f, '%1', 10)));
      const child = getChild(instances, block);
      if (child && n > 0) {
        const childBlocks = getStackBlocks(instances, child);
        const childActions = compileBlockSequence(instances, childBlocks);
        const bodyDuration = estimateDuration(childBlocks);
        actions.push({
          type: 'repeat',
          label,
          params: { count: n },
          body: childActions,
          phaserAction: {
            type: 'loop',
            count: n,
            body: childActions.map(a => a.phaserAction),
          },
          durationMs: bodyDuration * n,
        });
      }
      break;
    }
    case 'if_then': {
      const cond = getStr(f, '%1', 'true');
      const child = getChild(instances, block);
      let conditionMet = false;
      switch (cond) {
        case 'true': conditionMet = true; break;
        case 'false': conditionMet = false; break;
        case 'edge':
        case 'color':
          // Runtime condition — compiles to a conditional timeline branch
          conditionMet = true; // assume true; runtime evaluates
          break;
        default: conditionMet = (cond === 'true');
      }
      if (child) {
        const childBlocks = getStackBlocks(instances, child);
        const childActions = compileBlockSequence(instances, childBlocks);
        actions.push({
          type: 'if_then',
          label,
          params: { condition: cond, alwaysMet: conditionMet },
          body: conditionMet ? childActions : [],
          phaserAction: {
            type: 'conditional',
            condition: cond,
            body: childActions.map(a => a.phaserAction),
          },
          durationMs: conditionMet ? estimateDuration(childBlocks) : 0,
        });
      }
      break;
    }

    // ────────── Sound ──────────
    case 'play_sound': {
      const sound = getStr(f, '%1', 'meow');
      actions.push({
        type: 'play_sound',
        label,
        params: { sound },
        phaserAction: {
          type: 'audio',
          sound,
          action: 'play',
        },
        durationMs: 300,
      });
      break;
    }
    case 'stop_sound': {
      actions.push({
        type: 'stop_sound',
        label,
        params: {},
        phaserAction: {
          type: 'audio',
          action: 'stop_all',
        },
        durationMs: 0,
      });
      break;
    }
    case 'play_drum': {
      const drum = getStr(f, '%1', 'snare');
      const beats = getNum(f, '%2', 0.25);
      actions.push({
        type: 'play_drum',
        label,
        params: { drum, beats },
        phaserAction: {
          type: 'audio',
          sound: drum,
          action: 'play_drum',
          durationBeats: beats,
        },
        durationMs: beats * 500,
      });
      break;
    }
  }

  return actions;
}

/**
 * Estimate total duration of a block sequence (ms).
 */
function estimateDuration(blocks) {
  let total = 0;
  for (const block of blocks) {
    const def = getBlockDef(block.def.id);
    if (!def) continue;
    switch (block.def.id) {
      case 'move_steps':
      case 'turn_cw':
      case 'turn_ccw':
        total += 200; break;
      case 'goto_xy':
        total += 100; break;
      case 'jump':
        total += 300; break;
      case 'say':
        total += (getNum(block.fields, '%2', 2)) * 1000; break;
      case 'think':
        total += (getNum(block.fields, '%2', 2)) * 1000; break;
      case 'show':
      case 'hide':
        break; // instant
      case 'wait':
        total += (getNum(block.fields, '%1', 1)) * 1000; break;
      case 'repeat': {
        const n = parseInt(getNum(block.fields, '%1', 10));
        const child = getChild(blocks, block);
        if (child) {
          const childStack = getStackBlocks(blocks, child);
          total += estimateDuration(childStack) * n;
        }
        break;
      }
      case 'if_then': {
        const child = getChild(blocks, block);
        if (child) {
          const childStack = getStackBlocks(blocks, child);
          total += estimateDuration(childStack);
        }
        break;
      }
      case 'play_sound':
        total += 300; break;
      case 'play_drum':
        total += (getNum(block.fields, '%2', 0.25)) * 500; break;
    }
  }
  return total;
}

// ─────────────────────────────────────────────
//  LGSP Command Compilation
// ─────────────────────────────────────────────

/**
 * Compile blocks into LGSP Command[] format.
 */
function compileCommands(instances, blocks) {
  const commands = [];
  for (const block of blocks) {
    const cmds = compileBlockToCommand(instances, block);
    commands.push(...cmds);
  }
  return commands;
}

function compileBlockToCommand(instances, block) {
  const id = block.def.id;
  const f = block.fields;
  const cmds = [];

  switch (id) {
    case 'move_steps': {
      const steps = getNum(f, '%1', 10);
      cmds.push({
        id: uid(),
        type: 'move',
        targetEntityId: 'player',
        params: { direction: 'current', speed: steps * 2 },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'turn_cw': {
      const deg = getNum(f, '%1', 15);
      cmds.push({
        id: uid(),
        type: 'set_property',
        targetEntityId: 'player',
        params: { property: 'rotation', value: `+=${deg}` },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'turn_ccw': {
      const deg = getNum(f, '%1', 15);
      cmds.push({
        id: uid(),
        type: 'set_property',
        targetEntityId: 'player',
        params: { property: 'rotation', value: `-=${deg}` },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'goto_xy': {
      const x = getNum(f, '%1', 0);
      const y = getNum(f, '%2', 0);
      cmds.push({
        id: uid(),
        type: 'teleport',
        targetEntityId: 'player',
        params: { position: { x, y } },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'jump': {
      cmds.push({
        id: uid(),
        type: 'jump',
        targetEntityId: 'player',
        params: { force: 300, direction: 'up' },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'wait': {
      const secs = getNum(f, '%1', 1);
      cmds.push({
        id: uid(),
        type: 'wait',
        targetEntityId: null,
        params: { ticks: Math.round(secs * 60) },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'repeat': {
      const n = Math.max(0, parseInt(getNum(f, '%1', 10)));
      const child = getChild(instances, block);
      if (child && n > 0) {
        const childBlocks = getStackBlocks(instances, child);
        const bodyCmds = compileCommands(instances, childBlocks);
        cmds.push({
          id: uid(),
          type: 'loop',
          targetEntityId: null,
          params: { count: n, body: bodyCmds },
          sourceBlockId: String(block.id),
          evolvableOverride: null,
        });
      }
      break;
    }
    case 'if_then': {
      const cond = getStr(f, '%1', 'true');
      const child = getChild(instances, block);
      if (child) {
        const childBlocks = getStackBlocks(instances, child);
        const bodyCmds = compileCommands(instances, childBlocks);
        cmds.push({
          id: uid(),
          type: 'conditional',
          targetEntityId: null,
          params: {
            condition: cond,
            then: bodyCmds,
          },
          sourceBlockId: String(block.id),
          evolvableOverride: null,
        });
      }
      break;
    }
    case 'say': {
      const text = getStr(f, '%1', 'Hello!');
      cmds.push({
        id: uid(),
        type: 'emit_event',
        targetEntityId: 'player',
        params: { eventType: 'speech', payload: { text, style: 'say' } },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'think': {
      const text = getStr(f, '%1', 'Hmm...');
      cmds.push({
        id: uid(),
        type: 'emit_event',
        targetEntityId: 'player',
        params: { eventType: 'speech', payload: { text, style: 'think' } },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'show': {
      cmds.push({
        id: uid(),
        type: 'set_property',
        targetEntityId: 'player',
        params: { property: 'visible', value: true },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'hide': {
      cmds.push({
        id: uid(),
        type: 'set_property',
        targetEntityId: 'player',
        params: { property: 'visible', value: false },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'play_sound': {
      const sound = getStr(f, '%1', 'meow');
      cmds.push({
        id: uid(),
        type: 'emit_event',
        targetEntityId: null,
        params: { eventType: 'play_sound', payload: { sound } },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'stop_sound': {
      cmds.push({
        id: uid(),
        type: 'emit_event',
        targetEntityId: null,
        params: { eventType: 'stop_sound', payload: {} },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
    case 'play_drum': {
      const drum = getStr(f, '%1', 'snare');
      const beats = getNum(f, '%2', 0.25);
      cmds.push({
        id: uid(),
        type: 'emit_event',
        targetEntityId: null,
        params: { eventType: 'play_drum', payload: { drum, beats } },
        sourceBlockId: String(block.id),
        evolvableOverride: null,
      });
      break;
    }
  }

  return cmds;
}

// ─────────────────────────────────────────────
//  INITIAL SPRITE STATE
// ─────────────────────────────────────────────

function extractInitialSpriteState() {
  return {
    x: 240,
    y: 160,
    direction: 90,
    size: 100,
    visible: true,
  };
}

// ─────────────────────────────────────────────
//  LGSP MANIFEST GENERATION
// ─────────────────────────────────────────────

/**
 * Compile Block Studio instances into a full LGSP Block Manifest.
 * This is the wire format the Phaser game engine consumes on boot.
 *
 * @param {Array} instances - Block Studio instances
 * @param {Object} options
 * @param {string} options.gameId - Game identifier
 * @param {string} options.displayName - Human-readable game name
 * @param {Array} options.entities - Optional entity definitions for the game phases
 * @param {Array} options.species - Optional evolution species definitions
 * @returns {Object} LGSP-compatible JSON manifest
 */
export function compileToLgspManifest(instances, options = {}) {
  const {
    gameId = 'voxelcraft-game',
    displayName = 'Untitled Game',
    authorId = 'anon',
    entities = [],
    species = [],
  } = options;

  const roots = findRoots(instances);
  const compiled = compileBlockStacks(instances);

  // Build LGSP scripts array
  const lgspScripts = roots.map((root, idx) => {
    const blocks = getStackBlocks(instances, root);
    const firstBlock = blocks[0];
    const def = getBlockDef(firstBlock.def.id);
    const bodyBlocks = firstBlock.def.hat ? blocks.slice(1) : blocks;

    // Build BlockDefinition[] for LGSP
    const blockDefs = createLgspBlockDefs(instances, bodyBlocks);

    // Determine trigger
    let trigger = 'on_start';
    let triggerConfig;
    if (firstBlock.def.id === 'when_clicked') {
      trigger = 'on_event';
      triggerConfig = { eventType: 'stage_click' };
    }

    return {
      id: 'script_' + root.id,
      name: compiled.scripts[idx]?.name || 'script',
      trigger,
      triggerConfig,
      blocks: blockDefs,
      evolutionAnnotations: [],
    };
  });

  // Build basic phases if no entities provided
  const phases = entities.length > 0 ? entities : [{
    phaseId: 'default',
    name: 'Main',
    bounds: { width: 800, height: 600 },
    gravity: { x: 0, y: 900 },
    entities: [
      {
        id: 'player_sprite',
        type: 'player',
        name: 'Sprite',
        position: { x: 240, y: 160 },
        size: { width: 32, height: 32 },
        sprite: 'default',
        tags: ['player'],
        health: 3,
        maxHealth: 3,
      },
    ],
    collectibles: [],
    triggers: [],
  }];

  // Build the LGSP manifest
  const manifest = {
    protocol: LGSP_PROTOCOL,
    type: 'block_manifest',
    gameId,
    displayName,
    authorId,
    createdAt: new Date().toISOString(),
    version: 1,

    scriptCount: lgspScripts.length,
    scripts: lgspScripts,

    phases,
    compiledTimelines: compiled.scripts.map(s => ({
      id: s.id,
      trigger: s.trigger,
      timeline: s.timeline,
      durationMs: s.durationMs,
    })),

    // Evolution markers from species/evolution annotations
    evolutionMarkers: buildEvolutionMarkers(species),

    // Evolution config
    evolutionConfig: species.length > 0 ? {
      enabled: true,
      species: species.map(s => ({
        speciesId: s.speciesId,
        name: s.name,
        emoji: s.emoji || '🧬',
        role: s.role || 'generic',
        evolvableTraits: s.evolvableTraits || ['speed', 'aggression'],
        defaultTraits: s.defaultTraits || { speed: 1.0, aggression: 0.5 },
        fitnessFunction: s.fitnessFunction || 'hybrid',
        relevantMetrics: s.relevantMetrics || [],
      })),
      evolutionSpeed: {
        sessionsPerGen: 3,
        playSecondsPerGen: 120,
        minFitnessDelta: 5.0,
      },
    } : undefined,
  };

  return manifest;
}

/**
 * Convert a flat block list into LGSP BlockDefinition[].
 */
function createLgspBlockDefs(instances, blocks) {
  return blocks.map(block => {
    const def = getBlockDef(block.def.id);
    const args = def ? def.args : [];
    const params = {};
    const label = def ? buildBlockDesc(def, block.fields) : block.def.label;

    for (const arg of args) {
      const val = block.fields[arg.key] !== undefined ? block.fields[arg.key] : arg.def;
      let value;
      let type;

      if (arg.type === 'number') {
        type = 'number';
        value = parseFloat(val) || 0;
      } else if (arg.type === 'text') {
        type = 'string';
        value = String(val);
      } else if (arg.type === 'dropdown') {
        type = 'dropdown';
        value = String(val);
      } else {
        type = 'string';
        value = String(val);
      }

      params[arg.key] = { type, value };
    }

    return {
      blockType: block.def.id,
      blockId: String(block.id),
      label,
      params,
      children: [],
    };
  });
}

/**
 * Build evolution markers from species definitions.
 */
function buildEvolutionMarkers(species) {
  const markers = {};
  for (const s of species) {
    if (!s.mappedBlocks) continue;
    for (const mapping of s.mappedBlocks) {
      const markerId = mapping.blockId || `ev_${s.speciesId}_${mapping.property}`;
      if (!markers[markerId]) {
        markers[markerId] = {};
      }
      markers[markerId][mapping.property] = {
        speciesId: s.speciesId,
        trait: mapping.trait || mapping.property,
        range: mapping.range || [0.5, 2.0],
      };
    }
  }
  return markers;
}

// ─────────────────────────────────────────────
//  FITNESS FLUSH HELPER (LGSP Wire Format)
// ─────────────────────────────────────────────

/**
 * Create an LGSP fitness flush payload.
 *
 * @param {Object} options
 * @param {string} options.instanceId - Game instance ID
 * @param {number} options.generation - Current generation
 * @param {Array} options.events - FitnessEvent[]
 * @param {Object} options.sessionSummary - Session metrics
 * @returns {Object} LGSP Fitness Flush JSON
 */
export function createFitnessFlush(options = {}) {
  const {
    instanceId = 'unknown',
    generation = 0,
    events = [],
    flushNumber = 1,
    sessionSummary = {
      playCount: 1,
      totalPlayMs: 0,
      winRate: 0,
      avgScore: 0,
      totalDeaths: 0,
      firstPlayAt: Date.now(),
      lastPlayAt: Date.now(),
    },
  } = options;

  return {
    protocol: LGSP_PROTOCOL,
    type: 'fitness_flush',
    instanceId,
    generation,
    flushNumber,
    timestamp: Date.now(),
    sessionSummary,
    events,
    speciesSummaries: buildSpeciesSummaries(events),
  };
}

function buildSpeciesSummaries(events) {
  const summaries = {};
  for (const evt of events) {
    if (!summaries[evt.speciesId]) {
      summaries[evt.speciesId] = {
        speciesId: evt.speciesId,
        totalEvents: 0,
        positiveEvents: 0,
        negativeEvents: 0,
        avgFitnessDelta: 0,
        eventDistribution: {},
      };
    }
    const s = summaries[evt.speciesId];
    s.totalEvents++;
    if (evt.fitnessDelta > 0) s.positiveEvents++;
    else if (evt.fitnessDelta < 0) s.negativeEvents++;
    s.avgFitnessDelta = (s.avgFitnessDelta * (s.totalEvents - 1) + evt.fitnessDelta) / s.totalEvents;
    s.eventDistribution[evt.eventType] = (s.eventDistribution[evt.eventType] || 0) + 1;
  }
  return summaries;
}

/**
 * Create an LGSP evolution request payload.
 */
export function createEvolutionRequest(options = {}) {
  const {
    instanceId = 'unknown',
    sourceGeneration = 0,
    flushPool = [],
    config = {
      generations: 1,
      populationSlots: 6,
      cullThreshold: 0.3,
      mutationRate: 0.15,
      crossoverRate: 0.7,
    },
    currentDna = {},
  } = options;

  return {
    protocol: LGSP_PROTOCOL,
    type: 'evolution_request',
    instanceId,
    sourceGeneration,
    flushPool,
    config,
    currentDna,
  };
}

/**
 * Create an LGSP state snapshot.
 */
export function createStateSnapshot(options = {}) {
  const {
    instanceId = 'unknown',
    gameId = 'unknown',
    generation = 0,
    dnaPool = {},
    pendingFitness = [],
  } = options;

  return {
    protocol: LGSP_PROTOCOL,
    type: 'state_snapshot',
    instanceId,
    gameId,
    forkParent: null,
    timestamp: Date.now(),
    generation,
    dnaPool,
    pendingFitness,
    lastFlushedAt: null,
    generationHistory: [],
  };
}

// ─────────────────────────────────────────────
//  PHASER SCENE CONFIG BUILDER
// ─────────────────────────────────────────────

/**
 * Build a Phaser scene configuration from compiled block scripts.
 * Designed to be consumed by the GameScene in the Phaser game engine.
 *
 * @param {Object} compiledConfig - Output of compileBlockStacks()
 * @returns {Object} Phaser-compatible scene overrides & event bindings
 */
export function buildPhaserSceneConfig(compiledConfig) {
  if (!compiledConfig || !compiledConfig.scripts) {
    return { events: [], animations: [], uiOverrides: {} };
  }

  const events = [];
  const animations = [];
  const uiOverrides = {};

  for (const script of compiledConfig.scripts) {
    if (script.trigger === 'on_click') {
      events.push({
        trigger: 'pointerdown',
        on: 'stage',
        timeline: script.timeline,
        durationMs: script.durationMs,
      });
    } else if (script.trigger === 'on_start') {
      events.push({
        trigger: 'create',
        timeline: script.timeline,
        durationMs: script.durationMs,
      });
    } else if (script.trigger === 'on_key') {
      events.push({
        trigger: 'keydown',
        key: script.triggerConfig?.key || 'SPACE',
        timeline: script.timeline,
        durationMs: script.durationMs,
      });
    }
  }

  return {
    events,
    animations,
    uiOverrides: {
      playerSpeed: 200,
      jumpVelocity: -420,
      gravity: 900,
      sprite: compiledConfig.spriteState,
    },
  };
}

// ─────────────────────────────────────────────
//  NAMED EXPORTS
// ─────────────────────────────────────────────

export { BLOCK_DEFS, CATEGORY_COLORS };

// ─────────────────────────────────────────────
//  DEFAULT EXPORT
// ─────────────────────────────────────────────

export default {
  compileBlockStacks,
  compileToLgspManifest,
  compileCommands,
  compileBlockSequence,
  createFitnessFlush,
  createEvolutionRequest,
  createStateSnapshot,
  buildPhaserSceneConfig,
  BLOCK_DEFS,
  CATEGORY_COLORS,
};
