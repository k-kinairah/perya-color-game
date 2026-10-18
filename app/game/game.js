class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.entities = [];
    this.lastTime = 0;

    this.colors = ['red', 'blue', 'yellow', 'green', 'white', 'pink'];
    this.colorLabels = {
      red: 'PULA', blue: 'ASUL', yellow: 'DILAW',
      green: 'BERDE', white: 'PUTI', pink: 'ROSAS'
    };

    this.settings = {
      countdownDuration: 5,
      rollDuration: 3,
      revealDuration: 6,
      autoRoll: false,
      soundEnabled: true,
      riggedResult: null
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
    this.particles = [];
    this.history = []; // array of arrays of color ids, most recent first
    this.currentResult = null;

    this.rollBtn = document.getElementById('rollBtn');
    this.rollBtn.addEventListener('click', () => this.tryStartRoll(false));

    // WebAudio for perya sound effects (synthesized, no assets)
    this.audioCtx = null;

    this.setupResize();
    this.setup();

    this.adminPanel = new AdminPanel(this);

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
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain || 0.15, now + 0.01);
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
    const tilesRegionY = H * 0.60;
    const tilesRegionH = H * 0.20;
    const tilesRegionW = Math.min(W * 0.85, 1200);
    const tileGap = tilesRegionW * 0.015;
    const tileW = (tilesRegionW - tileGap * 5) / 6;
    const tileH = tilesRegionH;
    const startX = (W - tilesRegionW) / 2;
    for (let i = 0; i < 6; i++) {
      const cid = this.colors[i];
      const tile = new ColorTile(
        startX + i * (tileW + tileGap),
        tilesRegionY,
        tileW, tileH,
        cid,
        this.colorLabels[cid]
      );
      this.tiles.push(tile);
      this.entities.push(tile);
    }

    // Cabinet lights along the top arch
    const lightCount = 20;
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
    this.rollBtn.disabled = true;
    this.playTick();
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
    let finalColors;
    if (this.settings.riggedResult && this.colors.includes(this.settings.riggedResult)) {
      finalColors = [this.settings.riggedResult, this.settings.riggedResult, this.settings.riggedResult];
    } else {
      finalColors = [
        this.colors[Math.floor(Math.random() * 6)],
        this.colors[Math.floor(Math.random() * 6)],
        this.colors[Math.floor(Math.random() * 6)]
      ];
    }
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
  }

  resetRound() {
    this.state = 'idle';
    this.stateTimer = 0;
    this.currentResult = null;
    for (const t of this.tiles) t.reset();
    for (const d of this.dice) d.reset();
    this.rollBtn.disabled = false;
  }

  clearHistory() {
    this.history = [];
    this.stats.totalRolls = 0;
    this.stats.colorCounts = { red: 0, blue: 0, yellow: 0, green: 0, white: 0, pink: 0 };
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
      }
    } else if (this.state === 'reveal') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.resetRound();
        if (this.settings.autoRoll) {
          setTimeout(() => this.tryStartRoll(false), 400);
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

    if (this.adminPanel) this.adminPanel.refreshStats();
  }

  // ==== DRAW ====

  draw() {
    const W = this.viewW || this.canvas.width;
    const H = this.viewH || this.canvas.height;
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, W, H);

    this.drawBackground(W, H);
    this.drawCabinet(W, H);

    // Lights (behind the wood trim frame but on top of bg)
    for (const l of this.lights) l.draw(ctx);

    this.drawHeader(W, H);
    this.drawHistory(W, H);
    this.drawDiceStage(W, H);

    // Dice
    for (const d of this.dice) d.draw(ctx);

    // Tiles
    for (const t of this.tiles) t.draw(ctx);

    // Particles
    for (const p of this.particles) p.draw(ctx);

    this.drawCenterMessage(W, H);
    this.drawFooter(W, H);
  }

  drawBackground(W, H) {
    const ctx = this.ctx;
    // Deep carnival red-brown radial
    const bg = ctx.createRadialGradient(W / 2, H * 0.55, W * 0.1, W / 2, H * 0.55, W * 0.9);
    bg.addColorStop(0, '#3a1a10');
    bg.addColorStop(0.5, '#1e0d06');
    bg.addColorStop(1, '#0a0402');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial spotlight
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spot = ctx.createRadialGradient(W / 2, H * 0.42, 20, W / 2, H * 0.42, W * 0.4);
    spot.addColorStop(0, 'rgba(255, 210, 120, 0.18)');
    spot.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawCabinet(W, H) {
    const ctx = this.ctx;

    // Outer wooden frame
    const inset = Math.min(30, W * 0.02);
    const woodGrad = ctx.createLinearGradient(0, 0, 0, H);
    woodGrad.addColorStop(0, '#5a2f18');
    woodGrad.addColorStop(0.5, '#3a1c0d');
    woodGrad.addColorStop(1, '#2a1408');

    // Draw wood frame around the edges (as thick border)
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, W, inset);
    ctx.fillRect(0, H - inset, W, inset);
    ctx.fillRect(0, 0, inset, H);
    ctx.fillRect(W - inset, 0, inset, H);

    // Wood grain streaks
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#1a0a04';
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const y = Math.random() * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y + (Math.random() - 0.5) * 4, W * 0.7, y + (Math.random() - 0.5) * 4, W, y);
      ctx.stroke();
    }
    ctx.restore();

    // Gold trim on inner edge of frame
    ctx.save();
    const trim = ctx.createLinearGradient(0, inset - 4, 0, inset + 4);
    trim.addColorStop(0, '#7a5010');
    trim.addColorStop(0.5, '#ffe066');
    trim.addColorStop(1, '#7a5010');
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(255, 200, 80, 0.6)';
    ctx.shadowBlur = 12;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    ctx.restore();

    // Inner gold trim double line
    ctx.save();
    ctx.strokeStyle = '#c9a24d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inset + 8, inset + 8, W - (inset + 8) * 2, H - (inset + 8) * 2);
    ctx.restore();
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

    const bgrad = ctx.createLinearGradient(bx, by, bx, by + bannerH);
    bgrad.addColorStop(0, '#8a1a15');
    bgrad.addColorStop(0.5, '#c22a22');
    bgrad.addColorStop(1, '#6a0f0a');
    ctx.fillStyle = bgrad;
    Die._roundRect(ctx, bx, by, bannerW, bannerH, bannerH * 0.25);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffd700';
    ctx.shadowColor = 'rgba(255, 210, 100, 0.6)';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Title text
    ctx.font = `900 ${Math.floor(bannerH * 0.45)}px Georgia, serif`;
    ctx.fillStyle = '#3a0a05';
    ctx.fillText('PERYA COLOR GAME', W / 2 + 2, cy + 2);
    ctx.fillStyle = '#fff8dc';
    ctx.fillText('PERYA COLOR GAME', W / 2, cy);

    // Subtitle
    ctx.font = `italic ${Math.floor(bannerH * 0.18)}px Georgia, serif`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText('★ Kulay ng Suwerte ★', W / 2, cy + bannerH * 0.4);

    ctx.restore();
  }

  drawHistory(W, H) {
    const ctx = this.ctx;
    // Top-left small history panel
    const panelW = Math.min(220, W * 0.18);
    const panelH = Math.min(280, H * 0.4);
    const px = W * 0.035 + 20;
    const py = H * 0.16;

    ctx.save();
    ctx.fillStyle = 'rgba(20, 10, 5, 0.75)';
    Die._roundRect(ctx, px, py, panelW, panelH, 10);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#c9a24d';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.floor(panelH * 0.09)}px Georgia, serif`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText('PREVIOUS', px + panelW / 2, py + 8);
    ctx.fillText('RESULTS', px + panelW / 2, py + 8 + panelH * 0.1);

    // Rows
    const rows = Math.min(this.history.length, 8);
    const rowY0 = py + panelH * 0.28;
    const rowH = (panelH - (panelH * 0.28) - 10) / 8;
    const dotR = Math.min(rowH * 0.35, panelW * 0.09);

    for (let i = 0; i < rows; i++) {
      const result = this.history[i];
      const y = rowY0 + i * rowH + rowH / 2;
      const alpha = 1 - i * 0.07;
      ctx.globalAlpha = alpha;
      // Row index
      ctx.textAlign = 'left';
      ctx.font = `bold ${Math.floor(rowH * 0.45)}px monospace`;
      ctx.fillStyle = '#b89968';
      ctx.fillText(String(i + 1).padStart(2, '0'), px + 10, y - rowH * 0.22);
      // Dots
      const dotsStartX = px + panelW - dotR * 8;
      for (let j = 0; j < 3; j++) {
        const cid = result[j];
        const cx = dotsStartX + j * (dotR * 2.4);
        const cy2 = y;
        const c = Die.colorHex(cid);
        ctx.beginPath();
        ctx.arc(cx, cy2, dotR, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(cx - dotR * 0.3, cy2 - dotR * 0.3, 0, cx, cy2, dotR);
        g.addColorStop(0, c.light);
        g.addColorStop(1, c.dark);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
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
    // The dice stage — a felt-covered platform beneath the three dice
    const stageY = H * 0.42 + Math.min(W * 0.11, H * 0.18, 160) * 0.55;
    const stageW = Math.min(W * 0.55, 800);
    const stageH = H * 0.05;
    const sx = (W - stageW) / 2;

    ctx.save();
    const felt = ctx.createLinearGradient(sx, stageY, sx, stageY + stageH);
    felt.addColorStop(0, '#0e5432');
    felt.addColorStop(1, '#062818');
    ctx.fillStyle = felt;
    Die._roundRect(ctx, sx, stageY, stageW, stageH, stageH * 0.4);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c9a24d';
    ctx.stroke();
    ctx.restore();
  }

  drawCenterMessage(W, H) {
    const ctx = this.ctx;
    const cy = H * 0.24;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'idle') {
      ctx.font = `italic ${Math.floor(H * 0.03)}px Georgia, serif`;
      ctx.fillStyle = '#d4b878';
      ctx.fillText('Press ROLL to begin the round', W / 2, cy);
    } else if (this.state === 'countdown') {
      const bigSize = Math.floor(H * 0.18);
      const n = this.countdownRemaining;
      const t = 1 - (this.stateTimer % 1);
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
      ctx.fillText('GET READY!', W / 2, cy + bigSize * 0.55);
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
    ctx.fillText('★ For entertainment purposes only ★', W / 2, H - 8);
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
