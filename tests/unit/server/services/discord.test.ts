import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  config: { discordBloodBankInterestWebhookUrl: "" },
}));

vi.stubGlobal("$fetch", mocks.fetch);
vi.stubGlobal("useRuntimeConfig", () => mocks.config);

let sendBloodBankInterestToDiscord: typeof import("~/server/services/discord")["sendBloodBankInterestToDiscord"];

beforeAll(async () => {
  ({ sendBloodBankInterestToDiscord } = await import("~/server/services/discord"));
});

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.config.discordBloodBankInterestWebhookUrl = "";
});

describe("delivery Discord", () => {
  it("retorna disabled sem chamar a rede quando não há webhook", async () => {
    await expect(
      sendBloodBankInterestToDiscord({
        bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
        bankName: "Banco A",
        name: "Pessoa A",
        phone: "11999999999",
        institutionName: "Instituição A",
        userId: "user-a",
        origin: "ondedoar",
      }),
    ).resolves.toEqual({ status: "disabled" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("envia um embed com mentions desativadas", async () => {
    mocks.config.discordBloodBankInterestWebhookUrl =
      "https://discord.com/api/webhooks/example-id/example-value";
    mocks.fetch.mockResolvedValue(undefined);

    await expect(
      sendBloodBankInterestToDiscord({
        bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
        bankName: "Banco A",
        name: "Pessoa A",
        phone: "11999999999",
        institutionName: "Instituição A",
        institutionDocument: "04252011000110",
        userId: undefined,
        origin: "ondedoar",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/example-id/example-value",
      expect.objectContaining({
          method: "POST",
        timeout: 15000,
        body: expect.objectContaining({
          allowed_mentions: { parse: [] },
          embeds: [
            expect.objectContaining({
              title: "Novo interesse em coleta externa",
              color: expect.any(Number),
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: "Instituição",
                  value: "Instituição A",
                }),
                expect.objectContaining({
                  name: "CNPJ",
                  value: "04.252.011/0001-10",
                }),
                expect.objectContaining({
                  name: "Banco de sangue",
                  value: "Banco A",
                }),
              ]),
            }),
          ],
        }),
      }),
    );
  });

  it("recusa webhook sem HTTPS sem expor o valor configurado", async () => {
    mocks.config.discordBloodBankInterestWebhookUrl = "http://discord.example/example-value";

    await expect(
      sendBloodBankInterestToDiscord({
        bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
        bankName: "Banco A",
        name: "Pessoa A",
        phone: "11999999999",
        institutionName: "Instituição A",
        origin: "ondedoar",
      }),
    ).rejects.toThrow("HTTPS");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("trata resposta negativa do Discord como falha", async () => {
    mocks.config.discordBloodBankInterestWebhookUrl =
      "https://discord.com/api/webhooks/example-id/example-value";
    mocks.fetch.mockResolvedValue({ ok: false });

    await expect(
      sendBloodBankInterestToDiscord({
        bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
        bankName: "Banco A",
        name: "Pessoa A",
        phone: "11999999999",
        institutionName: "Instituição A",
        origin: "ondedoar",
      }),
    ).rejects.toThrow("rejected");
  });

  it("remove caracteres de controle dos campos exibidos no embed", async () => {
    mocks.config.discordBloodBankInterestWebhookUrl =
      "https://discord.com/api/webhooks/example-id/example-value";
    mocks.fetch.mockResolvedValue(undefined);

    await sendBloodBankInterestToDiscord({
      bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
      bankName: "Banco A\nBanco falso",
      name: "Pessoa A\r\nInstrução falsa",
      phone: "11999999999\nOutra linha",
      institutionName: "Instituição A\tEmpresa falsa",
      origin: "ondedoar",
    });

    const body = mocks.fetch.mock.calls[0][1].body;
    const fields = body.embeds[0].fields as Array<{ name: string; value: string }>;
    expect(fields.find((field) => field.name === "Instituição")?.value).toBe(
      "Instituição A Empresa falsa",
    );
    expect(fields.find((field) => field.name === "Banco de sangue")?.value).toBe(
      "Banco A Banco falso",
    );
    expect(fields.find((field) => field.name === "Contato")?.value).toBe(
      "Pessoa A Instrução falsa\n11999999999 Outra linha",
    );
  });
});
