"use client";

import { EngineCanvas } from "@/engine";
import { useCallback, useRef } from "react";

const POINTS = [
  [0.13, 0.34, 0.8], [0.25, 0.67, 1.1], [0.39, 0.24, 0.9], [0.52, 0.56, 1.3],
  [0.66, 0.31, 0.75], [0.78, 0.72, 1.05], [0.88, 0.43, 0.9], [0.58, 0.83, 0.7],
] as const;

export function CompareAtmosphere() {
  const lastPaint = useRef(0);

  const draw = useCallback((context: CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext, canvas: HTMLCanvasElement, _delta: number, _frame: number, timing: { elapsed: number }) => {
    if (!(context instanceof CanvasRenderingContext2D)) return false;
    if (timing.elapsed - lastPaint.current < 46) return;
    lastPaint.current = timing.elapsed;

    const width = canvas.width;
    const height = canvas.height;
    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue("--rv-green").trim() || "#205f4a";
    const line = style.getPropertyValue("--rv-line").trim() || "rgba(16,35,31,.12)";
    const lime = style.getPropertyValue("--rv-lime").trim() || "#c8f36b";
    const t = timing.elapsed * 0.00018;

    context.clearRect(0, 0, width, height);
    context.save();
    context.globalAlpha = 0.28;
    context.lineWidth = Math.max(1, width * 0.0008);
    context.strokeStyle = line;

    for (let band = 0; band < 5; band += 1) {
      const y = height * (0.18 + band * 0.16);
      context.beginPath();
      for (let x = -40; x <= width + 40; x += 28) {
        const wave = Math.sin(x * 0.006 + t * (band + 1)) * height * 0.025;
        if (x === -40) context.moveTo(x, y + wave);
        else context.lineTo(x, y + wave);
      }
      context.stroke();
    }

    context.globalAlpha = 0.42;
    POINTS.forEach(([px, py, speed], index) => {
      const driftX = Math.cos(t * speed + index) * width * 0.012;
      const driftY = Math.sin(t * speed * 0.8 + index * 0.7) * height * 0.018;
      const x = px * width + driftX;
      const y = py * height + driftY;
      const radius = Math.max(2.2, width * 0.0035);
      context.fillStyle = index % 3 === 0 ? lime : ink;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.12;
      context.beginPath();
      context.arc(x, y, radius * 3.4, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.42;
    });
    context.restore();
  }, []);

  return (
    <div className="rv-compare-atmosphere" aria-hidden>
      <EngineCanvas
        mode="2d"
        responsive
        dpr="auto"
        maxDpr={1.25}
        adaptive
        adaptiveTargetFps={30}
        pauseWhenOffscreen
        pauseWhenHidden
        onDraw={draw}
        style={{ width: "100%", height: "100%", minHeight: 260 }}
      />
    </div>
  );
}
