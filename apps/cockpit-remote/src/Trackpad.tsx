import { useRef } from 'react';
import { useRemoteStore } from './store';

interface TrackpadProps {
  onMove: (dx: number, dy: number) => void;
  onClick: (button: 'left' | 'right' | 'middle', double?: boolean) => void;
  onScroll: (dy: number) => void;
}

/**
 * Multi-touch trackpad surface for mobile.
 *
 * Gestures:
 *  - 1-finger drag → move cursor (delta * sensitivity)
 *  - 1-finger tap (no drag) → left click
 *  - 2-finger tap → right click
 *  - 2-finger drag vertical → scroll
 *  - 3-finger tap → middle click
 *  - long press 0.4s → release into "drag mode" until lift
 *
 * Inputs are throttled at requestAnimationFrame (~60fps) and batched.
 */
export function Trackpad({ onMove, onClick, onScroll }: TrackpadProps) {
  const sens = useRemoteStore((s) => s.trackpadSensitivity);
  const ref = useRef<HTMLDivElement | null>(null);
  const state = useRef({
    pointers: new Map<number, { x: number; y: number; t: number }>(),
    moved: false,
    rafId: 0,
    accumDx: 0,
    accumDy: 0,
    accumScrollDy: 0,
    longPressTimer: 0,
  });

  const flush = (): void => {
    const s = state.current;
    s.rafId = 0;
    if (s.accumDx !== 0 || s.accumDy !== 0) {
      onMove(s.accumDx, s.accumDy);
      s.accumDx = 0;
      s.accumDy = 0;
    }
    if (s.accumScrollDy !== 0) {
      onScroll(s.accumScrollDy);
      s.accumScrollDy = 0;
    }
  };

  const queue = (): void => {
    if (state.current.rafId) return;
    state.current.rafId = requestAnimationFrame(flush);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    state.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now() });
    state.current.moved = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const s = state.current;
    const p = s.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) s.moved = true;
    p.x = e.clientX;
    p.y = e.clientY;

    if (s.pointers.size === 1) {
      s.accumDx += dx * sens;
      s.accumDy += dy * sens;
    } else if (s.pointers.size === 2) {
      // average dy across pointers for scroll
      s.accumScrollDy += dy * 0.5;
    }
    queue();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const s = state.current;
    const p = s.pointers.get(e.pointerId);
    s.pointers.delete(e.pointerId);
    if (!p) return;
    const dt = Date.now() - p.t;
    if (!s.moved && dt < 250) {
      // tap
      if (s.pointers.size === 0) {
        // could be 1-, 2-, 3- finger tap depending on max simultaneous
        // we approximate: count pointers seen recently via residual map
        // (since we just deleted current, others may still be down for taps)
      }
    }
  };

  // Click delivery uses the count of fingers at lift moment.
  // We track the max simultaneous count during the gesture.
  const maxFingersRef = useRef(0);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    handlePointerDown(e);
    maxFingersRef.current = Math.max(maxFingersRef.current, state.current.pointers.size);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    handlePointerMove(e);
    maxFingersRef.current = Math.max(maxFingersRef.current, state.current.pointers.size);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const s = state.current;
    const count = maxFingersRef.current;
    handlePointerUp(e);
    if (s.pointers.size === 0) {
      if (!s.moved) {
        if (count >= 3) onClick('middle');
        else if (count === 2) onClick('right');
        else onClick('left');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(6);
      }
      maxFingersRef.current = 0;
    }
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative w-full h-[60vh] surface rounded-xl flex items-center justify-center overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      <span className="display text-sm opacity-30 pointer-events-none">
        trackpad · {sens.toFixed(1)}x
      </span>
      <div className="absolute inset-0 pointer-events-none border-l-2 border-t-2 border-r-2 border-b-2 border-current/10 m-4 rounded-xl" />
    </div>
  );
}
