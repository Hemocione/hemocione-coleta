import { CollectionRequest } from "~/server/models/collectionRequest";
import { AvailableDate } from "~/server/models/availableDate";
import { BloodBank } from "~/server/models/bloodBank";
import { Team } from "~/server/models/team";
import { Types } from "mongoose";
import { getInstitutionsByIds, Institution } from "./hemocioneId";

export interface CollectionRequestFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
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

export interface CollectionRequestWithDetails {
  _id: string;
  institutionId: string;
  institutionName: string;
  institutionLocation: {
    type: "Point";
    coordinates: [number, number];
  };
  institutionAddress: string;
  institutionLogo?: string;
  institutionBanner?: string;
  requestedByUserId: string;
  bloodBanksLocationId: string;
  requestedDates: Array<{
    availableDateId: string;
    slotIds?: string[]; // Now optional array of slot IDs
    date: string;
    startTime?: Date;
    endTime?: Date;
    teamName?: string;
    teamColor?: string;
    isLocked?: boolean;
  }>;
  selectedAvailableDateId?: string;
  selectedSlotId?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
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

export async function getCollectionRequestsByBloodBank(
  bloodBanksLocationId: string,
  filters: CollectionRequestFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<CollectionRequestWithDetails>> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const skip = (page - 1) * limit;

  // Build query
  const query: any = {
    bloodBanksLocationId,
    deletedAt: null,
    // Exclude cancelled status
    status: { $ne: "cancelled" },
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.dateFrom || filters.dateTo) {
    // This would need to be implemented with a lookup to availableDates
    // For now, we'll skip date filtering
  }

  console.log("=== DEBUG getCollectionRequestsByBloodBank ===");
  console.log("bloodBanksLocationId:", bloodBanksLocationId);
  console.log("typeof bloodBanksLocationId:", typeof bloodBanksLocationId);
  console.log("query:", JSON.stringify(query, null, 2));

  // Get total count
  const [total, requests] = await Promise.all([
    CollectionRequest.countDocuments(query),
    CollectionRequest.find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);
  console.log("total:", total);

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
    }),
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
        requestedDates: request.requestedDates.map((rd) => {
          const availableDate = availableDateMap.get(
            rd.availableDateId.toString()
          );

          return {
            availableDateId: rd.availableDateId.toString(),
            slotIds: rd.slotIds?.map((id) => id.toString()),
            date: availableDate?.date || "",
            // If specific slots are requested, show details for those slots
            // Otherwise, show general date info
            startTime: availableDate?.slots?.[0]?.startTime,
            endTime:
              availableDate?.slots?.[availableDate.slots.length - 1]?.endTime,
            isLocked:
              availableDate?.slots?.some((slot) => slot.locked) || false,
          };
        }),
      };
    })
    .filter((request): request is NonNullable<typeof request> => {
      return request !== null;
    });

  const pages = Math.ceil(requestsWithDetails.length / limit);

  return {
    data: requestsWithDetails as unknown as CollectionRequestWithDetails[],
    pagination: {
      total: requestsWithDetails.length,
      page,
      limit,
      pages,
    },
  };
}

export async function getCollectionRequestById(
  requestId: string,
  bloodBanksLocationId?: string,
  event?: any
): Promise<CollectionRequestWithDetails | null> {
  const query: any = {
    _id: new Types.ObjectId(requestId),
    deletedAt: null,
  };

  if (bloodBanksLocationId) {
    query.bloodBanksLocationId = bloodBanksLocationId;
  }

  const request = await CollectionRequest.findOne(query).lean();

  if (!request) {
    return null;
  }

  // Get institution data
  const authHeader = event ? getHeader(event, "authorization") : "";
  let institutions: Institution[] = [];

  try {
    institutions = await getInstitutionsByIds([
      request.institutionId.toString(),
    ]);
  } catch (error) {
    console.warn(
      "Failed to fetch institution data from hemocioneId API:",
      error.message
    );
    // Continue without institution data - will show fallback values
  }

  const institution = institutions[0];

  // Get available dates for requested dates
  const requestedDateIds = request.requestedDates.map(
    (rd) => rd.availableDateId
  );

  const availableDates = await AvailableDate.find({
    _id: { $in: requestedDateIds },
    deletedAt: null,
  })
    .populate("slots.teamId", "name color")
    .lean();

  const availableDateMap = new Map(
    availableDates.map((ad) => [ad._id.toString(), ad])
  );

  const requestWithDetails = {
    ...request,
    institutionName: institution?.name || "Instituição não encontrada",
    institutionLocation: institution?.location || {
      type: "Point",
      coordinates: [0, 0],
    },
    institutionAddress: institution?.address || "",
    institutionLogo: institution?.logo,
    institutionBanner: institution?.banner,
    requestedDates: request.requestedDates.map((rd) => {
      const availableDate = availableDateMap.get(rd.availableDateId.toString());

      return {
        availableDateId: rd.availableDateId.toString(),
        slotIds: rd.slotIds?.map((id) => id.toString()),
        date: availableDate?.date || "",
        startTime: availableDate?.slots?.[0]?.startTime,
        endTime:
          availableDate?.slots?.[availableDate.slots.length - 1]?.endTime,
        teamName:
          availableDate?.slots?.[0]?.teamId?.name || "Equipe não definida",
        teamColor: availableDate?.slots?.[0]?.teamId?.color || "#3B82F6",
        isLocked: availableDate?.slots?.some((slot) => slot.locked) || false,
      };
    }),
  };

  return requestWithDetails as CollectionRequestWithDetails;
}

export async function acceptCollectionRequest(
  requestId: string,
  selectedAvailableDateId: string,
  selectedSlotId: string,
  acceptedByUserId: string
): Promise<CollectionRequestWithDetails | null> {
  try {
    // For development, we'll skip transactions and use a simpler approach
    // TODO: Implement proper transaction handling for production
    // 1. Validate request exists and is pending
    const request = await CollectionRequest.findOne({
      _id: requestId,
      status: "pending",
      deletedAt: null,
    });

    if (!request) {
      throw new Error("Request not found or not in pending status");
    }

    // 2. Validate selected date/slot is in requestedDates
    const isRequestedDate = request.requestedDates.some(
      (rd) =>
        rd.availableDateId.toString() === selectedAvailableDateId &&
        rd.slotId.toString() === selectedSlotId
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
          "slots.$.lockedBy": new Types.ObjectId(requestId),
        },
      }
    );

    // 5. Update request status
    const statusHistoryEntry = {
      status: "accepted",
      changedAt: new Date(),
      changedBy: acceptedByUserId,
      reason: "Request accepted by blood bank",
    };

    const updatedRequest = await CollectionRequest.findOneAndUpdate(
      { _id: requestId },
      {
        $set: {
          status: "accepted",
          selectedAvailableDateId: new Types.ObjectId(selectedAvailableDateId),
          selectedSlotId: new Types.ObjectId(selectedSlotId),
        },
        $push: { statusHistory: statusHistoryEntry },
      },
      { new: true }
    );

    if (!updatedRequest) {
      throw new Error("Failed to update request status");
    }

    return updatedRequest.toObject();
  } catch (error: any) {
    console.error("Error accepting collection request:", error);
    throw error;
  }
}

export async function rejectCollectionRequest(
  requestId: string,
  rejectionReason: string,
  rejectedByUserId: string
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
    },
    {
      $set: {
        status: "rejected",
        rejectionReason,
      },
      $push: { statusHistory: statusHistoryEntry },
    }
  );

  return await getCollectionRequestById(requestId);
}

export async function cancelCollectionRequest(
  requestId: string,
  cancelledByUserId: string
): Promise<CollectionRequestWithDetails | null> {
  const session = await CollectionRequest.startSession();

  try {
    await session.withTransaction(async () => {
      const request = await CollectionRequest.findOne({
        _id: requestId,
        status: { $in: ["pending", "accepted"] },
        deletedAt: null,
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
        reason: "Request cancelled",
      };

      await CollectionRequest.findOneAndUpdate(
        { _id: requestId },
        {
          $set: { status: "cancelled" },
          $push: { statusHistory: statusHistoryEntry },
        },
        { session }
      );
    });

    return await getCollectionRequestById(requestId);
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
      // If no specific slots requested, check if any slots are available
      if (!requestedDate.slotIds || requestedDate.slotIds.length === 0) {
        const hasAvailableSlots = availableDate?.slots?.some(
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
          const slot = availableDate?.slots?.find(
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
