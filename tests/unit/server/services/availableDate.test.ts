import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAvailableDate } from "~/server/services/availableDate";

const mocks = vi.hoisted(() => ({
  availableDateFindOne: vi.fn(),
  availableDateSave: vi.fn(),
  teamFind: vi.fn(),
  getBloodBank: vi.fn(),
}));

vi.mock("~/server/models", () => {
  class AvailableDateMock {
    constructor(doc: Record<string, unknown>) {
      Object.assign(this, doc);
    }
    save() {
      return mocks.availableDateSave(this);
    }
  }
  (AvailableDateMock as unknown as { findOne: unknown }).findOne = (
    ...args: unknown[]
  ) => mocks.availableDateFindOne(...args);

  return {
    availableDate: { AvailableDate: AvailableDateMock },
    team: { Team: { find: (...args: unknown[]) => mocks.teamFind(...args) } },
  };
});

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBank(...args),
}));

const bloodBanksLocationId = "bloodbank-a";
const futureDate = "2999-01-15";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.availableDateFindOne.mockReturnValue({
    lean: () => Promise.resolve(null),
  });
  mocks.availableDateSave.mockImplementation((instance: any) =>
    Promise.resolve({ toObject: () => ({ ...instance }) })
  );
  mocks.getBloodBank.mockResolvedValue({ timezone: "America/Sao_Paulo" });
  mocks.teamFind.mockReturnValue({
    lean: () =>
      Promise.resolve([
        { _id: "507f1f77bcf86cd799439011" },
        { _id: "507f1f77bcf86cd799439012" },
      ]),
  });
});

describe("createAvailableDate — status bloqueada/pendente", () => {
  it.each(["blocked", "pending"] as const)(
    "cria a data com status=%s sem slots e sem consultar times/timezone",
    async (status) => {
      const result = await createAvailableDate(
        bloodBanksLocationId,
        futureDate,
        false,
        { type: "global" },
        status
      );

      expect(result).toMatchObject({
        bloodBanksLocationId,
        date: futureDate,
        isAllTeams: false,
        status,
        slots: [],
      });
      expect(mocks.teamFind).not.toHaveBeenCalled();
      expect(mocks.getBloodBank).not.toHaveBeenCalled();
    }
  );

  it("rejeita bloquear/marcar como pendente uma data no passado", async () => {
    await expect(
      createAvailableDate(
        bloodBanksLocationId,
        "2000-01-01",
        false,
        { type: "global" },
        "blocked"
      )
    ).rejects.toThrow("Não é possível criar datas no passado");
  });

  it("rejeita quando já existe registro (bloqueado, pendente ou liberado) para a data", async () => {
    mocks.availableDateFindOne.mockReturnValue({
      lean: () => Promise.resolve({ _id: "existing" }),
    });

    await expect(
      createAvailableDate(
        bloodBanksLocationId,
        futureDate,
        false,
        { type: "global" },
        "pending"
      )
    ).rejects.toThrow("Já existe uma data cadastrada para este dia");
  });

  it("mantém o comportamento padrão (status=released) quando o parâmetro é omitido", async () => {
    const result = await createAvailableDate(bloodBanksLocationId, futureDate, true, {
      type: "global",
      globalStartTime: "08:00",
      globalEndTime: "17:00",
    });

    expect(result.status).toBe("released");
    expect(result.slots).toHaveLength(2);
    expect(mocks.teamFind).toHaveBeenCalled();
    expect(mocks.getBloodBank).toHaveBeenCalled();
  });
});
