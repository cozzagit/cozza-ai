import { useEffect, useRef } from 'react';

/**
 * Ambient mode — slow generative wallpaper. Used as the "calm" view on
 * Viture during pauses. Pure canvas, no deps. Low frame rate to keep
 * battery friendly.
 */
export function Ambient() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const resize = (): void => {
      cv.width = cv.offsetWidth * (window.devicePixelRatio || 1);
      cv.height = cv.offsetHeight * (window.devicePixelRatio || 1);
    };
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    let raf = 0;
    let last = 0;
    const fps = 24;
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / fps) return;
      last = now;
      t += 0.005;
      const W = cv.width;
      const H = cv.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      // soft cyan + magenta blobs that breathe slowly
      drawBlob(
        ctx,
        W * (0.3 + 0.05 * Math.sin(t * 0.7)),
        H * (0.4 + 0.05 * Math.cos(t)),
        220,
        '0,229,255',
        0.18,
      );
      drawBlob(
        ctx,
        W * (0.7 + 0.04 * Math.cos(t * 0.5)),
        H * (0.6 + 0.05 * Math.sin(t * 0.9)),
        260,
        '255,0,170',
        0.14,
      );
      // grid
      ctx.strokeStyle = 'rgba(0,229,255,0.05)';
      ctx.lineWidth = 1;
      const step = 32 * (window.devicePixelRatio || 1);
      for (let x = 0; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative h-[80vh] rounded-xl overflow-hidden surface">
      <canvas ref={ref} className="w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="display text-3xl glow-cyan opacity-50">cozza · ambient</span>
      </div>
    </div>
  );
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  alpha: number,
): void {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${alpha})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
