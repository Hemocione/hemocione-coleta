import { z } from "zod";
import { createCollectionRequest } from "~/server/services/collectionRequest";

const hostSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(1).max(20),
});

const addressSchema = z.object({
  street: z.string().min(1).max(300),
  number: z.string().min(1).max(20),
  complement: z.string().max(200).optional(),
  neighborhood: z.string().min(1).max(200),
  city: z.string().min(1).max(200),
  state: z.string().min(2).max(2),
  zipCode: z.string().min(8).max(10),
});

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
  host: hostSchema,
  address: addressSchema.optional(),
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
  const { bloodBanksLocationId, requestedDates, host, address } = bodySchema.parse(body);

  const result = await createCollectionRequest(bloodBanksLocationId, {
    institutionId,
    requestedByUserId: userId,
    requestedDates,
    host,
    address,
  });

  return {
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  };
});
