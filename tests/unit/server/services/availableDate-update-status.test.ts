import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateAvailableDateStatus } from "~/server/services/availableDate";

const mocks = vi.hoisted(() => ({
  availableDateFindOneAndUpdate: vi.fn(),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: vi.fn(),
}));

vi.mock("~/server/models", () => {
  const AvailableDateMock = {} as Record<string, unknown>;
  AvailableDateMock.findOneAndUpdate = (...args: unknown[]) =>
    mocks.availableDateFindOneAndUpdate(...args);

  return {
    availableDate: { AvailableDate: AvailableDateMock },
    team: { Team: { find: vi.fn() } },
  };
});

const bloodBanksLocationId = "bloodbank-a";
const availableDateId = "507f1f77bcf86cd799439011";
const updatedDoc = { _id: availableDateId, status: "blocked", slots: [] };

beforeEach(() => {
  mocks.availableDateFindOneAndUpdate.mockReset();
});

describe("updateAvailableDateStatus", () => {
  it.each(["blocked", "pending", "released"] as const)(
    "persiste status=%s com filtro por banco e sem soft-delete",
    async (status) => {
      mocks.availableDateFindOneAndUpdate.mockReturnValue(updatedDoc);

      const result = await updateAvailableDateStatus(
        availableDateId,
        bloodBanksLocationId,
        status
      );

      expect(result).toBe(updatedDoc);
      expect(mocks.availableDateFindOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: availableDateId,
          bloodBanksLocationId,
          deletedAt: null,
        },
        { $set: { status } },
        { new: true, lean: true }
      );
    }
  );

  it("retorna null quando a data não pertence ao banco informado", async () => {
    mocks.availableDateFindOneAndUpdate.mockReturnValue(null);

    const result = await updateAvailableDateStatus(
      availableDateId,
      bloodBanksLocationId,
      "pending"
    );

    expect(result).toBeNull();
  });
});
