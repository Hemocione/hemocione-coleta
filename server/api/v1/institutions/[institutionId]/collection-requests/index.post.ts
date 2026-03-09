import { z } from "zod";
import {
  createCollectionRequest,
  getBloodBankLastAcceptorUserId,
} from "~/server/services/collectionRequest";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import { sendWhatsAppNotification } from "~/server/services/notification";

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

  // Fire-and-forget WhatsApp notification to blood bank responsible person
  (async () => {
    try {
      const responsibleUserId = await getBloodBankLastAcceptorUserId(
        bloodBanksLocationId
      );
      if (!responsibleUserId) {
        console.log(
          "[notification] No responsible person found for blood bank, skipping notification"
        );
        return;
      }

      const bloodBankDoc =
        await getBloodBankByBloodBanksLocationId(bloodBanksLocationId);
      const bloodBankName = bloodBankDoc?.name || "Banco de Sangue";
      const bloodBankSlug = bloodBankDoc?.slug || "";

      const requestedDatesStr = result.availableSlotOptions
        .filter((s) => s.isRequested)
        .map((s) => s.date)
        .filter((d, i, arr) => arr.indexOf(d) === i)
        .join(", ");

      const backofficeUrl = `${process.env.NUXT_PUBLIC_BASE_URL || ""}/${bloodBankSlug}/coletas/${result._id}`;

      await sendWhatsAppNotification({
        userId: responsibleUserId,
        templateName: "collection_request_created",
        params: {
          bloodBankName,
          institutionName: result.institutionName,
          requestedDates: requestedDatesStr,
          backofficeUrl,
        },
      });
    } catch (err) {
      // Notification failure should never block the response
    }
  })();

  return {
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  };
});
