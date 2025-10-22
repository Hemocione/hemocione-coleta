import { getAvailableDateById } from "~/server/services/availableDate";
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
    const availableDate = await getAvailableDateById(availableDateId);

    if (!availableDate) {
      throw createError({
        statusCode: 404,
        statusMessage: "Data não encontrada",
      });
    }

    // Verificar se pertence ao bloodbank
    if (availableDate.bloodBanksLocationId !== bloodBanksLocationId) {
      throw createError({
        statusCode: 403,
        statusMessage: "Data não pertence a este banco de sangue",
      });
    }

    return {
      success: true,
      data: availableDate,
    };
  } catch (error: any) {
    console.error("Error loading available date:", error);

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erro ao carregar data disponível",
    });
  }
});
