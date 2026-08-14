import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import {
  getCollectionRequestById,
  markCollectionRequestScheduled,
} from "~/server/services/collectionRequest";

const GENERATABLE_STATUSES = new Set([
  "accepted",
  "technical_visit_confirmed",
]);

function getDateWithTime(dateValue: Date | string, time: string) {
  const date = new Date(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

  if (
    Number.isNaN(date.getTime()) ||
    !timeMatch ||
    Number(timeMatch[1]) > 23 ||
    Number(timeMatch[2]) > 59
  ) {
    return null;
  }

  const result = new Date(date);
  result.setUTCHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  return result;
}

function getEventSchedule(request: {
  confirmedSchedule?: {
    date: Date;
    startTime: string;
    durationMinutes: number;
  };
  selectedSlotId?: string;
  availableSlotOptions: Array<{
    slotId: string;
    date: string;
    startTime?: Date;
    endTime?: Date;
  }>;
}) {
  if (request.confirmedSchedule) {
    const startAt = getDateWithTime(
      request.confirmedSchedule.date,
      request.confirmedSchedule.startTime
    );

    if (
      !startAt ||
      !Number.isFinite(request.confirmedSchedule.durationMinutes) ||
      request.confirmedSchedule.durationMinutes <= 0
    ) {
      return null;
    }

    return {
      startAt,
      endAt: new Date(
        startAt.getTime() + request.confirmedSchedule.durationMinutes * 60_000
      ),
    };
  }

  // Regular slot acceptance predates confirmedSchedule. Keep that flow
  // compatible by deriving the interval from the selected slot when needed.
  const selectedSlot = request.availableSlotOptions.find(
    (slot) => String(slot.slotId) === String(request.selectedSlotId)
  );
  if (!selectedSlot?.startTime || !selectedSlot.endTime) {
    return null;
  }

  const date = new Date(`${selectedSlot.date}T00:00:00.000Z`);
  const startTime = new Date(selectedSlot.startTime);
  const endTime = new Date(selectedSlot.endTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const startAt = new Date(date);
  startAt.setUTCHours(
    startTime.getUTCHours(),
    startTime.getUTCMinutes(),
    0,
    0
  );
  const endAt = new Date(date);
  endAt.setUTCHours(endTime.getUTCHours(), endTime.getUTCMinutes(), 0, 0);
  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    endAt <= startAt
  ) {
    return null;
  }

  return { startAt, endAt };
}

function formatAddress(address?: {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}) {
  if (!address) {
    return undefined;
  }

  return {
    address: [
      `${address.street}, ${address.number}`,
      address.complement,
      address.neighborhood,
      address.zipCode,
    ]
      .filter(Boolean)
      .join(", "),
    city: address.city,
    state: address.state,
  };
}

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");
  const requestId = getRouterParam(event, "requestId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Blood bank location ID is required",
    });
  }

  if (!requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request ID is required",
    });
  }

  const user = event.context.auth.user;
  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  const request = await getCollectionRequestById(
    requestId,
    bloodBanksLocationId
  );

  if (!request) {
    throw createError({
      statusCode: 404,
      statusMessage: "Collection request not found",
    });
  }

  if (!GENERATABLE_STATUSES.has(request.status)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Collection request must be accepted or have a confirmed technical visit",
    });
  }

  const schedule = getEventSchedule(request);
  if (!schedule) {
    throw createError({
      statusCode: 400,
      statusMessage: "Collection request has no valid confirmed schedule",
    });
  }

  const [bloodBank] = await Promise.all([
    getBloodBankByBloodBanksLocationId(bloodBanksLocationId),
  ]);
  const name = `Coleta — ${bloodBank?.name || request.institutionName || "Hemocione"}`;
  const config = useRuntimeConfig();
  const eventUrl = `${config.hemocioneDigitalEventUrl}`.replace(/\/$/, "");
  const location = formatAddress(request.address);

  // The MVP intentionally omits schedule: digital-event returns the slug
  // synchronously and can generate registration slots asynchronously later.
  const createdEvent = await $fetch<{ slug?: string }>(
    `${eventUrl}/api/backoffice/v1/event`,
    {
      method: "POST",
      headers: {
        "x-coleta-integration-secret": config.coletaIntegrationSecret,
      },
      body: {
        sourceCollectionRequestId: requestId,
        name,
        startAt: schedule.startAt.toISOString(),
        endAt: schedule.endAt.toISOString(),
        ...(location && { location }),
        bloodBanksLocationId: request.bloodBanksLocationId,
        institutionId: request.institutionId,
      },
    }
  );

  if (!createdEvent?.slug) {
    throw createError({
      statusCode: 502,
      statusMessage: "Digital event service did not return an event slug",
    });
  }

  const updatedRequest = await markCollectionRequestScheduled(requestId, {
    bloodBanksLocationId,
    eventSlug: createdEvent.slug,
    scheduledByUserId: user.id,
  });

  return {
    success: true,
    data: updatedRequest,
    eventSlug: createdEvent.slug,
    message: "Event registration link generated successfully",
  };
});
