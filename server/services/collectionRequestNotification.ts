import { collectionRequest } from "~/server/models";
import { getBloodBankByBloodBanksLocationId } from "./bloodBank";
import { getInstitutionsByIds } from "./hemocioneId";
import {
  sendWhatsAppNotification,
  sendWhatsAppNotificationToPhone,
} from "./notification";
import { buildPublicUrl } from "~/utils/publicUrl";
import { formatWhatsAppDate } from "~/server/utils/formatWhatsAppDate";

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

// Only these transitions target the institution. Bank-facing transitions must
// not leak their notification to the institution host phone.
const INSTITUTION_RECIPIENT_TRANSITIONS =
  new Set<CollectionRequestNotificationTransition>([
    "counter_proposed",
    "awaiting_technical_visit",
    "technical_visit_proposed",
    "technical_visit_confirmed",
    "technical_visit_verdict",
    "scheduled",
  ]);

function getCollectionRequestTrackingUrl(accessToken?: unknown): string {
  if (!accessToken) return "";

  return buildPublicUrl(`/agendar/acompanhar/${accessToken}`);
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

async function sendInstitutionNotification(
  userId: string | undefined,
  phone: string | undefined,
  templateName: string,
  params: Record<string, string>,
  requestId: string,
  transition: CollectionRequestNotificationTransition
): Promise<void> {
  if (userId) {
    await sendUserNotification(
      { userId, templateName, params },
      requestId,
      transition
    );
  }

  if (phone) {
    await sendPhoneNotification(
      { phone, templateName, params },
      requestId,
      transition
    );
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
    const institutionPhone = INSTITUTION_RECIPIENT_TRANSITIONS.has(transition)
      ? request.host?.phone
      : undefined;

    if (transition === "counter_proposed") {
      const proposedDate = request.counterProposal?.proposedDates?.[0];

      await sendInstitutionNotification(
        userId,
        institutionPhone,
        "collection_request_counter_proposed",
        {
          contactName,
          bloodBankName,
          proposedDate: formatWhatsAppDate(proposedDate?.date),
          proposedTime: proposedDate?.startTime || "",
          trackingUrl,
        },
        requestId,
        transition
      );
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
      await sendInstitutionNotification(
        userId,
        institutionPhone,
        "collection_request_awaiting_technical_visit",
        { contactName, bloodBankName, trackingUrl },
        requestId,
        transition
      );
      return;
    }

    if (transition === "technical_visit_proposed") {
      const proposedDate = request.visitProposal?.proposedDates?.[0];

      await sendInstitutionNotification(
        userId,
        institutionPhone,
        "collection_request_technical_visit_proposed",
        {
          contactName,
          bloodBankName,
          proposedDate: formatWhatsAppDate(proposedDate?.date),
          proposedTime: proposedDate?.startTime || "",
          trackingUrl,
        },
        requestId,
        transition
      );
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
      await sendInstitutionNotification(
        userId,
        institutionPhone,
        "technical_visit_confirmed",
        {
          contactName,
          bloodBankName,
          result: technicalVisitResult || "Aprovada",
          trackingUrl,
        },
        requestId,
        transition
      );
      return;
    }

    if (transition === "scheduled") {
      const confirmedDateTime = request.confirmedSchedule
        ? `${formatWhatsAppDate(request.confirmedSchedule.date)} ${request.confirmedSchedule.startTime}`.trim()
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

      await sendInstitutionNotification(
        userId,
        institutionPhone,
        "collection_request_scheduled",
        params,
        requestId,
        transition
      );
    }
  } catch (error) {
    console.error(
      `[notification] Failed to prepare collection request notification: transition=${transition}, requestId=${requestId}`,
      error
    );
  }
}
