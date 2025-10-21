import { getRestrictionChecklist } from "~/server/services/bloodBank";

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Blood bank location ID is required",
    });
  }

  try {
    const checklist = await getRestrictionChecklist(bloodBanksLocationId);

    return {
      success: true,
      data: checklist,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Failed to fetch restriction checklist",
    });
  }
});
