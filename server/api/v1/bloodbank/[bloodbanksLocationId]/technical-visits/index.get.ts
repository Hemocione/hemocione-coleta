import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getTechnicalVisitsByBloodBank } from "~/server/services/technicalVisit";

export default defineEventHandler(async (event) => {
  try {
    const bloodBanksLocationId = getRouterParam(
      event,
      "bloodbanksLocationId"
    );

    if (!bloodBanksLocationId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Blood bank location ID is required",
      });
    }

    assertUserAccessToBloodBanksLocationId(
      event.context.auth.user,
      bloodBanksLocationId
    );

    // Get technical visits
    const visits = await getTechnicalVisitsByBloodBank(bloodBanksLocationId);

    return {
      success: true,
      data: visits,
    };
  } catch (error: any) {
    console.error("Error fetching technical visits:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});

