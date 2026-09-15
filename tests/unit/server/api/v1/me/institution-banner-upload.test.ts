import { EventEmitter } from "node:events";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_INSTITUTION_BANNER_BYTES } from "~/utils/institutionBanner";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  readMultipartFormData: vi.fn(),
}));

vi.stubGlobal("fetch", mocks.fetch);
vi.stubGlobal("readMultipartFormData", mocks.readMultipartFormData);
vi.stubGlobal("getRequestHeader", (event: FakeEvent, name: string) =>
  event.headers[name.toLowerCase()]
);
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal(
  "createError",
  (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options)
);
vi.stubGlobal("useRuntimeConfig", () => ({
  public: { eventosHemocione: "https://eventos.example.test/" },
}));

interface FakeEvent {
  context: { auth?: { token: string } };
  headers: Record<string, string>;
  node?: { req: FakeRequest };
}

class FakeRequest extends EventEmitter {
  resume = vi.fn();
  rawBody?: Buffer;
}

interface MultipartPart {
  name?: string;
  filename?: string;
  type?: string;
  data?: Uint8Array;
}

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

const validBannerPng = (() => {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, 1600);
  headerView.setUint32(4, 400);
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
  return data;
})();

let handler: (event: FakeEvent) => Promise<unknown>;

function makeEvent(overrides: Partial<FakeEvent> = {}): FakeEvent {
  return {
    context: { auth: { token: "jwt-token" } },
    headers: {
      "content-type": "multipart/form-data; boundary=test",
      "content-length": "200",
    },
    ...overrides,
  };
}

beforeAll(async () => {
  const mod = await import("~/server/api/v1/me/institutions/banner.post");
  handler = mod.default as typeof handler;
});

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.readMultipartFormData.mockReset();
  mocks.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      url: "https://cdn.hemocione.com.br/events/dev/uploads/users/banner.png",
    }),
  });
  mocks.readMultipartFormData.mockResolvedValue([
    {
      name: "image",
      filename: "banner.png",
      type: "image/png",
      data: validBannerPng,
    } satisfies MultipartPart,
  ]);
});

describe("POST /api/v1/me/institutions/banner", () => {
  it("validates a rectangular image and forwards it to the Eventos upload endpoint", async () => {
    await expect(handler(makeEvent())).resolves.toEqual({
      url: "https://cdn.hemocione.com.br/events/dev/uploads/users/banner.png",
    });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://eventos.example.test/api/v1/image/upload",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer jwt-token" },
      })
    );
    const request = mocks.fetch.mock.calls[0][1];
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get("image")).toBeInstanceOf(Blob);
  });

  it("requires the authenticated token from the coleta middleware", async () => {
    await expect(
      handler(makeEvent({ context: {} }))
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.readMultipartFormData).not.toHaveBeenCalled();
  });

  it("limits chunked multipart requests before parsing the body", async () => {
    const request = new FakeRequest();
    const result = handler(
      makeEvent({
        headers: { "content-type": "multipart/form-data; boundary=test" },
        node: { req: request },
      })
    );
    request.emit(
      "data",
      Buffer.alloc(MAX_INSTITUTION_BANNER_BYTES + 64 * 1024 + 1)
    );

    await expect(result).rejects.toMatchObject({ statusCode: 413 });
    expect(request.resume).toHaveBeenCalled();
    expect(mocks.readMultipartFormData).not.toHaveBeenCalled();
  });

  it("maps an unavailable Eventos service to a gateway error", async () => {
    mocks.fetch.mockRejectedValue(new Error("connection refused"));

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("does not return a URL outside the Hemocione CDN", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ url: "https://example.test/banner.png" }),
    });

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 502 });
  });
});
