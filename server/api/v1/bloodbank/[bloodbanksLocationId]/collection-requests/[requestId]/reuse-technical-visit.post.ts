import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { reuseTechnicalVisit } from "~/server/services/collectionRequest";

const bodySchema = z.object({
  technicalVisitId: z.string().trim().min(1),
});

export default defineEventHandler(async (event) => {
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

  const user = event.context.auth.user;
  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  try {
    const body = bodySchema.parse(await readBody(event));
    const updatedRequest = await reuseTechnicalVisit(requestId, {
      technicalVisitId: body.technicalVisitId,
      bloodBanksLocationId,
      changedByUserId: user.id,
    });

    return {
      success: true,
      data: updatedRequest,
      message: "Technical visit reused successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;

    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "technicalVisitId is required",
      });
    }

    if (error.message?.includes("must be approved")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Technical visit must be approved",
      });
    }

    if (error.message?.includes("not awaiting")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Collection request is not awaiting technical visit",
      });
    }

    if (error.message?.includes("not found")) {
      throw createError({
        statusCode: 404,
        statusMessage: "Technical visit not found",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
