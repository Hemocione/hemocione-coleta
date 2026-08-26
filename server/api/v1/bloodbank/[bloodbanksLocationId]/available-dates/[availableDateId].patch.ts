import { z } from "zod";
import { updateAvailableDateStatus } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

const bodySchema = z.object({
  status: z.enum(["blocked", "pending", "released"]),
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

  try {
    const body = await readBody(event);
    const { status } = bodySchema.parse(body);

    const updatedAvailableDate = await updateAvailableDateStatus(
      availableDateId,
      bloodBanksLocationId,
      status
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
    console.error("Error updating available date status:", error);

    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos",
        data: error.errors,
      });
    }

    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erro ao atualizar status da data",
    });
  }
});
