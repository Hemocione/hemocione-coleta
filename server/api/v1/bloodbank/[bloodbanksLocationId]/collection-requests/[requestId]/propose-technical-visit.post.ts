import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { proposeTechnicalVisit } from "~/server/services/collectionRequest";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

const proposalDateSchema = z
  .object({
    date: z.coerce.date(),
    startTime: timeSchema,
    endTime: timeSchema.optional(),
    durationMinutes: z.number().int().positive().optional(),
    note: z.string(),
  })
  .superRefine((proposalDate, context) => {
    if (!proposalDate.endTime && proposalDate.durationMinutes === undefined) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Informe endTime ou durationMinutes",
      });
      return;
    }

    if (
      proposalDate.endTime &&
      timeToMinutes(proposalDate.endTime) <=
        timeToMinutes(proposalDate.startTime)
    ) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "endTime deve ser posterior a startTime",
      });
    }
  });

const bodySchema = z.object({
  proposedDates: z
    .array(proposalDateSchema)
    .min(1),
  note: z.string(),
});

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeProposalDates(
  proposedDates: z.infer<typeof bodySchema>["proposedDates"]
) {
  return proposedDates.map((proposalDate) => ({
    ...proposalDate,
    durationMinutes: proposalDate.endTime
      ? timeToMinutes(proposalDate.endTime) -
        timeToMinutes(proposalDate.startTime)
      : proposalDate.durationMinutes!,
  }));
}

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
        proposedDates: normalizeProposalDates(body.proposedDates),
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
