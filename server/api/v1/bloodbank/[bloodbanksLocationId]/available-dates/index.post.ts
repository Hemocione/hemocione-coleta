import { z } from "zod";
import { createAvailableDate } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

const bodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  isAllTeams: z.boolean(),
  slotsConfig: z.object({
    type: z.enum(["global", "individual"]),
    globalStartTime: z.string().optional(),
    globalEndTime: z.string().optional(),
    teamIds: z.array(z.string()).optional(),
    slots: z
      .array(
        z.object({
          teamId: z.string(),
          startTime: z.string(),
          endTime: z.string(),
        })
      )
      .optional(),
  }),
});

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

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

  // Validar body
  const body = await readBody(event);
  const { date, isAllTeams, slotsConfig } = bodySchema.parse(body);

  // Não permitir criação de datas no passado
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dateObj = new Date(date + "T00:00:00Z");
  if (dateObj < today) {
    throw createError({
      statusCode: 400,
      statusMessage: "Não é permitido criar datas no passado",
    });
  }

  // Validações adicionais
  if (slotsConfig.type === "global") {
    if (!slotsConfig.globalStartTime || !slotsConfig.globalEndTime) {
      throw createError({
        statusCode: 400,
        statusMessage: "Horários globais são obrigatórios quando type=global",
      });
    }
  } else {
    if (!slotsConfig.slots || slotsConfig.slots.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Slots individuais são obrigatórios quando type=individual",
      });
    }
  }

  if (
    !isAllTeams &&
    (!slotsConfig.teamIds || slotsConfig.teamIds.length === 0)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Pelo menos um time deve ser selecionado quando isAllTeams=false",
    });
  }

  try {
    const availableDate = await createAvailableDate(
      bloodBanksLocationId,
      date,
      isAllTeams,
      slotsConfig
    );

    return {
      success: true,
      data: availableDate,
    };
  } catch (error: any) {
    console.error("Error creating available date:", error);

    if (error.message.includes("Já existe uma data cadastrada")) {
      throw createError({
        statusCode: 409,
        statusMessage: error.message,
      });
    }

    if (error.message.includes("não pertence a este banco de sangue")) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      });
    }

    if (error.message.includes("Horário")) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erro ao criar data disponível",
    });
  }
});
