import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { counterPropose } from "~/server/services/collectionRequest";

const bodySchema = z.object({
  proposedDates: z
    .array(
      z.object({
        date: z.coerce.date(),
        startTime: z.string().min(1),
        durationMinutes: z.number().int().positive(),
        note: z.string(),
      })
    )
    .min(1),
  needsTechnicalVisit: z.boolean(),
  note: z.string(),
});

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

    const body = bodySchema.parse(await readBody(event));
    const proposedByUserId = event.context.auth.user.id;

    const updatedRequest = await counterPropose(
      requestId,
      {
        proposedDates: body.proposedDates,
        needsTechnicalVisit: body.needsTechnicalVisit,
        note: body.note,
        proposedBy: proposedByUserId,
      },
      bloodBanksLocationId
    );

    return {
      success: true,
      data: updatedRequest,
      message: "Counter proposal created successfully",
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos para a contraproposta",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
