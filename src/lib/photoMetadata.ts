export interface PhotoMetadata { latitude?: number; longitude?: number; description?: string }

export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  try {
    const {parse} = await import('exifr');
    const tags = await parse(file, {gps: true, xmp: true, iptc: true});
    const metadata: PhotoMetadata = {};
    if (Number.isFinite(tags?.latitude) && Math.abs(tags.latitude) <= 90
        && Number.isFinite(tags?.longitude) && Math.abs(tags.longitude) <= 180) {
      metadata.latitude = tags.latitude;
      metadata.longitude = tags.longitude;
    }
    const description = [tags?.ImageDescription, tags?.Caption, tags?.description]
      .find(value => typeof value === 'string' && value.trim());
    if (description) metadata.description = description.trim().replaceAll('\0', '').slice(0, 1000);
    return metadata;
  } catch {
    return {};
  }
}

// Build a fresh TIFF block containing only the two categories the user opted in to.
function selectedExif(metadata: PhotoMetadata, location: boolean, description: boolean) {
  const caption = description && metadata.description ? new TextEncoder().encode(metadata.description + '\0') : null;
  const hasGps = location && metadata.latitude !== undefined && metadata.longitude !== undefined;
  if (!caption && !hasGps) return null;
  const count = Number(Boolean(caption)) + Number(hasGps);
  const rootSize = 14 + count * 12;
  const gpsOffset = rootSize + (caption && caption.length > 4 ? caption.length + caption.length % 2 : 0);
  const output = new Uint8Array(gpsOffset + (hasGps ? 102 : 0));
  const view = new DataView(output.buffer);
  const u16 = (offset: number, value: number) => view.setUint16(offset, value, true);
  const u32 = (offset: number, value: number) => view.setUint32(offset, value, true);
  output.set([73, 73, 42, 0]);
  u32(4, 8);
  u16(8, count);
  const entry = (offset: number, tag: number, type: number, amount: number, data: number) => {
    u16(offset, tag); u16(offset + 2, type); u32(offset + 4, amount); u32(offset + 8, data);
  };
  if (caption) {
    entry(10, 0x010e, 2, caption.length, caption.length > 4 ? rootSize : 0);
    output.set(caption, caption.length > 4 ? rootSize : 18);
  }
  if (hasGps) {
    entry(10 + (caption ? 12 : 0), 0x8825, 4, 1, gpsOffset);
    u16(gpsOffset, 4);
    [metadata.latitude!, metadata.longitude!].forEach((coordinate, index) => {
      const offset = gpsOffset + 2 + index * 24;
      const ref = index === 0 ? (coordinate < 0 ? 'S' : 'N') : (coordinate < 0 ? 'W' : 'E');
      const data = gpsOffset + 54 + index * 24;
      entry(offset, index * 2 + 1, 2, 2, ref.charCodeAt(0));
      entry(offset + 12, index * 2 + 2, 5, 3, data);
      const absolute = Math.abs(coordinate), degrees = Math.floor(absolute);
      const minutes = (absolute - degrees) * 60, wholeMinutes = Math.floor(minutes);
      [degrees, wholeMinutes, Math.round((minutes - wholeMinutes) * 60_000_000)].forEach((value, part) => {
        u32(data + part * 8, value); u32(data + part * 8 + 4, part === 2 ? 1_000_000 : 1);
      });
    });
  }
  return output;
}

function pngExifChunk(tiff: Uint8Array<ArrayBuffer>) {
  const chunk = new Uint8Array(tiff.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, tiff.length);
  chunk.set([101, 88, 73, 102], 4); // eXIf
  chunk.set(tiff, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  return chunk;
}

export function addSelectedPhotoMetadata(blob: Blob, metadata: PhotoMetadata, location: boolean, description: boolean) {
  const tiff = selectedExif(metadata, location, description);
  if (!tiff) return blob;
  if (blob.type === 'image/png') {
    // PNG signature and IHDR occupy the first 33 bytes.
    return new Blob([blob.slice(0, 33), pngExifChunk(tiff), blob.slice(33)], {type: blob.type});
  }
  const length = tiff.length + 8;
  const header = new Uint8Array([0xff, 0xe1, length >> 8, length & 255, 69, 120, 105, 102, 0, 0]);
  return new Blob([blob.slice(0, 2), header, tiff, blob.slice(2)], {type: blob.type});
}
