export interface PhotoMetadata {
  latitude?: number;
  longitude?: number;
  description?: string;
  make?: string;
  model?: string;
  dateTaken?: string;
  lens?: string;
}

export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  try {
    const exifr = await import('exifr');
    const parse = exifr.parse ?? exifr.default.parse;
    const tags = await parse(await file.arrayBuffer(), {gps: true, xmp: true, iptc: true, reviveValues: false});
    const metadata: PhotoMetadata = {};
    if (Number.isFinite(tags?.latitude) && Math.abs(tags.latitude) <= 90
        && Number.isFinite(tags?.longitude) && Math.abs(tags.longitude) <= 180) {
      metadata.latitude = tags.latitude;
      metadata.longitude = tags.longitude;
    }
    const description = [tags?.ImageDescription, tags?.Caption, tags?.description]
      .find(value => typeof value === 'string' && value.trim());
    if (description) metadata.description = description.trim().replaceAll('\0', '').slice(0, 1000);
    const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\0/g, '').slice(0, 160) : undefined;
    metadata.make = clean(tags?.Make);
    metadata.model = clean(tags?.Model);
    metadata.lens = clean(tags?.LensModel);
    const date = clean(tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate);
    if (date && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) metadata.dateTaken = date;
    return metadata;
  } catch {
    return {};
  }
}

// Use selected tags and fresh offsets so removed data and stale orientation never travel with the export.
function selectedExif(metadata: PhotoMetadata, location: boolean, description: boolean) {
  const encode = (value: string | undefined) => value ? new TextEncoder().encode(value + '\0') : null;
  const asciiEntries = (fields: Array<[number, string | undefined]>) => fields.flatMap(([tag, value]) => {
    const bytes = encode(value);
    return bytes ? [{tag, bytes}] : [];
  });
  const root = asciiEntries([[0x010e, description ? metadata.description : undefined], [0x010f, metadata.make], [0x0110, metadata.model]]);
  const camera = asciiEntries([[0x9003, metadata.dateTaken], [0xa434, metadata.lens]]);
  const hasGps = location && metadata.latitude !== undefined && metadata.longitude !== undefined;
  const count = root.length + Number(Boolean(camera.length)) + Number(hasGps);
  if (!count) return null;
  const cameraOffset = 14 + count * 12;
  const gpsOffset = cameraOffset + (camera.length ? 6 + camera.length * 12 : 0);
  let nextData = gpsOffset + (hasGps ? 102 : 0);
  const dataSize = [...root, ...camera].reduce((size, {bytes}) => size + (bytes.length > 4 ? bytes.length + bytes.length % 2 : 0), 0);
  const output = new Uint8Array(nextData + dataSize);
  const view = new DataView(output.buffer);
  const u16 = (offset: number, value: number) => view.setUint16(offset, value, true);
  const u32 = (offset: number, value: number) => view.setUint32(offset, value, true);
  output.set([73, 73, 42, 0]);
  u32(4, 8);
  u16(8, count);
  const entry = (offset: number, tag: number, type: number, amount: number, data: number) => {
    u16(offset, tag); u16(offset + 2, type); u32(offset + 4, amount); u32(offset + 8, data);
  };
  const writeAscii = (fields: ReturnType<typeof asciiEntries>, directory: number) => {
    fields.forEach(({tag, bytes}, index) => {
      const offset = directory + index * 12;
      const inline = bytes.length <= 4;
      entry(offset, tag, 2, bytes.length, inline ? 0 : nextData);
      output.set(bytes, inline ? offset + 8 : nextData);
      if (!inline) nextData += bytes.length + bytes.length % 2;
    });
  };
  writeAscii(root, 10);
  if (camera.length) {
    entry(10 + root.length * 12, 0x8769, 4, 1, cameraOffset);
    u16(cameraOffset, camera.length);
    writeAscii(camera, cameraOffset + 2);
  }
  if (hasGps) {
    entry(10 + (root.length + Number(Boolean(camera.length))) * 12, 0x8825, 4, 1, gpsOffset);
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
