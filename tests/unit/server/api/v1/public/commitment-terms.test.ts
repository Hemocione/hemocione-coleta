import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCommitmentTermByToken: vi.fn(),
  getBloodBankByBloodBanksLocationId: vi.fn(),
}));

vi.mock("~/server/services/commitmentTerm", () => ({
  getCommitmentTermByToken: (...args: unknown[]) =>
    mocks.getCommitmentTermByToken(...args),
  renderTemplate: (template: string, params: Record<string, string>) =>
    template.replace("{{Grupo Pulsa}}", params.bloodBankName),
}));
vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBankByBloodBanksLocationId(...args),
}));

interface FakeEvent {
  context: { params: Record<string, string> };
  node: {
    res: {
      headers: Record<string, string>;
      setHeader: (name: string, value: string) => void;
    };
  };
}

let publicHandler: (event: FakeEvent) => Promise<any>;
let pdfHandler: (event: FakeEvent) => Promise<any>;

function makeEvent(): FakeEvent {
  return {
    context: { params: { token: "public-token" } },
    node: {
      res: {
        headers: {},
        setHeader(name, value) {
          this.headers[name.toLowerCase()] = value;
        },
      },
    },
  };
}

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name]
  );
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );

  const [publicTerm, pdf] = await Promise.all([
    import("~/server/api/v1/public/commitment-terms/[token]/index.get"),
    import("~/server/api/v1/public/commitment-terms/[token]/pdf.get"),
  ]);
  publicHandler = publicTerm.default as typeof publicHandler;
  pdfHandler = pdf.default as typeof pdfHandler;
});

beforeEach(() => {
  mocks.getCommitmentTermByToken.mockReset();
  mocks.getCommitmentTermByToken.mockResolvedValue({
    _id: "term-a",
    bloodBanksLocationId: "blood-bank-a",
    generatedContent: "Banco: {{Grupo Pulsa}}",
    status: "sent",
    sentAt: null,
    acknowledgedAt: null,
    createdAt: new Date("2026-08-27T12:00:00.000Z"),
  });
  mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
    name: "Hemodemo",
  });
});

describe("termo público", () => {
  it("não exibe placeholder legado no conteúdo público", async () => {
    const response = await publicHandler(makeEvent());

    expect(response.data.generatedContent).toBe("Banco: Hemodemo");
  });

  it("retorna PDF como download", async () => {
    const event = makeEvent();
    const pdf = await pdfHandler(event);

    expect(event.node.res.headers).toMatchObject({
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="termo-de-compromisso.pdf"',
    });
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toBe("%PDF-1.4");
  });
});
