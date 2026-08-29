import { describe, expect, it } from "vitest";
import {
  isHemocioneCdnUrl,
  MAX_INSTITUTION_LOGO_BYTES,
  validateInstitutionLogoData,
} from "~/utils/institutionLogo";

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, payload: Uint8Array) {
  const chunk = new Uint8Array(12 + payload.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  chunk.set([...type].map((character) => character.charCodeAt(0)), 4);
  chunk.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(chunk.subarray(4, 8 + payload.length)));
  return chunk;
}

function pngData(width: number, height: number, requestedSize?: number) {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);

  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array([0])),
    pngChunk("IEND", new Uint8Array()),
  ];
  const data = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }

  if (!requestedSize || requestedSize <= data.length) return data;
  const padded = new Uint8Array(requestedSize);
  padded.set(data);
  return padded;
}

function jpegData(width: number, height: number) {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
    0xff,
    0xda,
    0x00,
    0x0c,
    0x03,
    0x01,
    0x00,
    0x02,
    0x11,
    0x03,
    0x11,
    0x00,
    0x3f,
    0x00,
    0x00,
    0xff,
    0xd9,
  ]);
}

describe("validateInstitutionLogoData", () => {
  it("accepts a square PNG within the size limit", () => {
    expect(validateInstitutionLogoData(pngData(512, 512), "image/png")).toEqual({
      mimeType: "image/png",
      width: 512,
      height: 512,
    });
  });

  it("accepts a square JPEG", () => {
    expect(validateInstitutionLogoData(jpegData(256, 256), "image/jpeg")).toEqual({
      mimeType: "image/jpeg",
      width: 256,
      height: 256,
    });
  });

  it("rejects a non-square image", () => {
    expect(() =>
      validateInstitutionLogoData(pngData(512, 256), "image/png")
    ).toThrow("quadrada");
  });

  it("rejects an image larger than 2 MB", () => {
    expect(() =>
      validateInstitutionLogoData(
        pngData(1, 1, MAX_INSTITUTION_LOGO_BYTES + 1),
        "image/png"
      )
    ).toThrow("2 MB");
  });

  it("rejects a MIME type that does not match the image bytes", () => {
    expect(() =>
      validateInstitutionLogoData(pngData(1, 1), "image/jpeg")
    ).toThrow("tipo JPEG");
  });

  it("rejects truncated PNG and JPEG files", () => {
    const png = pngData(1, 1);
    const jpeg = jpegData(1, 1);

    expect(() =>
      validateInstitutionLogoData(png.subarray(0, -12), "image/png")
    ).toThrow("dimensões");
    expect(() =>
      validateInstitutionLogoData(jpeg.subarray(0, -2), "image/jpeg")
    ).toThrow("dimensões");
  });
});

describe("isHemocioneCdnUrl", () => {
  it.each([
    "https://cdn.hemocione.com.br:444/logo.png",
    "https://user:password@cdn.hemocione.com.br/logo.png",
    "https://cdn.hemocione.com.br",
  ])("rejects an invalid CDN URL: %s", (url) => {
    expect(isHemocioneCdnUrl(url)).toBe(false);
  });
});
