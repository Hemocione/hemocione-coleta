import { getTeamsByBloodBanksLocationId } from "~/server/services/team";
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
  
  if (!selectedBloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID is required",
    });
  }
  
  assertUserAccessToBloodBanksLocationId(user, selectedBloodBanksLocationId);

  try {
    const teams = await getTeamsByBloodBanksLocationId(selectedBloodBanksLocationId);

    return {
      success: true,
      data: teams,
    };
  } catch (error: any) {
    console.error("Error fetching teams:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch teams",
    });
  }
});
