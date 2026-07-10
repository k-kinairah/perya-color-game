class ColorTile extends GameObject {
  constructor(x, y, w, h, colorId, label) {
    super(x, y, w, h);
    this.name = 'ColorTile_' + colorId;
    this.colorId = colorId;
    this.label = label;
    this.highlight = 0;      // 0..1 pulsing highlight amount
    this.winCount = 0;       // 0..3 how many dice landed on this color
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.pulsePhase += dt * (2 + this.winCount * 1.5);
    const target = this.winCount > 0 ? 1 : 0;
    this.highlight += (target - this.highlight) * Math.min(1, dt * 6);
  }

  setWinCount(n) {
    this.winCount = n;
  }

  reset() {
    this.winCount = 0;
  }

  draw(ctx) {
    const c = Die.colorHex(this.colorId);
    const r = Math.min(10, Math.max(7, Math.min(this.width, this.height) * 0.12));
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const gold = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    gold.addColorStop(0, '#fff7bc');
    gold.addColorStop(0.16, '#ffe071');
    gold.addColorStop(0.44, '#b97514');
    gold.addColorStop(0.72, '#f1c34e');
    gold.addColorStop(1, '#6f3d0c');

    // Glow behind tile when winning
    if (this.highlight > 0.05) {
      ctx.save();
      const pulse = 0.7 + Math.sin(this.pulsePhase) * 0.3;
      const glowSize = 24 + this.winCount * 18 * pulse;
      ctx.shadowColor = c.light;
      ctx.shadowBlur = glowSize * this.highlight;
      ctx.fillStyle = c.fill;
      Die._roundRect(ctx, this.x, this.y, this.width, this.height, r);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.58)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Thick gold under-frame
    ctx.fillStyle = gold;
    Die._roundRect(ctx, this.x, this.y, this.width, this.height, r);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    // Tile body
    const inset = Math.max(1, this.height * 0.001);
    const grad = ctx.createLinearGradient(this.x, this.y + inset, this.x, this.y + this.height - inset);
    grad.addColorStop(0, c.glass || c.light);
    grad.addColorStop(0.22, c.light);
    grad.addColorStop(0.55, c.fill);
    grad.addColorStop(1, c.dark);
    ctx.fillStyle = grad;
    Die._roundRect(ctx, this.x + inset, this.y + inset, this.width - inset * 2, this.height - inset * 2, r * 0.68);
    ctx.fill();
    ctx.restore();

    // Glass reflection
    ctx.save();
    const shine = ctx.createLinearGradient(this.x, this.y + inset, this.x, this.y + this.height * 0.55);
    shine.addColorStop(0, 'rgba(255,255,255,0.58)');
    shine.addColorStop(0.36, 'rgba(255,255,255,0.24)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    Die._roundRect(ctx, this.x + inset + 4, this.y + inset + 4, this.width - (inset + 4) * 2, this.height * 0.36, r * 0.55);
    ctx.fill();
    ctx.restore();

    // Gold trim border and bevel lines
   ctx.lineWidth = Math.max(1.6, this.height * 0.022);
    ctx.strokeStyle = this.winCount > 0 ? '#fff8d4' : gold;
    Die._roundRect(ctx, this.x, this.y, this.width, this.height, r);
    ctx.stroke();

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,246,188,0.56)';
    Die._roundRect(
    ctx,
    this.x + 3,
    this.y + 3,
    this.width - 6,
    this.height - 6,
    r * 0.78
);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,7,2,0.48)';
    Die._roundRect(ctx, this.x + inset, this.y + inset, this.width - inset * 2, this.height - inset * 2, r * 0.62);
    ctx.stroke();
    ctx.restore();

    // Label
    ctx.save();
    const labelSize = Math.min(this.height * 0.16, this.width / Math.max(this.label.length * 0.95, 6));
    const labelY = this.y + this.height - Math.max(12, this.height * 0.16);
    ctx.font = `900 ${Math.floor(labelSize)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, labelSize * 0.16);
    ctx.strokeStyle = this.colorId === 'yellow' || this.colorId === 'white'
      ? 'rgba(255,246,180,0.72)'
      : 'rgba(84,45,8,0.82)';
    ctx.strokeText(this.label, cx, labelY);
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = this.colorId === 'yellow' || this.colorId === 'white' ? '#3b2108' : '#fff9df';
    ctx.fillText(this.label, cx, labelY);
    ctx.restore();

    // Win count badge (top-right corner)
    if (this.winCount > 0) {
      ctx.save();
      const badgeR = Math.min(19, Math.max(13, this.height * 0.16));
      const bx = this.x + this.width - badgeR - 7;
      const by = this.y + badgeR + 7;
      ctx.shadowColor = 'rgba(255, 228, 94, .75)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      const badge = ctx.createRadialGradient(bx - badgeR * .35, by - badgeR * .35, 1, bx, by, badgeR);
      badge.addColorStop(0, '#fff8c8');
      badge.addColorStop(.48, '#ffd54a');
      badge.addColorStop(1, '#a45f0b');
      ctx.fillStyle = badge;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#3a1a05';
      ctx.stroke();
      ctx.font = `bold ${Math.floor(badgeR * .95)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a1a05';
      ctx.fillText('x' + this.winCount, bx, by + 1);
      ctx.restore();
    }
  }
}
