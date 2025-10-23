import { cancelCollectionRequest } from "~/server/services/collectionRequest";

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

    // TODO: Get user ID from auth context
    const cancelledByUserId = "system"; // This should come from auth middleware

    // Cancel collection request
    const updatedRequest = await cancelCollectionRequest(
      requestId,
      cancelledByUserId
    );

    if (!updatedRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: "Collection request not found or cannot be cancelled",
      });
    }

    return {
      success: true,
      data: updatedRequest,
      message: "Collection request cancelled successfully",
    };
  } catch (error: any) {
    console.error("Error cancelling collection request:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
