import { acceptCollectionRequest } from "~/server/services/collectionRequest";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { sendWhatsAppNotificationToPhone } from "~/server/services/notification";

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
    const { selectedAvailableDateId, selectedSlotId } = body;
    const needsTechnicalVisit = body.needsTechnicalVisit ?? false;

    if (!selectedAvailableDateId || !selectedSlotId) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "selectedAvailableDateId and selectedSlotId are required",
      });
    }

    if (typeof needsTechnicalVisit !== "boolean") {
      throw createError({
        statusCode: 400,
        statusMessage: "needsTechnicalVisit must be a boolean",
      });
    }

    // TODO: Get user ID from auth context
    const acceptedByUserId = event.context.auth.user.id;

    // Accept collection request
    const updatedRequest = await acceptCollectionRequest(
      requestId,
      selectedAvailableDateId,
      selectedSlotId,
      acceptedByUserId,
      bloodBanksLocationId,
      needsTechnicalVisit
    );

    if (!updatedRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: "Collection request not found or cannot be accepted",
      });
    }

    // Fire-and-forget WhatsApp notification to institution's host
    if (updatedRequest.host?.phone) {
      const bloodBankDoc = await getBloodBankByBloodBanksLocationId(bloodBanksLocationId);
      const bloodBankName = bloodBankDoc?.name || "Banco de Sangue";

      const selectedSlotOption = updatedRequest.availableSlotOptions.find(
        (s) => s.slotId === selectedSlotId
      );
      const confirmedDate = selectedSlotOption?.date || "";
      const confirmedTime = selectedSlotOption?.startTime
        ? new Date(selectedSlotOption.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "";

      const trackingUrl = updatedRequest.accessToken
        ? `${process.env.NUXT_PUBLIC_BASE_URL || ""}/agendar/acompanhar/${updatedRequest.accessToken}`
        : "";

      sendWhatsAppNotificationToPhone({
        phone: updatedRequest.host.phone,
        templateName: "collection_request_accepted",
        params: {
          bloodBankName,
          confirmedDate,
          confirmedTime,
          trackingUrl,
        },
      }).catch(() => {});
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
