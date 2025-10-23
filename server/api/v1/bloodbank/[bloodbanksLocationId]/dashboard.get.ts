import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import {
  getCollectionRequestsByBloodBank,
  getCollectionRequestsByIds,
} from "~/server/services/collectionRequest";
import { getInstitutionsByIds } from "~/server/services/hemocioneId";
import { Team } from "~/server/models/team";
import { AvailableDate } from "~/server/models/availableDate";
import dayjs from "dayjs";

// Helper function to get available dates by specific IDs
async function getAvailableDatesByIds(availableDateIds: string[]) {
  const availableDates = await AvailableDate.find({
    _id: { $in: availableDateIds },
    deletedAt: null,
  })
    .populate("slots.teamId", "name color")
    .lean();

  return availableDates;
}

export default defineEventHandler(async (event) => {
  try {
    const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

    if (!bloodBanksLocationId) {
      throw createError({
        statusCode: 400,
        statusMessage: "bloodBanksLocationId is required",
      });
    }

    // Assert user access
    assertUserAccessToBloodBanksLocationId(
      event.context.auth.user,
      bloodBanksLocationId
    );

    // Get today and next 7 days
    const today = dayjs().startOf("day");
    const nextWeek = dayjs().add(7, "days").endOf("day");

    // Get pending requests count
    const pendingRequests = await getCollectionRequestsByBloodBank(
      bloodBanksLocationId,
      { status: "pending" },
      { page: 1, limit: 1 } // We only need the count
    );

    // Get available dates for the next 7 days
    const availableDates = await AvailableDate.find({
      bloodBanksLocationId,
      deletedAt: null,
      date: {
        $gte: today.format("YYYY-MM-DD"),
        $lte: nextWeek.format("YYYY-MM-DD"),
      },
    })
      .populate("slots.teamId", "name color")
      .lean();

    // Get all locked slots from the available dates
    const lockedSlots = availableDates.flatMap(
      (ad) =>
        ad.slots
          ?.filter((slot) => slot.locked)
          .map((slot) => ({
            availableDate: ad,
            slot: slot,
          })) || []
    );

    // If no locked slots, return empty data
    if (lockedSlots.length === 0) {
      return {
        success: true,
        data: {
          upcomingCollections: [],
          pendingRequestsCount: pendingRequests.pagination.total,
          nextCollection: null,
        },
      };
    }

    // Get collection requests for the locked slots to get institution info
    const collectionRequestIds = lockedSlots
      .map((ls) => ls.slot.lockedBy?.toString())
      .filter(Boolean) as string[];

    let collectionRequests: any[] = [];
    if (collectionRequestIds.length > 0) {
      collectionRequests = await getCollectionRequestsByIds(
        collectionRequestIds
      );
    }

    // Get unique institution IDs from collection requests
    const institutionIds = Array.from(
      new Set(collectionRequests.map((cr) => cr.institutionId))
    );

    // Get institutions
    const institutions =
      institutionIds.length > 0
        ? await getInstitutionsByIds(institutionIds)
        : [];

    // Get teams for the blood bank
    const teams = await Team.find({
      bloodBanksLocationId,
      deletedAt: null,
    }).lean();

    // Create lookup maps
    const institutionMap = new Map(institutions.map((inst) => [inst.id, inst]));
    const collectionRequestMap = new Map(
      collectionRequests.map((cr) => [cr._id.toString(), cr])
    );
    const teamMap = new Map(teams.map((team) => [team._id?.toString(), team]));

    // Enrich upcoming collections with full data from locked slots
    const enrichedCollections = lockedSlots
      .map((lockedSlot) => {
        const { availableDate, slot } = lockedSlot;
        const collectionRequest = collectionRequestMap.get(
          slot.lockedBy?.toString()
        );

        if (!collectionRequest) {
          console.error(`Collection request not found for slot: ${slot._id}`);
          return null;
        }

        const institution = institutionMap.get(
          collectionRequest.institutionId.toString()
        );
        const team = slot.teamId;

        // Ensure institution data is always available
        if (!institution) {
          console.error(
            `Institution not found for ID: ${collectionRequest.institutionId}`
          );
          return null;
        }

        return {
          _id: collectionRequest._id,
          institutionName: institution.name,
          institutionLocation:
            institution.latitude && institution.longitude
              ? {
                  type: "Point" as const,
                  coordinates: [institution.longitude, institution.latitude],
                }
              : null,
          institutionAddress: institution.address || "",
          institutionLogo: institution.logo,
          institutionBanner: institution.banner,
          date: availableDate.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          teamName: (team as any)?.name || "Equipe não definida",
          teamColor: (team as any)?.color || "#3B82F6",
          createdAt: collectionRequest.createdAt,
          updatedAt: collectionRequest.updatedAt,
        };
      })
      .filter((collection) => collection !== null);

    // Sort by date
    enrichedCollections.sort((a, b) => {
      if (a.date === b.date) {
        return (
          new Date(a.startTime || 0).getTime() -
          new Date(b.startTime || 0).getTime()
        );
      }
      return a.date.localeCompare(b.date);
    });

    // Get next collection (first one)
    const nextCollection =
      enrichedCollections.length > 0 ? enrichedCollections[0] : null;

    return {
      success: true,
      data: {
        upcomingCollections: enrichedCollections,
        pendingRequestsCount: pendingRequests.pagination.total,
        nextCollection,
      },
    };
  } catch (error: any) {
    console.error("Error loading dashboard data:", error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
