import { z } from "zod";
import { addTeamsToAvailableDate } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

const bodySchema = z.object({
  teamIds: z.array(z.string()).min(1, "Pelo menos um time deve ser fornecido"),
  defaultStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:mm"),
  defaultEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:mm"),
});

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");
  const availableDateId = getRouterParam(event, "availableDateId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "bloodBanksLocationId é obrigatório",
    });
  }
  assertUserAccessToBloodBanksLocationId(
    event.context.auth.user,
    bloodBanksLocationId
  );

  if (!availableDateId) {
    throw createError({
      statusCode: 400,
      statusMessage: "availableDateId é obrigatório",
    });
  }

  // Validar body
  const body = await readBody(event);
  const { teamIds, defaultStartTime, defaultEndTime } = bodySchema.parse(body);

  // Validar horários
  const startTime = new Date(`2000-01-01T${defaultStartTime}:00.000Z`);
  const endTime = new Date(`2000-01-01T${defaultEndTime}:00.000Z`);

  if (startTime >= endTime) {
    throw createError({
      statusCode: 400,
      statusMessage: "Horário de início deve ser anterior ao horário de fim",
    });
  }

  try {
    const updatedAvailableDate = await addTeamsToAvailableDate(
      availableDateId,
      bloodBanksLocationId,
      teamIds,
      defaultStartTime,
      defaultEndTime
    );

    if (!updatedAvailableDate) {
      throw createError({
        statusCode: 404,
        statusMessage:
          "Data não encontrada ou não pertence a este banco de sangue",
      });
    }

    return {
      success: true,
      data: updatedAvailableDate,
    };
  } catch (error: any) {
    console.error("Error adding teams to available date:", error);

    if (error.message.includes("não pertence a este banco de sangue")) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      });
    }

    if (error.message.includes("já estão incluídos")) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      });
    }

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erro ao adicionar times à data",
    });
  }
});
