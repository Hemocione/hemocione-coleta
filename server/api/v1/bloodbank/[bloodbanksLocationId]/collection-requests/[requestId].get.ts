import { getCollectionRequestById } from "~/server/services/collectionRequest";

export default defineEventHandler(async (event) => {
  try {
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

    // Get collection request details
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

    return {
      success: true,
      data: request,
    };
  } catch (error: any) {
    console.error("Error fetching collection request:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
