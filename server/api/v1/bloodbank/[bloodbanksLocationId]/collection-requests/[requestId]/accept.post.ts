import { acceptCollectionRequest } from "~/server/services/collectionRequest";

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
    const { selectedAvailableDateId, selectedSlotId } = body;

    if (!selectedAvailableDateId || !selectedSlotId) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "selectedAvailableDateId and selectedSlotId are required",
      });
    }

    // TODO: Get user ID from auth context
    const acceptedByUserId = "system"; // This should come from auth middleware

    // Accept collection request
    const updatedRequest = await acceptCollectionRequest(
      requestId,
      selectedAvailableDateId,
      selectedSlotId,
      acceptedByUserId
    );

    if (!updatedRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: "Collection request not found or cannot be accepted",
      });
    }

    return {
      success: true,
      data: updatedRequest,
      message: "Collection request accepted successfully",
    };
  } catch (error: any) {
    console.error("Error accepting collection request:", error);

    // Handle specific error cases
    if (error.message?.includes("already locked")) {
      throw createError({
        statusCode: 409,
        statusMessage: "Slot is already locked by another request",
      });
    }

    if (error.message?.includes("not in requested dates")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Selected date/slot is not in the requested dates",
      });
    }

    if (error.message?.includes("not in pending status")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Request is not in pending status",
      });
    }

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
