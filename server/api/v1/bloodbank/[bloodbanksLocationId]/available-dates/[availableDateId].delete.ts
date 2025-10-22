import { deleteAvailableDate } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

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

  try {
    const success = await deleteAvailableDate(
      availableDateId,
      bloodBanksLocationId
    );

    if (!success) {
      throw createError({
        statusCode: 404,
        statusMessage:
          "Data não encontrada ou não pertence a este banco de sangue",
      });
    }

    return {
      success: true,
      message: "Data deletada com sucesso",
    };
  } catch (error: any) {
    console.error("Error deleting available date:", error);

    if (error.message.includes("slots travados")) {
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
      statusMessage: "Erro ao deletar data disponível",
    });
  }
});
