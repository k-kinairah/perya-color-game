class Game {
  constructor(canvas, broadcastManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.broadcast = broadcastManager || null;
    this.renderer = new CabinetRenderer(this);
    this.entities = [];
    this.lastTime = 0;

    this.colors = ['red', 'blue', 'yellow', 'green', 'white', 'pink'];
    this.colorLabels = {
      red: 'RED', blue: 'BLUE', yellow: 'YELLOW',
      green: 'GREEN', white: 'WHITE', pink: 'PINK'
    };

    this.settings = {
      countdownDuration: 5,
      rollDuration: 3,
      revealDuration: 6,
      autoRoll: false,
      autoRollInterval: 0.4,
      soundEnabled: true,
      resultMode: 'fair',
      manualResult: ['red', 'blue', 'green'],
      colorWeights: { red: 1, blue: 1, yellow: 1, green: 1, white: 1, pink: 1 },
      musicVolume: 0.5,
      effectsVolume: 1
    };

    this.stats = {
      totalRolls: 0,
      colorCounts: { red: 0, blue: 0, yellow: 0, green: 0, white: 0, pink: 0 }
    };

    this.state = 'idle'; // 'idle' | 'countdown' | 'rolling' | 'reveal'
    this.stateTimer = 0;
    this.countdownRemaining = 0;

    this.dice = [];
    this.tiles = [];
    this.lights = [];
    this.bettingBoard = null;
    this.particles = [];
    this.history = []; // array of arrays of color ids, most recent first
    this.historyRecords = [];
    this.currentResult = null;
    this.pendingForcedResult = null;
    this.lastStateBroadcast = 0;

    this.cabinetRenderer = new CabinetRenderer();

    this.rollBtn = document.getElementById('rollBtn');
    if (this.rollBtn) this.rollBtn.addEventListener('click', () => this.tryStartRoll(false));

    // WebAudio for perya sound effects (synthesized, no assets)
    this.audioCtx = null;

    this.setupResize();
    this.setup();

    this.setupBroadcast();

    this.start();
  }

  ensureAudio() {
    if (!this.audioCtx) {
      try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.audioCtx = null; }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  playTone(freq, duration, type, gain) {
    if (!this.settings.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    const volume = Math.max(0, Math.min(1, this.settings.effectsVolume ?? 1));
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime((gain || 0.15) * volume, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g).connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playTick() { this.playTone(880, 0.08, 'square', 0.08); }
  playClack() { this.playTone(180 + Math.random() * 100, 0.12, 'square', 0.14); }
  playChime() {
    this.playTone(660, 0.2, 'triangle', 0.14);
    setTimeout(() => this.playTone(880, 0.25, 'triangle', 0.14), 90);
    setTimeout(() => this.playTone(1320, 0.35, 'triangle', 0.12), 200);
  }

  setupBroadcast() {
    if (!this.broadcast) return;
    this.broadcast.on('START_ROUND', () => this.tryStartRoll(true));
    this.broadcast.on('START_COUNTDOWN', () => this.tryStartRoll(true));
    this.broadcast.on('FORCE_RESULT', payload => this.forceRoll(payload.dice));
    this.broadcast.on('RESET_ROUND', () => this.resetRound());
    this.broadcast.on('CLEAR_HISTORY', () => this.clearHistory());
    this.broadcast.on('UPDATE_SETTINGS', payload => this.applySettings(payload.settings || payload));
    this.publishState('GAME_STATE');
  }

  applySettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    const numeric = (key, min, fallback) => {
      if (settings[key] === undefined) return;
      this.settings[key] = Math.max(min, parseFloat(settings[key]) || fallback);
    };

    numeric('countdownDuration', 1, this.settings.countdownDuration);
    numeric('rollDuration', 1, this.settings.rollDuration);
    numeric('revealDuration', 1, this.settings.revealDuration);
    numeric('autoRollInterval', 0.4, this.settings.autoRollInterval);

    if (settings.soundEnabled !== undefined) this.settings.soundEnabled = !!settings.soundEnabled;
    if (settings.autoRoll !== undefined) this.settings.autoRoll = !!settings.autoRoll;
    if (settings.musicVolume !== undefined) this.settings.musicVolume = Math.max(0, Math.min(1, parseFloat(settings.musicVolume) || 0));
    if (settings.effectsVolume !== undefined) this.settings.effectsVolume = Math.max(0, Math.min(1, parseFloat(settings.effectsVolume) || 0));
    if (['fair', 'weighted', 'manual'].includes(settings.resultMode)) this.settings.resultMode = settings.resultMode;
    if (Array.isArray(settings.manualResult) && settings.manualResult.length === 3 &&
        settings.manualResult.every(c => this.colors.includes(c))) {
      this.settings.manualResult = settings.manualResult.slice();
    }

    this.publishState('STATE_UPDATE');
  }

  getPhaseLabel() {
    if (this.state === 'idle') return 'Idle';
    if (this.state === 'countdown') return 'Countdown';
    if (this.state === 'rolling' || this.state === 'stopping') return 'Rolling';
    if (this.state === 'reveal') return 'Reveal';
    return 'Finished';
  }

  getStateSnapshot() {
    const countdownTotal = Math.max(0.1, this.settings.countdownDuration || 5);
    const countdownRemaining = this.state === 'countdown'
      ? Math.max(0, this.stateTimer)
      : 0;
    return {
      phase: this.getPhaseLabel(),
      state: this.state,
      stateTimer: Math.max(0, this.stateTimer),
      countdownRemaining,
      countdownTotal,
      countdownProgress: this.state === 'countdown'
        ? Math.max(0, Math.min(1, countdownRemaining / countdownTotal))
        : 0,
      currentRound: this.stats.totalRolls + (this.state === 'idle' ? 1 : 0),
      roundsPlayed: this.stats.totalRolls,
      currentResult: this.currentResult ? this.currentResult.slice() : null,
      lastResult: this.history.length > 0 ? this.history[0].slice() : null,
      history: this.historyRecords.slice(0, 10).map(record => ({
        round: record.round,
        result: record.result.slice(),
        timestamp: record.timestamp
      })),
      settings: { ...this.settings, manualResult: this.settings.manualResult.slice() },
      canStart: this.state === 'idle',
      canForce: this.state === 'idle',
      canReset: this.state !== 'idle'
    };
  }

  publishState(type = 'STATE_UPDATE') {
    if (!this.broadcast) return;
    this.broadcast.send(type, this.getStateSnapshot());
  }

  setup() {
    this.layout();
  }

  layout() {
    // Compute logical layout based on current canvas size
    const W = this.canvas.width / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);
    this.viewW = W;
    this.viewH = H;

    // Recreate entities scaled to viewport
    this.entities = this.entities.filter(e => e instanceof Particle);
    this.dice = [];
    this.tiles = [];
    this.lights = [];

    // Dice area — center of cabinet
    const diceCenterY = H * 0.42;
    const dieSize = Math.min(W * 0.11, H * 0.18, 160);
    const spacing = dieSize * 1.35;
    const cx = W / 2;
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * spacing;
      const die = new Die(x, diceCenterY, dieSize);
      this.dice.push(die);
      this.entities.push(die);
    }

    // Color tiles — 6 tiles below the dice, in one row (or two rows if narrow)
    const boardW = Math.min(W * 0.89, 1500);
    const boardH = Math.min(H * 0.25, 180);
    const boardX = (W - boardW) / 2;
    const boardY = H * 0.600;
    const outerPadding = 15;   // distance from board edge
    const tileGap = 0;        

    const slotW = (boardW - outerPadding * 2 - tileGap * 5) / 6;
    const slotH = boardH - outerPadding * 2;
    const tileW = slotW * 0.94;
    const tileH = slotH * 0.75;
    const visualOrder = ['yellow', 'white', 'pink', 'blue', 'red', 'green'];
    this.bettingBoard = { x: boardX, y: boardY, width: boardW, height: boardH };
    for (let i = 0; i < 6; i++) {
      const cid = visualOrder[i];
      const slotX = boardX + outerPadding + i * (slotW - tileGap);
      const slotY = boardY + 5;
      const slotH = boardH - 20;
      const tile = new ColorTile(
        slotX + (slotW - tileW) / 2,
        slotY + (slotH - tileH) / 2,
        tileW, tileH,
        cid,
        this.colorLabels[cid]
      );
      this.tiles.push(tile);
      this.entities.push(tile);
    }

    // Cabinet lights along the top arch
    const lightCount = 19;
    const archTop = H * 0.055;
    const archLeft = W * 0.08;
    const archRight = W * 0.92;
    const archWidth = archRight - archLeft;
    const lightRadius = Math.max(6, Math.min(12, W * 0.008));
    const hues = [0, 45, 60, 120, 200, 300, 340];
    for (let i = 0; i < lightCount; i++) {
      const t = i / (lightCount - 1);
      const x = archLeft + t * archWidth;
      // arch curve
      const y = archTop + Math.sin(t * Math.PI) * -30 + 30;
      const hue = hues[i % hues.length];
      const light = new CabinetLight(x, y, lightRadius, i * 0.4, hue);
      this.lights.push(light);
      this.entities.push(light);
    }
    // Side vertical lights
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const y = H * 0.12 + t * (H * 0.75);
      const hue = hues[(i + 3) % hues.length];
      const lL = new CabinetLight(W * 0.04, y, lightRadius, i * 0.6, hue);
      const lR = new CabinetLight(W * 0.96, y, lightRadius, i * 0.6 + 1.5, hue);
      this.lights.push(lL, lR);
      this.entities.push(lL, lR);
    }
  }

  setupResize() {
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = this.canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      this.canvas.width = Math.floor(r.width * dpr);
      this.canvas.height = Math.floor(r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.dice.length > 0) this.layout();
    };
    window.addEventListener('resize', fit);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(this.canvas);
    fit();
  }

  screenToWorld(x, y) { return { x, y }; }
  worldToScreen(x, y) { return { x, y }; }

  getObjectAt(canvasX, canvasY) {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      const b = e.getBounds();
      if (canvasX >= b.x && canvasX <= b.x + b.width &&
          canvasY >= b.y && canvasY <= b.y + b.height) {
        return e;
      }
    }
    return null;
  }

  // ==== ROUND FLOW ====

  tryStartRoll(fromAdmin) {
    if (this.state !== 'idle') return;
    this.ensureAudio();
    this.state = 'countdown';
    this.stateTimer = this.settings.countdownDuration;
    this.countdownRemaining = Math.ceil(this.stateTimer);
    this.lastTickShown = this.countdownRemaining;
    for (const t of this.tiles) t.reset();
    for (const d of this.dice) d.reset();
    this.currentResult = null;
    if (this.rollBtn) this.rollBtn.disabled = true;
    this.playTick();
    this.publishState('STATE_UPDATE');
  }

  forceRoll(finalColors) {
    if (this.state !== 'idle') return;
    this.pendingForcedResult = null;
    if (Array.isArray(finalColors) && finalColors.length === 3 &&
        finalColors.every(c => this.colors.includes(c))) {
      this.pendingForcedResult = finalColors.slice();
    }
    this.tryStartRoll(true);
  }

  pickWeightedColor() {
    const weights = this.settings.colorWeights || {};
    const total = this.colors.reduce((sum, c) => sum + Math.max(0, Number(weights[c]) || 0), 0);
    if (total <= 0) return this.colors[Math.floor(Math.random() * this.colors.length)];
    let target = Math.random() * total;
    for (const c of this.colors) {
      target -= Math.max(0, Number(weights[c]) || 0);
      if (target <= 0) return c;
    }
    return this.colors[this.colors.length - 1];
  }

  determineFinalColors() {
    if (this.pendingForcedResult) {
      const result = this.pendingForcedResult.slice();
      this.pendingForcedResult = null;
      return result;
    }
    if (this.settings.resultMode === 'manual' &&
        Array.isArray(this.settings.manualResult) &&
        this.settings.manualResult.length === 3 &&
        this.settings.manualResult.every(c => this.colors.includes(c))) {
      return this.settings.manualResult.slice();
    }
    if (this.settings.resultMode === 'weighted') {
      return [this.pickWeightedColor(), this.pickWeightedColor(), this.pickWeightedColor()];
    }
    return [
      this.colors[Math.floor(Math.random() * 6)],
      this.colors[Math.floor(Math.random() * 6)],
      this.colors[Math.floor(Math.random() * 6)]
    ];
  }

  beginRolling() {
    this.state = 'rolling';
    this.stateTimer = this.settings.rollDuration;
    for (const d of this.dice) d.startRoll(this.settings.rollDuration);
    this.playClack();
    // Clack cadence during roll
    this.clackTimer = 0;
  }

  finishRolling() {
    // Determine final colors
    let finalColors = this.determineFinalColors();
    // Stop dice one by one with slight delay for drama
    finalColors.forEach((c, i) => {
      setTimeout(() => {
        this.dice[i].stopRoll(c);
        this.playClack();
        this.spawnBurst(this.dice[i].cx, this.dice[i].cy, Die.colorHex(c).fill, 18);
        if (i === 2) this.onAllDiceStopped(finalColors);
      }, i * 250);
    });
  }

  onAllDiceStopped(finalColors) {
    this.currentResult = finalColors.slice();
    this.history.unshift(finalColors.slice());
    if (this.history.length > 12) this.history.length = 12;
    this.historyRecords.unshift({
      round: this.stats.totalRolls + 1,
      result: finalColors.slice(),
      timestamp: new Date().toISOString()
    });
    if (this.historyRecords.length > 50) this.historyRecords.length = 50;

    // Update tile win counts
    const counts = {};
    for (const c of finalColors) counts[c] = (counts[c] || 0) + 1;
    for (const tile of this.tiles) tile.setWinCount(counts[tile.colorId] || 0);

    // Stats
    this.stats.totalRolls += 1;
    for (const c of finalColors) this.stats.colorCounts[c] = (this.stats.colorCounts[c] || 0) + 1;

    // Excitement burst on lights
    for (const l of this.lights) l.setExcitement(1);

    this.playChime();

    // Extra particle celebration on each winning tile
    for (const tile of this.tiles) {
      if (tile.winCount > 0) {
        for (let k = 0; k < tile.winCount * 6; k++) {
          this.spawnBurst(
            tile.x + tile.width / 2,
            tile.y + tile.height / 2,
            Die.colorHex(tile.colorId).fill,
            1
          );
        }
      }
    }

    this.state = 'reveal';
    this.stateTimer = this.settings.revealDuration;
    this.publishState('STATE_UPDATE');
  }

  resetRound() {
    this.state = 'idle';
    this.stateTimer = 0;
    this.currentResult = null;
    this.pendingForcedResult = null;
    for (const t of this.tiles) t.reset();
    for (const d of this.dice) d.reset();
    if (this.rollBtn) this.rollBtn.disabled = false;
    this.publishState('STATE_UPDATE');
  }

  clearHistory() {
    this.history = [];
    this.historyRecords = [];
    this.stats.totalRolls = 0;
    this.stats.colorCounts = { red: 0, blue: 0, yellow: 0, green: 0, white: 0, pink: 0 };
    this.publishState('STATE_UPDATE');
  }

  spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 220;
      const life = 0.7 + Math.random() * 0.7;
      const size = 3 + Math.random() * 4;
      const p = new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 80, color, life, size);
      this.particles.push(p);
      this.entities.push(p);
    }
  }

  // ==== UPDATE ====

  update(dt) {
    // State machine
    if (this.state === 'countdown') {
      this.stateTimer -= dt;
      const shown = Math.max(1, Math.ceil(this.stateTimer));
      if (shown !== this.lastTickShown && this.stateTimer > 0) {
        this.lastTickShown = shown;
        this.playTick();
      }
      this.countdownRemaining = shown;
      if (this.stateTimer <= 0) {
        this.beginRolling();
        this.publishState('STATE_UPDATE');
      }
    } else if (this.state === 'rolling') {
      this.stateTimer -= dt;
      this.clackTimer = (this.clackTimer || 0) - dt;
      if (this.clackTimer <= 0) {
        this.playClack();
        this.clackTimer = 0.12 + Math.random() * 0.1;
      }
      if (this.stateTimer <= 0) {
        this.finishRolling();
        this.state = 'stopping'; // brief interstitial handled by setTimeout chain
        this.publishState('STATE_UPDATE');
      }
    } else if (this.state === 'reveal') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.resetRound();
        if (this.settings.autoRoll) {
          setTimeout(() => this.tryStartRoll(false), Math.max(0.1, this.settings.autoRollInterval || 0.4) * 1000);
        }
      }
    }

    // Update entities
    for (const e of this.entities) e.update(dt);

    // Clean up dead particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i].dead) {
        const p = this.particles[i];
        this.particles.splice(i, 1);
        const idx = this.entities.indexOf(p);
        if (idx >= 0) this.entities.splice(idx, 1);
      }
    }

    if (this.broadcast && performance.now() - this.lastStateBroadcast > 250) {
      this.lastStateBroadcast = performance.now();
      this.publishState('STATE_UPDATE');
    }
  }

  // ==== DRAW ====

  draw() {
    const W = this.viewW || this.canvas.width;
    const H = this.viewH || this.canvas.height;
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.drawBackground(W, H);
    this.drawCabinet(W, H);

    // Lights (behind the wood trim frame but on top of bg)
    for (const l of this.lights) l.draw(ctx);

    this.drawHeader(W, H);
    this.drawHistory(W, H);
    this.drawDiceStage(W, H);

    // Dice
    for (const d of this.dice) d.draw(ctx);

    this.drawBettingBoard(W, H);

    // Tiles
    for (const t of this.tiles) t.draw(ctx);

    // Particles
    for (const p of this.particles) p.draw(ctx);

    this.drawCenterMessage(W, H);
    this.drawFooter(W, H);
  }

  drawBettingBoard(W, H) {
    if (!this.bettingBoard) return;
    const ctx = this.ctx;
    const { x, y, width: w, height: h } = this.bettingBoard;
    const r = Math.max(12, h * 0.12);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    const board = ctx.createLinearGradient(x, y, x, y + h);
    board.addColorStop(0, '#3a1c0b');
    board.addColorStop(0.42, '#170904');
    board.addColorStop(1, '#0d0503');
    ctx.fillStyle = board;
    Die._roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const woodGloss = ctx.createLinearGradient(x, y, x, y + h * 0.55);
    woodGloss.addColorStop(0, 'rgba(255,216,130,0.16)');
    woodGloss.addColorStop(0.4, 'rgba(255,255,255,0.04)');
    woodGloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = woodGloss;
    Die._roundRect(ctx, x + 6, y + 6, w - 12, h * 0.42, r * 0.62);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const trim = ctx.createLinearGradient(x, y, x, y + h);
    trim.addColorStop(0, '#fff4b0');
    trim.addColorStop(0.34, '#d7a73c');
    trim.addColorStop(0.62, '#7a4f0c');
    trim.addColorStop(1, '#f3cf62');
    ctx.lineWidth = Math.max(3, h * 0.01);
    ctx.strokeStyle = trim;
    Die._roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,246,190,0.62)';
    Die._roundRect(ctx, x + 6, y + 6, w - 11, h - 14, r * 0.7);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    Die._roundRect(ctx, x + 10, y + 10, w - 20, h - 20, r * 0.52);
    ctx.stroke();
    ctx.restore();

    const gap = Math.max(1, Math.min(8, w * 0.008));
    const slotW = (w - gap * 7) / 6;
    const slotH = h - gap * 2;
    for (let i = 0; i < 6; i++) {
      const sx = x + gap + i * (slotW + gap);
      const sy = y + gap;
      ctx.save();
      Die._roundRect(ctx, sx, sy, slotW, slotH, Math.max(7, slotH * 0.1));
      ctx.fill();
      ctx.restore();
    }
  }

  drawBackground(W, H) {
    const ctx = this.ctx;

    const wood = ctx.createLinearGradient(0, 0, 0, H);
    wood.addColorStop(0, '#8a4c21');
    wood.addColorStop(0.18, '#6d3516');
    wood.addColorStop(0.46, '#351407');
    wood.addColorStop(0.74, '#54240d');
    wood.addColorStop(1, '#160704');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, W, H);

    const plankCount = 9;
    for (let i = 0; i < plankCount; i++) {
      const y = Math.round(H * i / plankCount);
      const h = Math.ceil(H / plankCount) + 2;
      const plank = ctx.createLinearGradient(0, y, W, y + h);
      plank.addColorStop(0, i % 2 ? 'rgba(54,20,7,0.22)' : 'rgba(255,184,86,0.08)');
      plank.addColorStop(0.5, 'rgba(255,215,132,0.05)');
      plank.addColorStop(1, i % 2 ? 'rgba(255,197,112,0.06)' : 'rgba(22,7,3,0.24)');
      ctx.fillStyle = plank;
      ctx.fillRect(0, y, W, h);

      ctx.strokeStyle = 'rgba(20,7,2,0.42)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,150,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      ctx.lineTo(W, y + 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < H; y += 7) {
      ctx.beginPath();
      ctx.strokeStyle = y % 28 === 0 ? 'rgba(255,220,165,.24)' : 'rgba(23,7,2,.42)';
      ctx.lineWidth = y % 28 === 0 ? 1.3 : 0.8;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        W * 0.22, y + Math.sin(y * 0.035) * 7,
        W * 0.68, y + Math.cos(y * 0.026) * 9,
        W, y + Math.sin(y * 0.018) * 3
      );
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let x = -40; x < W; x += 72) {
      const band = ctx.createLinearGradient(x, 0, x + 54, 0);
      band.addColorStop(0, 'rgba(255,210,130,0)');
      band.addColorStop(0.5, 'rgba(255,236,178,0.22)');
      band.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = band;
      ctx.fillRect(x, 0, 54, H);
    }
    ctx.restore();

    const spotlight = ctx.createRadialGradient(W / 2, H * 0.43, 30, W / 2, H * 0.43, W * 0.56);
    spotlight.addColorStop(0, 'rgba(255,226,154,.42)');
    spotlight.addColorStop(0.32, 'rgba(244,151,44,.16)');
    spotlight.addColorStop(1, 'rgba(244,151,44,0)');
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, W, H);

    const varnish = ctx.createLinearGradient(0, 0, W, H);
    varnish.addColorStop(0, 'rgba(255,255,255,0.10)');
    varnish.addColorStop(0.18, 'rgba(255,255,255,0.02)');
    varnish.addColorStop(0.46, 'rgba(255,213,144,0.08)');
    varnish.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    varnish.addColorStop(0.56, 'rgba(255,255,255,0.02)');
    varnish.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = varnish;
    ctx.fillRect(0, 0, W, H);

    const edge = ctx.createRadialGradient(W / 2, H / 2, W * 0.22, W / 2, H / 2, W * 0.78);
    edge.addColorStop(0.56, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,.72)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
}

  drawCabinet(W, H) {
    const ctx = this.ctx;

    const frame = Math.min(W, H) * 0.036;
    const radius = Math.max(16, frame * 0.7);
    const outerWood = ctx.createLinearGradient(0, 0, 0, H);
    outerWood.addColorStop(0, '#1a0b02');
    outerWood.addColorStop(0.28, '#2b1004');
    outerWood.addColorStop(0.64, '#2b0f05');
    outerWood.addColorStop(1, '#0a05022c');

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.78)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = outerWood;
    Die._roundRect(ctx, frame * 0.5, frame * 0.5, W - frame, H - frame, radius);
    ctx.fill();
    ctx.restore();

    const gold = ctx.createLinearGradient(0, frame, 0, H - frame);
    gold.addColorStop(0, '#fff9c9');
    gold.addColorStop(0.12, '#ffe071');
    gold.addColorStop(0.38, '#a96510');
    gold.addColorStop(0.62, '#e1ad37');
    gold.addColorStop(0.86, '#fff0a2');
    gold.addColorStop(1, '#87500c');

    ctx.save();
    ctx.shadowColor = 'rgba(255,205,76,.72)';
    ctx.shadowBlur = 24;
    ctx.lineWidth = Math.max(8, frame * 0.24);
    ctx.strokeStyle = gold;
    Die._roundRect(ctx, frame, frame, W - frame * 2, H - frame * 2, radius * 0.72);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineWidth = Math.max(2, frame * 0.055);
    ctx.strokeStyle = 'rgba(255,250,208,0.88)';
    Die._roundRect(ctx, frame + 8, frame + 8, W - (frame + 8) * 2, H - (frame + 8) * 2, radius * 0.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(50,18,4,0.72)';
    ctx.lineWidth = Math.max(3, frame * 0.09);
    Die._roundRect(ctx, frame + 16, frame + 16, W - (frame + 16) * 2, H - (frame + 16) * 2, radius * 0.42);
    ctx.stroke();
    ctx.restore();

    const topBevel = ctx.createLinearGradient(0, frame * 0.5, 0, frame * 2.6);
    topBevel.addColorStop(0, 'rgba(255,231,153,0.24)');
    topBevel.addColorStop(0.35, 'rgba(255,255,255,0.10)');
    topBevel.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topBevel;
    ctx.fillRect(frame, frame, W - frame * 2, frame * 1.9);

    const innerShadow = ctx.createLinearGradient(0, H - frame * 2.8, 0, H - frame);
    innerShadow.addColorStop(0, 'rgba(0,0,0,0)');
    innerShadow.addColorStop(1, 'rgba(255,213,118,.18)');
    ctx.fillStyle = innerShadow;
    ctx.fillRect(frame, H - frame * 2.8, W - frame * 2, frame * 1.9);

    const ornament = Math.max(8, frame * 0.34);
    const drawCorner = (x, y) => {
      ctx.save();
      const cg = ctx.createRadialGradient(x - ornament * 0.35, y - ornament * 0.35, 1, x, y, ornament);
      cg.addColorStop(0, '#fff8ca');
      cg.addColorStop(0.45, '#dfa33a');
      cg.addColorStop(1, '#67370a');
      ctx.fillStyle = cg;
      ctx.shadowColor = 'rgba(255,216,93,.65)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, ornament, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff0a1';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, ornament * 0.46, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(82,40,8,.75)';
      ctx.stroke();
      ctx.restore();
    };

    drawCorner(frame, frame);
    drawCorner(W - frame, frame);
    drawCorner(frame, H - frame);
    drawCorner(W - frame, H - frame);
}

  drawHeader(W, H) {
    const ctx = this.ctx;
    const cy = H * 0.09;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title banner background
    const bannerW = Math.min(W * 0.55, 780);
    const bannerH = H * 0.09;
    const bx = (W - bannerW) / 2;
    const by = cy - bannerH / 2;

    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;
    const bgrad = ctx.createLinearGradient(bx, by, bx, by + bannerH);
    bgrad.addColorStop(0, '#4c0705');
    bgrad.addColorStop(0.18, '#a40f12');
    bgrad.addColorStop(0.55, '#7d0808');
    bgrad.addColorStop(1, '#2a0303');
    ctx.fillStyle = bgrad;
    Die._roundRect(ctx, bx, by, bannerW, bannerH, bannerH * 0.25);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const gloss = ctx.createLinearGradient(0, by, 0, by + bannerH * .45);
    gloss.addColorStop(0, 'rgba(255,255,255,.34)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    Die._roundRect(ctx, bx + 8, by + 7, bannerW - 16, bannerH * .42, bannerH * .18);
    ctx.fill();
    const trim = ctx.createLinearGradient(bx, by, bx, by + bannerH);
    trim.addColorStop(0, '#fff9c6');
    trim.addColorStop(0.28, '#ffd95c');
    trim.addColorStop(0.62, '#a86911');
    trim.addColorStop(1, '#fff0a3');

// outer gold border
    ctx.lineWidth = 5;
    ctx.strokeStyle = trim;
    ctx.shadowColor = 'rgba(255,210,100,.72)';
    ctx.shadowBlur = 18;

    Die._roundRect(
        ctx,
        bx,
        by,
        bannerW,
        bannerH,
        bannerH * 0.25
    );

    ctx.stroke();

    ctx.shadowBlur = 0;

// inner gold border
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,240,180,.85)';

    Die._roundRect(
        ctx,
        bx + 8,
        by + 8,
        bannerW - 16,
        bannerH - 16,
        bannerH * 0.18
    );

ctx.stroke();

    // Title text
    ctx.font = `900 ${Math.floor(bannerH * 0.45)}px Georgia, serif`;
    ctx.lineWidth = Math.max(2, bannerH * 0.035);
    ctx.strokeStyle = '#5a2704';
    ctx.strokeText(' ★  PERYA COLOR GAME  ★ ', W / 2, cy);
    ctx.fillStyle = '#3a0a05';
    ctx.fillText(' ★  PERYA COLOR GAME  ★ ', W / 2 + 2, cy + 2);
    const textGold = ctx.createLinearGradient(0, cy - bannerH * 0.28, 0, cy + bannerH * 0.28);
    textGold.addColorStop(0, '#fff8ca');
    textGold.addColorStop(0.45, '#ffd45a');
    textGold.addColorStop(1, '#b77715');
    ctx.shadowColor = 'rgba(255,222,99,.55)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = textGold;
    ctx.fillText(' ★  PERYA COLOR GAME  ★ ', W / 2, cy);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = `italic ${Math.floor(bannerH * 0.18)}px Georgia, serif`;
    ctx.fillStyle = '#ffd700';

    ctx.restore();
  }

  drawHistory(W, H) {
    const ctx = this.ctx;
    // Top-left small history panel
    const panelW = Math.min(240, W * 0.20);
    const panelH = Math.min(220, H * 0.4);
    const px = W * 0.070 + 70;
    const py = H * 0.17;

    ctx.save();
    const panelGrad = ctx.createLinearGradient(px, py, px, py + panelH);
    panelGrad.addColorStop(0, 'rgba(88, 43, 17, 0.94)');
    panelGrad.addColorStop(0.42, 'rgba(35, 13, 6, 0.94)');
    panelGrad.addColorStop(1, 'rgba(13, 6, 3, 0.96)');
    ctx.fillStyle = panelGrad;
    Die._roundRect(ctx, px, py, panelW, panelH, 10);
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const panelGold = ctx.createLinearGradient(px, py, px, py + panelH);
    panelGold.addColorStop(0, '#fff3ad');
    panelGold.addColorStop(0.48, '#b87918');
    panelGold.addColorStop(1, '#f0c45a');
    ctx.lineWidth = 2;
    ctx.strokeStyle = panelGold;
    ctx.stroke();

    ctx.save();
    const panelGloss = ctx.createLinearGradient(px, py, px, py + panelH * 0.35);
    panelGloss.addColorStop(0, 'rgba(255,255,255,0.13)');
    panelGloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = panelGloss;
    Die._roundRect(ctx, px + 5, py + 5, panelW - 10, panelH * 0.26, 7);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top'; 
    ctx.font = `bold ${Math.floor(panelH * 0.09)}px Georgia, serif`;
    ctx.shadowColor = 'rgba(255,212,88,.45)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffe58a';
    ctx.fillText(' PREVIOUS ROLLS ', px + panelW / 2, py + 19);
    ctx.shadowBlur = 0;

    // Rows
    const rows = Math.min(this.history.length, 3);
    const topPadding = panelH * 0.34;
    const bottomPadding = 26;

    const rowY0 = py + topPadding;
    const rowH = (panelH - topPadding - bottomPadding) / 3;
    const dotR = Math.min(rowH * 0.35, panelW * 0.09);


    for (let i = 0; i < rows; i++) {
      const result = this.history[i];
      const y = rowY0 + i * rowH + rowH / 2;
      const alpha = 1 - i * 0.07;
      ctx.globalAlpha = alpha;
      // Center the 3 balls
      const spacing = dotR * 2.7;
      const totalWidth = spacing * 2; 
      const rowDotR = i === 0 ? dotR * 1.1 : dotR * 0.92;   // distance between first and last ball
      const dotsStartX = px + panelW / 2 - totalWidth / 2;
      for (let j = 0; j < 3; j++) {
        const cid = result[j];
        const cx = dotsStartX + j * (dotR * 2.4);
        const cy2 = y;
        const c = Die.colorHex(cid);
        ctx.beginPath();
        ctx.arc(cx, cy2, rowDotR, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(
        cx - rowDotR * .3,
        cy2 - rowDotR * .3,
        0,
        cx,
        cy2,
        rowDotR
    );
        g.addColorStop(0, c.light);
        g.addColorStop(1, c.dark);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
      }
      
      if (i < rows - 1) {
          ctx.beginPath();
          ctx.moveTo(px + 24, y + rowH / 2);
          ctx.lineTo(px + panelW - 24, y + rowH / 2);

          ctx.strokeStyle = "rgba(255, 189, 7, 0.86)";
          ctx.lineWidth = 1;
          ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }


    if (this.history.length === 0) {
      ctx.textAlign = 'center';
      ctx.font = `italic ${Math.floor(panelH * 0.08)}px Georgia, serif`;
      ctx.fillStyle = '#7a6a4a';
      ctx.fillText('— No rolls yet —', px + panelW / 2, py + panelH / 2);
    }

    ctx.restore();
  }

  drawDiceStage(W, H) {

    const ctx = this.ctx;
    const stageY = H * 0.42 + Math.min(W * 0.11, H * 0.18, 160) * 0.55;
    const stageW = Math.min(W * 0.66, 960);
    const stageH = H * 0.045;
    const sx = (W - stageW) / 2;
    const r = stageH * 0.62;

    ctx.save();
    const halo = ctx.createRadialGradient(W / 2, stageY - stageH * 1.1, 10, W / 2, stageY, stageW * 0.62);
    halo.addColorStop(0, 'rgba(255,225,146,0.28)');
    halo.addColorStop(0.5, 'rgba(236,159,45,0.10)');
    halo.addColorStop(1, 'rgba(236,159,45,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - stageW * 0.18, stageY - stageH * 3, stageW * 1.36, stageH * 4.2);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.74)';
    ctx.shadowBlur = 38;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    Die._roundRect(ctx, sx + 10, stageY + 20, stageW, stageH * 1.05, r);
    ctx.fill();
    ctx.restore();

    const wood = ctx.createLinearGradient(sx, stageY, sx, stageY + stageH + 20);
    wood.addColorStop(0, '#8a5122');
    wood.addColorStop(0.28, '#603014');
    wood.addColorStop(0.72, '#351507');
    wood.addColorStop(1, '#190704');
    ctx.fillStyle = wood;
    Die._roundRect(ctx, sx, stageY, stageW, stageH + 15, r);
    ctx.fill();

    const gold = ctx.createLinearGradient(sx, stageY, sx, stageY + stageH + 15);
    gold.addColorStop(0,'#fffdd8');
    gold.addColorStop(.20,'#ffe88a');
    gold.addColorStop(.45,'#d39d29');
    gold.addColorStop(.72,'#8b5b12');
    gold.addColorStop(1,'#f9d86d');
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = gold;
    ctx.shadowColor = 'rgba(255,218,86,.65)';
    ctx.shadowBlur = 18;
    Die._roundRect(ctx, sx, stageY, stageW, stageH + 15, r);
    ctx.stroke();
    ctx.restore();

    const felt = ctx.createLinearGradient(
    sx,
    stageY + 8,
    sx,
    stageY + stageH
    );
    felt.addColorStop(0, '#b91f2d');
    felt.addColorStop(.18, '#a01422');
    felt.addColorStop(.45, '#7f0e19');
    felt.addColorStop(.75, '#5d0911');
    felt.addColorStop(1, '#360407');
    ctx.fillStyle = felt;
    Die._roundRect(ctx, sx + 13, stageY + 10, stageW - 26, stageH - 3, r * 0.62);
    ctx.fill();

    ctx.save();

    ctx.lineWidth = 2;

    ctx.strokeStyle = "rgba(255,240,180,.65)";

    Die._roundRect(
        ctx,
        sx + 14,
        stageY + 11,
        stageW - 28,
        stageH - 6,
        r * .55
    );

    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "rgba(255,230,210,.22)";
    ctx.strokeStyle = '#d7f0b8';
    ctx.lineWidth = 1;
    for (let x = sx + 24; x < sx + stageW - 24; x += 14) {  
      ctx.beginPath();
      ctx.moveTo(x, stageY + 14);
      ctx.lineTo(x + 26, stageY + stageH - 4);
      ctx.stroke();
    }
    ctx.restore();

    const shine = ctx.createLinearGradient(sx, stageY + 9, sx, stageY + stageH * 0.55);
    shine.addColorStop(0, 'rgba(255,255,255,.26)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    Die._roundRect(ctx, sx + 17, stageY + 12, stageW - 34, stageH * 0.42, r * 0.44);
    ctx.fill();

    /*
    const face = ctx.createLinearGradient(sx, stageY + stageH, sx, stageY + stageH + 18);
    face.addColorStop(0, '#5b2a0e');
    face.addColorStop(1, '#160604');
    ctx.fillStyle = face;
    ctx.fillRect(sx + 12, stageY + stageH - 2, stageW - 24, 14);
    */
}

  drawCenterMessage(W, H) {
    const ctx = this.ctx;
    const cy = H * 0.24;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'idle') {
      ctx.font = `italic bold ${Math.floor(H * 0.02)}px Georgia, serif`;
      ctx.fillStyle = '#dab560';
      ctx.fillText('Press ROLL to begin the round', W / 2, cy);
    } else if (this.state === 'countdown') {
      const bigSize = Math.floor(H * 0.11);
      const n = this.countdownRemaining;
      const t = 1 - (this.stateTimer % 2);
      const scale = 1 + (1 - t) * 0.4;
      ctx.font = `900 ${Math.floor(bigSize * scale)}px Georgia, serif`;
      ctx.shadowColor = 'rgba(255, 200, 60, 0.9)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#3a0a05';
      ctx.fillText(String(n), W / 2 + 3, cy + 3);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(String(n), W / 2, cy);
      ctx.shadowBlur = 0;

      ctx.font = `bold ${Math.floor(H * 0.028)}px Georgia, serif`;
      ctx.fillStyle = '#fff8dc';
      // ctx.fillText('GET READY!', W / 2, cy + bigSize * 0.55);
    } else if (this.state === 'rolling' || this.state === 'stopping') {
      const pulse = 0.7 + Math.sin(performance.now() * 0.01) * 0.3;
      ctx.font = `900 ${Math.floor(H * 0.05)}px Georgia, serif`;
      ctx.shadowColor = 'rgba(255, 100, 60, 0.9)';
      ctx.shadowBlur = 20 * pulse;
      ctx.fillStyle = '#ff8844';
      ctx.fillText('ROLLING…', W / 2, cy);
      ctx.shadowBlur = 0;
    } else if (this.state === 'reveal' && this.currentResult) {
      ctx.font = `900 ${Math.floor(H * 0.045)}px Georgia, serif`;
      ctx.shadowColor = 'rgba(80, 220, 120, 0.9)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#3a0a05';
      ctx.fillText('WINNING COLORS!', W / 2 + 2, cy + 2);
      ctx.fillStyle = '#7fffa0';
      ctx.fillText('WINNING COLORS!', W / 2, cy);
      ctx.shadowBlur = 0;

      // Show color names
      ctx.font = `bold ${Math.floor(H * 0.024)}px Georgia, serif`;
      const names = this.currentResult.map(c => this.colorLabels[c]).join(' • ');
      ctx.fillStyle = '#ffd700';
      ctx.fillText(names, W / 2, cy + H * 0.05);
    }

    ctx.restore();
  }

  drawFooter(W, H) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `italic ${Math.floor(H * 0.018)}px Georgia, serif`;
    ctx.fillStyle = '#8a7050';
    ctx.restore();
  }

  start() {
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - this.lastTime) / 1000 || 0);
      this.lastTime = ts;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
