import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { deleteTechnicalVisit } from "~/server/services/technicalVisit";

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
    const deleted = await deleteTechnicalVisit(bloodBanksLocationId, visitId);

    if (!deleted) {
      throw createError({
        statusCode: 404,
        statusMessage: "Technical visit not found",
      });
    }

    return {
      success: true,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("Error deleting technical visit:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to delete technical visit",
    });
  }
});
