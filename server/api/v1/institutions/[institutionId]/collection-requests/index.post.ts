import { z } from "zod";
import {
  createCollectionRequest,
  getBloodBankLastAcceptorUserId,
} from "~/server/services/collectionRequest";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import { sendWhatsAppNotification } from "~/server/services/notification";
import { buildPublicUrl } from "~/utils/publicUrl";
import { formatWhatsAppDate } from "~/server/utils/formatWhatsAppDate";

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
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        priority: z.number().int().min(1).max(3).optional(),
      })
    )
    .min(1)
    .max(3),
  host: hostSchema,
  address: addressSchema.optional(),
  note: z.string().max(500).optional(),
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
  const { bloodBanksLocationId, requestedDates, host, address, note } =
    bodySchema.parse(body);

  const result = await createCollectionRequest(bloodBanksLocationId, {
    institutionId,
    requestedByUserId: userId,
    requestedDates,
    host,
    address,
    note,
  });

  try {
    const recipientUserId = await getBloodBankLastAcceptorUserId(
      bloodBanksLocationId
    );
    if (recipientUserId) {
      const bloodBankDoc =
        await getBloodBankByBloodBanksLocationId(bloodBanksLocationId);
      const bloodBankName = bloodBankDoc?.name || "Banco de Sangue";
      const bloodBankSlug = bloodBankDoc?.slug || "";

      const requestedDatesStr = result.availableSlotOptions
        .filter((slot) => slot.isRequested)
        .map((slot) => formatWhatsAppDate(slot.date))
        .filter((date, index, dates) => dates.indexOf(date) === index)
        .join(", ");

      const backofficeUrl = buildPublicUrl(
        `/${bloodBankSlug}/coletas/${result._id}`
      );

      const delivered = await sendWhatsAppNotification({
        userId: recipientUserId,
        templateName: "collection_request_created",
        params: {
          bloodBankName,
          institutionName: result.institutionName,
          requestedDates: requestedDatesStr,
          backofficeUrl,
        },
      });

      if (!delivered) {
        console.error(
          "[notification] Collection request created notification failed",
          { requestId: result._id }
        );
      }
    } else {
      console.log(
        "[notification] No accepted blood bank user found, skipping notification"
      );
    }
  } catch (error) {
    console.error(
      "[notification] Collection request created notification failed",
      error
    );
  }

  return {
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  };
});
