import { collectionRequest } from "~/server/models";
import { getBloodBankByBloodBanksLocationId } from "./bloodBank";
import { getInstitutionsByIds } from "./hemocioneId";
import {
  sendWhatsAppNotification,
  sendWhatsAppNotificationToPhone,
} from "./notification";
import { buildPublicUrl } from "~/utils/publicUrl";

const { CollectionRequest } = collectionRequest;

export type CollectionRequestNotificationTransition =
  | "counter_proposed"
  | "counter_proposal_declined"
  | "awaiting_technical_visit"
  | "technical_visit_proposed"
  | "technical_visit_scheduled"
  | "technical_visit_proposal_declined"
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

  return buildPublicUrl(`/agendar/acompanhar/${accessToken}`);
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

async function sendUserNotification(
  params: Parameters<typeof sendWhatsAppNotification>[0],
  requestId: string,
  transition: CollectionRequestNotificationTransition
): Promise<void> {
  try {
    const delivered = await sendWhatsAppNotification(params);
    if (!delivered) {
      console.error("[notification] WhatsApp notification was not delivered", {
        requestId,
        transition,
      });
    }
  } catch (error) {
    console.error("[notification] WhatsApp notification failed", {
      requestId,
      transition,
      error,
    });
  }
}

async function sendPhoneNotification(
  params: Parameters<typeof sendWhatsAppNotificationToPhone>[0],
  requestId: string,
  transition: CollectionRequestNotificationTransition
): Promise<void> {
  try {
    const delivered = await sendWhatsAppNotificationToPhone(params);
    if (!delivered) {
      console.error("[notification] WhatsApp phone notification was not delivered", {
        requestId,
        transition,
      });
    }
  } catch (error) {
    console.error("[notification] WhatsApp phone notification failed", {
      requestId,
      transition,
      error,
    });
  }
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

      await sendUserNotification({
        userId,
        templateName: "collection_request_counter_proposed",
        params: {
          contactName,
          bloodBankName,
          proposedDate: formatDate(proposedDate?.date),
          proposedTime: proposedDate?.startTime || "",
          trackingUrl,
        },
      }, requestId, transition);
      return;
    }

    if (transition === "counter_proposal_declined") {
      if (!userId) return;

      await sendUserNotification({
        userId,
        templateName: "collection_request_counter_proposal_declined",
        params: {
          contactName: "Equipe do banco de sangue",
          institutionName,
          trackingUrl,
        },
      }, requestId, transition);
      return;
    }

    if (transition === "awaiting_technical_visit") {
      if (!userId) return;

      await sendUserNotification({
        userId,
        templateName: "collection_request_awaiting_technical_visit",
        params: {
          contactName,
          bloodBankName,
          trackingUrl,
        },
      }, requestId, transition);
      return;
    }

    if (transition === "technical_visit_proposed") {
      if (!userId) return;

      const proposedDate = request.visitProposal?.proposedDates?.[0];

      await sendUserNotification({
        userId,
        templateName: "collection_request_technical_visit_proposed",
        params: {
          contactName,
          bloodBankName,
          proposedDate: formatDate(proposedDate?.date),
          proposedTime: proposedDate?.startTime || "",
          trackingUrl,
        },
      }, requestId, transition);
      return;
    }

    if (transition === "technical_visit_scheduled") {
      if (!userId) return;

      await sendUserNotification({
        userId,
        templateName: "technical_visit_scheduled",
        params: {
          contactName: "Equipe do banco de sangue",
          institutionName,
          trackingUrl,
        },
      }, requestId, transition);
      return;
    }

    if (transition === "technical_visit_proposal_declined") {
      if (!userId) return;

      await sendUserNotification({
        userId,
        templateName: "technical_visit_proposal_declined",
        params: {
          contactName: "Equipe do banco de sangue",
          institutionName,
          trackingUrl,
        },
      }, requestId, transition);
      return;
    }

    if (
      transition === "technical_visit_confirmed" ||
      transition === "technical_visit_verdict"
    ) {
      if (!userId) return;

      await sendUserNotification({
        userId,
        templateName: "technical_visit_confirmed",
        params: {
          contactName,
          bloodBankName,
          result: technicalVisitResult || "Aprovada",
          trackingUrl,
        },
      }, requestId, transition);
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
        await sendUserNotification({
          userId,
          templateName: "collection_request_scheduled",
          params,
        }, requestId, transition);
      }

      if (request.host?.phone) {
        await sendPhoneNotification({
          phone: request.host.phone,
          templateName: "collection_request_scheduled",
          params,
        }, requestId, transition);
      }
    }
  } catch (error) {
    console.error(
      `[notification] Failed to prepare collection request notification: transition=${transition}, requestId=${requestId}`,
      error
    );
  }
}
