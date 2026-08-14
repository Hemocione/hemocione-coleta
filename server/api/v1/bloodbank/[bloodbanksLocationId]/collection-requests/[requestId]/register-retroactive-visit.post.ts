import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { registerRetroactiveVisit } from "~/server/services/collectionRequest";

const bodySchema = z.object({
  visitDate: z.coerce.date(),
  note: z.string().max(2000).optional(),
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
    const updatedRequest = await registerRetroactiveVisit(requestId, {
      visitDate: body.visitDate,
      note: body.note,
      bloodBanksLocationId,
      changedByUserId: user.id,
    });

    return {
      success: true,
      data: updatedRequest,
      message: "Technical visit registered retroactively successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;

    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "visitDate is required and must be a valid date",
      });
    }

    if (error.message?.includes("not awaiting")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Collection request is not awaiting technical visit",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
