import { z } from "zod";
import { assertSecretAuth } from "~/server/services/auth";
import { updateBloodBankSettings } from "~/server/services/bloodBank";

const bodySchema = z.object({ hidden: z.boolean() }).strict();

export default defineEventHandler(async (event) => {
  assertSecretAuth(event);

  try {
    const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

    if (!bloodBanksLocationId) {
      throw createError({
        statusCode: 400,
        statusMessage: "bloodBanksLocationId é obrigatório",
      });
    }

    if (!z.uuid().safeParse(bloodBanksLocationId).success) {
      throw createError({
        statusCode: 400,
        statusMessage: "bloodBanksLocationId deve ser um UUID válido",
      });
    }

    const body = bodySchema.parse(await readBody(event));
    const settings = await updateBloodBankSettings(bloodBanksLocationId, body);

    if (!settings) {
      throw createError({
        statusCode: 404,
        statusMessage: "Banco de sangue não encontrado",
      });
    }

    return { success: true, data: settings };
  } catch (error: any) {
    if (error?.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos",
      });
    }

    throw error;
  }
});
