import { removeTeamFromAvailableDate } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

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

  try {
    const updatedAvailableDate = await removeTeamFromAvailableDate(
      availableDateId,
      bloodBanksLocationId,
      slotId
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
    console.error("Error removing slot from available date:", error);

    if (error.message.includes("travado")) {
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
      statusMessage: "Erro ao remover time da data",
    });
  }
});
