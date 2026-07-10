class Particle extends GameObject {
  constructor(x, y, vx, vy, color, life, size) {
    super(x - size / 2, y - size / 2, size, size);
    this.name = 'Particle';
    this.cx = x;
    this.cy = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.gravity = 400;
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy += this.gravity * dt;
    this.cx += this.vx * dt;
    this.cy += this.vy * dt;
  }

  draw(ctx) {
    const t = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.size * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
