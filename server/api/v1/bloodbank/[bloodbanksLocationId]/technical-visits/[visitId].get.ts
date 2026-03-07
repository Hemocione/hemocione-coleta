import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getTechnicalVisitById } from "~/server/services/technicalVisit";

export default defineEventHandler(async (event) => {
  const user = event.context.auth.user;
  const bloodBanksLocationId = getRouterParam(
    event,
    "bloodbanksLocationId"
  );
  const visitId = getRouterParam(event, "visitId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID is required",
    });
  }

  if (!visitId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Visit ID is required",
    });
  }

  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  try {
    const visit = await getTechnicalVisitById(bloodBanksLocationId, visitId);

    if (!visit) {
      throw createError({
        statusCode: 404,
        statusMessage: "Technical visit not found",
      });
    }

    return {
      success: true,
      data: visit,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("Error fetching technical visit:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch technical visit",
    });
  }
});
