import { z } from "zod";
import { getAvailableDatesByBloodBank } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

const querySchema = z.object({
  year: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : undefined)),
  month: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : undefined)),
});

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "bloodBanksLocationId é obrigatório",
    });
  }
  assertUserAccessToBloodBanksLocationId(
    event.context.auth.user,
    bloodBanksLocationId
  );
  // Validar query parameters
  const query = await getQuery(event);
  const { year, month } = querySchema.parse(query);

  try {
    const availableDates = await getAvailableDatesByBloodBank(
      bloodBanksLocationId,
      { year }
    );

    return {
      success: true,
      data: availableDates,
    };
  } catch (error: any) {
    console.error("Error loading available dates:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Erro ao carregar datas disponíveis",
    });
  }
});
