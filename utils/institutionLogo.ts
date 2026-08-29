export const MAX_INSTITUTION_LOGO_BYTES = 2 * 1024 * 1024;
export const INSTITUTION_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
] as const;

export function isHemocioneCdnUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "cdn.hemocione.com.br" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

type InstitutionLogoMimeType = (typeof INSTITUTION_LOGO_MIME_TYPES)[number];

interface ImageDimensions {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const JPEG_START = [0xff, 0xd8];
const JPEG_SOF_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

function isPng(data: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => data[index] === byte);
}

function isJpeg(data: Uint8Array) {
  return JPEG_START.every((byte, index) => data[index] === byte);
}

function crc32(data: Uint8Array, start: number, end: number) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc ^= data[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readPngDimensions(data: Uint8Array): ImageDimensions | null {
  if (!isPng(data) || data.length < 24) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = PNG_SIGNATURE.length;
  let dimensions: ImageDimensions | null = null;
  let hasImageData = false;

  while (offset + 12 <= data.length) {
    const chunkLength = view.getUint32(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > data.length) return null;

    const chunkType = String.fromCharCode(
      data[typeStart],
      data[typeStart + 1],
      data[typeStart + 2],
      data[typeStart + 3]
    );
    if (crc32(data, typeStart, dataEnd) !== view.getUint32(dataEnd)) {
      return null;
    }

    if (offset === PNG_SIGNATURE.length) {
      if (chunkType !== "IHDR" || chunkLength !== 13) return null;
      const width = view.getUint32(dataStart);
      const height = view.getUint32(dataStart + 4);
      if (width === 0 || height === 0) return null;
      dimensions = { width, height };
    } else if (chunkType === "IDAT") {
      hasImageData = hasImageData || chunkLength > 0;
    } else if (chunkType === "IEND") {
      return chunkLength === 0 && hasImageData && chunkEnd === data.length
        ? dimensions
        : null;
    }

    offset = chunkEnd;
  }

  return null;
}

function readJpegDimensions(data: Uint8Array): ImageDimensions | null {
  if (!isJpeg(data) || data.length < 4) return null;
  if (data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) {
    return null;
  }

  let offset = 2;
  let dimensions: ImageDimensions | null = null;
  while (offset < data.length) {
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset];
    offset += 1;

    if (marker === undefined) break;
    if (marker === 0xd9) {
      return offset === data.length ? dimensions : null;
    }
    if (marker === 0xda) {
      if (offset + 2 > data.length - 2) return null;
      const scanHeaderLength = (data[offset] << 8) | data[offset + 1];
      if (
        scanHeaderLength < 2 ||
        offset + scanHeaderLength >= data.length - 2
      ) {
        return null;
      }
      return dimensions;
    }
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > data.length) break;

    const segmentLength = (data[offset] << 8) | data[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > data.length) break;

    if (JPEG_SOF_MARKERS.has(marker) && segmentLength >= 7) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const height = view.getUint16(offset + 3);
      const width = view.getUint16(offset + 5);
      dimensions = width > 0 && height > 0 ? { width, height } : null;
    }

    offset += segmentLength;
  }

  return null;
}

function detectMimeType(data: Uint8Array): InstitutionLogoMimeType | null {
  if (isPng(data)) return "image/png";
  if (isJpeg(data)) return "image/jpeg";
  return null;
}

export function validateInstitutionLogoData(
  data: Uint8Array,
  declaredMimeType: string
): { mimeType: InstitutionLogoMimeType } & ImageDimensions {
  if (data.byteLength > MAX_INSTITUTION_LOGO_BYTES) {
    throw new Error("A logo deve ter no máximo 2 MB.");
  }

  const mimeType = declaredMimeType.split(";", 1)[0].trim().toLowerCase();
  if (!INSTITUTION_LOGO_MIME_TYPES.includes(mimeType as InstitutionLogoMimeType)) {
    throw new Error("A logo deve ser um arquivo PNG ou JPEG.");
  }

  const detectedMimeType = detectMimeType(data);
  if (detectedMimeType !== mimeType) {
    throw new Error(
      `O conteúdo do arquivo não corresponde ao tipo ${mimeType === "image/png" ? "PNG" : "JPEG"}.`
    );
  }

  const dimensions =
    mimeType === "image/png"
      ? readPngDimensions(data)
      : readJpegDimensions(data);
  if (!dimensions) {
    throw new Error("Não foi possível ler as dimensões da logo.");
  }
  if (dimensions.width !== dimensions.height) {
    throw new Error("A logo deve ser quadrada.");
  }

  return { mimeType: mimeType as InstitutionLogoMimeType, ...dimensions };
}
