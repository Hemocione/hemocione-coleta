import { createTeam } from "~/server/services/team";
import { addTeamToFutureAvailableDates } from "~/server/services/availableDate";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

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

    // Adicionar team a availableDates futuras com isAllTeams = true
    // TODO: improve this implementation to run it in the background
    // try {
    //   await addTeamToFutureAvailableDates(
    //     selectedBloodBanksLocationId,
    //     team._id
    //   );
    // } catch (availableDateError) {
    //   console.warn(
    //     "Error adding team to future available dates:",
    //     availableDateError
    //   );
    //   // Não falhar a criação do team se houver erro ao adicionar às availableDates
    // }

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
