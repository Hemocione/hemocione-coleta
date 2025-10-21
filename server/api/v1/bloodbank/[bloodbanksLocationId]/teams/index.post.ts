import { createTeam } from "~/server/services/team";
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

  const body = await readBody(event);
  const { name, color } = body;

  if (!name || !color) {
    throw createError({
      statusCode: 400,
      statusMessage: "Name and color are required",
    });
  }

  // Validate color format
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Color must be a valid hex color code (e.g., #RRGGBB)",
    });
  }

  try {
    const team = await createTeam(selectedBloodBanksLocationId, name, color);

    return {
      success: true,
      data: team,
    };
  } catch (error: any) {
    console.error("Error creating team:", error);
    
    if (error.message === "Team name already exists for this bloodbank") {
      throw createError({
        statusCode: 409,
        statusMessage: "Team name already exists for this bloodbank",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create team",
    });
  }
});
