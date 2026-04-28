import { getActiveBloodBankBySlug } from "~/server/services/bloodBank";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "slug é obrigatório" });
  }

  const bank = await getActiveBloodBankBySlug(slug);
  if (!bank) {
    throw createError({
      statusCode: 404,
      statusMessage: "Banco não encontrado",
    });
  }

  return {
    success: true,
    data: {
      _id: bank._id?.toString?.() || "",
      name: bank.name,
      slug: bank.slug,
      logo: bank.logo ?? null,
      bloodBanksLocationId: bank.bloodBanksLocationId?.toString?.() || "",
    },
  };
});
