import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { CollectionRequestSchema } from "~/server/models/collectionRequest";

// Modelo dedicado com nome único, só para validar o schema sem tocar no
// registro global do mongoose nem precisar de conexão com banco.
const CollectionRequestPriorityTestModel = mongoose.model(
  "CollectionRequestPriorityTest",
  CollectionRequestSchema
);

const baseHost = {
  name: "Pessoa responsável",
  email: "pessoa@example.com",
  phone: "11999999999",
};

function buildRequest(
  requestedDates: Array<{ availableDateId: string; priority?: number }>
) {
  return new CollectionRequestPriorityTestModel({
    institutionId: "550e8400-e29b-41d4-a716-446655440000",
    requestedByUserId: "550e8400-e29b-41d4-a716-446655440001",
    bloodBanksLocationId: "550e8400-e29b-41d4-a716-446655440002",
    requestedDates,
    host: baseHost,
  });
}

describe("RequestedDateSchema.priority", () => {
  it("exige o campo priority em cada data solicitada", () => {
    const doc = buildRequest([
      { availableDateId: new mongoose.Types.ObjectId().toString() },
    ]);

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(String(error)).toMatch(/priorit/i);
  });

  it("rejeita priority fora do intervalo 1..3", () => {
    const doc = buildRequest([
      {
        availableDateId: new mongoose.Types.ObjectId().toString(),
        priority: 4,
      },
    ]);

    const error = doc.validateSync();

    expect(error).toBeDefined();
  });

  it("rejeita prioridades duplicadas entre as datas solicitadas", () => {
    const doc = buildRequest([
      {
        availableDateId: new mongoose.Types.ObjectId().toString(),
        priority: 1,
      },
      {
        availableDateId: new mongoose.Types.ObjectId().toString(),
        priority: 1,
      },
    ]);

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(String(error)).toMatch(/priorit/i);
  });

  it("aceita prioridades únicas de 1 a N para N datas solicitadas", () => {
    const doc = buildRequest([
      { availableDateId: new mongoose.Types.ObjectId().toString(), priority: 2 },
      { availableDateId: new mongoose.Types.ObjectId().toString(), priority: 1 },
      { availableDateId: new mongoose.Types.ObjectId().toString(), priority: 3 },
    ]);

    const error = doc.validateSync();

    expect(error).toBeUndefined();
  });
});
