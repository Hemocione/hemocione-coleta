import { z } from "zod";
import { createCollectionRequest } from "~/server/services/collectionRequest";

const bodySchema = z.object({
  bloodBanksLocationId: z.string(),
  requestedDates: z
    .array(
      z.object({
        availableDateId: z.string(),
        slotIds: z.array(z.string()).optional(),
      })
    )
    .min(1)
    .max(3),
});

export default defineEventHandler(async (event) => {
  const institutionId = getRouterParam(event, "institutionId");
  if (!institutionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "institutionId é obrigatório",
    });
  }

  // Auth required (handled by middleware), use token user for requestedByUserId
  const userId = event.context.auth?.user?.id;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody(event);
  const { bloodBanksLocationId, requestedDates } = bodySchema.parse(body);

  const result = await createCollectionRequest(bloodBanksLocationId, {
    institutionId,
    requestedByUserId: userId,
    requestedDates,
  });

  return {
    success: true,
    data: result,
  };
});
