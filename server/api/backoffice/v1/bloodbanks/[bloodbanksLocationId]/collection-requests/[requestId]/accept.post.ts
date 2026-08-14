import { z } from "zod";
import { assertSecretAuth } from "~/server/services/auth";
import { acceptCollectionRequest } from "~/server/services/collectionRequest";

const bodySchema = z.object({
  actingAsStaffId: z.string().trim().min(1),
  selectedAvailableDateId: z.string().trim().min(1),
  selectedSlotId: z.string().trim().min(1),
  needsTechnicalVisit: z.boolean().default(false),
});

export default defineEventHandler(async (event) => {
  assertSecretAuth(event);

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

    const body = bodySchema.parse(await readBody(event));
    const updatedRequest = await acceptCollectionRequest(
      requestId,
      body.selectedAvailableDateId,
      body.selectedSlotId,
      body.actingAsStaffId,
      bloodBanksLocationId,
      body.needsTechnicalVisit
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
    if (error.statusCode) {
      throw error;
    }

    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos; actingAsStaffId é obrigatório",
      });
    }

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
      statusCode: 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
