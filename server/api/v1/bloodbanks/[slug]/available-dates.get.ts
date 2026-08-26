import { z } from "zod";
import { getActiveBloodBanksLocationIdBySlug } from "~/server/services/bloodBank";
import { getAvailableDatesByBloodBank } from "~/server/services/availableDate";

const querySchema = z.object({
  start: z.string().optional(), // YYYY-MM-DD
  end: z.string().optional(), // YYYY-MM-DD
  monthsAhead: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v) : undefined)),
});

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "slug é obrigatório" });
  }

  const query = await getQuery(event);
  const { start, end, monthsAhead } = querySchema.parse(query);

  const bloodBanksLocationId = await getActiveBloodBanksLocationIdBySlug(slug);
  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Banco não encontrado",
    });
  }

  const dates = await getAvailableDatesByBloodBank(bloodBanksLocationId, {
    start,
    end,
    monthsAhead: monthsAhead ?? 12,
    // Doador só pode ver/agendar datas liberadas.
    excludeStatuses: ["blocked", "pending"],
  });

  // Strip sensitive fields if any (none currently)
  return {
    success: true,
    data: dates,
  };
});
