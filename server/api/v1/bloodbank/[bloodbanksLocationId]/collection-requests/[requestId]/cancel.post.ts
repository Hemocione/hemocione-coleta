import { cancelCollectionRequest } from "~/server/services/collectionRequest";
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
    const { cancellationReason } = body;

    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Cancellation reason is required",
      });
    }

    if (cancellationReason.trim().length > 1000) {
      throw createError({
        statusCode: 400,
        statusMessage: "Cancellation reason must be at most 1000 characters",
      });
    }

    const cancelledByUserId = event.context.auth.user.id;

    // Cancel collection request
    const updatedRequest = await cancelCollectionRequest(
      requestId,
      cancellationReason.trim(),
      cancelledByUserId,
      bloodBanksLocationId
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
