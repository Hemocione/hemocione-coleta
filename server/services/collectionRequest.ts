import { Types } from "mongoose";
import {
  team,
  collectionRequest,
  availableDate,
  bloodBank,
} from "~/server/models";
const { Team } = team;
const { CollectionRequest } = collectionRequest;
const { AvailableDate } = availableDate;
const { BloodBank } = bloodBank;
import { getInstitutionsByIds } from "./hemocioneId";
import {
  createTechnicalVisit,
  getTechnicalVisitById,
} from "./technicalVisit";
import { notifyCollectionRequestStatusTransition } from "./collectionRequestNotification";

export interface CollectionRequestFilters {
  status?: string;
  institutionId?: string;
  bloodBanksLocationId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type CollectionRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "counter_proposed"
  | "counter_proposal_declined"
  | "awaiting_technical_visit"
  | "technical_visit_confirmed"
  | "scheduled";

export interface CounterProposalDate {
  date: Date;
  startTime: string;
  durationMinutes: number;
  note: string;
}

export interface CounterProposal {
  proposedDates: CounterProposalDate[];
  needsTechnicalVisit: boolean;
  note: string;
  proposedBy: string;
  proposedAt: Date;
  response?: {
    decision: "accepted" | "declined";
    selectedDateId: string;
    respondedAt: Date;
    respondedBy: string;
  };
}

export interface CounterProposeData {
  proposedDates: CounterProposalDate[];
  needsTechnicalVisit: boolean;
  note: string;
  proposedBy: string;
}

export interface RespondToCounterProposalData {
  decision: "accepted" | "declined";
  selectedDateId: string;
  respondedBy: string;
}

export interface ReuseTechnicalVisitData {
  technicalVisitId: string;
  bloodBanksLocationId: string;
  changedByUserId: string;
}

export interface RegisterRetroactiveVisitData {
  visitDate: Date;
  note?: string;
  bloodBanksLocationId: string;
  changedByUserId: string;
}

export interface ScheduleNewVisitData {
  visitDate: Date;
  bloodBanksLocationId: string;
  changedByUserId: string;
}

export interface MarkCollectionRequestScheduledData {
  bloodBanksLocationId: string;
  scheduledByUserId: string;
  eventSlug?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface StructuredAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface CollectionRequestWithDetails {
  _id: string;
  institutionId: string;
  institutionName: string;
  institutionLocation: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  institutionAddress: string;
  institutionLogo?: string;
  institutionBanner?: string;
  requestedByUserId: string;
  bloodBanksLocationId: string;
  availableSlotOptions: Array<{
    availableDateId: string;
    slotId: string;
    date: string;
    startTime?: Date;
    endTime?: Date;
    teamName?: string;
    teamColor?: string;
    isLocked?: boolean;
    isRequested?: boolean; // Indicates if this slot was specifically requested
  }>;
  host: {
    name: string;
    email: string;
    phone: string;
  };
  address?: StructuredAddress;
  accessToken?: string;
  selectedAvailableDateId?: string;
  selectedSlotId?: string;
  note?: string;
  technicalVisitId?: string;
  counterProposal?: CounterProposal;
  previousCounterProposals?: CounterProposal[];
  confirmedSchedule?: {
    date: Date;
    startTime: string;
    durationMinutes: number;
  };
  eventSlug?: string;
  status: CollectionRequestStatus;
  rejectionReason?: string;
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy?: string;
    reason?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

async function getCollectionRequestsByScope(
  scope: {
    bloodBanksLocationId?: string;
    institutionId?: string;
  },
  filters: CollectionRequestFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<CollectionRequestWithDetails>> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const skip = (page - 1) * limit;

  // Build query
  const query: any = {
    ...scope,
    deletedAt: null,
    // Exclude cancelled status
    status: { $ne: "cancelled" },
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.institutionId) {
    query.institutionId = filters.institutionId;
  }

  if (filters.dateFrom || filters.dateTo) {
    // This would need to be implemented with a lookup to availableDates
    // For now, we'll skip date filtering
  }

  // Get total count
  const [total, requests] = await Promise.all([
    CollectionRequest.countDocuments(query),
    CollectionRequest.find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Get unique institution IDs
  const institutionIds = Array.from(
    new Set(requests.map((r) => r.institutionId.toString()))
  );

  const allRequestedDateIds = Array.from(
    new Set(
      requests.flatMap((r) =>
        r.requestedDates.map((rd) => rd.availableDateId.toString())
      )
    )
  );

  // Parallelize institution and availableDates calls
  const [institutions, availableDates] = await Promise.all([
    institutionIds.length > 0
      ? getInstitutionsByIds(institutionIds)
      : Promise.resolve([]),
    AvailableDate.find({
      _id: { $in: allRequestedDateIds },
      deletedAt: null,
    })
      .populate({ path: "slots.teamId", select: "name color", model: Team })
      .lean(),
  ]);
  // Create institution lookup map
  const institutionMap = new Map(institutions.map((inst) => [inst.id, inst]));

  const availableDateMap = new Map(
    availableDates.map((ad) => [ad._id.toString(), ad])
  );

  // Build requests with details and filter by institution status
  const requestsWithDetails = requests
    .map((request) => {
      const institution = institutionMap.get(request.institutionId.toString());

      if (!institution) {
        return null;
      }

      // Build available slot options for this request
      const availableSlotOptions: Array<{
        availableDateId: string;
        slotId: string;
        date: string;
        startTime?: Date;
        endTime?: Date;
        teamName?: string;
        teamColor?: string;
        isLocked?: boolean;
        isRequested?: boolean;
      }> = [];

      // Create a set of requested slot IDs for quick lookup
      const requestedSlotIds = new Set<string>();
      request.requestedDates.forEach((rd) => {
        if (rd.slotIds) {
          rd.slotIds.forEach((slotId) => {
            requestedSlotIds.add(slotId.toString());
          });
        }
      });

      // Process each requested date and extract all available slots
      request.requestedDates.forEach((rd) => {
        const availableDate = availableDateMap.get(
          rd.availableDateId.toString()
        );

        if (availableDate && availableDate.slots) {
          availableDate.slots.forEach((slot) => {
            // If specific slotIds were requested, only include those slots
            // If no specific slotIds were requested, include all slots
            const shouldIncludeSlot =
              !rd.slotIds ||
              rd.slotIds.length === 0 ||
              rd.slotIds.some(
                (requestedSlotId) =>
                  requestedSlotId.toString() === slot._id.toString()
              );

            if (shouldIncludeSlot) {
              availableSlotOptions.push({
                availableDateId: rd.availableDateId.toString(),
                slotId: slot._id.toString(),
                date: availableDate.date,
                startTime: slot.startTime,
                endTime: slot.endTime,
                teamName: (slot.teamId as any)?.name || "Equipe não definida",
                teamColor: (slot.teamId as any)?.color || "#3B82F6",
                isLocked: slot.locked || false,
                isRequested: requestedSlotIds.has(slot._id.toString()),
              });
            }
          });
        }
      });

      return {
        ...request,
        institutionName: institution.name,
        institutionLocation:
          institution.latitude && institution.longitude
            ? {
                type: "Point",
                coordinates: [institution.longitude, institution.latitude],
              }
            : null,
        institutionAddress: institution.address || "",
        institutionLogo: institution.logo,
        institutionBanner: institution.banner,
        institutionStatus: institution.status,
        availableSlotOptions,
      };
    })
    .filter((request): request is NonNullable<typeof request> => {
      return request !== null;
    });

  const pages = Math.ceil(total / limit);

  return {
    data: requestsWithDetails as unknown as CollectionRequestWithDetails[],
    pagination: {
      total,
      page,
      limit,
      pages,
    },
  };
}

export async function getCollectionRequestsByBloodBank(
  bloodBanksLocationId: string,
  filters: CollectionRequestFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<CollectionRequestWithDetails>> {
  return getCollectionRequestsByScope(
    { bloodBanksLocationId },
    filters,
    pagination
  );
}

export async function getCollectionRequestsByInstitution(
  institutionId: string,
  filters: CollectionRequestFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<CollectionRequestWithDetails>> {
  return getCollectionRequestsByScope({ institutionId }, filters, pagination);
}

export async function getCollectionRequests(
  filters: CollectionRequestFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<CollectionRequestWithDetails>> {
  const scope = {
    ...(filters.institutionId && { institutionId: filters.institutionId }),
    ...(filters.bloodBanksLocationId && {
      bloodBanksLocationId: filters.bloodBanksLocationId,
    }),
  };

  return getCollectionRequestsByScope(scope, filters, pagination);
}

export async function getCollectionRequestById(
  requestId: string,
  bloodBanksLocationId?: string
): Promise<CollectionRequestWithDetails | null> {
  const query: any = {
    _id: requestId,
    deletedAt: null,
  };

  if (bloodBanksLocationId) {
    query.bloodBanksLocationId = bloodBanksLocationId;
  }

  const request = await CollectionRequest.findOne(query).lean();

  if (!request) {
    return null;
  }

  const [institutions, availableDates] = await Promise.all([
    getInstitutionsByIds([request.institutionId.toString()]),
    (() => {
      const requestedDateIds = request.requestedDates.map(
        (rd) => rd.availableDateId
      );
      return AvailableDate.find({
        _id: { $in: requestedDateIds },
        deletedAt: null,
      })
        .populate({ path: "slots.teamId", select: "name color", model: Team })
        .lean();
    })(),
  ]);

  const institution = institutions[0];

  const availableDateMap = new Map(
    availableDates.map((ad) => [ad._id.toString(), ad])
  );

  // Build available slot options from all requested dates
  const availableSlotOptions: Array<{
    availableDateId: string;
    slotId: string;
    date: string;
    startTime?: Date;
    endTime?: Date;
    teamName?: string;
    teamColor?: string;
    isLocked?: boolean;
    isRequested?: boolean;
  }> = [];

  // Process each requested date and extract all available slots
  request.requestedDates.forEach((rd) => {
    const availableDate = availableDateMap.get(rd.availableDateId.toString());
    const requestedSlotIds = new Set<string>();

    if (availableDate && availableDate.slots) {
      availableDate.slots.forEach((slot) => {
        // If specific slotIds were requested, only include those slots
        // If no specific slotIds were requested, include all slots
        const shouldIncludeSlot =
          !rd.slotIds ||
          rd.slotIds.length === 0 ||
          rd.slotIds.some(
            (requestedSlotId) =>
              requestedSlotId.toString() === slot._id.toString()
          );

        if (shouldIncludeSlot) {
          availableSlotOptions.push({
            availableDateId: rd.availableDateId.toString(),
            slotId: slot._id.toString(),
            date: availableDate.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            teamName:
              (slot.teamId as { name?: string })?.name || "Equipe não definida",
            teamColor: (slot.teamId as { color?: string })?.color || "#3B82F6",
            isLocked: slot.locked || false,
            isRequested: requestedSlotIds.has(slot._id.toString()),
          });
        }
      });
    }
  });

  const requestWithDetails = {
    ...request,
    institutionName: institution?.name || "Instituição não encontrada",
    institutionLocation:
      institution?.latitude && institution?.longitude
        ? {
            type: "Point",
            coordinates: [institution.longitude, institution.latitude],
          }
        : null,
    institutionAddress: institution?.address || "",
    institutionLogo: institution?.logo,
    institutionBanner: institution?.banner,
    availableSlotOptions,
  };

  return requestWithDetails as unknown as CollectionRequestWithDetails;
}

export async function acceptCollectionRequest(
  requestId: string,
  selectedAvailableDateId: string,
  selectedSlotId: string,
  acceptedByUserId: string,
  bloodBanksLocationId: string,
  needsTechnicalVisit = false
): Promise<CollectionRequestWithDetails | null> {
  try {
    // For development, we'll skip transactions and use a simpler approach
    // TODO: Implement proper transaction handling for production
    // 1. Validate request exists and is pending
    const request = await CollectionRequest.findOne({
      _id: requestId,
      status: "pending",
      deletedAt: null,
      bloodBanksLocationId,
    });

    if (!request) {
      throw new Error("Request not found or not in pending status");
    }

    // 2. Validate selected date/slot is in requestedDates
    const isRequestedDate = request.requestedDates.some(
      (rd) => rd.availableDateId.toString() === selectedAvailableDateId
    );

    if (!isRequestedDate) {
      throw new Error("Selected date/slot is not in requested dates");
    }

    // 3. Check if slot is available (not locked)
    const availableDate = await AvailableDate.findOne({
      _id: selectedAvailableDateId,
      "slots._id": selectedSlotId,
      deletedAt: null,
    });

    if (!availableDate) {
      throw new Error("Available date or slot not found");
    }

    const slot = availableDate.slots.id(selectedSlotId);
    if (!slot || slot.locked || slot.lockedBy) {
      throw new Error("Slot is already locked");
    }

    // 4. Lock the slot
    await AvailableDate.findOneAndUpdate(
      {
        _id: selectedAvailableDateId,
        "slots._id": selectedSlotId,
      },
      {
        $set: {
          "slots.$.locked": true,
          "slots.$.lockedBy": requestId,
        },
      }
    );

    // 5. Update request status
    const nextStatus: CollectionRequestStatus = needsTechnicalVisit
      ? "awaiting_technical_visit"
      : "accepted";
    const statusHistoryEntry = {
      status: nextStatus,
      changedAt: new Date(),
      changedBy: acceptedByUserId,
      reason: needsTechnicalVisit
        ? "Request accepted by blood bank; technical visit required"
        : "Request accepted by blood bank",
    };

    await CollectionRequest.findOneAndUpdate(
      {
        _id: requestId,
        bloodBanksLocationId,
        status: "pending",
        deletedAt: null,
      },
      {
        $set: {
          status: nextStatus,
          selectedAvailableDateId: new Types.ObjectId(selectedAvailableDateId),
          selectedSlotId: new Types.ObjectId(selectedSlotId),
        },
        $push: { statusHistory: statusHistoryEntry },
      }
    );

    if (nextStatus === "awaiting_technical_visit") {
      void notifyCollectionRequestStatusTransition({
        requestId,
        bloodBanksLocationId,
        transition: "awaiting_technical_visit",
      });
    }

    return await getCollectionRequestById(requestId, bloodBanksLocationId);
  } catch (error: any) {
    console.error("Error accepting collection request:", error);
    throw error;
  }
}

function getTechnicalVisitAddress(request: {
  address?: StructuredAddress;
}): string {
  if (!request.address) {
    return "Endereço não informado";
  }

  const address = request.address;
  const formattedAddress = [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city} - ${address.state}`,
    address.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  return formattedAddress.slice(0, 500) || "Endereço não informado";
}

async function getAwaitingTechnicalVisitRequest(
  requestId: string,
  bloodBanksLocationId: string
) {
  const request = await CollectionRequest.findOne({
    _id: requestId,
    bloodBanksLocationId,
    status: "awaiting_technical_visit",
    deletedAt: null,
  });

  if (!request) {
    throw new Error(
      "Collection request not found or not awaiting technical visit"
    );
  }

  return request;
}

async function linkTechnicalVisitToRequest(
  requestId: string,
  bloodBanksLocationId: string,
  technicalVisitId: string | Types.ObjectId,
  status: "awaiting_technical_visit" | "technical_visit_confirmed",
  changedByUserId: string,
  reason: string
) {
  const updatedRequest = await CollectionRequest.findOneAndUpdate(
    {
      _id: requestId,
      bloodBanksLocationId,
      status: "awaiting_technical_visit",
      deletedAt: null,
    },
    {
      $set: {
        technicalVisitId,
        status,
      },
      $push: {
        statusHistory: {
          status,
          changedAt: new Date(),
          changedBy: changedByUserId,
          reason,
        },
      },
    },
    { new: true }
  );

  if (!updatedRequest) {
    throw new Error("Collection request was already resolved");
  }

  void notifyCollectionRequestStatusTransition({
    requestId,
    bloodBanksLocationId,
    transition:
      status === "technical_visit_confirmed"
        ? "technical_visit_confirmed"
        : "awaiting_technical_visit",
  });

  return updatedRequest;
}

export async function reuseTechnicalVisit(
  requestId: string,
  data: ReuseTechnicalVisitData
) {
  await getAwaitingTechnicalVisitRequest(
    requestId,
    data.bloodBanksLocationId
  );

  const visit = await getTechnicalVisitById(
    data.bloodBanksLocationId,
    data.technicalVisitId
  );

  if (!visit) {
    throw new Error("Technical visit not found for this blood bank");
  }

  if (visit.outcome !== "approved") {
    throw new Error("Technical visit must be approved");
  }

  return linkTechnicalVisitToRequest(
    requestId,
    data.bloodBanksLocationId,
    data.technicalVisitId,
    "technical_visit_confirmed",
    data.changedByUserId,
    "Approved technical visit reused for collection request"
  );
}

export async function registerRetroactiveVisit(
  requestId: string,
  data: RegisterRetroactiveVisitData
) {
  const request = await getAwaitingTechnicalVisitRequest(
    requestId,
    data.bloodBanksLocationId
  );

  const visit = await createTechnicalVisit({
    bloodBanksLocationId: data.bloodBanksLocationId,
    institutionId: request.institutionId.toString(),
    address: getTechnicalVisitAddress(request),
    visitDate: data.visitDate,
    outcome: "approved",
    notes: data.note,
    visitedBy: data.changedByUserId,
    registeredRetroactively: true,
  });

  return linkTechnicalVisitToRequest(
    requestId,
    data.bloodBanksLocationId,
    visit._id,
    "technical_visit_confirmed",
    data.changedByUserId,
    "Technical visit registered retroactively and approved"
  );
}

export async function scheduleNewTechnicalVisit(
  requestId: string,
  data: ScheduleNewVisitData
) {
  const request = await getAwaitingTechnicalVisitRequest(
    requestId,
    data.bloodBanksLocationId
  );

  const visit = await createTechnicalVisit({
    bloodBanksLocationId: data.bloodBanksLocationId,
    institutionId: request.institutionId.toString(),
    address: getTechnicalVisitAddress(request),
    visitDate: data.visitDate,
    outcome: "pending",
    visitedBy: data.changedByUserId,
  });

  return linkTechnicalVisitToRequest(
    requestId,
    data.bloodBanksLocationId,
    visit._id,
    "awaiting_technical_visit",
    data.changedByUserId,
    "Technical visit scheduled"
  );
}

export async function markCollectionRequestScheduled(
  requestId: string,
  data: MarkCollectionRequestScheduledData
) {
  const changedAt = new Date();
  const updatedRequest = await CollectionRequest.findOneAndUpdate(
    {
      _id: requestId,
      bloodBanksLocationId: data.bloodBanksLocationId,
      status: { $in: ["accepted", "technical_visit_confirmed"] },
      deletedAt: null,
    },
    {
      $set: {
        status: "scheduled",
        ...(data.eventSlug !== undefined && { eventSlug: data.eventSlug }),
      },
      $push: {
        statusHistory: {
          status: "scheduled",
          changedAt,
          changedBy: data.scheduledByUserId,
          reason: "Collection request scheduled",
        },
      },
    },
    { new: true }
  );

  if (!updatedRequest) {
    throw new Error(
      "Collection request not found or not ready to be scheduled"
    );
  }

  void notifyCollectionRequestStatusTransition({
    requestId,
    bloodBanksLocationId: data.bloodBanksLocationId,
    transition: "scheduled",
  });

  return updatedRequest;
}

export async function counterPropose(
  requestId: string,
  data: CounterProposeData
) {
  const counterProposal: CounterProposal = {
    ...data,
    proposedAt: new Date(),
  };
  const statusHistoryEntry = {
    status: "counter_proposed",
    changedAt: new Date(),
    changedBy: data.proposedBy,
    reason: "Counter proposal sent by blood bank",
  };

  const updatedRequest = await CollectionRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: "pending",
      deletedAt: null,
      counterProposal: { $exists: false },
    },
    {
      $set: {
        counterProposal,
        status: "counter_proposed",
      },
      $push: { statusHistory: statusHistoryEntry },
    },
    { new: true }
  );

  if (!updatedRequest) {
    throw new Error(
      "Request not found, not in pending status, or already has a counter proposal"
    );
  }

  const notificationBloodBanksLocationId = updatedRequest.bloodBanksLocationId
    ?.toString();
  if (notificationBloodBanksLocationId) {
    void notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId: notificationBloodBanksLocationId,
      transition: "counter_proposed",
    });
  }

  return updatedRequest;
}

export async function respondToCounterProposal(
  requestId: string,
  data: RespondToCounterProposalData
) {
  const request = await CollectionRequest.findOne({
    _id: requestId,
    status: "counter_proposed",
    deletedAt: null,
    counterProposal: { $exists: true },
  });

  if (!request?.counterProposal) {
    throw new Error("Request not found or not in counter proposed status");
  }

  const currentCounterProposal = request.counterProposal as unknown as CounterProposal;
  let nextStatus: CollectionRequestStatus;
  let confirmedSchedule:
    | {
        date: Date;
        startTime: string;
        durationMinutes: number;
      }
    | undefined;

  if (data.decision === "accepted") {
    const selectedDateIndex = Number(data.selectedDateId);
    const selectedDate =
      Number.isInteger(selectedDateIndex) && selectedDateIndex >= 0
        ? currentCounterProposal.proposedDates[selectedDateIndex]
        : undefined;

    if (!selectedDate) {
      throw new Error("Selected date is not in the counter proposal");
    }

    confirmedSchedule = {
      date: selectedDate.date,
      startTime: selectedDate.startTime,
      durationMinutes: selectedDate.durationMinutes,
    };
    nextStatus = currentCounterProposal.needsTechnicalVisit
      ? "awaiting_technical_visit"
      : "accepted";
  } else if (data.decision === "declined") {
    nextStatus = "counter_proposal_declined";
  } else {
    throw new Error("Invalid counter proposal decision");
  }

  const respondedAt = new Date();
  const resolvedCounterProposal: CounterProposal = {
    ...currentCounterProposal,
    response: {
      decision: data.decision,
      selectedDateId: data.selectedDateId,
      respondedAt,
      respondedBy: data.respondedBy,
    },
  };
  const statusHistoryEntry = {
    status: nextStatus,
    changedAt: respondedAt,
    changedBy: data.respondedBy,
    reason:
      data.decision === "accepted"
        ? "Counter proposal accepted by institution"
        : "Counter proposal declined by institution",
  };

  const update = {
    $set: {
      status: nextStatus,
      ...(confirmedSchedule && { confirmedSchedule }),
    },
    $push: {
      previousCounterProposals: resolvedCounterProposal,
      statusHistory: statusHistoryEntry,
    },
    $unset: { counterProposal: 1 },
  };

  const updatedRequest = await CollectionRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: "counter_proposed",
      deletedAt: null,
      counterProposal: { $exists: true },
    },
    update,
    { new: true }
  );

  if (!updatedRequest) {
    throw new Error("Request was already responded to");
  }

  const notificationBloodBanksLocationId = request.bloodBanksLocationId
    ?.toString();
  if (
    notificationBloodBanksLocationId &&
    nextStatus === "awaiting_technical_visit"
  ) {
    void notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId: notificationBloodBanksLocationId,
      transition: "awaiting_technical_visit",
    });
  } else if (
    notificationBloodBanksLocationId &&
    nextStatus === "counter_proposal_declined"
  ) {
    void notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId: notificationBloodBanksLocationId,
      transition: "counter_proposal_declined",
      recipientUserId: currentCounterProposal.proposedBy.toString(),
    });
  }

  return updatedRequest;
}

export async function rejectCollectionRequest(
  requestId: string,
  rejectionReason: string,
  rejectedByUserId: string,
  bloodBanksLocationId: string
): Promise<CollectionRequestWithDetails | null> {
  const statusHistoryEntry = {
    status: "rejected",
    changedAt: new Date(),
    changedBy: rejectedByUserId,
    reason: rejectionReason,
  };

  await CollectionRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: "pending",
      deletedAt: null,
      bloodBanksLocationId,
    },
    {
      $set: {
        status: "rejected",
        rejectionReason,
      },
      $push: { statusHistory: statusHistoryEntry },
    }
  ).lean();

  return await getCollectionRequestById(requestId, bloodBanksLocationId);
}

export async function cancelCollectionRequest(
  requestId: string,
  cancellationReason: string,
  cancelledByUserId: string,
  bloodBanksLocationId: string
): Promise<CollectionRequestWithDetails | null> {
  const session = await CollectionRequest.startSession();

  try {
    await session.withTransaction(async () => {
      const request = await CollectionRequest.findOne({
        _id: requestId,
        status: { $in: ["pending", "accepted"] },
        deletedAt: null,
        bloodBanksLocationId,
      }).session(session);

      if (!request) {
        throw new Error("Request not found or cannot be cancelled");
      }

      // If accepted, unlock the slot
      if (
        request.status === "accepted" &&
        request.selectedAvailableDateId &&
        request.selectedSlotId
      ) {
        await AvailableDate.findOneAndUpdate(
          {
            _id: request.selectedAvailableDateId,
            "slots._id": request.selectedSlotId,
          },
          {
            $set: {
              "slots.$.locked": false,
              "slots.$.lockedBy": null,
            },
          },
          { session }
        );
      }

      // Update request status
      const statusHistoryEntry = {
        status: "cancelled",
        changedAt: new Date(),
        changedBy: cancelledByUserId,
        reason: cancellationReason,
      };

      await CollectionRequest.findOneAndUpdate(
        { _id: requestId, bloodBanksLocationId },
        {
          $set: { status: "cancelled" },
          $push: { statusHistory: statusHistoryEntry },
        },
        { session }
      );
    });

    return await getCollectionRequestById(requestId, bloodBanksLocationId);
  } finally {
    await session.endSession();
  }
}

export async function validateInstitutionDateUniqueness(
  institutionId: string,
  requestedDates: Array<{ availableDateId: string; slotIds?: string[] }>
): Promise<string[] | null> {
  // Get all active requests for this institution (not rejected/cancelled)
  const activeRequests = await CollectionRequest.find({
    institutionId,
    status: { $nin: ["rejected", "cancelled"] },
    deletedAt: null,
  }).lean();

  // Extract dates from requested dates
  const requestedDateIds = requestedDates.map((rd) => rd.availableDateId);

  // Get available dates to check actual dates
  const availableDates = await AvailableDate.find({
    _id: { $in: requestedDateIds },
    deletedAt: null,
  }).lean();

  const requestedActualDates = availableDates.map((ad) => ad.date);

  // Check for conflicts
  const conflictingDates: string[] = [];

  for (const activeRequest of activeRequests) {
    const activeRequestDateIds = activeRequest.requestedDates.map((rd) =>
      rd.availableDateId.toString()
    );

    // Get the actual dates for active request
    const activeAvailableDates = await AvailableDate.find({
      _id: { $in: activeRequestDateIds },
      deletedAt: null,
    }).lean();

    const activeActualDates = activeAvailableDates.map((ad) => ad.date);

    // Check for date conflicts
    for (const requestedDate of requestedActualDates) {
      if (activeActualDates.includes(requestedDate)) {
        conflictingDates.push(requestedDate);
      }
    }
  }

  return conflictingDates.length > 0 ? conflictingDates : null;
}

export async function validateSlotsAvailability(
  requestedDates: Array<{ availableDateId: string; slotIds?: string[] }>
): Promise<{ availableDateId: string; slotId: string }[] | null> {
  const unavailableSlots: { availableDateId: string; slotId: string }[] = [];

  for (const requestedDate of requestedDates) {
    const availableDate = await AvailableDate.findOne({
      _id: requestedDate.availableDateId,
      deletedAt: null,
    }).lean();

    if (!availableDate) {
      // If available date not found, mark as unavailable
      unavailableSlots.push({
        availableDateId: requestedDate.availableDateId,
        slotId: "any",
      });
      continue;
    }

    // If no specific slots requested, check if any slots are available
    if (!requestedDate.slotIds || requestedDate.slotIds.length === 0) {
      const hasAvailableSlots = availableDate.slots.some(
        (slot) => !slot.locked && !slot.lockedBy
      );
      if (!hasAvailableSlots) {
        unavailableSlots.push({
          availableDateId: requestedDate.availableDateId,
          slotId: "any",
        });
      }
    } else {
      // Check specific slots
      for (const slotId of requestedDate.slotIds) {
        const slot = availableDate.slots.find(
          (s) => s._id.toString() === slotId
        );
        if (!slot || slot.locked || slot.lockedBy) {
          unavailableSlots.push({
            availableDateId: requestedDate.availableDateId,
            slotId,
          });
        }
      }
    }
  }

  return unavailableSlots.length > 0 ? unavailableSlots : null;
}

// Get the userId of the person who last accepted a collection request for this blood bank
export async function getBloodBankLastAcceptorUserId(
  bloodBanksLocationId: string
): Promise<string | null> {
  const lastAccepted = await CollectionRequest.findOne({
    bloodBanksLocationId,
    status: "accepted",
    deletedAt: null,
    "statusHistory.status": "accepted",
  })
    .sort({ "statusHistory.changedAt": -1, _id: -1 })
    .select("statusHistory")
    .lean();

  if (!lastAccepted) return null;

  const acceptEntry = [...(lastAccepted.statusHistory || [])]
    .reverse()
    .find((h) => h.status === "accepted" && h.changedBy);

  return acceptEntry?.changedBy?.toString() || null;
}

// Get collection requests by IDs
export async function getCollectionRequestsByIds(ids: string[]) {
  const collectionRequests = await CollectionRequest.find({
    _id: { $in: ids },
    deletedAt: null,
  }).lean();

  return collectionRequests;
}

// Collection Request Creation for Backoffice
export interface CreateCollectionRequestData {
  institutionId: string;
  requestedByUserId: string;
  requestedDates: Array<{
    availableDateId: string;
    slotIds?: string[];
    startTime?: string;
  }>;
  host: {
    name: string;
    email: string;
    phone: string;
  };
  address?: StructuredAddress;
  note?: string;
}

export async function createCollectionRequest(
  bloodBanksLocationId: string,
  data: CreateCollectionRequestData
): Promise<CollectionRequestWithDetails> {
  // Validate that the blood bank exists and is active
  const bloodBank = await BloodBank.findOne({
    bloodBanksLocationId,
    active: true,
  });

  if (!bloodBank) {
    throw new Error(
      "Banco de sangue não encontrado ou indisponível para agendamento"
    );
  }

  // Check if institution already has an open request for this blood bank
  const existingOpenRequest = await CollectionRequest.findOne({
    institutionId: data.institutionId,
    bloodBanksLocationId,
    status: {
      $in: [
        "pending",
        "counter_proposed",
        "awaiting_technical_visit",
        "technical_visit_confirmed",
        "accepted",
      ],
    },
    deletedAt: null,
  });

  if (existingOpenRequest) {
    throw new Error(
      "Esta instituição já possui uma solicitação em aberto para este banco de sangue"
    );
  }

  // Validate requested dates exist and belong to this blood bank
  const availableDateIds = data.requestedDates.map((rd) => rd.availableDateId);
  const availableDates = await AvailableDate.find({
    _id: { $in: availableDateIds },
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (availableDates.length !== availableDateIds.length) {
    throw new Error(
      "One or more requested dates are invalid or don't belong to this blood bank"
    );
  }

  // Create the collection request
  const collectionRequest = new CollectionRequest({
    institutionId: data.institutionId,
    requestedByUserId: data.requestedByUserId,
    bloodBanksLocationId,
    requestedDates: data.requestedDates.map((rd) => ({
      availableDateId: new Types.ObjectId(rd.availableDateId),
      slotIds: rd.slotIds?.map((id) => new Types.ObjectId(id)),
      startTime: rd.startTime,
    })),
    note: data.note,
    host: data.host,
    address: data.address,
    status: "pending",
    statusHistory: [
      {
        status: "pending",
        changedAt: new Date(),
        changedBy: data.requestedByUserId,
        reason: "Request created",
      },
    ],
  });

  const savedRequest = await collectionRequest.save();

  // Return the request with details
  if (!savedRequest._id) {
    throw new Error("Failed to save collection request");
  }

  const requestWithDetails = await getCollectionRequestById(
    savedRequest._id.toString(),
    bloodBanksLocationId
  );

  if (!requestWithDetails) {
    throw new Error("Failed to retrieve created request");
  }

  return requestWithDetails;
}

export interface CollectionRequestPublicDetails {
  _id: string;
  status: CollectionRequestStatus;
  bloodBankName: string;
  bloodBankLogo?: string | null;
  institutionName: string;
  host: {
    name: string;
    email: string;
    phone: string;
  };
  address?: StructuredAddress;
  requestedDates: Array<{
    date: string;
    startTime?: Date;
    endTime?: Date;
    teamName?: string;
  }>;
  selectedDate?: {
    date: string;
    startTime?: Date;
    endTime?: Date;
    teamName?: string;
  };
  rejectionReason?: string;
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    reason?: string;
  }>;
  accessToken?: string;
  createdAt: Date;
}

export async function getCollectionRequestPublicByToken(
  accessToken: string
): Promise<CollectionRequestPublicDetails | null> {
  const request = await CollectionRequest.findOne({
    accessToken,
    deletedAt: null,
  }).lean();

  if (!request) {
    return null;
  }

  return buildCollectionRequestPublicDetails(request);
}

async function buildCollectionRequestPublicDetails(
  request: any
): Promise<CollectionRequestPublicDetails> {
  const [institutions, bloodBankDoc, availableDates] = await Promise.all([
    getInstitutionsByIds([request.institutionId.toString()]),
    BloodBank.findOne({ bloodBanksLocationId: request.bloodBanksLocationId }).lean(),
    AvailableDate.find({
      _id: { $in: request.requestedDates.map((rd: any) => rd.availableDateId) },
      deletedAt: null,
    })
      .populate({ path: "slots.teamId", select: "name", model: Team })
      .lean(),
  ]);

  const institution = institutions[0];
  const availableDateMap = new Map(
    availableDates.map((ad) => [ad._id.toString(), ad])
  );

  const requestedDatesInfo: CollectionRequestPublicDetails["requestedDates"] = [];
  request.requestedDates.forEach((rd: any) => {
    const ad = availableDateMap.get(rd.availableDateId.toString());
    if (!ad) return;
    if (rd.slotIds && rd.slotIds.length > 0) {
      rd.slotIds.forEach((slotId: any) => {
        const slot = ad.slots.find((s) => s._id.toString() === slotId.toString());
        if (slot) {
          requestedDatesInfo.push({
            date: ad.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            teamName: (slot.teamId as any)?.name,
          });
        }
      });
    } else {
      requestedDatesInfo.push({ date: ad.date });
    }
  });

  let selectedDate: CollectionRequestPublicDetails["selectedDate"];
  if (request.selectedAvailableDateId && request.selectedSlotId) {
    const ad = availableDateMap.get(request.selectedAvailableDateId.toString());
    if (ad) {
      const slot = ad.slots.find(
        (s) => s._id.toString() === request.selectedSlotId!.toString()
      );
      if (slot) {
        selectedDate = {
          date: ad.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          teamName: (slot.teamId as any)?.name,
        };
      }
    }
  }

  return {
    _id: request._id!.toString(),
    status: request.status as CollectionRequestPublicDetails["status"],
    bloodBankName: bloodBankDoc?.name || "Banco de Sangue",
    bloodBankLogo: bloodBankDoc?.logo,
    institutionName: institution?.name || "Instituição",
    host: request.host as CollectionRequestPublicDetails["host"],
    address: request.address as StructuredAddress | undefined,
    requestedDates: requestedDatesInfo,
    selectedDate,
    rejectionReason: request.rejectionReason || undefined,
    statusHistory: (request.statusHistory || []).map((h: any) => ({
      status: h.status as string,
      changedAt: h.changedAt as Date,
      reason: h.reason || undefined,
    })),
    createdAt: request.createdAt as Date,
  };
}

export async function getCollectionRequestPublic(
  requestId: string
): Promise<CollectionRequestPublicDetails | null> {
  const request = await CollectionRequest.findOne({
    _id: requestId,
    deletedAt: null,
  }).lean();

  if (!request) {
    return null;
  }

  return buildCollectionRequestPublicDetails(request);
}

export async function getCollectionRequestIdByToken(
  accessToken: string
): Promise<{ requestId: string; requestedByUserId: string } | null> {
  const request = await CollectionRequest.findOne({
    accessToken,
    deletedAt: null,
  })
    .select("_id requestedByUserId")
    .lean();

  if (!request) return null;

  return {
    requestId: request._id!.toString(),
    requestedByUserId: request.requestedByUserId.toString(),
  };
}

export async function withdrawCollectionRequest(
  requestId: string,
  withdrawnByUserId: string,
  reason?: string
): Promise<CollectionRequestPublicDetails | null> {
  const request = await CollectionRequest.findOne({
    _id: requestId,
    status: "pending",
    deletedAt: null,
  });

  if (!request) {
    throw new Error("Request not found or not in pending status");
  }

  const statusHistoryEntry = {
    status: "cancelled",
    changedAt: new Date(),
    changedBy: withdrawnByUserId,
    reason: reason || "Retirado pela instituição",
  };

  await CollectionRequest.findOneAndUpdate(
    { _id: requestId, status: "pending", deletedAt: null },
    {
      $set: { status: "cancelled" },
      $push: { statusHistory: statusHistoryEntry },
    }
  );

  return await getCollectionRequestPublic(requestId);
}
