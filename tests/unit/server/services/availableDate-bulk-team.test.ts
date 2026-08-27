import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkSetAvailableDates } from "~/server/services/availableDate";

const mocks = vi.hoisted(() => ({
  availableDateFind: vi.fn(),
  availableDateFindOneAndUpdate: vi.fn(),
  availableDateSave: vi.fn(),
  teamFind: vi.fn(),
  getBloodBank: vi.fn(),
}));

function chainable<T>(value: T) {
  const query = Promise.resolve(value) as Promise<T> & {
    lean: () => Promise<T>;
  };
  query.lean = () => Promise.resolve(value);
  return query;
}

vi.mock("~/server/models", () => {
  class AvailableDateMock {
    constructor(doc: Record<string, unknown>) {
      Object.assign(this, doc);
    }

    save() {
      return mocks.availableDateSave(this);
    }
  }

  (AvailableDateMock as unknown as { find: unknown }).find = (...args: unknown[]) =>
    mocks.availableDateFind(...args);
  (AvailableDateMock as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate =
    (...args: unknown[]) => mocks.availableDateFindOneAndUpdate(...args);

  return {
    availableDate: { AvailableDate: AvailableDateMock },
    team: { Team: { find: (...args: unknown[]) => mocks.teamFind(...args) } },
  };
});

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBank(...args),
}));

const bloodBanksLocationId = "blood-bank-a";
const date = "2999-01-15";
const teamA = "507f1f77bcf86cd799439011";
const teamB = "507f1f77bcf86cd799439012";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getBloodBank.mockResolvedValue({ timezone: "America/Sao_Paulo" });
  mocks.teamFind.mockReturnValue({
      lean: () =>
      Promise.resolve([
        { _id: teamA },
        { _id: teamB },
      ]),
  });
  mocks.availableDateFindOneAndUpdate.mockResolvedValue({ _id: "date-a" });
  mocks.availableDateSave.mockResolvedValue({});
});

describe("bulkSetAvailableDates por equipe", () => {
  it("adiciona uma equipe a uma data existente sem ignorar a operação", async () => {
    mocks.availableDateFind.mockReturnValue(
      chainable([
        {
          _id: "date-a",
          date,
          status: "released",
          isAllTeams: false,
          slots: [{ teamId: teamA, locked: false }],
        },
      ])
    );

    const result = await bulkSetAvailableDates(bloodBanksLocationId, [
      { date, isAvailable: true, teamId: teamB },
    ]);

    expect(result).toMatchObject({ created: 1, skipped: 0, errors: [] });
    expect(mocks.availableDateFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "date-a", bloodBanksLocationId, deletedAt: null },
      expect.objectContaining({
        $push: { slots: expect.objectContaining({ teamId: expect.anything() }) },
      })
    );
  });

  it("remove somente a equipe selecionada e preserva outras equipes da data", async () => {
    mocks.availableDateFind.mockReturnValue(
      chainable([
        {
          _id: "date-a",
          date,
          status: "released",
          isAllTeams: true,
          slots: [
            { teamId: teamA, locked: false, lockedBy: null },
            { teamId: teamB, locked: true, lockedBy: "request-b" },
          ],
        },
      ])
    );

    const result = await bulkSetAvailableDates(bloodBanksLocationId, [
      { date, isAvailable: false, teamId: teamA },
    ]);

    expect(result).toMatchObject({ deleted: 1, skipped: 0, errors: [] });
    expect(mocks.availableDateFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "date-a", bloodBanksLocationId, deletedAt: null },
      {
        $set: { isAllTeams: false },
          $pull: { slots: { teamId: teamA } },
      }
    );
  });
});
