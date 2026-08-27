import { describe, expect, it } from "vitest";
import { isCollectionRequestScheduled } from "~/utils/bloodbankCollectionRequest";

describe("status de agendamento da coleta", () => {
  it("considera aceite com horário selecionado como agendado", () => {
    expect(
      isCollectionRequestScheduled({
        status: "accepted",
        selectedSlotId: "slot-a",
      })
    ).toBe(true);
  });

  it("não considera aceite sem horário como agendado", () => {
    expect(isCollectionRequestScheduled({ status: "accepted" })).toBe(false);
  });
});
