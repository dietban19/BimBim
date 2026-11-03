/** Pointer travel, in CSS pixels, beyond which a press counts as a drag (camera navigation). */
export const CLICK_TOLERANCE_PX = 4;

interface PressState {
  readonly pointerId: number;
  readonly button: number;
  readonly x: number;
  readonly y: number;
  moved: boolean;
}

export interface PointerSample {
  readonly pointerId: number;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * Distinguishes a primary-button click from a drag. Tools only act on clicks,
 * so orbiting or panning the camera never places or selects anything.
 */
export class PointerGesture {
  private press: PressState | null = null;

  begin(event: PointerSample): void {
    this.press = { pointerId: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, moved: false };
  }

  track(event: PointerSample): void {
    if (!this.press || event.pointerId !== this.press.pointerId) return;
    if (Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > CLICK_TOLERANCE_PX) {
      this.press.moved = true;
    }
  }

  /** Completes the gesture and reports whether it was a primary-button click. */
  end(event: PointerSample): boolean {
    const press = this.press;
    this.press = null;
    if (!press || press.pointerId !== event.pointerId) return false;
    this.track(event);
    const moved = press.moved || Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_TOLERANCE_PX;
    return press.button === 0 && !moved;
  }

  cancel(): void {
    this.press = null;
  }

  /** True while a button is held and the pointer has travelled far enough to be a drag. */
  get isDragging(): boolean {
    return this.press?.moved ?? false;
  }
}
