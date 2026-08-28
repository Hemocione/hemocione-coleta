import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  createCommitmentTerm: vi.fn(),
  getBloodBankByBloodBanksLocationId: vi.fn(),
  getTemplateForBloodBank: vi.fn(),
  renderTemplate: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/commitmentTerm", () => ({
  createCommitmentTerm: (...args: unknown[]) =>
    mocks.createCommitmentTerm(...args),
  getTemplateForBloodBank: (...args: unknown[]) =>
    mocks.getTemplateForBloodBank(...args),
  renderTemplate: (...args: unknown[]) => mocks.renderTemplate(...args),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBankByBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/notification", () => ({
  sendWhatsAppNotificationToPhone: vi.fn(),
}));

interface FakeEvent {
  context: {
    auth: {
      user: {
        id: string;
        givenName: string;
        surName: string;
      };
    };
    params: Record<string, string>;
  };
  body: unknown;
}

type Handler = (event: FakeEvent) => Promise<unknown>;

let handler: Handler;

function makeEvent(body: unknown): FakeEvent {
  return {
    context: {
      auth: {
        user: {
          id: "blood-bank-user",
          givenName: "Ana",
          surName: "Silva",
        },
      },
      params: { bloodbanksLocationId: "blood-bank-a" },
    },
    body,
  };
}

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name]
  );
  vi.stubGlobal("readBody", (event: FakeEvent) => event.body);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );

  const mod = await import(
    "~/server/api/v1/bloodbank/[bloodbanksLocationId]/commitment-terms/index.post"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  mocks.assertUserAccessToBloodBanksLocationId.mockReset();
  mocks.createCommitmentTerm.mockReset();
  mocks.getBloodBankByBloodBanksLocationId.mockReset();
  mocks.getTemplateForBloodBank.mockReset();
  mocks.renderTemplate.mockReset();
  mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
    name: "Hemodemo",
  });
  mocks.getTemplateForBloodBank.mockResolvedValue(
    "Banco: {{bloodBankName}}"
  );
  mocks.renderTemplate.mockImplementation(
    (_template: string, params: Record<string, string>) =>
      `Banco: ${params.bloodBankName}`
  );
  mocks.createCommitmentTerm.mockResolvedValue({
    _id: "term-a",
    accessToken: "term-token",
  });
});

describe("POST commitment-terms", () => {
  it("usa o nome autenticado para assinar e ignora assinatura no input", async () => {
    await handler(
      makeEvent({
        customContent: "Termo",
        sentTo: "11999999999",
        status: "draft",
        signedByName: "Nome não confiável",
        signedAt: "2020-01-01T00:00:00.000Z",
      })
    );

    expect(mocks.createCommitmentTerm).toHaveBeenCalledWith(
      expect.objectContaining({
        signedByName: "Ana Silva",
        signedAt: expect.any(Date),
      })
    );
    expect(mocks.createCommitmentTerm).not.toHaveBeenCalledWith(
      expect.objectContaining({ signedByName: "Nome não confiável" })
    );
  });

  it("usa o nome real do banco de sangue ao renderizar o termo", async () => {
    await handler(
      makeEvent({
        sentTo: "11999999999",
        status: "draft",
        templateParams: { bloodBankName: "Nome enviado pelo navegador" },
      })
    );

    expect(mocks.renderTemplate).toHaveBeenCalledWith(
      "Banco: {{bloodBankName}}",
      expect.objectContaining({ bloodBankName: "Hemodemo" })
    );
    expect(mocks.createCommitmentTerm).toHaveBeenCalledWith(
      expect.objectContaining({ generatedContent: "Banco: Hemodemo" })
    );
  });
});
