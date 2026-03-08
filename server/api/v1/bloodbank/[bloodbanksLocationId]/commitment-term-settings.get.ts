import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getCommitmentTermSettings } from "~/server/services/bloodBank";

export default defineEventHandler(async (event) => {
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

  const settings = await getCommitmentTermSettings(
    selectedBloodBanksLocationId
  );

  return {
    success: true,
    data: settings,
  };
});
