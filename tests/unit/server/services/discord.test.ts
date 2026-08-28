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
        userId: "user-a",
        origin: "ondedoar",
      }),
    ).resolves.toEqual({ status: "disabled" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("envia os dados com mentions desativadas", async () => {
    mocks.config.discordBloodBankInterestWebhookUrl =
      "https://discord.com/api/webhooks/example-id/example-value";
    mocks.fetch.mockResolvedValue(undefined);

    await expect(
      sendBloodBankInterestToDiscord({
        bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
        bankName: "Banco A",
        name: "Pessoa A",
        phone: "11999999999",
        userId: undefined,
        origin: "ondedoar",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/example-id/example-value",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          allowed_mentions: { parse: [] },
          content: expect.stringContaining("Pessoa A"),
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
        origin: "ondedoar",
      }),
    ).rejects.toThrow("rejected");
  });
});
