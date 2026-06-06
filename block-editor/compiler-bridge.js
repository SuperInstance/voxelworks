/**
 * VoxelWorks — Block Compiler Bridge
 * Browser-compatible wrapper around block-compiler.js
 * Loads the ES module and exposes compile functions on window.VoxelCompiler.
 */
(function(){
  'use strict';

  // ─────────────────────────────────────────────
  //  Inline block definitions (mirrors block-compiler.js)
  //  Avoids needing to parse the ES module in a non-module context.
  // ─────────────────────────────────────────────

  const CATEGORY_COLORS = {
    motion: '#4C97FF',
    looks: '#9966FF',
    control: '#FFAB19',
    sound: '#CF63CF',
    sensing: '#5CB1D6',
  };

  const BLOCK_DEFS = {
    // ─── Motion ───
    move_steps: { id: "move_steps", category: "motion", label: "move %1 steps", args: [{ key:"%1", type:"number", def:10 }] },
    turn_cw:    { id: "turn_cw", category: "motion", label: "turn ↻ %1 degrees", args: [{ key:"%1", type:"number", def:15 }] },
    turn_ccw:   { id: "turn_ccw", category: "motion", label: "turn ↺ %1 degrees", args: [{ key:"%1", type:"number", def:15 }] },
    goto_xy:    { id: "goto_xy", category: "motion", label: "go to x:%1 y:%2", args: [{ key:"%1", type:"number", def:0 },{ key:"%2", type:"number", def:0 }] },
    jump:       { id: "jump", category: "motion", label: "jump", args: [] },

    // ─── Looks ───
    say:   { id: "say", category: "looks", label: "say %1 for %2 secs", args: [{ key:"%1", type:"text", def:"Hello!" },{ key:"%2", type:"number", def:2 }] },
    think: { id: "think", category: "looks", label: "think %1 for %2 secs", args: [{ key:"%1", type:"text", def:"Hmm..." },{ key:"%2", type:"number", def:2 }] },
    show:  { id: "show", category: "looks", label: "show", args: [] },
    hide:  { id: "hide", category: "looks", label: "hide", args: [] },

    // ─── Control ───
    when_clicked: { id: "when_clicked", category: "control", label: "when clicked", args: [], hat: true },
    if_then:      { id: "if_then", category: "control", label: "if %1 then", args: [{ key:"%1", type:"dropdown", def:"true", opts:[{l:"true",v:"true"},{l:"false",v:"false"},{l:"touching edge",v:"edge"},{l:"touching color",v:"color"}] }] },
    repeat:       { id: "repeat", category: "control", label: "repeat %1", args: [{ key:"%1", type:"number", def:10 }] },
    wait:         { id: "wait", category: "control", label: "wait %1 secs", args: [{ key:"%1", type:"number", def:1 }] },

    // ─── Sound ───
    play_sound: { id: "play_sound", category: "sound", label: "play sound %1", args: [{ key:"%1", type:"dropdown", def:"meow", opts:[{l:"meow",v:"meow"},{l:"chirp",v:"chirp"},{l:"buzz",v:"buzz"},{l:"pop",v:"pop"}] }] },
    stop_sound: { id: "stop_sound", category: "sound", label: "stop all sounds", args: [] },
    play_drum:  { id: "play_drum", category: "sound", label: "play drum %1 for %2 beats", args: [{ key:"%1", type:"dropdown", def:"snare", opts:[{l:"snare",v:"snare"},{l:"kick",v:"kick"},{l:"hi-hat",v:"hihat"},{l:"cymbal",v:"cymbal"}] },{ key:"%2", type:"number", def:0.25 }] },
};//  HELPERS (mirrors block-compiler.js)
  // ─────────────────────────────────────────────

  function getBlockDef(id) { return BLOCK_DEFS[id] || null; }

  function findInst(instances, id) { return instances.find(i => i.id === id) || null; }

  function getChild(instances, inst) { return inst.childId !== null ? findInst(instances, inst.childId) : null; }

  function getParent(instances, inst) { return inst.parentId !== null ? findInst(instances, inst.parentId) : null; }

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

  function getStackBlocks(instances, root) {
    const arr = [];
    const visited = new Set();
    let cur = root;
    while (cur) {
      if (visited.has(cur.id)) { console.error('[CompilerBridge] Cycle detected'); break; }
      visited.add(cur.id);
      arr.push(cur);
      cur = getChild(instances, cur);
    }
    return arr;
  }

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

  function uid() { return 'cmd_' + Math.random().toString(36).substring(2, 10); }

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

  // ─────────────────────────────────────────────
  //  COMPILER CORE
  // ─────────────────────────────────────────────

  function compileBlockStacks(instances) {
    const roots = instances.filter(i => i.parentId === null);
    const scripts = [];
    const commands = [];
    let totalDurationMs = 0;

    for (const root of roots) {
      const blocks = getStackBlocks(instances, root);
      const firstBlock = blocks[0];
      const def = getBlockDef(firstBlock.def.id);
      if (!def) continue;

      let trigger = 'on_start';
      if (firstBlock.def.id === 'when_clicked') trigger = 'on_click';

      const bodyBlocks = firstBlock.def.hat ? blocks.slice(1) : blocks;
      const scriptLabel = def ? buildBlockDesc(def, firstBlock.fields) : (firstBlock.def.label || 'script');
      const timeline = compileBlockSequence(instances, bodyBlocks);

      scripts.push({
        id: 'script_' + root.id,
        name: scriptLabel,
        trigger,
        timeline,
        durationMs: estimateDuration(bodyBlocks),
      });
      commands.push(...compileCommands(instances, bodyBlocks));
      totalDurationMs += estimateDuration(bodyBlocks);
    }

    return {
      protocol: 'lgsp/v0.1.0',
      version: '0.1.0',
      compiledAt: Date.now(),
      scripts,
      commands,
      totalDurationMs,
      spriteState: { x: 240, y: 160, direction: 90, size: 100, visible: true },
      stats: { scriptCount: scripts.length, commandCount: commands.length },
    };
  }

  function compileBlockSequence(instances, blocks) {
    const timeline = [];
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      const actions = compileSingleBlock(instances, block, blocks, i);
      timeline.push(...actions);
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

  function compileSingleBlock(instances, block, allBlocks, index) {
    const id = block.def.id;
    const f = block.fields;
    const def = getBlockDef(id);
    const label = def ? buildBlockDesc(def, f) : id;
    const actions = [];

    switch (id) {
      case 'move_steps': {
        const steps = getNum(f, '%1', 10);
        actions.push({ type:'move', label, params:{steps,direction:'current'}, durationMs:200,
          phaserAction:{ type:'tween',targets:'sprite',props:{},duration:200,ease:'Sine.easeInOut' } });
        break;
      }
      case 'turn_cw': {
        const deg = getNum(f, '%1', 15);
        actions.push({ type:'turn', label, params:{degrees:deg,direction:'cw'}, durationMs:150,
          phaserAction:{ type:'tween',targets:'sprite',props:{angle:`+=${deg}`},duration:150,ease:'Sine.easeInOut' } });
        break;
      }
      case 'turn_ccw': {
        const deg = getNum(f, '%1', 15);
        actions.push({ type:'turn', label, params:{degrees:deg,direction:'ccw'}, durationMs:150,
          phaserAction:{ type:'tween',targets:'sprite',props:{angle:`-=${deg}`},duration:150,ease:'Sine.easeInOut' } });
        break;
      }
      case 'goto_xy': {
        const x = getNum(f, '%1', 0);
        const y = getNum(f, '%2', 0);
        actions.push({ type:'goto', label, params:{x,y}, durationMs:100,
          phaserAction:{ type:'tween',targets:'sprite',props:{x,y},duration:100,ease:'Power1' } });
        break;
      }
      case 'jump': {
        actions.push({ type:'jump', label, params:{height:40}, durationMs:300,
          phaserAction:{ type:'timeline', sequence:[
            {type:'tween',targets:'sprite',props:{y:'-=40'},duration:150,ease:'Sine.easeOut'},
            {type:'tween',targets:'sprite',props:{y:'+=40'},duration:150,ease:'Bounce.easeOut'}
          ]} });
        break;
      }
      case 'say': {
        const text = getStr(f, '%1', 'Hello!');
        const secs = getNum(f, '%2', 2);
        actions.push({ type:'say', label, params:{text,duration:secs}, durationMs:secs*1000,
          phaserAction:{ type:'speech', text, style:'say', durationMs:secs*1000 } });
        break;
      }
      case 'think': {
        const text = getStr(f, '%1', 'Hmm...');
        const secs = getNum(f, '%2', 2);
        actions.push({ type:'think', label, params:{text,duration:secs}, durationMs:secs*1000,
          phaserAction:{ type:'speech', text, style:'think', durationMs:secs*1000 } });
        break;
      }
      case 'show': {
        actions.push({ type:'show', label, params:{}, durationMs:0,
          phaserAction:{ type:'visibility', visible:true } });
        break;
      }
      case 'hide': {
        actions.push({ type:'hide', label, params:{}, durationMs:0,
          phaserAction:{ type:'visibility', visible:false } });
        break;
      }
      case 'when_clicked': break;
      case 'wait': {
        const secs = getNum(f, '%1', 1);
        actions.push({ type:'wait', label, params:{seconds:secs}, durationMs:secs*1000,
          phaserAction:{ type:'delay', durationMs:secs*1000 } });
        break;
      }
      case 'repeat': {
        const n = Math.max(0, parseInt(getNum(f, '%1', 10)));
        const child = getChild(instances, block);
        if (child && n > 0) {
          const childBlocks = getStackBlocks(instances, child);
          const childActions = compileBlockSequence(instances, childBlocks);
          const bodyDuration = estimateDuration(childBlocks);
          actions.push({ type:'repeat', label, params:{count:n}, body:childActions, durationMs:bodyDuration*n,
            phaserAction:{ type:'loop', count:n, body:childActions.map(a=>a.phaserAction) } });
        }
        break;
      }
      case 'if_then': {
        const cond = getStr(f, '%1', 'true');
        const child = getChild(instances, block);
        if (child) {
          const childBlocks = getStackBlocks(instances, child);
          const childActions = compileBlockSequence(instances, childBlocks);
          actions.push({ type:'if_then', label, params:{condition:cond}, body:childActions, durationMs:estimateDuration(childBlocks),
            phaserAction:{ type:'conditional', condition:cond, body:childActions.map(a=>a.phaserAction) } });
        }
        break;
      }
      case 'play_sound': {
        const sound = getStr(f, '%1', 'meow');
        actions.push({ type:'play_sound', label, params:{sound}, durationMs:300,
          phaserAction:{ type:'audio', sound, action:'play' } });
        break;
      }
      case 'stop_sound': {
        actions.push({ type:'stop_sound', label, params:{}, durationMs:0,
          phaserAction:{ type:'audio', action:'stop_all' } });
        break;
      }
      case 'play_drum': {
        const drum = getStr(f, '%1', 'snare');
        const beats = getNum(f, '%2', 0.25);
        actions.push({ type:'play_drum', label, params:{drum,beats}, durationMs:beats*500,
          phaserAction:{ type:'audio', sound:drum, action:'play_drum', durationBeats:beats } });
        break;
      }
    }
    return actions;
  }

  function estimateDuration(blocks) {
    let total = 0;
    for (const block of blocks) {
      const def = getBlockDef(block.def.id);
      if (!def) continue;
      switch (block.def.id) {
        case 'move_steps': case 'turn_cw': case 'turn_ccw': total += 200; break;
        case 'goto_xy': total += 100; break;
        case 'jump': total += 300; break;
        case 'say': case 'think': total += (getNum(block.fields, '%2', 2)) * 1000; break;
        case 'show': case 'hide': break;
        case 'wait': total += (getNum(block.fields, '%1', 1)) * 1000; break;
        case 'repeat': {
          const n = parseInt(getNum(block.fields, '%1', 10));
          const child = getChild(blocks, block);
          if (child) total += estimateDuration(getStackBlocks(blocks, child)) * n;
          break;
        }
        case 'if_then': {
          const child = getChild(blocks, block);
          if (child) total += estimateDuration(getStackBlocks(blocks, child));
          break;
        }
        case 'play_sound': total += 300; break;
        case 'play_drum': total += (getNum(block.fields, '%2', 0.25)) * 500; break;
      }
    }
    return total;
  }

  function compileCommands(instances, blocks) {
    const cmds = [];
    for (const block of blocks) {
      cmds.push(...compileBlockToCommand(instances, block));
    }
    return cmds;
  }

  function compileBlockToCommand(instances, block) {
    const id = block.def.id;
    const f = block.fields;
    const cmds = [];
    switch (id) {
      case 'move_steps':
        cmds.push({ id:uid(), type:'move', targetEntityId:'player', params:{direction:'current',speed:getNum(f,'%1',10)*2}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'turn_cw':
        cmds.push({ id:uid(), type:'set_property', targetEntityId:'player', params:{property:'rotation',value:'+='+getNum(f,'%1',15)}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'turn_ccw':
        cmds.push({ id:uid(), type:'set_property', targetEntityId:'player', params:{property:'rotation',value:'-='+getNum(f,'%1',15)}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'goto_xy':
        cmds.push({ id:uid(), type:'teleport', targetEntityId:'player', params:{position:{x:getNum(f,'%1',0),y:getNum(f,'%2',0)}}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'jump':
        cmds.push({ id:uid(), type:'jump', targetEntityId:'player', params:{force:300,direction:'up'}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'wait':
        cmds.push({ id:uid(), type:'wait', targetEntityId:null, params:{ticks:Math.round(getNum(f,'%1',1)*60)}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'repeat': {
        const n = Math.max(0, parseInt(getNum(f,'%1',10)));
        const child = getChild(instances, block);
        if (child && n > 0) {
          cmds.push({ id:uid(), type:'loop', targetEntityId:null, params:{count:n,body:compileCommands(instances,getStackBlocks(instances,child))}, sourceBlockId:String(block.id), evolvableOverride:null });
        }
        break;
      }
      case 'if_then': {
        const cond = getStr(f, '%1', 'true');
        const child = getChild(instances, block);
        if (child) {
          cmds.push({ id:uid(), type:'conditional', targetEntityId:null, params:{condition:cond,then:compileCommands(instances,getStackBlocks(instances,child))}, sourceBlockId:String(block.id), evolvableOverride:null });
        }
        break;
      }
      case 'say': case 'think': {
        const text = getStr(f, '%1', 'Hello!');
        const style = id === 'think' ? 'think' : 'say';
        cmds.push({ id:uid(), type:'emit_event', targetEntityId:'player', params:{eventType:'speech',payload:{text,style}}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      }
      case 'show': cmds.push({ id:uid(), type:'set_property', targetEntityId:'player', params:{property:'visible',value:true}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'hide': cmds.push({ id:uid(), type:'set_property', targetEntityId:'player', params:{property:'visible',value:false}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'play_sound': cmds.push({ id:uid(), type:'emit_event', targetEntityId:null, params:{eventType:'play_sound',payload:{sound:getStr(f,'%1','meow')}}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'stop_sound': cmds.push({ id:uid(), type:'emit_event', targetEntityId:null, params:{eventType:'stop_sound',payload:{}}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
      case 'play_drum': cmds.push({ id:uid(), type:'emit_event', targetEntityId:null, params:{eventType:'play_drum',payload:{drum:getStr(f,'%1','snare'),beats:getNum(f,'%2',0.25)}}, sourceBlockId:String(block.id), evolvableOverride:null }); break;
    }
    return cmds;
  }

  // ─────────────────────────────────────────────
  //  LGSP FITNESS FLUSH
  // ─────────────────────────────────────────────

  function createFitnessFlush(options = {}) {
    const {
      instanceId = 'unknown',
      generation = 0,
      events = [],
      flushNumber = 1,
      sessionSummary = {
        playCount: 1, totalPlayMs: 0, winRate: 0, avgScore: 0, totalDeaths: 0,
        firstPlayAt: Date.now(), lastPlayAt: Date.now(),
      },
    } = options;

    return {
      protocol: 'lgsp/v0.1.0',
      type: 'fitness_flush',
      instanceId, generation, flushNumber,
      timestamp: Date.now(),
      sessionSummary, events,
      speciesSummaries: {},
    };
  }

  // ─────────────────────────────────────────────
  //  TOP-LEVEL API — Compile instances array to JSON
  // ─────────────────────────────────────────────

  function compileToShipJson(instances, options = {}) {
    const {
      gameId = 'voxelcraft-game',
      displayName = 'My Block Game',
      authorId = 'anon',
    } = options;

    const compiled = compileBlockStacks(instances);

    // Build scripts array for LGSP game manifest
    const roots = instances.filter(i => i.parentId === null);
    const lgspScripts = roots.map((root, idx) => {
      const blocks = getStackBlocks(instances, root);
      const firstBlock = blocks[0];
      const def = getBlockDef(firstBlock.def.id);
      const bodyBlocks = firstBlock.def.hat ? blocks.slice(1) : blocks;

      const blockDefs = bodyBlocks.map(block => {
        const bdef = getBlockDef(block.def.id);
        const params = {};
        (bdef ? bdef.args : []).forEach(a => {
          const val = block.fields[a.key] !== undefined ? block.fields[a.key] : a.def;
          if (a.type === 'number') params[a.key] = { type:'number', value:parseFloat(val)||0 };
          else if (a.type === 'text') params[a.key] = { type:'string', value:String(val) };
          else if (a.type === 'dropdown') params[a.key] = { type:'dropdown', value:String(val) };
        });
        return {
          blockType: block.def.id,
          blockId: String(block.id),
          label: bdef ? buildBlockDesc(bdef, block.fields) : block.def.label,
          params,
          children: [],
        };
      });

      const trigger = firstBlock.def.id === 'when_clicked' ? 'on_event' : 'on_start';
      const triggerConfig = firstBlock.def.id === 'when_clicked' ? { eventType:'stage_click' } : undefined;

      return {
        id: 'script_' + root.id,
        name: compiled.scripts[idx]?.name || 'script',
        trigger, triggerConfig, blocks: blockDefs,
        evolutionAnnotations: [],
      };
    });

    return {
      protocol: 'lgsp/v0.1.0',
      type: 'block_manifest',
      gameId, displayName, authorId,
      createdAt: new Date().toISOString(),
      version: 1,
      scriptCount: lgspScripts.length,
      scripts: lgspScripts,
      phases: [{
        phaseId: 'default', name: 'Main',
        bounds: { width: 800, height: 600 },
        gravity: { x: 0, y: 900 },
        entities: [{
          id: 'player_sprite', type: 'player', name: 'Sprite',
          position: { x: 240, y: 160 },
          size: { width: 32, height: 32 },
          sprite: 'default', tags: ['player'],
          health: 3, maxHealth: 3,
        }],
        collectibles: [], triggers: [],
      }],
      compiledTimelines: compiled.scripts.map(s => ({
        id: s.id, trigger: s.trigger,
        timeline: s.timeline, durationMs: s.durationMs,
      })),
      spriteState: compiled.spriteState,
      stats: compiled.stats,
    };
  }

  // ─────────────────────────────────────────────
  //  EXPORT
  // ─────────────────────────────────────────────

  window.VoxelCompiler = {
    compileBlockStacks,
    compileToShipJson,
    createFitnessFlush,
    compileCommands,
    BLOCK_DEFS,
    CATEGORY_COLORS,
    compileBlockSequence,
    compileSingleBlock,
    getBlockDef,
    findInst,
    getChild,
    getParent,
    getRoot,
    getStackBlocks,
    estimateDuration,
  };

  console.log('[VoxelCompiler] Bridge loaded.');
})();
