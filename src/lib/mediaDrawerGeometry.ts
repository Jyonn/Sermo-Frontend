export interface MediaSize {width: number; height: number}
export interface MediaTransform {scale: number; x: number; y: number}
export const fittedMediaTransform: MediaTransform = {scale: 1, x: 0, y: 0};

export function fitMedia(stage: MediaSize, image: MediaSize) {
  if (!stage.width || !stage.height || !image.width || !image.height) return {width: 0, height: 0, maximum: 16};
  const fit = Math.min(stage.width / image.width, stage.height / image.height);
  return {width: image.width * fit, height: image.height * fit, maximum: Math.max(1, 16 / fit)};
}

export function constrainMediaTransform(transform: MediaTransform, fitted: ReturnType<typeof fitMedia>, stage: MediaSize) {
  const scale = Math.min(fitted.maximum, Math.max(.5, transform.scale));
  const x = Math.max(0, (fitted.width * scale - stage.width) / 2);
  const y = Math.max(0, (fitted.height * scale - stage.height) / 2);
  return {scale, x: x ? Math.max(-x, Math.min(x, transform.x)) : 0, y: y ? Math.max(-y, Math.min(y, transform.y)) : 0};
}
