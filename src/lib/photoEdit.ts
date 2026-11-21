import {addSelectedPhotoMetadata, type PhotoMetadata} from './photoMetadata';

export interface PhotoPoint { x: number; y: number }
export interface PhotoRect extends PhotoPoint { width: number; height: number }
export interface MosaicStroke { points: PhotoPoint[]; diameter: number }
export interface PhotoEdit {
  turns: number;
  flipX: boolean;
  flipY: boolean;
  crop: PhotoRect;
  strokes: MosaicStroke[];
  keepLocation: boolean;
  keepDescription: boolean;
  flash: boolean;
}

export const fullPhoto: PhotoRect = {x: 0, y: 0, width: 1, height: 1};
export const initialPhotoEdit = (): PhotoEdit => ({
  turns: 0, flipX: false, flipY: false, crop: fullPhoto, strokes: [],
  keepLocation: false, keepDescription: false, flash: false,
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

export function photoSourcePoint(point: PhotoPoint, edit: PhotoEdit): PhotoPoint {
  const x = edit.flipX ? 1 - point.x : point.x;
  const y = edit.flipY ? 1 - point.y : point.y;
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
  return {source, tiles, mask: canvas2d(source.width, source.height)};
}

export function paintPhoto(canvas: HTMLCanvasElement, layers: ReturnType<typeof photoLayers>, edit: PhotoEdit) {
  const {source, tiles, mask} = layers;
  const {width, height} = source;
  const swapped = edit.turns % 2 === 1;
  const canvasWidth = swapped ? height : width, canvasHeight = swapped ? width : height;
  if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
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

export async function decodePhoto(uri: string) {
  const image = new Image();
  image.src = uri;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 64_000_000) throw new Error('Invalid image dimensions');
  return image;
}

export async function exportPhoto(image: HTMLImageElement, edit: PhotoEdit, metadata: PhotoMetadata, file: File) {
  const layers = photoLayers(image, edit.flash ? 1600 : 4096);
  const {canvas: painted} = canvas2d(1, 1);
  paintPhoto(painted, layers, edit);
  const {crop} = edit;
  const w = painted.width * crop.width, h = painted.height * crop.height;
  const {canvas, context} = canvas2d(w, h);
  context.drawImage(painted, crop.x * painted.width, crop.y * painted.height, w, h, 0, 0, canvas.width, canvas.height);
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
