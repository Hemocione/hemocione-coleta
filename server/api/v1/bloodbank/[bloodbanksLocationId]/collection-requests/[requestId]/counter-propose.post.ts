import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import {
  counterPropose,
  getCollectionRequestById,
} from "~/server/services/collectionRequest";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

const proposalDateSchema = z
  .object({
    date: z.coerce.date(),
    availableDateId: z.string().trim().min(1),
    slotId: z.string().trim().min(1),
    startTime: timeSchema,
    endTime: timeSchema.optional(),
    durationMinutes: z.number().int().positive().optional(),
    teamName: z.string().trim().max(100).optional(),
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
  needsTechnicalVisit: z.boolean(),
  note: z.string(),
});

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatSlotTime(value: Date | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && timeSchema.safeParse(value).success) {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
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
    const request = await getCollectionRequestById(
      requestId,
      bloodBanksLocationId
    );

    if (!request || request.status !== "pending") {
      throw createError({
        statusCode: 409,
        statusMessage: "A solicitação não está disponível para contraproposta",
      });
    }

    const configuredSlots = new Map(
      request.availableCounterProposalOptions
        .filter((slot) => !slot.isLocked)
        .map((slot) => [`${slot.availableDateId}:${slot.slotId}`, slot])
    );
    const hasOnlyConfiguredSlots = body.proposedDates.every((proposalDate) => {
      const slot = configuredSlots.get(
        `${proposalDate.availableDateId}:${proposalDate.slotId}`
      );
      if (!slot) return false;

      return (
        proposalDate.date.toISOString().slice(0, 10) === slot.date &&
        proposalDate.startTime === formatSlotTime(slot.startTime) &&
        proposalDate.endTime === formatSlotTime(slot.endTime) &&
        proposalDate.teamName === slot.teamName
      );
    });

    if (!hasOnlyConfiguredSlots) {
      throw createError({
        statusCode: 400,
        statusMessage: "Selecione apenas slots disponíveis do calendário",
      });
    }

    const proposedByUserId = event.context.auth.user.id;

    const updatedRequest = await counterPropose(
      requestId,
      {
        proposedDates: normalizeProposalDates(body.proposedDates),
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
