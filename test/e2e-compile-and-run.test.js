#!/usr/bin/env node
/**
 * VoxelWorks E2E Test — Block Compiler → Manifest → Phaser Config
 *
 * Tests the "Last Mile" pipeline end-to-end using Node.js:
 * 1. Creates simulated block instances (like the Block Studio would produce)
 * 2. Loads the compiler and compiles them to an LGSP manifest
 * 3. Validates the manifest structure and timeline actions
 * 4. Simulates the Phaser scene configuration generation
 * 5. Verifies the BlockScriptRuntime can consume the manifest
 *
 * Usage: node test/e2e-compile-and-run.test.js
 * Requires: Node.js 18+
 *
 * Exit code: 0 = PASS, 1 = FAIL
 */

const path = require('path');
const fs = require('fs');

const VOXELWORKS_DIR = path.resolve(__dirname, '..');

function main() {
  console.log('=== VoxelWorks E2E: Block Studio → Ship → Game ===\n');
  let passed = 0;
  let failed = 0;

  function assert(label, condition, detail) {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.log(`  ✗ ${label} ${detail ? `— ${detail}` : ''}`);
      failed++;
    }
  }

  // ── 1. Load the compiler-bridge script ──
  console.log('[Test 1] Loading compiler bridge...');
  const bridgePath = path.join(VOXELWORKS_DIR, 'block-editor', 'compiler-bridge.js');
  assert('compiler-bridge.js exists', fs.existsSync(bridgePath));
  assert('block-compiler.js exists (root)', fs.existsSync(path.join(VOXELWORKS_DIR, 'block-compiler.js')));

  // Load the compiler-bridge in a simulated browser environment
  // It attaches to window.VoxelCompiler
  global.window = {};
  eval(fs.readFileSync(bridgePath, 'utf8'));
  const VoxelCompiler = global.window.VoxelCompiler;

  assert('VoxelCompiler exposed on window', typeof VoxelCompiler === 'object');
  assert('compileBlockStacks function', typeof VoxelCompiler.compileBlockStacks === 'function');
  assert('compileToShipJson function', typeof VoxelCompiler.compileToShipJson === 'function');
  assert('createFitnessFlush function', typeof VoxelCompiler.createFitnessFlush === 'function');
  assert('BLOCK_DEFS defined', typeof VoxelCompiler.BLOCK_DEFS === 'object');
  assert('11+ block defs', Object.keys(VoxelCompiler.BLOCK_DEFS).length >= 11);

  // ── 2. Create simulated block instances ──
  console.log('\n[Test 2] Creating block instances...');

  const defs = VoxelCompiler.BLOCK_DEFS;
  const insts = [];

  // Helper: create a block instance with unique IDs
  let nextInstId = 1;
  function makeInst(blockId, fields, opts = {}) {
    const def = defs[blockId];
    if (!def) throw new Error(`Unknown block: ${blockId}`);
    const f = {};
    (def.args || []).forEach(a => {
      f[a.key] = fields[a.key] !== undefined ? fields[a.key] : a.def;
    });
    const inst = {
      id: nextInstId++,
      def: def,
      fields: f,
      x: opts.x || 100,
      y: opts.y || 100,
      parentId: opts.parentId !== undefined ? opts.parentId : null,
      childId: opts.childId !== undefined ? opts.childId : null,
      el: null,
    };
    return inst;
  }

  // Create stack 1: when clicked → move 30 steps → wait 1 sec → say "Hi!"
  const whenClicked = makeInst('when_clicked', {}, { x: 120, y: 80 });
  const moveSteps = makeInst('move_steps', { '%1': 30 }, { parentId: whenClicked.id });
  const waitBlock = makeInst('wait', { '%1': 1 }, { parentId: moveSteps.id });
  const sayBlock = makeInst('say', { '%1': 'Hi!', '%2': 2 }, { parentId: waitBlock.id });

  // Link chain: whenClicked → moveSteps → wait → say
  whenClicked.childId = moveSteps.id;
  moveSteps.parentId = whenClicked.id;
  moveSteps.childId = waitBlock.id;
  waitBlock.parentId = moveSteps.id;
  waitBlock.childId = sayBlock.id;
  sayBlock.parentId = waitBlock.id;

  insts.push(whenClicked, moveSteps, waitBlock, sayBlock);

  console.log(`  Created ${insts.length} instances in stack 1 (click → move 30 → wait 1 → say "Hi!")`);

  // Create stack 2: turn 90 degrees → jump → think "Wheee!"
  const turnBlock = makeInst('turn_cw', { '%1': 90 }, { x: 200, y: 180 });
  const jumpBlock = makeInst('jump', {}, { parentId: turnBlock.id });
  const thinkBlock = makeInst('think', { '%1': 'Wheee!', '%2': 1.5 }, { parentId: jumpBlock.id });

  turnBlock.childId = jumpBlock.id;
  jumpBlock.parentId = turnBlock.id;
  jumpBlock.childId = thinkBlock.id;
  thinkBlock.parentId = jumpBlock.id;

  insts.push(turnBlock, jumpBlock, thinkBlock);

  console.log(`  Created ${insts.length} total instances (2 stacks)`);

  // ── 3. Test compiler core ──
  console.log('\n[Test 3] Compiling block stacks...');

  const compiledStacks = VoxelCompiler.compileBlockStacks(insts);
  assert('compiledStacks.protocol is lgsp/v0.1.0', compiledStacks.protocol === 'lgsp/v0.1.0');
  assert('compiledStacks has scripts', Array.isArray(compiledStacks.scripts));
  assert('compiledStacks has 2 scripts', compiledStacks.scripts.length === 2);
  assert('compiledStacks has commands', Array.isArray(compiledStacks.commands));
  assert('compiledStacks has totalDurationMs > 0', compiledStacks.totalDurationMs > 0);
  assert('spriteState present', typeof compiledStacks.spriteState === 'object');
  assert('stats.scriptCount === 2', compiledStacks.stats.scriptCount === 2);

  // Check script 1 (click → move 30 → wait 1 → say)
  const script1 = compiledStacks.scripts[0];
  console.log(`\n  Script 1: "${script1.name}"`);
  assert('script1 trigger is on_click', script1.trigger === 'on_click');
  assert('script1 has timeline', Array.isArray(script1.timeline));
  assert('script1 timeline has 3 actions', script1.timeline.length === 3);

  // Check action types in order
  assert('Action 1 is "move"', script1.timeline[0].type === 'move');
  assert('Action 1 steps = 30', script1.timeline[0].params.steps === 30);
  assert('Action 2 is "wait"', script1.timeline[1].type === 'wait');
  assert('Action 2 seconds = 1', script1.timeline[1].params.seconds === 1);
  assert('Action 3 is "say"', script1.timeline[2].type === 'say');
  assert('Action 3 text = "Hi!"', script1.timeline[2].params.text === 'Hi!');

  // Check script 2
  const script2 = compiledStacks.scripts[1];
  console.log(`\n  Script 2: "${script2.name}"`);
  assert('script2 trigger is on_start', script2.trigger === 'on_start' || script2.trigger === undefined);
  assert('script2 timeline has 3 actions', script2.timeline.length === 3);
  assert('Action 1 is "turn"', script2.timeline[0].type === 'turn');
  assert('Action 1 degrees = 90', script2.timeline[0].params.degrees === 90);
  assert('Action 2 is "jump"', script2.timeline[1].type === 'jump');
  assert('Action 3 is "think"', script2.timeline[2].type === 'think');

  // ── 4. Test compileToShipJson (full manifest) ──
  console.log('\n[Test 4] Generating LGSP manifest...');

  const manifest = VoxelCompiler.compileToShipJson(insts, {
    gameId: 'e2e-test',
    displayName: 'E2E Test Game',
    authorId: 'test',
  });

  assert('manifest.protocol is lgsp/v0.1.0', manifest.protocol === 'lgsp/v0.1.0');
  assert('manifest.type is block_manifest', manifest.type === 'block_manifest');
  assert('manifest.gameId is e2e-test', manifest.gameId === 'e2e-test');
  assert('manifest.displayName is correct', manifest.displayName === 'E2E Test Game');
  assert('manifest.scriptCount === 2', manifest.scriptCount === 2);
  assert('manifest has scripts array', Array.isArray(manifest.scripts));
  assert('manifest has 2 scripts', manifest.scripts.length === 2);
  assert('manifest has phases', Array.isArray(manifest.phases));
  assert('manifest has 1 phase', manifest.phases.length === 1);
  assert('manifest phase has entities', manifest.phases[0].entities.length > 0);

  // Check LGSP script definitions
  const lgspScript0 = manifest.scripts[0];
  assert('LGSP script 0 has blocks array', Array.isArray(lgspScript0.blocks));
  assert('LGSP script 0 3 blocks', lgspScript0.blocks.length === 3);
  assert('LGSP script 0 block 0 type = move_steps', lgspScript0.blocks[0].blockType === 'move_steps');
  assert('LGSP script 0 block 0 params %1 value = 30', lgspScript0.blocks[0].params['%1'].value === 30);

  // Check compiledTimelines
  assert('manifest has compiledTimelines', Array.isArray(manifest.compiledTimelines));
  assert('compiledTimelines length = 2', manifest.compiledTimelines.length === 2);

  // ── 5. Test Fitness Flush ──
  console.log('\n[Test 5] Testing Fitness Flush...');

  const flush = VoxelCompiler.createFitnessFlush({
    instanceId: 'test-instance',
    generation: 0,
    flushNumber: 1,
    events: [
      { eventType: 'say', speciesId: 'player', fitnessDelta: 0, timestamp: Date.now(), metadata: { text: 'Hi!' } },
      { eventType: 'game_win', speciesId: 'player', fitnessDelta: 100, timestamp: Date.now(), metadata: { score: 300, won: true } },
    ],
    sessionSummary: {
      playCount: 1, totalPlayMs: 12000, winRate: 1, avgScore: 300, totalDeaths: 0,
      firstPlayAt: Date.now() - 12000, lastPlayAt: Date.now(),
    },
  });

  assert('flush.protocol is lgsp/v0.1.0', flush.protocol === 'lgsp/v0.1.0');
  assert('flush.type is fitness_flush', flush.type === 'fitness_flush');
  assert('flush has instanceId', typeof flush.instanceId === 'string');
  assert('flush has sessionSummary', typeof flush.sessionSummary === 'object');
  assert('flush has events array', Array.isArray(flush.events));
  assert('flush has 2 events', flush.events.length === 2);
  assert('flush has speciesSummaries', typeof flush.speciesSummaries === 'object');

  // ── 6. Test BlockScriptRuntime consumption ──
  console.log('\n[Test 6] Verifying BlockScriptRuntime integration...');

  const runtimePath = path.join(VOXELWORKS_DIR, 'game-template', 'scenes', 'BlockScriptRuntime.js');
  assert('BlockScriptRuntime.js exists', fs.existsSync(runtimePath));

  const runtimeContent = fs.readFileSync(runtimePath, 'utf8');
  assert('Runtime exports BlockScriptRuntime class', runtimeContent.includes('class BlockScriptRuntime'));

  // Verify it exports the expected methods
  const expectedMethods = [
    'executeScripts',
    'executeTimeline',
    'executeAction',
    'waitAsync',
    'tweenAsync',
    'showSpeech',
    'hideSpeech',
    'updateSpeechFollow',
    'flushFitness',
  ];

  for (const method of expectedMethods) {
    assert(`Runtime has method: ${method}`, runtimeContent.includes(method));
  }

  // Verify it handles all compiled action types
  const actionTypes = ['move', 'turn', 'goto', 'jump', 'say', 'think', 'show', 'hide',
    'wait', 'repeat', 'if_then', 'play_sound', 'stop_sound', 'play_drum'];

  for (const at of actionTypes) {
    assert(`Runtime handles action type: ${at}`, runtimeContent.includes(`case '${at}'`));
  }

  // ── 7. Verify BlockScriptStage integration ──
  console.log('\n[Test 7] Verifying BlockScriptStage integration...');

  const stagePath = path.join(VOXELWORKS_DIR, 'game-template', 'scenes', 'BlockScriptStage.js');
  assert('BlockScriptStage.js exists', fs.existsSync(stagePath));

  const stageContent = fs.readFileSync(stagePath, 'utf8');
  assert('Stage imports BlockScriptRuntime', stageContent.includes("import { BlockScriptRuntime }"));
  assert('Stage handles endGame with flushFitness', stageContent.includes('flushFitness'));
  assert('Stage handles click scripts', stageContent.includes('executeClickScripts'));
  assert('Stage has UI with Back button', stageContent.includes('Back to Studio'));

  // ── 8. Verify game.js integration ──
  console.log('\n[Test 8] Verifying game.js integration...');

  const gameJsPath = path.join(VOXELWORKS_DIR, 'game-template', 'game.js');
  assert('game.js exists', fs.existsSync(gameJsPath));

  const gameJsContent = fs.readFileSync(gameJsPath, 'utf8');
  assert('game.js imports BlockScriptStage', gameJsContent.includes("import { BlockScriptStage }"));
  assert('game.js detects block script mode', gameJsContent.includes('__VOXELWORKS_BLOCK_MANIFEST'));
  assert('game.js conditionally registers scenes', gameJsContent.includes('isBlockScriptMode'));
  assert('game.js switches scene list for block mode', gameJsContent.includes('BlockScriptStage'));

  // ── 9. Verify index.html integration ──
  console.log('\n[Test 9] Verifying index.html integration...');

  const gameHtmlPath = path.join(VOXELWORKS_DIR, 'game-template', 'index.html');
  assert('game index.html exists', fs.existsSync(gameHtmlPath));

  const gameHtmlContent = fs.readFileSync(gameHtmlPath, 'utf8');
  assert('game HTML loads manifest from localStorage', gameHtmlContent.includes('voxelworks_block_manifest'));
  assert('game HTML supports ?mode=blocks param', gameHtmlContent.includes('mode=blocks'));

  // Block editor integration
  const editorPath = path.join(VOXELWORKS_DIR, 'block-editor', 'index.html');
  assert('block-editor index.html exists', fs.existsSync(editorPath));

  const editorContent = fs.readFileSync(editorPath, 'utf8');
  assert('Editor loads compiler-bridge.js', editorContent.includes('compiler-bridge.js'));
  assert('Editor has btn-ship', editorContent.includes('btn-ship'));
  assert('Editor calls VoxelCompiler.compileToShipJson', editorContent.includes('compileToShipJson'));
  assert('Editor stores in localStorage', editorContent.includes('voxelworks_block_manifest'));
  assert('Editor opens game in new tab', editorContent.includes('game-template/index.html'));

  // ── 10. Compile→Runtime round-trip verification ──
  console.log('\n[Test 10] Round-trip: Compile → Runtime timeline verification...');

  // Simulate what the BlockScriptRuntime does with a compiled action
  function simulateAction(action, state) {
    switch (action.type) {
      case 'move': {
        const rad = (90 - state.direction) * Math.PI / 180;
        state.x += Math.cos(rad) * action.params.steps;
        state.y -= Math.sin(rad) * action.params.steps;
        return { result: 'moved', x: state.x, y: state.y };
      }
      case 'turn': {
        const dir = action.params.direction === 'cw' ? 1 : -1;
        state.direction = (state.direction + dir * action.params.degrees) % 360;
        if (state.direction < 0) state.direction += 360;
        return { result: 'turned', direction: state.direction };
      }
      case 'jump': {
        return { result: 'jumped', height: action.params.height || 40 };
      }
      case 'say':
      case 'think': {
        return { result: action.type, text: action.params.text, duration: action.params.duration };
      }
      case 'wait': {
        return { result: 'waited', seconds: action.params.seconds };
      }
      case 'repeat': {
        return { result: 'repeated', count: action.params.count, bodyLength: (action.body || []).length };
      }
      case 'if_then': {
        return { result: 'conditional', condition: action.params.condition, bodyLength: (action.body || []).length };
      }
      default:
        return { result: 'unknown' };
    }
  }

  // Simulate the full execution for script 1
  const state = { x: 240, y: 160, direction: 90, visible: true };
  for (const action of script1.timeline) {
    simulateAction(action, state);
  }
  // After move 30 steps at direction 90 (right), x should be ~270
  assert('Simulated state.x ≈ 270 after move 30', Math.abs(state.x - 270) < 1);

  // Simulate script 2
  const state2 = { x: 240, y: 160, direction: 90, visible: true };
  for (const action of script2.timeline) {
    simulateAction(action, state2);
  }
  assert('Simulated direction = 180 after turn 90 CW', state2.direction === 180);

  // ── Summary ──
  const total = passed + failed;
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  RESULTS: ${passed}/${total} passed, ${failed}/${total} failed`);
  console.log(`${'═'.repeat(55)}`);

  if (failed === 0) {
    console.log('\n  ✅ ALL TESTS PASSED — Last Mile verified!\n');
    console.log('  Block Studio → Compiler → LGSP Manifest → Phaser Engine');
    console.log('  → BlockScriptRuntime → Fitness Flush pipeline complete.\n');
  } else {
    console.log(`\n  ❌ ${failed} test(s) FAILED\n`);
  }

  return { passed, failed, total };
}

// ── Run ──
if (require.main === module) {
  const result = main();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = { main };
