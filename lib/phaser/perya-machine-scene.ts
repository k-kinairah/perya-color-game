type PhaserNamespace = typeof import("phaser");

const WORLD_WIDTH = 1920;
const WORLD_HEIGHT = 1080;
const COUNTDOWN_START_SECONDS = 10;
const ROUND_STATES = ["Waiting", "Betting Open", "Rolling", "Reveal", "Reset"] as const;
const PLACEHOLDER_WINNING_COLORS = ["yellow", "blue", "white"] as const;

export type RoundState = (typeof ROUND_STATES)[number];
type BettingColorId = (typeof PLACEHOLDER_WINNING_COLORS)[number] | "pink" | "red" | "green";

interface RoundStateChange {
  current: RoundState;
  previous: RoundState | null;
}

type RoundStateListener = (change: RoundStateChange) => void;

const NEXT_ROUND_STATE: Record<RoundState, RoundState> = {
  Waiting: "Betting Open",
  "Betting Open": "Rolling",
  Rolling: "Reveal",
  Reveal: "Reset",
  Reset: "Waiting",
};

class RoundStateMachine {
  private currentState: RoundState;
  private listeners = new Set<RoundStateListener>();

  constructor(initialState: RoundState = "Waiting") {
    this.currentState = initialState;
  }

  get state() {
    return this.currentState;
  }

  advance() {
    this.transitionTo(NEXT_ROUND_STATE[this.currentState]);
  }

  subscribe(listener: RoundStateListener) {
    this.listeners.add(listener);
    listener({ current: this.currentState, previous: null });

    return () => {
      this.listeners.delete(listener);
    };
  }

  transitionTo(nextState: RoundState) {
    if (!ROUND_STATES.includes(nextState)) {
      return;
    }

    if (nextState === this.currentState) {
      return;
    }

    const previous = this.currentState;
    this.currentState = nextState;
    this.listeners.forEach((listener) => {
      listener({ current: this.currentState, previous });
    });
  }
}

export function createPeryaMachineScene(Phaser: PhaserNamespace) {
  class Cabinet extends Phaser.GameObjects.Container {
    constructor(scene: Phaser.Scene) {
      super(scene, 0, 0);
      scene.add.existing(this);
      this.draw(scene);
    }

    private draw(scene: Phaser.Scene) {
      const g = scene.add.graphics();
      this.add(g);

      g.fillStyle(0x15100d, 1);
      g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      g.fillStyle(0x000000, 0.46);
      g.fillRoundedRect(138, 88, 1660, 948, 38);
      g.fillStyle(0x000000, 0.22);
      g.fillRoundedRect(92, 68, 1748, 950, 42);

      g.fillStyle(0x2a1106, 1);
      g.fillRoundedRect(76, 34, 1768, 986, 44);
      g.fillStyle(0x4b210b, 1);
      g.fillRoundedRect(108, 62, 1704, 930, 34);
      g.fillStyle(0x7c4115, 1);
      g.fillRoundedRect(148, 96, 1624, 856, 24);
      g.fillStyle(0xd19329, 1);
      g.fillRoundedRect(188, 132, 1544, 780, 16);

      const innerWall = [
        new Phaser.Math.Vector2(244, 176),
        new Phaser.Math.Vector2(1676, 176),
        new Phaser.Math.Vector2(1608, 884),
        new Phaser.Math.Vector2(312, 884),
      ];
      g.fillStyle(0x0f7c83, 1);
      g.fillPoints(innerWall, true);

      g.lineStyle(16, 0xffdc5d, 1);
      g.strokeRoundedRect(120, 70, 1680, 914, 34);
      g.lineStyle(8, 0x2a1308, 1);
      g.strokeRoundedRect(176, 124, 1568, 800, 18);

      g.fillStyle(0xffffff, 0.12);
      g.fillRect(176, 126, 1490, 12);
      g.fillStyle(0x000000, 0.22);
      g.fillRect(232, 878, 1410, 18);
    }
  }

  class IndicatorPanel extends Phaser.GameObjects.Container {
    constructor(scene: Phaser.Scene) {
      super(scene, 0, 0);
      scene.add.existing(this);
      this.draw(scene);
    }

    private draw(scene: Phaser.Scene) {
      const g = scene.add.graphics();
      this.add(g);

      g.fillStyle(0x000000, 0.28);
      g.fillRoundedRect(376, 178, 1184, 184, 18);
      g.fillStyle(0x2b1509, 1);
      g.fillRoundedRect(338, 128, 1244, 218, 20);
      g.fillStyle(0xe4a92c, 1);
      g.fillRoundedRect(370, 154, 1180, 166, 14);
      g.fillStyle(0x7b3b12, 1);
      g.fillRoundedRect(420, 194, 1080, 86, 8);
      g.lineStyle(12, 0x1c0c04, 1);
      g.strokeRoundedRect(338, 128, 1244, 218, 20);
      g.lineStyle(6, 0xffef9e, 0.82);
      g.strokeRoundedRect(392, 172, 1136, 126, 10);

      const slots = [532, 776, 1020, 1264];
      slots.forEach((x) => {
        g.fillStyle(0x1a0b05, 1);
        g.fillRoundedRect(x, 216, 158, 52, 4);
        g.fillStyle(0xff2538, 1);
        g.fillCircle(x + 37, 242, 17);
        g.fillStyle(0xffd92e, 1);
        g.fillCircle(x + 79, 242, 17);
        g.fillStyle(0x1ccb70, 1);
        g.fillCircle(x + 121, 242, 17);
      });
    }
  }

  class Playfield extends Phaser.GameObjects.Container {
    constructor(scene: Phaser.Scene) {
      super(scene, 0, 0);
      scene.add.existing(this);
      this.draw(scene);
    }

    private draw(scene: Phaser.Scene) {
      const g = scene.add.graphics();
      this.add(g);

      const rim = [
        new Phaser.Math.Vector2(330, 370),
        new Phaser.Math.Vector2(1590, 370),
        new Phaser.Math.Vector2(1736, 816),
        new Phaser.Math.Vector2(184, 816),
      ];
      const field = [
        new Phaser.Math.Vector2(386, 418),
        new Phaser.Math.Vector2(1534, 418),
        new Phaser.Math.Vector2(1636, 758),
        new Phaser.Math.Vector2(284, 758),
      ];
      const innerField = [
        new Phaser.Math.Vector2(430, 454),
        new Phaser.Math.Vector2(1490, 454),
        new Phaser.Math.Vector2(1572, 728),
        new Phaser.Math.Vector2(348, 728),
      ];

      g.fillStyle(0x000000, 0.34);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(348, 404),
          new Phaser.Math.Vector2(1608, 404),
          new Phaser.Math.Vector2(1762, 850),
          new Phaser.Math.Vector2(194, 850),
        ],
        true,
      );
      g.fillStyle(0x087b83, 1);
      g.fillPoints(rim, true);
      g.fillStyle(0x0b969d, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(330, 370),
          new Phaser.Math.Vector2(1590, 370),
          new Phaser.Math.Vector2(1534, 418),
          new Phaser.Math.Vector2(386, 418),
        ],
        true,
      );
      g.fillStyle(0x065b62, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(284, 758),
          new Phaser.Math.Vector2(1636, 758),
          new Phaser.Math.Vector2(1736, 816),
          new Phaser.Math.Vector2(184, 816),
        ],
        true,
      );
      g.fillStyle(0x076a72, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(330, 370),
          new Phaser.Math.Vector2(386, 418),
          new Phaser.Math.Vector2(284, 758),
          new Phaser.Math.Vector2(184, 816),
        ],
        true,
      );
      g.fillStyle(0x0a8990, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(1590, 370),
          new Phaser.Math.Vector2(1736, 816),
          new Phaser.Math.Vector2(1636, 758),
          new Phaser.Math.Vector2(1534, 418),
        ],
        true,
      );
      g.fillStyle(0x064c55, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(184, 816),
          new Phaser.Math.Vector2(1736, 816),
          new Phaser.Math.Vector2(1650, 858),
          new Phaser.Math.Vector2(270, 858),
        ],
        true,
      );
      g.fillGradientStyle(0xffdf35, 0xffcf24, 0xdb971b, 0xc38312, 1);
      g.fillPoints(field, true);
      g.fillStyle(0x000000, 0.12);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(386, 418),
          new Phaser.Math.Vector2(1534, 418),
          new Phaser.Math.Vector2(1490, 454),
          new Phaser.Math.Vector2(430, 454),
        ],
        true,
      );
      g.fillGradientStyle(0xffe657, 0xffd42f, 0xe0a124, 0xc48314, 0.94);
      g.fillPoints(innerField, true);
      g.lineStyle(14, 0xc17c0e, 0.84);
      g.strokePoints([...field, field[0]], false);
      g.lineStyle(7, 0xfff2a6, 0.82);
      g.strokePoints([...field, field[0]], false);
      g.lineStyle(4, 0xffffff, 0.36);
      g.strokePoints([...innerField, innerField[0]], false);

      g.fillStyle(0xffffff, 0.12);
      g.fillEllipse(880, 512, 690, 92);
      g.fillStyle(0xffffff, 0.08);
      g.fillEllipse(1170, 548, 520, 70);
      g.fillStyle(0x9c640f, 0.2);
      g.fillEllipse(960, 710, 990, 80);
      g.fillStyle(0x744709, 0.16);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(360, 704),
          new Phaser.Math.Vector2(1560, 704),
          new Phaser.Math.Vector2(1636, 758),
          new Phaser.Math.Vector2(284, 758),
        ],
        true,
      );
    }
  }

  class Dice extends Phaser.GameObjects.Container {
    private dice: Array<{
      body: Phaser.GameObjects.Container;
      homeRotation: number;
      homeX: number;
      homeY: number;
    }> = [];

    constructor(scene: Phaser.Scene) {
      super(scene, 0, 0);
      scene.add.existing(this);
      this.draw();
    }

    private draw() {
      const positions = [
        { x: 726, y: 584, rotation: -0.22, colors: [0xffdf30, 0xf4f4ec, 0xee35a8] },
        { x: 960, y: 640, rotation: 0.08, colors: [0x2d73ff, 0xff303f, 0x18c56f] },
        { x: 1194, y: 584, rotation: 0.22, colors: [0xf4f4ec, 0xee35a8, 0xffdf30] },
      ];

      positions.forEach((position) => {
        const die = this.scene.add.container(position.x, position.y);
        die.setRotation(position.rotation);
        this.add(die);
        this.drawDieShadow(die);
        this.drawColorDie(die, position.colors);
        this.dice.push({
          body: die,
          homeRotation: position.rotation,
          homeX: position.x,
          homeY: position.y,
        });
      });
    }

    roll(onComplete?: () => void) {
      const paths = [
        [
          { x: 828, y: 524, rotation: 1.35, scale: 1.08, duration: 170 },
          { x: 690, y: 658, rotation: 2.82, scale: 0.96, duration: 230 },
          { x: 842, y: 578, rotation: 4.08, scale: 1.04, duration: 310 },
          { x: 740, y: 624, rotation: 5.08, scale: 0.99, duration: 410 },
        ],
        [
          { x: 1034, y: 548, rotation: 1.64, scale: 1.08, duration: 180 },
          { x: 904, y: 692, rotation: 3.34, scale: 0.95, duration: 250 },
          { x: 1070, y: 610, rotation: 4.72, scale: 1.03, duration: 340 },
          { x: 960, y: 640, rotation: 5.92, scale: 1, duration: 450 },
        ],
        [
          { x: 1088, y: 526, rotation: -1.25, scale: 1.08, duration: 170 },
          { x: 1262, y: 654, rotation: -2.78, scale: 0.96, duration: 230 },
          { x: 1104, y: 586, rotation: -4.18, scale: 1.04, duration: 310 },
          { x: 1192, y: 620, rotation: -5.26, scale: 0.99, duration: 410 },
        ],
      ];

      let completedDice = 0;
      this.dice.forEach((die, index) => {
        this.scene.tweens.killTweensOf(die.body);
        this.animateDiePath(die, paths[index], 0, index * 55, () => {
          completedDice += 1;

          if (completedDice === this.dice.length) {
            onComplete?.();
          }
        });
      });
    }

    private drawDieShadow(die: Phaser.GameObjects.Container) {
      const shadow = this.scene.add.graphics();
      die.add(shadow);

      shadow.fillStyle(0x2c1a08, 0.16);
      shadow.fillEllipse(46, 158, 350, 94);
      shadow.fillStyle(0x2c1a08, 0.28);
      shadow.fillEllipse(20, 140, 250, 66);
      shadow.fillStyle(0x1b1005, 0.34);
      shadow.fillEllipse(-4, 124, 164, 38);
    }

    private drawColorDie(die: Phaser.GameObjects.Container, colors: number[]) {
      const g = this.scene.add.graphics();
      die.add(g);

      const top = [
        new Phaser.Math.Vector2(-106, -62),
        new Phaser.Math.Vector2(-26, -122),
        new Phaser.Math.Vector2(104, -82),
        new Phaser.Math.Vector2(28, -20),
      ];
      const left = [
        new Phaser.Math.Vector2(-106, -62),
        new Phaser.Math.Vector2(28, -20),
        new Phaser.Math.Vector2(28, 116),
        new Phaser.Math.Vector2(-106, 68),
      ];
      const right = [
        new Phaser.Math.Vector2(28, -20),
        new Phaser.Math.Vector2(104, -82),
        new Phaser.Math.Vector2(104, 54),
        new Phaser.Math.Vector2(28, 116),
      ];

      g.fillStyle(0x000000, 0.16);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(-118, -54),
          new Phaser.Math.Vector2(-30, -134),
          new Phaser.Math.Vector2(116, -90),
          new Phaser.Math.Vector2(116, 62),
          new Phaser.Math.Vector2(30, 130),
          new Phaser.Math.Vector2(-118, 76),
        ],
        true,
      );

      g.fillStyle(this.mixColor(colors[0], 0xffffff, 0.2), 1);
      g.fillPoints(top, true);
      g.fillStyle(colors[1], 1);
      g.fillPoints(left, true);
      g.fillStyle(this.mixColor(colors[2], 0x000000, 0.14), 1);
      g.fillPoints(right, true);

      g.lineStyle(13, 0xf8f0d0, 0.95);
      g.strokePoints([...top, top[0]], false);
      g.strokePoints([...left, left[0]], false);
      g.strokePoints([...right, right[0]], false);
      g.lineStyle(5, 0x7b5c24, 0.62);
      g.strokePoints([...top, top[0]], false);
      g.strokePoints([...left, left[0]], false);
      g.strokePoints([...right, right[0]], false);

      this.drawFaceHighlight(g, top, 0.18);
      this.drawFaceHighlight(g, left, 0.14);
      this.drawFaceHighlight(g, right, 0.12);
      this.drawRoundedCorners(g);
    }

    private drawFaceHighlight(
      g: Phaser.GameObjects.Graphics,
      points: Phaser.Math.Vector2[],
      alpha: number,
    ) {
      const center = points.reduce(
        (sum, point) => new Phaser.Math.Vector2(sum.x + point.x, sum.y + point.y),
        new Phaser.Math.Vector2(0, 0),
      );
      center.x /= points.length;
      center.y /= points.length;

      const inset = points.map(
        (point) =>
          new Phaser.Math.Vector2(
            center.x + (point.x - center.x) * 0.58,
            center.y + (point.y - center.y) * 0.58,
          ),
      );

      g.fillStyle(0xffffff, alpha);
      g.fillPoints(inset, true);
    }

    private drawRoundedCorners(g: Phaser.GameObjects.Graphics) {
      const cornerPoints = [
        [-106, -62],
        [-26, -122],
        [104, -82],
        [104, 54],
        [28, 116],
        [-106, 68],
      ];

      g.fillStyle(0xffffff, 0.46);
      cornerPoints.forEach(([x, y]) => {
        g.fillCircle(x, y, 12);
      });
      g.fillStyle(0xffffff, 0.2);
      g.fillEllipse(-36, -78, 76, 22);
      g.fillEllipse(-48, -12, 54, 18);
    }

    private mixColor(from: number, to: number, amount: number) {
      const fromColor = Phaser.Display.Color.IntegerToColor(from);
      const toColor = Phaser.Display.Color.IntegerToColor(to);
      return Phaser.Display.Color.Interpolate.ColorWithColor(
        fromColor,
        toColor,
        100,
        amount * 100,
      ).color;
    }

    private animateDiePath(
      die: {
        body: Phaser.GameObjects.Container;
        homeRotation: number;
        homeX: number;
        homeY: number;
      },
      path: Array<{
        duration: number;
        rotation: number;
        scale: number;
        x: number;
        y: number;
      }>,
      stepIndex: number,
      delay = 0,
      onComplete?: () => void,
    ) {
      const step = path[stepIndex];

      if (!step) {
        this.scene.tweens.add({
        targets: die.body,
        delay,
        duration: 560,
          ease: "Sine.easeOut",
          rotation: die.homeRotation,
          scaleX: 1,
          scaleY: 1,
          x: die.homeX,
          y: die.homeY,
          onComplete,
        });
        return;
      }

      this.scene.tweens.add({
        targets: die.body,
        delay,
        duration: step.duration,
        ease: "Sine.easeInOut",
        rotation: die.homeRotation + step.rotation,
        scaleX: step.scale,
        scaleY: step.scale,
        x: step.x,
        y: step.y,
        onComplete: () => {
          this.animateDiePath(die, path, stepIndex + 1, 0, onComplete);
        },
      });
    }
  }

  class BettingBoard extends Phaser.GameObjects.Container {
    private highlightOverlays = new Map<BettingColorId, Phaser.GameObjects.Graphics>();

    constructor(scene: Phaser.Scene) {
      super(scene, 0, 0);
      scene.add.existing(this);
      this.draw(scene);
    }

    private draw(scene: Phaser.Scene) {
      const g = scene.add.graphics();
      this.add(g);

      g.fillStyle(0x000000, 0.34);
      g.fillRoundedRect(288, 858, 1344, 134, 12);
      g.fillStyle(0x183234, 1);
      g.fillRoundedRect(304, 828, 1312, 136, 12);
      g.fillStyle(0x0b555d, 1);
      g.fillRoundedRect(334, 852, 1252, 88, 8);
      g.lineStyle(10, 0x2c1607, 1);
      g.strokeRoundedRect(304, 828, 1312, 136, 12);
      g.lineStyle(6, 0xf4c247, 1);
      g.strokeRoundedRect(334, 852, 1252, 88, 8);

      const tileSize = 112;
      const tileGap = 18;
      const boardWidth = tileSize * 6 + tileGap * 5;
      const startX = (WORLD_WIDTH - boardWidth) / 2;
      const tileY = 840;
      const colors: Array<{ color: number; id: BettingColorId }> = [
        { color: 0xffdf30, id: "yellow" },
        { color: 0xf4f4ec, id: "white" },
        { color: 0xee35a8, id: "pink" },
        { color: 0x2d73ff, id: "blue" },
        { color: 0xff303f, id: "red" },
        { color: 0x18c56f, id: "green" },
      ];

      colors.forEach(({ color, id }, index) => {
        const x = startX + index * (tileSize + tileGap);

        g.fillStyle(0x000000, 0.26);
        g.fillRoundedRect(x + 8, tileY + 10, tileSize, tileSize, 8);

        g.fillStyle(0x050505, 1);
        g.fillRoundedRect(x, tileY, tileSize, tileSize, 8);
        g.fillStyle(color, 1);
        g.fillRoundedRect(x + 10, tileY + 10, tileSize - 20, tileSize - 20, 4);

        g.fillStyle(0xffffff, 0.22);
        g.fillRoundedRect(x + 18, tileY + 18, tileSize - 36, 22, 4);
        g.fillStyle(0xffffff, 0.1);
        g.fillRect(x + 18, tileY + 42, tileSize - 36, 18);

        g.lineStyle(4, 0xffffff, 0.34);
        g.strokeRoundedRect(x + 14, tileY + 14, tileSize - 28, tileSize - 28, 4);
        g.lineStyle(5, 0x000000, 0.7);
        g.strokeRoundedRect(x + 10, tileY + 10, tileSize - 20, tileSize - 20, 4);
        this.createHighlightOverlay(id, x, tileY, tileSize);
      });
    }

    highlightWinningColors(colorIds: readonly BettingColorId[]) {
      this.highlightOverlays.forEach((overlay) => {
        this.scene.tweens.killTweensOf(overlay);
        overlay.setAlpha(0);
      });

      colorIds.forEach((colorId) => {
        const overlay = this.highlightOverlays.get(colorId);

        if (!overlay) {
          return;
        }

        overlay.setAlpha(0.2);
        this.scene.tweens.add({
          targets: overlay,
          alpha: 1,
          duration: 360,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            overlay.setAlpha(0.85);
            this.scene.tweens.add({
              targets: overlay,
              alpha: 0,
              delay: 3000,
              duration: 520,
              ease: "Sine.easeOut",
            });
          },
        });
      });
    }

    private createHighlightOverlay(
      colorId: BettingColorId,
      x: number,
      y: number,
      size: number,
    ) {
      const overlay = this.scene.add.graphics();
      this.add(overlay);

      overlay.fillStyle(0xfff4a8, 0.22);
      overlay.fillRoundedRect(x - 8, y - 8, size + 16, size + 16, 12);
      overlay.lineStyle(8, 0xfff5b5, 0.86);
      overlay.strokeRoundedRect(x - 8, y - 8, size + 16, size + 16, 12);
      overlay.lineStyle(4, 0xffffff, 0.9);
      overlay.strokeRoundedRect(x + 4, y + 4, size - 8, size - 8, 8);
      overlay.setAlpha(0);
      this.highlightOverlays.set(colorId, overlay);
    }
  }

  return class PeryaMachineScene extends Phaser.Scene {
    private debugStateText?: Phaser.GameObjects.Text;
    private countdownText?: Phaser.GameObjects.Text;
    private countdownTimer?: Phaser.Time.TimerEvent;
    private countdownRemaining = COUNTDOWN_START_SECONDS;
    private bettingBoard?: BettingBoard;
    private dice?: Dice;
    private unsubscribeRoundState?: () => void;
    private roundStateMachine = new RoundStateMachine("Betting Open");

    constructor() {
      super("PeryaMachineScene");
    }

    create() {
      this.cameras.main.setBackgroundColor("#15100d");
      new Cabinet(this);
      new IndicatorPanel(this);
      new Playfield(this);
      this.dice = new Dice(this);
      this.bettingBoard = new BettingBoard(this);
      this.createDebugStateLabel();
      this.createCountdownLabel();
      this.unsubscribeRoundState = this.roundStateMachine.subscribe((change) => {
        this.handleRoundStateChange(change);
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.disposeRoundStateSubscription();
      });
    }

    setRoundState(nextState: RoundState) {
      this.roundStateMachine.transitionTo(nextState);
    }

    advanceRoundState() {
      this.roundStateMachine.advance();
    }

    getRoundState() {
      return this.roundStateMachine.state;
    }

    private createDebugStateLabel() {
      this.debugStateText = this.add
        .text(28, 24, "", {
          backgroundColor: "rgba(0, 0, 0, 0.58)",
          color: "#fff4b8",
          fontFamily: "Arial",
          fontSize: "28px",
          fontStyle: "900",
          padding: {
            x: 16,
            y: 10,
          },
        })
        .setDepth(1000);
    }

    private createCountdownLabel() {
      this.countdownText = this.add
        .text(960, 4, "", {
          backgroundColor: "rgba(0, 0, 0, 0.62)",
          color: "#ffffff",
          fontFamily: "Arial",
          fontSize: "34px",
          fontStyle: "900",
          padding: {
            x: 18,
            y: 8,
          },
        })
        .setOrigin(0.5, 0)
        .setDepth(1000);
      this.updateCountdownLabel();
    }

    private handleRoundStateChange(change: RoundStateChange) {
      this.debugStateText?.setText(`State: ${change.current}`);
      if (change.current === "Betting Open") {
        this.startBettingCountdown();
      } else {
        this.stopCountdown();
      }
      this.onRoundStateChanged(change);
    }

    private onRoundStateChanged(_change: RoundStateChange) {
      if (_change.current === "Rolling") {
        this.dice?.roll(() => {
          this.bettingBoard?.highlightWinningColors(PLACEHOLDER_WINNING_COLORS);
        });
      }
      // Future roll/reveal/reset animations can branch from this hook.
    }

    private disposeRoundStateSubscription() {
      this.stopCountdown();
      this.unsubscribeRoundState?.();
      this.unsubscribeRoundState = undefined;
    }

    private startBettingCountdown() {
      this.stopCountdown();
      this.countdownRemaining = COUNTDOWN_START_SECONDS;
      this.updateCountdownLabel();
      this.countdownTimer = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          this.tickCountdown();
        },
      });
    }

    private tickCountdown() {
      if (this.roundStateMachine.state !== "Betting Open") {
        this.stopCountdown();
        return;
      }

      this.countdownRemaining = Math.max(0, this.countdownRemaining - 1);
      this.updateCountdownLabel();

      if (this.countdownRemaining === 0) {
        this.stopCountdown();
        this.setRoundState("Rolling");
      }
    }

    private stopCountdown() {
      this.countdownTimer?.remove(false);
      this.countdownTimer = undefined;
    }

    private updateCountdownLabel() {
      this.countdownText?.setText(`Countdown: ${this.countdownRemaining}`);
    }
  };
}
