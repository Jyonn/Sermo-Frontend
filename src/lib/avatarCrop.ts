export interface AvatarCrop { x: number; y: number; size: number }
export interface AvatarImageSize { width: number; height: number; transparent: boolean }

// Enumerate common formats as well as accepting images generally. Some WebKit
// versions treat image/* literally when deciding whether to transcode a PNG.
export const AVATAR_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,image/svg+xml,image/*';

export function avatarOriginalFileAccept(userAgent: string, platform: string, touchPoints: number) {
  // public.data opens the iOS document picker, bypassing Photos' compatible
  // representation. On other platforms keep the ordinary image-file filter.
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1)
    ? 'application/octet-stream' : AVATAR_IMAGE_ACCEPT;
}

export function avatarImageMime(bytes: Uint8Array, declaredType: string) {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if ([137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (text(0,6) === 'GIF87a' || text(0,6) === 'GIF89a') return 'image/gif';
  if (text(0,4) === 'RIFF' && text(8,12) === 'WEBP') return 'image/webp';
  if (text(0,2) === 'BM') return 'image/bmp';
  if (text(4,8) === 'ftyp') {
    const brands = text(8,32);
    if (/avif|avis/.test(brands)) return 'image/avif';
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brands)) return 'image/heic';
  }
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text(0,bytes.length))) return 'image/svg+xml';
  return declaredType.startsWith('image/') ? declaredType : '';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function avatarCropBounds(image: AvatarImageSize) {
  const maxSize = image.transparent ? Math.max(image.width, image.height) * 1.2 : Math.min(image.width, image.height);
  return {
    x: image.transparent ? (image.width - maxSize) / 2 : 0,
    y: image.transparent ? (image.height - maxSize) / 2 : 0,
    width: image.transparent ? maxSize : image.width,
    height: image.transparent ? maxSize : image.height,
    maxSize,
    minSize: Math.min(maxSize, Math.max(16, Math.min(image.width, image.height) / 8)),
  };
}

export function constrainAvatarCrop(image: AvatarImageSize, crop: AvatarCrop): AvatarCrop {
  const bounds = avatarCropBounds(image);
  const size = clamp(crop.size, bounds.minSize, bounds.maxSize);
  return { size, x: clamp(crop.x, bounds.x, bounds.x + bounds.width - size), y: clamp(crop.y, bounds.y, bounds.y + bounds.height - size) };
}

export function initialAvatarCrop(image: AvatarImageSize): AvatarCrop {
  const size = avatarCropBounds(image).maxSize;
  return { x: (image.width - size) / 2, y: (image.height - size) / 2, size };
}

export function sizeAvatarCrop(image: AvatarImageSize, crop: AvatarCrop, size: number) {
  const bounds = avatarCropBounds(image);
  const nextSize = clamp(size, bounds.minSize, bounds.maxSize);
  return constrainAvatarCrop(image, { x: crop.x + (crop.size - nextSize) / 2, y: crop.y + (crop.size - nextSize) / 2, size: nextSize });
}

export function resizeAvatarCrop(image: AvatarImageSize, crop: AvatarCrop, corner: string, dx: number, dy: number) {
  const bounds = avatarCropBounds(image);
  const left = corner.includes('w');
  const top = corner.includes('n');
  const anchorX = left ? crop.x + crop.size : crop.x;
  const anchorY = top ? crop.y + crop.size : crop.y;
  const limit = Math.min(bounds.maxSize, left ? anchorX - bounds.x : bounds.x + bounds.width - anchorX,
    top ? anchorY - bounds.y : bounds.y + bounds.height - anchorY);
  const size = clamp(crop.size + ((left ? -dx : dx) + (top ? -dy : dy)) / 2, bounds.minSize, limit);
  return { x: left ? anchorX - size : anchorX, y: top ? anchorY - size : anchorY, size };
}

export function hasTransparentPixels(pixels: Uint8ClampedArray) {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) return true;
  return false;
}

export async function exportAvatarCrop(image: HTMLImageElement, crop: AvatarCrop, transparent: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.max(1, Math.min(1024, Math.round(crop.size)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  const scale = canvas.width / crop.size;
  context.imageSmoothingQuality = 'high';
  // Draw the whole image at its selected offset. Canvas clips the image and
  // leaves out-of-image padding transparent, rather than stretching edge pixels.
  context.drawImage(image, -crop.x * scale, -crop.y * scale, image.naturalWidth * scale, image.naturalHeight * scale);
  const type = transparent ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Avatar export failed')), type, .94));
  return new File([blob], transparent ? 'avatar.png' : 'avatar.jpg', { type: blob.type });
}
