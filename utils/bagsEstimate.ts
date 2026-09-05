// Taxa histórica de conversão de participantes em bolsas coletadas.
// Cerca de 80% dos participantes de um evento de coleta de fato doam.
export const PARTICIPANT_TO_BAGS_RATE = 0.8;

// Estimativa de bolsas a partir dos participantes esperados.
// Retorna null quando a entrada não permite estimar.
export function estimateBagsFromParticipants(
  participants: number | undefined | null
): number | null {
  if (
    typeof participants !== "number" ||
    !Number.isFinite(participants) ||
    participants < 1
  ) {
    return null;
  }
  return Math.floor(participants * PARTICIPANT_TO_BAGS_RATE);
}
