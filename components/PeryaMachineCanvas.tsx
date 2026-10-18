"use client";

import { useEffect, useRef } from "react";

export default function PeryaMachineCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);

  useEffect(() => {
    let disposed = false;

    async function mountPhaser() {
      const Phaser = await import("phaser");
      const { createPeryaMachineScene } = await import(
        "@/lib/phaser/perya-machine-scene"
      );

      if (!hostRef.current || disposed) {
        return;
      }

      const PeryaMachineScene = createPeryaMachineScene(Phaser);

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: 1920,
        height: 1080,
        backgroundColor: "#16100b",
        scene: PeryaMachineScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });
    }

    void mountPhaser();

    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="perya-machine-canvas" />;
}
