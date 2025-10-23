import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getCollectionRequestsByBloodBank } from "~/server/services/collectionRequest";

export default defineEventHandler(async (event) => {
  try {
    const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

    if (!bloodBanksLocationId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Blood bank location ID is required",
      });
    }
    assertUserAccessToBloodBanksLocationId(
      event.context.auth.user,
      bloodBanksLocationId
    );

    // Get query parameters
    const query = getQuery(event);
    const status = query.status as string;
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const dateFrom = query.dateFrom as string;
    const dateTo = query.dateTo as string;

    // Build filters
    const filters = {
      ...(status && { status }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    };

    // Get pagination options
    const pagination = { page, limit };

    // Get collection requests
    const result = await getCollectionRequestsByBloodBank(
      bloodBanksLocationId,
      filters,
      pagination
    );

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  } catch (error: any) {
    console.error("Error fetching collection requests:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
