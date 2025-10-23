import { rejectCollectionRequest } from "~/server/services/collectionRequest";
import { getBloodBanksLocationIdBySlug } from "~/server/services/bloodBank";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

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

    assertUserAccessToBloodBanksLocationId(
      event.context.auth.user,
      bloodBanksLocationId
    );

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

    const rejectedByUserId = event.context.auth.user.id;

    // Reject collection request
    const updatedRequest = await rejectCollectionRequest(
      requestId,
      rejectionReason.trim(),
      rejectedByUserId,
      bloodBanksLocationId
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
