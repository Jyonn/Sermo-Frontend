export interface MediaSize {width: number; height: number}
export interface MediaTransform {scale: number; x: number; y: number}
export const fittedMediaTransform: MediaTransform = {scale: 1, x: 0, y: 0};
export const mediaSlideGap = 14;

export function mediaInfoProgress(open: boolean, distance: number, height: number) {
  return Math.min(1, Math.max(0, Number(open) - distance / Math.max(1, height)));
}

export function fitMedia(stage: MediaSize, image: MediaSize) {
  if (!stage.width || !stage.height || !image.width || !image.height) return {width: 0, height: 0, maximum: 16};
  const fit = Math.min(stage.width / image.width, stage.height / image.height);
  return {width: image.width * fit, height: image.height * fit, maximum: Math.max(1, 16 / fit)};
}

export function fitMediaForInfo(stage: MediaSize, fitted: MediaSize, contentHeight: number) {
  const panelHeight = Math.min(contentHeight, stage.height / 2);
  const photoHeight = stage.height - panelHeight;
  const scale = fitted.width && fitted.height
    ? Math.max(stage.width / fitted.width, photoHeight / fitted.height)
    : 1;
  return {panelHeight, scale, y: (stage.height - fitted.height * scale) / 2 - panelHeight};
}

export function constrainMediaTransform(transform: MediaTransform, fitted: ReturnType<typeof fitMedia>, stage: MediaSize) {
  const scale = Math.min(fitted.maximum, Math.max(.5, transform.scale));
  const x = Math.max(0, (fitted.width * scale - stage.width) / 2);
  const y = Math.max(0, (fitted.height * scale - stage.height) / 2);
  return {scale, x: x ? Math.max(-x, Math.min(x, transform.x)) : 0, y: y ? Math.max(-y, Math.min(y, transform.y)) : 0};
}

export function mediaWheelInput(event: Pick<WheelEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'deltaMode' | 'deltaX' | 'deltaY'>, height: number) {
  const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
  const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
  const action = event.ctrlKey || event.metaKey ? 'zoom'
    : event.shiftKey || Math.abs(dx) > Math.abs(event.deltaY) ? 'browse' : 'pan';
  return {action, x: dx * factor, y: event.deltaY * factor} as const;
}

export type SwipeAxis = 'horizontal' | 'free';
export interface SwipeSample {x: number; y: number; time: number}

export function lockSwipeAxis(x: number, y: number, previous?: SwipeAxis): SwipeAxis | undefined {
  if (previous || Math.hypot(x, y) <= 8) return previous;
  return Math.abs(x) >= Math.abs(y) ? 'horizontal' : 'free';
}

export type MediaSwipeDirection = 'left' | 'right' | 'up' | 'down';

export function lockMediaSwipeDirection(x: number, y: number, previous?: MediaSwipeDirection): MediaSwipeDirection | undefined {
  if (previous) return previous;
  const axis = lockSwipeAxis(x, y);
  if (!axis) return undefined;
  if (axis === 'horizontal') return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

export function mediaSwipeOffset(direction: MediaSwipeDirection, x: number, y: number) {
  switch (direction) {
    case 'left': return Math.min(0, x);
    case 'right': return Math.max(0, x);
    case 'up': return Math.min(0, y);
    case 'down': return Math.max(0, y);
  }
}

export function swipeVelocity(samples: SwipeSample[], end: SwipeSample, axis: 'x' | 'y') {
  const start = samples.find(sample => end.time - sample.time <= 100);
  return start ? (end[axis] - start[axis]) / Math.max(16, end.time - start.time) : 0;
}

export function shouldCompleteSwipe(distance: number, extent: number, velocity: number) {
  return Math.abs(distance) >= extent / 2
    || Math.abs(distance) >= 16 && Math.sign(velocity) === Math.sign(distance) && Math.abs(velocity) >= .45;
}

export const filmHeight = 36;
const filmPortraitWidth = filmHeight * .75;
const filmSmallGap = 3;
const filmLargeGap = 10;
export const filmPitch = (filmHeight + filmPortraitWidth) / 2 + filmLargeGap;

export function filmTiles(cursor: number, first: number, last: number) {
  const origin = Math.floor(cursor);
  const selection = (index: number) => Math.max(0, 1 - Math.abs(index - cursor));
  const width = (index: number) => filmPortraitWidth + (filmHeight - filmPortraitWidth) * selection(index);
  const pitch = (left: number) => (width(left) + width(left + 1)) / 2 + filmSmallGap
    + (filmLargeGap - filmSmallGap) * Math.min(1, selection(left) + selection(left + 1));
  let center = (origin - cursor) * pitch(origin);
  for (let i = origin - 1; i >= first; i--) center -= pitch(i);
  for (let i = origin; i < first; i++) center += pitch(i);
  return Array.from({length: Math.max(0, last - first + 1)}, (_, offset) => {
    const index = first + offset;
    const tile = {index, center, width: width(index)};
    center += pitch(index);
    return tile;
  });
}
