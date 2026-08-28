import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  sendBloodBankInterestToDiscord: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  bloodBankInterest: {
    BloodBankInterest: {
      findOne: (...args: unknown[]) => mocks.findOne(...args),
      findOneAndUpdate: (...args: unknown[]) => mocks.findOneAndUpdate(...args),
      create: (...args: unknown[]) => mocks.create(...args),
      updateOne: (...args: unknown[]) => mocks.updateOne(...args),
    },
  },
}));

vi.mock("~/server/services/discord", () => ({
  sendBloodBankInterestToDiscord: (...args: unknown[]) =>
    mocks.sendBloodBankInterestToDiscord(...args),
}));

const input = {
  bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
  bankName: "Banco A",
  name: "Pessoa A",
  phone: "11999999999",
  phoneNormalized: "5511999999999",
  userId: "user-a",
  origin: "ondedoar" as const,
  dedupeKey: "123e4567-e89b-12d3-a456-426614174000:5511999999999",
};

function queryResult<T>(value: T) {
  return { lean: () => ({ exec: () => Promise.resolve(value) }) };
}

beforeEach(() => {
  mocks.findOne.mockReset().mockReturnValue(queryResult(null));
  mocks.findOneAndUpdate
    .mockReset()
    .mockReturnValue(queryResult({ _id: "interest-a" }));
  mocks.create.mockReset().mockResolvedValue({ _id: "interest-a", ...input });
  mocks.updateOne.mockReset().mockResolvedValue({ acknowledged: true });
  mocks.sendBloodBankInterestToDiscord.mockReset().mockResolvedValue({ status: "sent" });
});

describe("persistência de interesse", () => {
  it("persiste antes do Discord e marca sent após delivery", async () => {
    const { createBloodBankInterest } = await import("~/server/services/bloodBankInterest");

    await expect(createBloodBankInterest(input)).resolves.toEqual({
      id: "interest-a",
      created: true,
      deliveryStatus: "sent",
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bloodBanksLocationId: input.bloodBanksLocationId,
        bankName: input.bankName,
        discordStatus: "pending",
      }),
    );
    expect(mocks.sendBloodBankInterestToDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ bankName: "Banco A" }),
    );
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: "interest-a" },
      expect.objectContaining({
        $set: expect.objectContaining({ discordStatus: "sent" }),
      }),
    );
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "interest-a" }),
      expect.objectContaining({
        $set: expect.objectContaining({ discordStatus: "delivering" }),
        $inc: { discordAttempts: 1 },
      }),
      { new: true, lean: true },
    );
  });

  it("marca failed e propaga erro de delivery sem marcar sent", async () => {
    mocks.sendBloodBankInterestToDiscord.mockRejectedValue(new Error("Discord down"));
    const { createBloodBankInterest } = await import("~/server/services/bloodBankInterest");

    await expect(createBloodBankInterest(input)).rejects.toMatchObject({
      statusCode: 502,
      message: "Interest saved but Discord delivery failed",
    });
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: "interest-a" },
      expect.objectContaining({
        $set: expect.objectContaining({
          discordStatus: "failed",
          discordLastError: "Discord delivery failed",
        }),
      }),
    );
    expect(mocks.updateOne.mock.calls[0][1].$set.discordStatus).not.toBe("sent");
  });

  it("não cria outro registro e retorna o estado sent para uma duplicata", async () => {
    mocks.findOne.mockReturnValue(queryResult({ _id: "old-interest", discordStatus: "sent" }));
    const { createBloodBankInterest } = await import("~/server/services/bloodBankInterest");

    await expect(createBloodBankInterest(input)).resolves.toEqual({
      id: "old-interest",
      created: false,
      deliveryStatus: "sent",
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.sendBloodBankInterestToDiscord).not.toHaveBeenCalled();
  });

  it("retenta uma duplicata que está failed", async () => {
    mocks.findOne.mockReturnValue(queryResult({
      _id: "old-interest",
      discordStatus: "failed",
      ...input,
    }));
    mocks.findOneAndUpdate.mockReturnValue(queryResult({ _id: "old-interest" }));
    const { createBloodBankInterest } = await import("~/server/services/bloodBankInterest");

    await expect(createBloodBankInterest(input)).resolves.toMatchObject({
      id: "old-interest",
      created: false,
      deliveryStatus: "sent",
    });
    expect(mocks.sendBloodBankInterestToDiscord).toHaveBeenCalledTimes(1);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: "old-interest" },
      expect.objectContaining({ $set: expect.objectContaining({ discordStatus: "sent" }) }),
    );
  });

  it("não envia delivery duplicada enquanto outra requisição possui a reivindicação", async () => {
    let claimCount = 0;
    let releaseDelivery!: (value: { status: "sent" }) => void;
    mocks.findOneAndUpdate.mockImplementation(() =>
      queryResult(claimCount++ === 0 ? { _id: "interest-a" } : null),
    );
    mocks.sendBloodBankInterestToDiscord.mockImplementation(
      () => new Promise((resolve) => {
        releaseDelivery = resolve;
      }),
    );
    const { createBloodBankInterest } = await import("~/server/services/bloodBankInterest");

    const firstDelivery = createBloodBankInterest(input);
    await vi.waitFor(() => expect(mocks.sendBloodBankInterestToDiscord).toHaveBeenCalledTimes(1));

    await expect(createBloodBankInterest(input)).resolves.toMatchObject({
      id: "interest-a",
      created: true,
      deliveryStatus: "pending",
    });
    expect(mocks.sendBloodBankInterestToDiscord).toHaveBeenCalledTimes(1);

    releaseDelivery({ status: "sent" });
    await expect(firstDelivery).resolves.toMatchObject({ deliveryStatus: "sent" });
  });

  it("não transforma falha ao salvar o estado em falso erro do Discord", async () => {
    mocks.updateOne.mockRejectedValue(new Error("Mongo unavailable"));
    const { createBloodBankInterest } = await import("~/server/services/bloodBankInterest");

    await expect(createBloodBankInterest(input)).rejects.toThrow(
      "Interest delivery status could not be saved",
    );
    expect(mocks.sendBloodBankInterestToDiscord).toHaveBeenCalledTimes(1);
    expect(mocks.updateOne.mock.calls[0][1].$set.discordStatus).toBe("sent");
  });
});
