import { z } from "zod";
import { bulkSetAvailableDates } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

const entrySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  isAvailable: z.boolean(),
  teamId: z.string().nullish(),
});

const bodySchema = z.object({
  entries: z
    .array(entrySchema)
    .min(1, "Pelo menos uma entrada é obrigatória")
    .max(366, "Máximo de 366 entradas por chamada"),
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

  const body = await readBody(event);
  const { entries } = bodySchema.parse(body);

  try {
    const result = await bulkSetAvailableDates(bloodBanksLocationId, entries);

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error("Error in bulk available dates:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Erro ao processar disponibilidades em massa",
    });
  }
});
