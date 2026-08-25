import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { proposeTechnicalVisit } from "~/server/services/collectionRequest";

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
    const updatedRequest = await proposeTechnicalVisit(
      requestId,
      {
        proposedDates: body.proposedDates,
        note: body.note,
        proposedBy: event.context.auth.user.id,
      },
      bloodBanksLocationId
    );

    return {
      success: true,
      data: updatedRequest,
      message: "Technical visit proposal created successfully",
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos para a proposta de visita técnica",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
