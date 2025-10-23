import { rejectCollectionRequest } from "~/server/services/collectionRequest";

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

    // Get request body
    const body = await readBody(event);
    const { rejectionReason } = body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Rejection reason is required",
      });
    }

    // TODO: Get user ID from auth context
    const rejectedByUserId = "system"; // This should come from auth middleware

    // Reject collection request
    const updatedRequest = await rejectCollectionRequest(
      requestId,
      rejectionReason.trim(),
      rejectedByUserId
    );

    if (!updatedRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: "Collection request not found or cannot be rejected",
      });
    }

    return {
      success: true,
      data: updatedRequest,
      message: "Collection request rejected successfully",
    };
  } catch (error: any) {
    console.error("Error rejecting collection request:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
