import { z } from "zod";
import { updateSlot } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

const bodySchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  locked: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");
  const availableDateId = getRouterParam(event, "availableDateId");
  const slotId = getRouterParam(event, "slotId");

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

  if (!slotId) {
    throw createError({
      statusCode: 400,
      statusMessage: "slotId é obrigatório",
    });
  }

  // Validar body
  const body = await readBody(event);
  const updates = bodySchema.parse(body);

  // Verificar se pelo menos um campo foi fornecido
  if (Object.keys(updates).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Pelo menos um campo deve ser fornecido para atualização",
    });
  }

  try {
    const updatedAvailableDate = await updateSlot(
      availableDateId,
      bloodBanksLocationId,
      slotId,
      updates
    );

    if (!updatedAvailableDate) {
      throw createError({
        statusCode: 404,
        statusMessage:
          "Slot não encontrado ou não pertence a este banco de sangue",
      });
    }

    return {
      success: true,
      data: updatedAvailableDate,
    };
  } catch (error: any) {
    console.error("Error updating slot:", error);

    if (error.message.includes("Horário")) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      });
    }

    if (error.message.includes("não pertence a este banco de sangue")) {
      throw createError({
        statusCode: 403,
        statusMessage: error.message,
      });
    }

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erro ao atualizar slot",
    });
  }
});
