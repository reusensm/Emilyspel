export type SwipeDirection = 'left' | 'right';
export type SwipeCallback = (direction: SwipeDirection) => void;

const SWIPE_THRESHOLD = 0.25; // 25% of screen width
const ROTATION_FACTOR = 0.1; // degrees per pixel

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
}

export function setupSwipe(
  card: HTMLElement,
  onSwipe: SwipeCallback,
  onDrag: (offsetX: number, progress: number) => void
): () => void {
  const state: SwipeState = { startX: 0, startY: 0, currentX: 0, isDragging: false };

  function getThreshold() {
    return window.innerWidth * SWIPE_THRESHOLD;
  }

  function handleStart(x: number, y: number) {
    state.isDragging = true;
    state.startX = x;
    state.startY = y;
    state.currentX = x;
    card.style.transition = 'none';
  }

  function handleMove(x: number) {
    if (!state.isDragging) return;
    state.currentX = x;
    const offsetX = state.currentX - state.startX;
    const progress = Math.min(Math.abs(offsetX) / getThreshold(), 1);

    card.style.transform = `translateX(${offsetX}px) rotate(${offsetX * ROTATION_FACTOR}deg)`;
    onDrag(offsetX, progress);
  }

  function handleEnd() {
    if (!state.isDragging) return;
    state.isDragging = false;

    const offsetX = state.currentX - state.startX;
    const threshold = getThreshold();

    if (Math.abs(offsetX) > threshold) {
      const direction: SwipeDirection = offsetX > 0 ? 'right' : 'left';
      const flyOut = offsetX > 0 ? window.innerWidth : -window.innerWidth;
      card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0, 0, 1)';
      card.style.transform = `translateX(${flyOut}px) rotate(${flyOut * ROTATION_FACTOR}deg)`;
      setTimeout(() => onSwipe(direction), 350);
    } else {
      // Snap back with bounce
      card.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      card.style.transform = 'translateX(0) rotate(0)';
      onDrag(0, 0);
    }
  }

  // Touch events
  function onTouchStart(e: TouchEvent) {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  }
  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }
  function onTouchEnd() {
    handleEnd();
  }

  // Mouse events
  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  }
  function onMouseMove(e: MouseEvent) {
    handleMove(e.clientX);
  }
  function onMouseUp() {
    handleEnd();
  }

  // Keyboard
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      triggerSwipeAnimation('left', onSwipe);
    } else if (e.key === 'ArrowRight') {
      triggerSwipeAnimation('right', onSwipe);
    }
  }

  function triggerSwipeAnimation(direction: SwipeDirection, cb: SwipeCallback) {
    const flyOut = direction === 'right' ? window.innerWidth : -window.innerWidth;
    card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0, 0, 1)';
    card.style.transform = `translateX(${flyOut}px) rotate(${flyOut * ROTATION_FACTOR}deg)`;
    onDrag(flyOut, 1);
    setTimeout(() => cb(direction), 350);
  }

  card.addEventListener('touchstart', onTouchStart, { passive: true });
  card.addEventListener('touchmove', onTouchMove, { passive: false });
  card.addEventListener('touchend', onTouchEnd);
  card.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  // Cleanup
  return () => {
    card.removeEventListener('touchstart', onTouchStart);
    card.removeEventListener('touchmove', onTouchMove);
    card.removeEventListener('touchend', onTouchEnd);
    card.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
  };
}
