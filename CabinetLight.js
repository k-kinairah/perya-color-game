class CabinetLight extends GameObject {
  constructor(x, y, radius, phase, hue) {
    super(x - radius, y - radius, radius * 2, radius * 2);
    this.name = 'CabinetLight';
    this.cx = x;
    this.cy = y;
    this.radius = radius;
    this.phase = phase;
    this.hue = hue;
    this.speed = 1.5;
    this.time = 0;
    this.excitement = 0; // 0..1, driven by Game
  }

  update(dt) {
    this.time += dt * this.speed;
    this.flicker = 0.92 + Math.sin(this.time * 4.7 + this.phase * 1.9) * 0.04 + Math.sin(this.time * 11.3 + this.phase) * 0.025;
    this.excitement = Math.max(0, this.excitement - dt * 0.5);
  }

  setExcitement(v) {
    this.excitement = Math.max(this.excitement, v);
  }

  draw(ctx) {
    const base = 0.58 + 0.42 * (Math.sin(this.time + this.phase) * 0.5 + 0.5);
    const intensity = base * (0.8 + this.excitement * 0.7) * (this.flicker || 1);
    const r = this.radius * (1 + this.excitement * 0.3);

    ctx.save();
    // Soft shadow/socket on the wood.
    ctx.beginPath();
    ctx.arc(this.cx, this.cy + r * 0.2, r * 1.28, 0, Math.PI * 2);
    const socket = ctx.createRadialGradient(this.cx - r * 0.25, this.cy - r * 0.25, r * 0.1, this.cx, this.cy, r * 1.3);
    socket.addColorStop(0, '#fff0a8');
    socket.addColorStop(0.35, '#b86f1d');
    socket.addColorStop(0.72, '#55300f');
    socket.addColorStop(1, '#1a0d05');
    ctx.fillStyle = socket;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = r * 1.1;
    ctx.shadowOffsetY = r * 0.35;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Outer glow
    const glow = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, r * 4.2);
    glow.addColorStop(0, `hsla(${this.hue}, 100%, 76%, ${0.72 * intensity})`);
    glow.addColorStop(0.28, `hsla(${this.hue}, 95%, 58%, ${0.28 * intensity})`);
    glow.addColorStop(1, `hsla(${this.hue}, 90%, 55%, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r * 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Bulb
    const bulb = ctx.createRadialGradient(this.cx - r * 0.32, this.cy - r * 0.34, 0, this.cx, this.cy, r);
    bulb.addColorStop(0, 'rgba(255,255,244,1)');
    bulb.addColorStop(0.22, `hsla(${this.hue}, 100%, 86%, 1)`);
    bulb.addColorStop(0.62, `hsla(${this.hue}, 94%, 60%, ${0.94 + intensity * 0.06})`);
    bulb.addColorStop(1, `hsla(${this.hue}, 78%, 32%, 0.95)`);
    ctx.fillStyle = bulb;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.cx - r * 0.28, this.cy - r * 0.34, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fill();

    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.strokeStyle = 'rgba(255,239,170,0.72)';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.strokeStyle = 'rgba(34,17,5,0.65)';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
