import { getActiveBloodBanksLocationIdBySlug } from "~/server/services/bloodBank";
import { getRestrictionChecklist } from "~/server/services/bloodBank";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "slug é obrigatório" });
  }

  const bloodBanksLocationId = await getActiveBloodBanksLocationIdBySlug(slug);
  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Banco não encontrado",
    });
  }

  const restrictions = await getRestrictionChecklist(bloodBanksLocationId);

  return {
    success: true,
    data: restrictions,
  };
});
