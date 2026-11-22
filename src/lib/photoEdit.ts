import {addSelectedPhotoMetadata, type PhotoMetadata} from './photoMetadata';

export interface PhotoPoint { x: number; y: number }
export interface PhotoRect extends PhotoPoint { width: number; height: number }
export interface MosaicStroke { points: PhotoPoint[]; diameter: number }
export const photoFilters = {
  original: 'none',
  vivid: 'saturate(1.28) contrast(1.08)',
  warm: 'sepia(0.24) saturate(1.12) brightness(1.04)',
  cool: 'sepia(0.16) hue-rotate(158deg) saturate(0.87)',
  mono: 'grayscale(1) contrast(1.09)',
  soft: 'saturate(0.72) contrast(0.88) brightness(1.08)',
} as const;
export type PhotoFilter = keyof typeof photoFilters;

export interface PhotoEdit {
  turns: number;
  flipX: boolean;
  flipY: boolean;
  angle: number;
  filter: PhotoFilter;
  crop: PhotoRect;
  strokes: MosaicStroke[];
  keepLocation: boolean;
  keepDescription: boolean;
  flash: boolean;
}

export const fullPhoto: PhotoRect = {x: 0, y: 0, width: 1, height: 1};
export const initialPhotoEdit = (): PhotoEdit => ({
  turns: 0, flipX: false, flipY: false, angle: 0, filter: 'original', crop: fullPhoto, strokes: [],
  keepLocation: true, keepDescription: true, flash: false,
});

export const clampPhoto = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function centeredPhotoCrop(crop: PhotoRect, width: number, height: number, anchor: PhotoPoint = {x: .5, y: .5}, shift: PhotoPoint = {x: 0, y: 0}): PhotoRect {
  width = clampPhoto(width, .04, 1);
  height = clampPhoto(height, .04, 1);
  return {
    x: clampPhoto(crop.x + (crop.width - width) * anchor.x + shift.x, 0, 1 - width),
    y: clampPhoto(crop.y + (crop.height - height) * anchor.y + shift.y, 0, 1 - height),
    width, height,
  };
}

export function rotatePhoto(edit: PhotoEdit): PhotoEdit {
  const {x, y, width, height} = edit.crop;
  return {...edit, turns: (edit.turns + 1) % 4, flipX: edit.flipY, flipY: edit.flipX,
    crop: {x: 1 - y - height, y: x, width: height, height: width}};
}

export function flipPhoto(edit: PhotoEdit, axis: 'x' | 'y'): PhotoEdit {
  const {crop} = edit;
  return axis === 'x'
    ? {...edit, flipX: !edit.flipX, crop: {...crop, x: 1 - crop.x - crop.width}}
    : {...edit, flipY: !edit.flipY, crop: {...crop, y: 1 - crop.y - crop.height}};
}

export function straightenPhoto(angle: number, aspect: number) {
  const radians = clampPhoto(angle, -45, 45) * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  return {radians, cos, sin, scale: cos + Math.abs(sin) * Math.max(aspect, 1 / aspect)};
}

export function photoSourcePoint(point: PhotoPoint, edit: PhotoEdit, aspect = 1): PhotoPoint {
  const {cos, sin, scale} = straightenPhoto(edit.angle, aspect);
  const dx = (point.x - .5) * aspect, dy = point.y - .5;
  const unrotated = {x: (cos * dx + sin * dy) / (scale * aspect) + .5, y: (-sin * dx + cos * dy) / scale + .5};
  const x = edit.flipX ? 1 - unrotated.x : unrotated.x;
  const y = edit.flipY ? 1 - unrotated.y : unrotated.y;
  switch (edit.turns) {
    case 1: return {x: y, y: 1 - x};
    case 2: return {x: 1 - x, y: 1 - y};
    case 3: return {x: 1 - y, y: x};
    default: return {x, y};
  }
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  return {canvas, context};
}

export function photoLayers(image: HTMLImageElement, maximum: number) {
  const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
  const {canvas: source, context} = canvas2d(image.naturalWidth * scale, image.naturalHeight * scale);
  context.drawImage(image, 0, 0, source.width, source.height);
  const block = Math.max(6, Math.round(Math.max(source.width, source.height) / 55));
  const {canvas: tiles, context: tileContext} = canvas2d(source.width / block, source.height / block);
  tileContext.drawImage(source, 0, 0, tiles.width, tiles.height);
  return {source, tiles, mask: canvas2d(source.width, source.height),
    filtered: new Map<PhotoFilter, {source: HTMLCanvasElement; tiles: HTMLCanvasElement}>()};
}

// CSS filter functions are evaluated on the canvas even in browsers without CanvasRenderingContext2D.filter.
function colorize(source: HTMLCanvasElement, filter: PhotoFilter) {
  const {canvas, context} = canvas2d(source.width, source.height);
  if (typeof context.filter === 'string') {
    context.filter = photoFilters[filter];
    context.drawImage(source, 0, 0);
    return canvas;
  }
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const {data} = pixels;
  const saturation = {original: 1, vivid: 1.28, warm: 1.12, cool: .87, mono: 0, soft: .72}[filter];
  const contrast = {original: 1, vivid: 1.08, warm: 1, cool: 1, mono: 1.09, soft: .88}[filter];
  const brightness = filter === 'soft' ? 1.08 : filter === 'warm' ? 1.04 : 1;
  const warm = filter === 'warm';
  const cool = filter === 'cool';
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index], g = data[index + 1], b = data[index + 2];
    const gray = .2126 * r + .7152 * g + .0722 * b;
    const offset = (gray * (1 - saturation) - 127.5) * contrast + 127.5;
    const weight = saturation * contrast;
    data[index] = (r * weight + offset) * brightness * (cool ? .93 : warm ? 1.045 : 1);
    data[index + 1] = (g * weight + offset) * brightness;
    data[index + 2] = (b * weight + offset) * brightness * (warm ? .9 : cool ? 1.08 : 1);
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function paintPhoto(canvas: HTMLCanvasElement, layers: ReturnType<typeof photoLayers>, edit: PhotoEdit) {
  const {mask} = layers;
  let palette = edit.filter === 'original' ? layers : layers.filtered.get(edit.filter);
  if (!palette) {
    palette = {source: colorize(layers.source, edit.filter), tiles: colorize(layers.tiles, edit.filter)};
    layers.filtered.set(edit.filter, palette);
  }
  const {source, tiles} = palette;
  const {width, height} = source;
  const swapped = edit.turns % 2 === 1;
  const canvasWidth = swapped ? height : width, canvasHeight = swapped ? width : height;
  if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  const straighten = straightenPhoto(edit.angle, canvas.width / canvas.height);
  context.rotate(straighten.radians);
  context.scale((edit.flipX ? -1 : 1) * straighten.scale, (edit.flipY ? -1 : 1) * straighten.scale);
  context.rotate(edit.turns * Math.PI / 2);
  context.drawImage(source, -width / 2, -height / 2);
  if (edit.strokes.length) {
    const brush = mask.context;
    brush.clearRect(0, 0, width, height);
    brush.lineCap = 'round';
    brush.lineJoin = 'round';
    for (const stroke of edit.strokes) {
      const [first, ...rest] = stroke.points;
      const diameter = stroke.diameter * Math.min(width, height);
      brush.lineWidth = diameter;
      brush.beginPath();
      if (!rest.length) {
        brush.arc(first.x * width, first.y * height, diameter / 2, 0, Math.PI * 2);
        brush.fill();
      } else {
        brush.moveTo(first.x * width, first.y * height);
        for (const point of rest) brush.lineTo(point.x * width, point.y * height);
        brush.stroke();
      }
    }
    context.globalCompositeOperation = 'destination-out';
    context.drawImage(mask.canvas, -width / 2, -height / 2);
    context.globalCompositeOperation = 'source-over';
    brush.globalCompositeOperation = 'source-in';
    brush.imageSmoothingEnabled = false;
    brush.drawImage(tiles, 0, 0, width, height);
    brush.globalCompositeOperation = 'source-over';
    context.drawImage(mask.canvas, -width / 2, -height / 2);
  }
  context.restore();
}

export function renderPhotoPreview(image: HTMLImageElement, edit: PhotoEdit, layers = photoLayers(image, 1280)) {
  const {canvas: painted} = canvas2d(1, 1);
  paintPhoto(painted, layers, edit);
  const {crop} = edit;
  const w = painted.width * crop.width, h = painted.height * crop.height;
  const {canvas, context} = canvas2d(w, h);
  context.drawImage(painted, crop.x * painted.width, crop.y * painted.height, w, h, 0, 0, canvas.width, canvas.height);
  return {canvas, context};
}

export async function decodePhoto(uri: string) {
  const image = new Image();
  image.src = uri;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 64_000_000) throw new Error('Invalid image dimensions');
  return image;
}

export async function exportPhoto(image: HTMLImageElement, edit: PhotoEdit, metadata: PhotoMetadata, file: File) {
  const layers = photoLayers(image, edit.flash ? 1600 : 4096);
  const {canvas, context} = renderPhotoPreview(image, edit, layers);
  const png = !edit.flash && !/^image\/(jpeg|heic|heif)$/.test(file.type);
  if (edit.flash) {
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#101715';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const makeBlob = (type: string, quality: number) => new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Photo export failed')), type, quality));
  let blob = await makeBlob(png ? 'image/png' : 'image/jpeg', edit.flash ? .84 : .93);
  let current = canvas;
  while (!edit.flash && blob.size > 9.9 * 1024 * 1024) {
    // Reduce pixel count first to retain transparency in large PNG results.
    const smaller = canvas2d(current.width * .66, current.height * .66);
    smaller.context.drawImage(current, 0, 0, smaller.canvas.width, smaller.canvas.height);
    current = smaller.canvas;
    blob = await new Promise<Blob>((resolve, reject) =>
      smaller.canvas.toBlob(value => value ? resolve(value) : reject(new Error('Photo export failed')), blob.type, .89));
  }
  if (edit.flash && blob.size > 900 * 1024) blob = await makeBlob('image/jpeg', .68);
  if (!edit.flash) blob = addSelectedPhotoMetadata(blob, metadata, edit.keepLocation, edit.keepDescription);
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/png' ? '.png' : '.jpg'), {type: blob.type});
}
