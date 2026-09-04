export const IMAGE_PREVIEW_MOBILE_MAX_WIDTH = 980;
export const IMAGE_PREVIEW_SWIPE_MIN_DISTANCE = 42;
export const IMAGE_PREVIEW_SWIPE_MAX_DISTANCE = 72;
export const IMAGE_PREVIEW_SWIPE_AXIS_RATIO = 1.15;

export type ImagePreviewSwipeDirection = -1 | 0 | 1;
export type ImagePreviewPoint = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveImagePreviewPinchZoom({
  startZoom,
  startDistance,
  currentDistance,
  minZoom,
  maxZoom
}: {
  startZoom: number;
  startDistance: number;
  currentDistance: number;
  minZoom: number;
  maxZoom: number;
}) {
  if (!Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(currentDistance)) {
    return clamp(startZoom, minZoom, maxZoom);
  }
  return clamp(startZoom * (currentDistance / startDistance), minZoom, maxZoom);
}

export function resolveImagePreviewPinchPan({
  startPan,
  startMidpoint,
  currentMidpoint,
  stageCenter,
  zoomRatio
}: {
  startPan: ImagePreviewPoint;
  startMidpoint: ImagePreviewPoint;
  currentMidpoint: ImagePreviewPoint;
  stageCenter: ImagePreviewPoint;
  zoomRatio: number;
}): ImagePreviewPoint {
  const safeRatio = Number.isFinite(zoomRatio) && zoomRatio > 0 ? zoomRatio : 1;
  return {
    x: currentMidpoint.x - stageCenter.x - (startMidpoint.x - stageCenter.x - startPan.x) * safeRatio,
    y: currentMidpoint.y - stageCenter.y - (startMidpoint.y - stageCenter.y - startPan.y) * safeRatio
  };
}

export function resolveImagePreviewSwipe({
  pointerType,
  viewportWidth,
  stageWidth,
  deltaX,
  deltaY,
  canPan,
  canNavigatePrevious,
  canNavigateNext
}: {
  pointerType: string;
  viewportWidth: number;
  stageWidth: number;
  deltaX: number;
  deltaY: number;
  canPan: boolean;
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
}): ImagePreviewSwipeDirection {
  if (pointerType !== "touch" || viewportWidth > IMAGE_PREVIEW_MOBILE_MAX_WIDTH || canPan) return 0;
  const distance = Math.abs(deltaX);
  const threshold = Math.min(
    IMAGE_PREVIEW_SWIPE_MAX_DISTANCE,
    Math.max(IMAGE_PREVIEW_SWIPE_MIN_DISTANCE, Math.max(0, stageWidth) * 0.12)
  );
  if (distance < threshold || distance <= Math.abs(deltaY) * IMAGE_PREVIEW_SWIPE_AXIS_RATIO) return 0;
  if (deltaX < 0) return canNavigateNext ? 1 : 0;
  return canNavigatePrevious ? -1 : 0;
}
