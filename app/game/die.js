class Die extends GameObject {
  constructor(x, y, size) {
    super(x - size / 2, y - size / 2, size, size);
    this.name = 'Die';
    this.cx = x;
    this.cy = y;
    this.size = size;
    this.color = null;      // final resting color id
    this.displayColor = null; // currently drawn face during roll
    this.rolling = false;
    this.rollTime = 0;
    this.rollDuration = 3;
    this.faceTimer = 0;
    this.faceInterval = 0.06;
    this.bounceY = 0;
    this.bounceVy = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.settled = false;
    this.settleWobble = 0;
    this.colors = ['red', 'blue', 'yellow', 'green', 'white', 'pink'];
  }

  startRoll(duration) {
    this.rolling = true;
    this.settled = false;
    this.rollTime = 0;
    this.rollDuration = duration;
    this.faceTimer = 0;
    this.faceInterval = 0.05;
    this.color = null;
    this.displayColor = this.colors[Math.floor(Math.random() * 6)];
    this.rotationSpeed = (Math.random() * 12 + 8) * (Math.random() < 0.5 ? -1 : 1);
    this.bounceVy = -400 - Math.random() * 200;
    this.settleWobble = 0;
  }

  stopRoll(finalColor) {
    this.rolling = false;
    this.settled = true;
    this.color = finalColor;
    this.displayColor = finalColor;
    this.settleWobble = 1;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.bounceY = 0;
    this.bounceVy = -180;
  }

  reset() {
    this.rolling = false;
    this.settled = false;
    this.color = null;
    this.displayColor = null;
    this.bounceY = 0;
    this.bounceVy = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.settleWobble = 0;
  }

  update(dt) {
    if (this.rolling) {
      this.rollTime += dt;
      this.faceTimer += dt;

      // Slow the face-swap toward the end for a cool wind-down feel
      const progress = Math.min(this.rollTime / this.rollDuration, 1);
      this.faceInterval = 0.05 + progress * 0.15;

      if (this.faceTimer >= this.faceInterval) {
        this.faceTimer = 0;
        let next;
        do { next = this.colors[Math.floor(Math.random() * 6)]; }
        while (next === this.displayColor && Math.random() < 0.5);
        this.displayColor = next;
      }

      // Bouncing physics
      this.bounceVy += 1400 * dt;
      this.bounceY += this.bounceVy * dt;
      if (this.bounceY > 0) {
        this.bounceY = 0;
        this.bounceVy *= -0.55;
        if (Math.abs(this.bounceVy) < 60) this.bounceVy = -180 - Math.random() * 120;
      }

      this.rotation += this.rotationSpeed * dt;
      this.rotationSpeed *= (1 - 0.4 * dt);
    } else if (this.settled) {
      // Small settle bounce
      this.bounceVy += 1400 * dt;
      this.bounceY += this.bounceVy * dt;
      if (this.bounceY > 0) {
        this.bounceY = 0;
        this.bounceVy *= -0.4;
        if (Math.abs(this.bounceVy) < 30) { this.bounceVy = 0; this.bounceY = 0; }
      }
      this.settleWobble = Math.max(0, this.settleWobble - dt * 2.5);
    }
  }

  static colorHex(id) {
    switch (id) {
      case 'red':    return { fill: '#e63946', dark: '#8a1e28', light: '#ff6b74' };
      case 'blue':   return { fill: '#1d70d6', dark: '#0e3a75', light: '#5aa3ec' };
      case 'yellow': return { fill: '#f5c518', dark: '#8a6b06', light: '#ffe066' };
      case 'green':  return { fill: '#2ea043', dark: '#155023', light: '#65d17d' };
      case 'white':  return { fill: '#f4f0e6', dark: '#8a8577', light: '#ffffff' };
      case 'pink':   return { fill: '#ec5c9a', dark: '#8a2757', light: '#ffa0c9' };
      default:       return { fill: '#555', dark: '#222', light: '#888' };
    }
  }

  draw(ctx) {
    const drawY = this.cy + this.bounceY;
    const s = this.size * (1 + this.settleWobble * 0.05 * Math.sin(this.settleWobble * 20));

    ctx.save();
    // Shadow on the ground
    const shadowScale = 1 - Math.min(0.6, -this.bounceY / 300);
    ctx.globalAlpha = 0.45 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.cx, this.cy + this.size * 0.55, this.size * 0.5 * shadowScale, this.size * 0.14 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.translate(this.cx, drawY);
    ctx.rotate(this.rotation);

    const c = Die.colorHex(this.displayColor || 'white');
    const half = s / 2;
    const r = s * 0.12;

    // Die body — rounded rect with gradient
    const grad = ctx.createLinearGradient(-half, -half, half, half);
    grad.addColorStop(0, c.light);
    grad.addColorStop(0.5, c.fill);
    grad.addColorStop(1, c.dark);
    ctx.fillStyle = grad;
    Die._roundRect(ctx, -half, -half, s, s, r);
    ctx.fill();

    // Inner border / bevel
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.strokeStyle = c.dark;
    ctx.stroke();

    // Highlight streak
    ctx.save();
    ctx.globalAlpha = 0.35;
    const hi = ctx.createLinearGradient(-half, -half, -half + s * 0.4, -half + s * 0.4);
    hi.addColorStop(0, 'rgba(255,255,255,0.9)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    Die._roundRect(ctx, -half + s * 0.06, -half + s * 0.06, s * 0.5, s * 0.5, r * 0.6);
    ctx.fill();
    ctx.restore();

    // Draw a color disc in the center (like a perya die face)
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    const disc = ctx.createRadialGradient(-s * 0.08, -s * 0.08, s * 0.05, 0, 0, s * 0.32);
    disc.addColorStop(0, c.light);
    disc.addColorStop(0.6, c.fill);
    disc.addColorStop(1, c.dark);
    ctx.fillStyle = disc;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.025);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  static _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
