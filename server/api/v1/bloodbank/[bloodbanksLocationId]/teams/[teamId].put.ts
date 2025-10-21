import { updateTeam } from "~/server/services/team";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

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

  const body = await readBody(event);
  const { name, color } = body;

  if (!name && !color) {
    throw createError({
      statusCode: 400,
      statusMessage: "At least one field (name or color) is required",
    });
  }

  // Validate color format if provided
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Color must be a valid hex color code (e.g., #RRGGBB)",
    });
  }

  try {
    const updates: { name?: string; color?: string } = {};
    if (name) updates.name = name;
    if (color) updates.color = color;

    const team = await updateTeam(
      teamId,
      selectedBloodBanksLocationId,
      updates
    );

    if (!team) {
      throw createError({
        statusCode: 404,
        statusMessage: "Team not found",
      });
    }

    return {
      success: true,
      data: team,
    };
  } catch (error: any) {
    console.error("Error updating team:", error);

    if (
      error.message === "Team not found or does not belong to this bloodbank"
    ) {
      throw createError({
        statusCode: 404,
        statusMessage: "Team not found or does not belong to this bloodbank",
      });
    }

    if (error.message === "Team name already exists for this bloodbank") {
      throw createError({
        statusCode: 409,
        statusMessage: "Team name already exists for this bloodbank",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to update team",
    });
  }
});
