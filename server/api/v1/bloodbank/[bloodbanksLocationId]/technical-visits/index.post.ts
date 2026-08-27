import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import {
  createCommitmentTerm,
  getTemplateForBloodBank,
  renderTemplate,
} from "~/server/services/commitmentTerm";
import {
  getCollectionRequestById,
  getCollectionRequestsByBloodBank,
} from "~/server/services/collectionRequest";
import { sendWhatsAppNotificationToPhone } from "~/server/services/notification";
import {
  createTechnicalVisit,
  linkTechnicalVisitToCollectionRequest,
  updateTechnicalVisit,
} from "~/server/services/technicalVisit";

dayjs.extend(utc);
dayjs.extend(timezone);
const SCHEDULE_TIMEZONE = "America/Sao_Paulo";

const createTechnicalVisitSchema = z.object({
  requestId: z.string().trim().min(1).nullish(),
  institutionId: z.string().uuid().nullish(),
  address: z.string().min(1).max(500),
  location: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .nullish(),
  visitDate: z.string().datetime({ offset: true }).or(z.string().date()),
  outcome: z.enum(["approved", "rejected", "pending"]),
  notes: z.string().max(2000).nullish(),
});

export default defineEventHandler(async (event) => {
  const user = event.context.auth.user;
  const bloodBanksLocationId = getRouterParam(
    event,
    "bloodbanksLocationId"
  );

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID is required",
    });
  }

  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  const body = await readBody(event);
  const parsed = createTechnicalVisitSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  }

  try {
    let selectedRequest: Awaited<ReturnType<typeof getCollectionRequestById>> =
      null;

    if (parsed.data.requestId) {
      selectedRequest = await getCollectionRequestById(
        parsed.data.requestId,
        bloodBanksLocationId
      );

      if (
        !selectedRequest ||
        selectedRequest.status !== "awaiting_technical_visit" ||
        selectedRequest.technicalVisitId
      ) {
        throw createError({
          statusCode: 400,
          statusMessage:
            "A solicitação não está disponível para uma nova visita técnica",
        });
      }
    }

    const visitDate = parsed.data.visitDate.includes("T")
      ? new Date(parsed.data.visitDate)
      : dayjs
          .tz(`${parsed.data.visitDate}T12:00`, SCHEDULE_TIMEZONE)
          .toDate();

    const visit = await createTechnicalVisit({
      bloodBanksLocationId,
      institutionId:
        selectedRequest?.institutionId || parsed.data.institutionId || undefined,
      address: parsed.data.address,
      location: parsed.data.location ?? undefined,
      visitDate,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes ?? undefined,
      visitedBy: user.id,
    });

    if (selectedRequest && parsed.data.requestId) {
      await linkTechnicalVisitToCollectionRequest(
        parsed.data.requestId,
        bloodBanksLocationId,
        visit._id
      );
    }

    let responseVisit = visit;
    if (selectedRequest && parsed.data.requestId && parsed.data.outcome !== "pending") {
      responseVisit =
        (await updateTechnicalVisit(
          bloodBanksLocationId,
          visit._id,
          {
            outcome: parsed.data.outcome,
            notes: parsed.data.notes ?? undefined,
          },
          user.id
        )) || visit;
    }

    // Auto-generate commitment term if approved and setting is enabled
    if (parsed.data.outcome === "approved") {
      (async () => {
        try {
          const bloodBank =
            await getBloodBankByBloodBanksLocationId(bloodBanksLocationId);
          if (!bloodBank?.autoGenerateCommitmentTerm) return;

          // Find the latest collection request for this institution to get host/address data
          let hostPhone: string | undefined;
          let sentTo = "";
          const templateParams: Record<string, string> = {
            bloodBankName: bloodBank.name || "",
            address: parsed.data.address,
            date: new Date().toLocaleDateString("pt-BR"),
          };

          const institutionId =
            selectedRequest?.institutionId || parsed.data.institutionId;
          if (institutionId) {
            const requests = await getCollectionRequestsByBloodBank(
              bloodBanksLocationId,
              { institutionId },
              { page: 1, limit: 1 }
            );
            const latestRequest = requests.data[0];
            if (latestRequest) {
              templateParams.institutionName =
                latestRequest.institutionName || "";
              templateParams.hostName = latestRequest.host?.name || "";
              sentTo =
                latestRequest.host?.phone ||
                latestRequest.host?.email ||
                "";
              hostPhone = latestRequest.host?.phone;
            }
          }

          if (!sentTo) {
            console.log(
              "[commitment-term] No contact info found for auto-generated term, skipping"
            );
            return;
          }

          const template =
            await getTemplateForBloodBank(bloodBanksLocationId);
          const generatedContent = renderTemplate(
            template,
            templateParams
          );

          const term = await createCommitmentTerm({
            bloodBanksLocationId,
            technicalVisitId: responseVisit._id?.toString(),
            generatedContent,
            sentTo,
            status: "sent",
          });

          const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || "";
          const termUrl = `${baseUrl}/termo/${term.accessToken}`;

          // Send WhatsApp notification to host
          if (hostPhone) {
            sendWhatsAppNotificationToPhone({
              phone: hostPhone,
              templateName: "commitment_term_generated",
              params: {
                bloodBankName: templateParams.bloodBankName,
                termUrl,
                hostName: templateParams.hostName || "",
              },
            }).catch(() => {});
          }

          console.log(
            `[commitment-term] Auto-generated and sent term ${term._id} for visit ${responseVisit._id}`
          );
        } catch (err) {
          console.error(
            "[commitment-term] Failed to auto-generate term:",
            err
          );
        }
      })();
    }

    return {
      success: true,
      data: responseVisit,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("Error creating technical visit:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create technical visit",
    });
  }
});
