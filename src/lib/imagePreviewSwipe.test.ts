import { describe, expect, test } from "bun:test";
import {
  resolveImagePreviewPinchPan,
  resolveImagePreviewPinchZoom,
  resolveImagePreviewSwipe
} from "./imagePreviewSwipe";

const baseGesture = {
  pointerType: "touch",
  viewportWidth: 390,
  stageWidth: 360,
  deltaX: -72,
  deltaY: 8,
  canPan: false,
  canNavigatePrevious: true,
  canNavigateNext: true
};

describe("mobile image preview swipe", () => {
  test("switches only for a deliberate horizontal touch gesture on mobile", () => {
    expect(resolveImagePreviewSwipe(baseGesture)).toBe(1);
    expect(resolveImagePreviewSwipe({ ...baseGesture, deltaX: 72 })).toBe(-1);
    expect(resolveImagePreviewSwipe({ ...baseGesture, deltaX: -20 })).toBe(0);
    expect(resolveImagePreviewSwipe({ ...baseGesture, deltaX: -72, deltaY: 80 })).toBe(0);
    expect(resolveImagePreviewSwipe({ ...baseGesture, pointerType: "mouse" })).toBe(0);
    expect(resolveImagePreviewSwipe({ ...baseGesture, viewportWidth: 1200 })).toBe(0);
  });

  test("keeps zoomed-image panning and navigation boundaries intact", () => {
    expect(resolveImagePreviewSwipe({ ...baseGesture, canPan: true })).toBe(0);
    expect(resolveImagePreviewSwipe({ ...baseGesture, canNavigateNext: false })).toBe(0);
    expect(resolveImagePreviewSwipe({ ...baseGesture, deltaX: 72, canNavigatePrevious: false })).toBe(0);
  });

  test("scales around the two-finger midpoint within zoom limits", () => {
    expect(resolveImagePreviewPinchZoom({
      startZoom: 0.5,
      startDistance: 100,
      currentDistance: 180,
      minZoom: 0.1,
      maxZoom: 3
    })).toBe(0.9);
    expect(resolveImagePreviewPinchZoom({
      startZoom: 2,
      startDistance: 100,
      currentDistance: 300,
      minZoom: 0.1,
      maxZoom: 3
    })).toBe(3);
    expect(resolveImagePreviewPinchPan({
      startPan: { x: 0, y: 0 },
      startMidpoint: { x: 120, y: 160 },
      currentMidpoint: { x: 130, y: 170 },
      stageCenter: { x: 180, y: 300 },
      zoomRatio: 2
    })).toEqual({ x: 70, y: 150 });
  });
});
