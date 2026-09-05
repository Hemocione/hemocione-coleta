import { describe, expect, it } from "vitest";
import {
  PARTICIPANT_TO_BAGS_RATE,
  estimateBagsFromParticipants,
} from "~/utils/bagsEstimate";

describe("estimateBagsFromParticipants", () => {
  it("converte participantes em bolsas pela taxa de 80%", () => {
    expect(PARTICIPANT_TO_BAGS_RATE).toBe(0.8);
    expect(estimateBagsFromParticipants(300)).toBe(240);
    expect(estimateBagsFromParticipants(1500)).toBe(1200);
  });

  it("arredonda para baixo quando a conversão não é inteira", () => {
    expect(estimateBagsFromParticipants(7)).toBe(5); // 7 × 0,8 = 5,6 → 5
  });

  it("retorna null para entrada inválida", () => {
    expect(estimateBagsFromParticipants(0)).toBeNull();
    expect(estimateBagsFromParticipants(-5)).toBeNull();
    expect(estimateBagsFromParticipants(undefined)).toBeNull();
    expect(estimateBagsFromParticipants(Number.NaN)).toBeNull();
  });
});
