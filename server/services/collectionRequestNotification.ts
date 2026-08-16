import { collectionRequest } from "~/server/models";
import { getBloodBankByBloodBanksLocationId } from "./bloodBank";
import { getInstitutionsByIds } from "./hemocioneId";
import {
  sendWhatsAppNotification,
  sendWhatsAppNotificationToPhone,
} from "./notification";

const { CollectionRequest } = collectionRequest;

export type CollectionRequestNotificationTransition =
  | "counter_proposed"
  | "counter_proposal_declined"
  | "awaiting_technical_visit"
  | "technical_visit_confirmed"
  | "technical_visit_verdict"
  | "scheduled";

interface NotifyCollectionRequestStatusTransitionData {
  requestId: string;
  bloodBanksLocationId: string;
  transition: CollectionRequestNotificationTransition;
  recipientUserId?: string;
  technicalVisitResult?: "Aprovada" | "Reprovada";
}

function getCollectionRequestTrackingUrl(accessToken?: unknown): string {
  if (!accessToken) return "";

  return `${process.env.NUXT_PUBLIC_BASE_URL || ""}/agendar/acompanhar/${accessToken}`;
}

function formatDate(value: unknown): string {
  if (!value) return "";

  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

function getUserId(value: unknown): string | undefined {
  return value?.toString?.();
}

/**
 * Sends the WhatsApp notification associated with a collection-request
 * transition. This function deliberately owns recipient lookup and template
 * parameter ordering so every state transition uses the same rules.
 */
export async function notifyCollectionRequestStatusTransition({
  requestId,
  bloodBanksLocationId,
  transition,
  recipientUserId,
  technicalVisitResult,
}: NotifyCollectionRequestStatusTransitionData): Promise<void> {
  try {
    const request = await CollectionRequest.findOne({
      _id: requestId,
      bloodBanksLocationId,
      deletedAt: null,
    }).lean();

    if (!request) return;

    const [bloodBank, institutions] = await Promise.all([
      getBloodBankByBloodBanksLocationId(bloodBanksLocationId),
      getInstitutionsByIds([request.institutionId.toString()]),
    ]);

    const institution = institutions[0];
    const contactName = request.host?.name || "Responsável pela instituição";
    const bloodBankName = bloodBank?.name || "Banco de sangue";
    const institutionName = institution?.name || "Instituição";
    const trackingUrl = getCollectionRequestTrackingUrl(request.accessToken);
    const userId =
      recipientUserId || getUserId(request.requestedByUserId);

    if (transition === "counter_proposed") {
      const proposedDate = request.counterProposal?.proposedDates?.[0];

      if (!userId) return;

      void sendWhatsAppNotification({
        userId,
        templateName: "collection_request_counter_proposed",
        params: {
          contactName,
          bloodBankName,
          proposedDate: formatDate(proposedDate?.date),
          proposedTime: proposedDate?.startTime || "",
          trackingUrl,
        },
      }).catch(() => {});
      return;
    }

    if (transition === "counter_proposal_declined") {
      if (!userId) return;

      void sendWhatsAppNotification({
        userId,
        templateName: "collection_request_counter_proposal_declined",
        params: {
          contactName: "Equipe do banco de sangue",
          institutionName,
          trackingUrl,
        },
      }).catch(() => {});
      return;
    }

    if (transition === "awaiting_technical_visit") {
      if (!userId) return;

      void sendWhatsAppNotification({
        userId,
        templateName: "collection_request_awaiting_technical_visit",
        params: {
          contactName,
          bloodBankName,
          trackingUrl,
        },
      }).catch(() => {});
      return;
    }

    if (
      transition === "technical_visit_confirmed" ||
      transition === "technical_visit_verdict"
    ) {
      if (!userId) return;

      void sendWhatsAppNotification({
        userId,
        templateName: "technical_visit_confirmed",
        params: {
          contactName,
          bloodBankName,
          result: technicalVisitResult || "Aprovada",
          trackingUrl,
        },
      }).catch(() => {});
      return;
    }

    if (transition === "scheduled") {
      const confirmedDateTime = request.confirmedSchedule
        ? `${formatDate(request.confirmedSchedule.date)} ${request.confirmedSchedule.startTime}`.trim()
        : "";
      const eventLink = request.eventSlug
        ? `https://eventos.hemocione.com.br/event/${request.eventSlug}`
        : trackingUrl;
      const params = {
        contactName,
        bloodBankName,
        confirmedDateTime,
        eventLink,
      };

      if (userId) {
        void sendWhatsAppNotification({
          userId,
          templateName: "collection_request_scheduled",
          params,
        }).catch(() => {});
      }

      if (request.host?.phone) {
        void sendWhatsAppNotificationToPhone({
          phone: request.host.phone,
          templateName: "collection_request_scheduled",
          params,
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error(
      `[notification] Failed to prepare collection request notification: transition=${transition}, requestId=${requestId}`,
      error
    );
  }
}
