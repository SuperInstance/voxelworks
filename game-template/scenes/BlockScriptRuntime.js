/**
 * BlockScriptRuntime — Executes compiled block timelines on Phaser sprites.
 * Consumed by GameScene when a block_script manifest is loaded.
 *
 * LGSP Fitness Flush: At game end (win/lose), sends a fitness flush payload.
 * In the browser, this writes to localStorage for the block-editor to pick up.
 * In production, this would POST to a Nebula endpoint.
 */
export class BlockScriptRuntime {
  /**
   * @param {Phaser.Scene} scene - The GameScene instance
   * @param {Object} manifest - Compiled block manifest (from VoxelCompiler.compileToShipJson)
   */
  constructor(scene, manifest) {
    this.scene = scene;
    this.manifest = manifest;
    this.isRunning = false;
    this.isAborted = false;
    this.currentTimelines = []; // currently running Phaser timelines
    this.speechBubble = null;
    this.speechBubbleBg = null;
    this._startTime = 0;
    this._fitnessEvents = [];
    this._sessionStartTime = Date.now();

    console.log('[BlockScriptRuntime] Initialized with manifest:', manifest?.displayName || 'Untitled');
  }

  /**
   * Check if the scene has a block script manifest loaded.
   */
  hasScripts() {
    return this.manifest && this.manifest.scripts && this.manifest.scripts.length > 0;
  }

  /**
   * Get all scripts for a given trigger type.
   * @param {string} triggerType - 'on_start' | 'on_event' | 'on_key'
   * @param {string} [eventType] - For on_event, e.g. 'stage_click'
   * @returns {Array} Matching scripts
   */
  getScriptsByTrigger(triggerType, eventType) {
    if (!this.manifest) return [];
    return this.manifest.scripts.filter(s => {
      if (s.trigger !== triggerType) return false;
      if (triggerType === 'on_event' && eventType) {
        return s.triggerConfig?.eventType === eventType;
      }
      if (triggerType === 'on_key' && eventType) {
        return s.triggerConfig?.key === eventType;
      }
      return true;
    });
  }

  /**
   * Execute all 'on_start' scripts.
   * Returns a promise that resolves when all scripts complete.
   */
  async executeStartScripts() {
    const scripts = this.getScriptsByTrigger('on_start');
    if (scripts.length === 0) return;
    console.log('[BlockScriptRuntime] Executing', scripts.length, 'start script(s)');
    await this.executeScripts(scripts);
  }

  /**
   * Execute scripts triggered by a stage click.
   */
  async executeClickScripts() {
    const scripts = this.getScriptsByTrigger('on_event', 'stage_click');
    if (scripts.length === 0) return;
    console.log('[BlockScriptRuntime] Executing', scripts.length, 'click script(s)');
    await this.executeScripts(scripts);
  }

  /**
   * Execute a set of scripts (their compiled timelines).
   * @param {Array} scripts - Script objects with .timeline arrays
   */
  async executeScripts(scripts) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isAborted = false;
    this._startTime = Date.now();

    try {
      for (const script of scripts) {
        if (this.isAborted) break;
        await this.executeTimeline(script.timeline || [], script.id);
      }
    } catch (err) {
      console.error('[BlockScriptRuntime] Execution error:', err);
    }

    this.isRunning = false;
  }

  /**
   * Abort current execution.
   */
  abort() {
    this.isAborted = true;
    this.isRunning = false;
    // Kill any running tweens on the sprite
    if (this.scene && this.scene.player) {
      this.scene.tweens.killTweensOf(this.scene.player);
    }
    // Stop any speech
    this.hideSpeech();
  }

  // =============================================================
  //  TIMELINE EXECUTION
  // =============================================================

  /**
   * Execute a single timeline (array of action objects).
   * @param {Array} timeline - Action objects from compiled script
   * @param {string} scriptId - For debugging
   */
  async executeTimeline(timeline, scriptId) {
    if (!timeline || timeline.length === 0) return;

    for (let i = 0; i < timeline.length && !this.isAborted; i++) {
      const action = timeline[i];
      try {
        await this.executeAction(action);
      } catch (err) {
        console.error('[BlockScriptRuntime] Action failed:', action?.type, err);
      }
    }
  }

  /**
   * Execute a single action from the compiled timeline.
   * @param {Object} action - Compiled action object
   */
  async executeAction(action) {
    if (!action || this.isAborted) return;

    switch (action.type) {
      // ── Motion ──
      case 'move': {
        const steps = action.params?.steps || 10;
        const player = this.scene.player;
        if (!player) break;

        // Calculate direction: Scratch convention (0=up, 90=right)
        // The sprite's current angle (Phaser angle) should reflect this
        const dir = player.angle || 0; // Phaser angle in degrees
        const rad = (90 - dir) * Math.PI / 180;
        const dx = Math.cos(rad) * steps;
        const dy = -Math.sin(rad) * steps;

        // Use tween for smooth movement
        const targetX = Phaser.Math.Clamp(player.x + dx, 10, 790);
        const targetY = Phaser.Math.Clamp(player.y + dy, 10, 590);

        await this.tweenAsync(player, { x: targetX, y: targetY }, 200, 'Sine.easeInOut');
        break;
      }

      case 'turn': {
        const deg = action.params?.degrees || 15;
        const dir = action.params?.direction || 'cw';
        const player = this.scene.player;
        if (!player) break;

        const delta = dir === 'cw' ? deg : -deg;
        await this.tweenAsync(player, { angle: player.angle + delta }, 150, 'Sine.easeInOut');
        break;
      }

      case 'goto': {
        const gx = action.params?.x ?? player.x;
        const gy = action.params?.y ?? player.y;
        const player = this.scene.player;
        if (!player) break;

        await this.tweenAsync(player, {
          x: Phaser.Math.Clamp(gx, 10, 790),
          y: Phaser.Math.Clamp(gy, 10, 590),
        }, 100, 'Power1');
        break;
      }

      case 'jump': {
        const player = this.scene.player;
        if (!player) break;

        const origY = player.y;
        await this.tweenAsync(player, { y: origY - 40 }, 150, 'Sine.easeOut');
        if (!this.isAborted) {
          await this.tweenAsync(player, { y: origY }, 150, 'Bounce.easeOut');
        } else {
          player.y = origY;
        }
        break;
      }

      // ── Looks ──
      case 'say':
      case 'think': {
        const text = action.params?.text || '';
        const duration = (action.params?.duration || 2) * 1000;
        const isThink = action.type === 'think';

        this.showSpeech(text, isThink);

        // Log the speech event as a fitness event
        this._fitnessEvents.push({
          eventType: isThink ? 'think' : 'say',
          speciesId: 'player',
          fitnessDelta: 0,
          timestamp: Date.now(),
          metadata: { text },
        });

        await this.waitAsync(duration);
        this.hideSpeech();
        break;
      }

      case 'show': {
        const player = this.scene.player;
        if (player) {
          player.setVisible(true);
          player.setAlpha(1);
        }
        break;
      }

      case 'hide': {
        const player = this.scene.player;
        if (player) {
          player.setVisible(false);
        }
        break;
      }

      // ── Control ──
      case 'wait': {
        const seconds = action.params?.seconds || 1;
        await this.waitAsync(seconds * 1000);
        break;
      }

      case 'repeat': {
        const count = action.params?.count || 0;
        const body = action.body || [];
        if (count <= 0 || body.length === 0) break;

        for (let r = 0; r < count && !this.isAborted; r++) {
          console.log(`[BlockScriptRuntime] Repeat iteration ${r + 1}/${count}`);
          for (const subAction of body) {
            if (this.isAborted) break;
            await this.executeAction(subAction);
          }
        }
        break;
      }

      case 'if_then': {
        const condition = action.params?.condition || 'true';
        let conditionMet = false;

        switch (condition) {
          case 'true': conditionMet = true; break;
          case 'false': conditionMet = false; break;
          case 'edge': {
            const player = this.scene.player;
            if (player) {
              conditionMet = (player.x <= 15 || player.x >= 785 || player.y <= 15 || player.y >= 585);
            }
            break;
          }
          default:
            conditionMet = (condition === 'true');
        }

        if (conditionMet && action.body) {
          for (const subAction of action.body) {
            if (this.isAborted) break;
            await this.executeAction(subAction);
          }
        }
        break;
      }

      // ── Sound ──
      case 'play_sound': {
        const sound = action.params?.sound || 'meow';
        console.log(`[BlockScriptRuntime] 🔊 Playing sound: ${sound}`);
        // Visual feedback via flash
        if (this.scene.cameras && this.scene.cameras.main) {
          this.scene.cameras.main.flash(200, 207, 99, 207, false, null, this.scene);
        }
        await this.waitAsync(300);
        break;
      }

      case 'stop_sound': {
        console.log('[BlockScriptRuntime] 🔇 Stopping all sounds');
        break;
      }

      case 'play_drum': {
        const drum = action.params?.drum || 'snare';
        const beats = action.params?.beats || 0.25;
        console.log(`[BlockScriptRuntime] 🥁 Drum: ${drum} for ${beats} beats`);
        if (this.scene.cameras && this.scene.cameras.main) {
          this.scene.cameras.main.flash(100, 255, 255, 255, false, null, this.scene);
        }
        await this.waitAsync(beats * 500);
        break;
      }

      default:
        console.warn('[BlockScriptRuntime] Unknown action type:', action.type);
    }
  }

  // =============================================================
  //  HELPERS
  // =============================================================

  /**
   * Wait for a duration (ms), polling every 50ms for abort.
   */
  waitAsync(ms) {
    return new Promise(resolve => {
      const start = Date.now();
      const poll = () => {
        if (this.isAborted || Date.now() - start >= ms) return resolve();
        setTimeout(poll, 50);
      };
      poll();
    });
  }

  /**
   * Create a Phaser tween and return a promise that resolves when complete.
   */
  tweenAsync(target, props, duration, ease = 'Sine.easeInOut') {
    return new Promise(resolve => {
      if (this.isAborted) return resolve();
      this.scene.tweens.add({
        targets: target,
        ...props,
        duration,
        ease,
        onComplete: resolve,
      });
    });
  }

  // =============================================================
  //  SPEECH BUBBLE
  // =============================================================

  /**
   * Show a speech/thought bubble above the player.
   */
  showSpeech(text, isThink = false) {
    this.hideSpeech();

    const player = this.scene.player;
    if (!player || !this.scene.add) return;

    const style = isThink ? {
      backgroundColor: '#ddd',
      color: '#111',
      padding: '6px 14px',
      borderRadius: '18px 18px 18px 4px',
      fontSize: '13px',
      fontWeight: 500,
      maxWidth: 180,
      wordWrap: { width: 160 },
    } : {
      backgroundColor: '#fff',
      color: '#111',
      padding: '8px 14px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 500,
      maxWidth: 180,
      wordWrap: { width: 160 },
    };

    this.speechBubble = this.scene.add.text(player.x, player.y - 60, text, {
      ...style,
      fontFamily: 'Courier New',
    }).setOrigin(0.5, 1).setDepth(100).setScrollFactor(1);

    // Add a small tail indicator
    if (!isThink) {
      this.speechBubbleBg = this.scene.add.triangle(
        player.x, player.y - 60, -10, 2, 10, 2, 0, 10,
        0xffffff, 1
      ).setOrigin(0.5, 1).setDepth(99);
    }

    // Follow player via update callback
    this._speechFollow = () => {
      if (this.speechBubble && player && player.active) {
        this.speechBubble.setPosition(player.x, player.y - 60);
        if (this.speechBubbleBg) {
          this.speechBubbleBg.setPosition(player.x, player.y - 60);
        }
      }
    };
  }

  /**
   * Hide the speech bubble.
   */
  hideSpeech() {
    if (this.speechBubble) {
      this.speechBubble.destroy();
      this.speechBubble = null;
    }
    if (this.speechBubbleBg) {
      this.speechBubbleBg.destroy();
      this.speechBubbleBg = null;
    }
    this._speechFollow = null;
  }

  /**
   * Call this in the scene's update() loop to keep speech follow player.
   */
  updateSpeechFollow() {
    if (this._speechFollow) {
      this._speechFollow();
    }
  }

  // =============================================================
  //  LGSP FITNESS FLUSH
  // =============================================================

  /**
   * Get fitness events collected during gameplay.
   */
  getFitnessEvents() {
    return [...this._fitnessEvents];
  }

  /**
   * Build and store a fitness flush payload.
   * In the browser, this writes to localStorage for cross-room pickup.
   * In production, this would POST to Nebula.
   *
   * @param {Object} options
   * @param {boolean} options.won - Whether the game was won
   * @param {number} options.score - Final score
   * @param {number} options.livesRemaining - Lives at end
   * @param {number} options.totalCoins - Total coins collected
   * @param {number} options.playDurationMs - Duration of play session
   */
  flushFitness(options = {}) {
    const {
      won = false,
      score = 0,
      livesRemaining = 0,
      totalCoins = 0,
      playDurationMs = 0,
    } = options;

    const event = {
      protocol: 'lgsp/v0.1.0',
      type: 'fitness_flush',
      instanceId: 'voxelworks_' + Date.now(),
      generation: 0,
      flushNumber: 1,
      timestamp: Date.now(),
      sessionSummary: {
        playCount: 1,
        totalPlayMs: playDurationMs || (Date.now() - this._sessionStartTime),
        winRate: won ? 1 : 0,
        avgScore: score,
        totalDeaths: livesRemaining <= 0 ? 1 : 0,
        firstPlayAt: this._sessionStartTime,
        lastPlayAt: Date.now(),
      },
      events: [
        ...this._fitnessEvents,
        {
          eventType: won ? 'game_win' : 'game_over',
          speciesId: 'player',
          fitnessDelta: won ? 100 : -50,
          timestamp: Date.now(),
          metadata: { score, livesRemaining, totalCoins, won },
        },
      ],
      speciesSummaries: {
        player: {
          speciesId: 'player',
          totalEvents: this._fitnessEvents.length + 1,
          positiveEvents: won ? 1 : 0,
          negativeEvents: won ? 0 : 1,
          avgFitnessDelta: won ? 100 : -50,
          eventDistribution: {
            ...this._fitnessEvents.reduce((acc, e) => {
              acc[e.eventType] = (acc[e.eventType] || 0) + 1;
              return acc;
            }, {}),
            [won ? 'game_win' : 'game_over']: 1,
          },
        },
      },
    };

    // Store in localStorage for block-editor to pick up
    try {
      localStorage.setItem('voxelworks_last_fitness_flush', JSON.stringify(event));
      console.log('[BlockScriptRuntime] 💪 Fitness flush stored in localStorage');

      // Also emit a custom event for cross-frame communication
      window.dispatchEvent(new CustomEvent('voxelworks:fitness-flush', { detail: event }));
    } catch (e) {
      console.warn('[BlockScriptRuntime] Could not store fitness flush:', e);
    }

    return event;
  }
}
