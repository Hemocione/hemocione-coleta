import { deleteTeam } from "~/server/services/team";
import { removeSlotsFromFutureAvailableDates } from "~/server/services/availableDate";
import {
  assertUserAccessToBloodBanksLocationId,
  useHemocioneUserAuth,
} from "~/server/services/auth";

export default defineEventHandler(async (event) => {
  // Get user from auth context
  const user = event.context.auth.user;
  const selectedBloodBanksLocationId = getRouterParam(
    event,
    "bloodbanksLocationId"
  );
  const teamId = getRouterParam(event, "teamId");

  if (!selectedBloodBanksLocationId || !teamId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID and team ID are required",
    });
  }

  assertUserAccessToBloodBanksLocationId(user, selectedBloodBanksLocationId);

  try {
    // Remover slots não-locked do team de availableDates futuras
    let removedSlotsCount = 0;
    try {
      removedSlotsCount = await removeSlotsFromFutureAvailableDates(
        selectedBloodBanksLocationId,
        teamId
      );
    } catch (availableDateError) {
      console.warn(
        "Error removing team from future available dates:",
        availableDateError
      );
      // Não falhar a deleção do team se houver erro ao remover das availableDates
    }

    const success = await deleteTeam(teamId, selectedBloodBanksLocationId);

    if (!success) {
      throw createError({
        statusCode: 404,
        statusMessage: "Team not found",
      });
    }

    return {
      success: true,
      message: "Team deleted successfully",
      removedSlotsCount, // Informar quantos slots foram removidos
    };
  } catch (error: any) {
    console.error("Error deleting team:", error);

    if (
      error.message === "Team not found or does not belong to this bloodbank"
    ) {
      throw createError({
        statusCode: 404,
        statusMessage: "Team not found or does not belong to this bloodbank",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to delete team",
    });
  }
});
