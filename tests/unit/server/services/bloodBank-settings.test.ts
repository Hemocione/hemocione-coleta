import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateBloodBankSettings } from "~/server/services/bloodBank";

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  bloodBank: {
    BloodBank: {
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.findOneAndUpdate(...args),
    },
  },
}));

const bloodBanksLocationId = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  mocks.findOneAndUpdate.mockReset();
});

describe("updateBloodBankSettings", () => {
  it("persiste hidden e retorna a configuração atualizada", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({
      bloodBanksLocationId,
      hidden: true,
    });

    const result = await updateBloodBankSettings(bloodBanksLocationId, {
      hidden: true,
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { bloodBanksLocationId },
      { $set: { hidden: true } },
      { new: true, lean: true, runValidators: true },
    );
    expect(result).toEqual({ bloodBanksLocationId, hidden: true });
  });

  it("retorna null quando o banco não existe", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);

    const result = await updateBloodBankSettings(bloodBanksLocationId, {
      hidden: false,
    });

    expect(result).toBeNull();
  });
});
