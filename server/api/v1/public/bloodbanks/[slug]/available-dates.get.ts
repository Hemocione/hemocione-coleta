import { z } from "zod";
import { getBloodBanksLocationIdBySlug } from "~/server/services/bloodBank";
import { getAvailableDatesByBloodBank } from "~/server/services/availableDate";

const querySchema = z.object({
  year: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v) : undefined)),
  month: z
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
  const { year, month } = querySchema.parse(query);

  const bloodBanksLocationId = await getBloodBanksLocationIdBySlug(slug);
  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Banco não encontrado",
    });
  }

  const dates = await getAvailableDatesByBloodBank(
    bloodBanksLocationId,
    year,
    month
  );

  // Strip sensitive fields if any (none currently)
  return {
    success: true,
    data: dates,
  };
});
