import { EventEmitter } from "node:events";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_INSTITUTION_LOGO_BYTES } from "~/utils/institutionLogo";

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

const validPng = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  )
);

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
  const mod = await import("~/server/api/v1/me/institutions/logo.post");
  handler = mod.default as typeof handler;
});

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.readMultipartFormData.mockReset();
  mocks.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      url: "https://cdn.hemocione.com.br/events/dev/uploads/users/logo.png",
    }),
  });
  mocks.readMultipartFormData.mockResolvedValue([
    {
      name: "image",
      filename: "logo.png",
      type: "image/png",
      data: validPng,
    } satisfies MultipartPart,
  ]);
});

describe("POST /api/v1/me/institutions/logo", () => {
  it("validates the image and forwards it to the Eventos upload endpoint", async () => {
    await expect(handler(makeEvent())).resolves.toEqual({
      url: "https://cdn.hemocione.com.br/events/dev/uploads/users/logo.png",
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

  it("rejects a non-square image before calling Eventos", async () => {
    const nonSquare = new Uint8Array(validPng);
    new DataView(nonSquare.buffer).setUint32(20, 2);
    mocks.readMultipartFormData.mockResolvedValue([
      {
        name: "image",
        filename: "logo.png",
        type: "image/png",
        data: nonSquare,
      } satisfies MultipartPart,
    ]);

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.fetch).not.toHaveBeenCalled();
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
      Buffer.alloc(MAX_INSTITUTION_LOGO_BYTES + 64 * 1024 + 1)
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
      json: vi.fn().mockResolvedValue({ url: "https://example.test/logo.png" }),
    });

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 502 });
  });
});
