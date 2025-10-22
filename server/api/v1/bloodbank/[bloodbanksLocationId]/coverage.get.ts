import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
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

  // Get bloodbank by bloodBanksLocationId
  const bloodbank = await getBloodBankByBloodBanksLocationId(
    selectedBloodBanksLocationId
  );

  if (!bloodbank) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bloodbank not found",
    });
  }

  return {
    success: true,
    data: {
      id: bloodbank._id,
      name: bloodbank.name,
      slug: bloodbank.slug,
      location: bloodbank.location,
      bloodBanksLocationId: bloodbank.bloodBanksLocationId,
      logo: bloodbank.logo,
      coverageArea: bloodbank.coverageArea,
      hasLocation: !!bloodbank.location,
      hasCoverageArea: !!bloodbank.coverageArea,
      timezone: bloodbank.timezone,
    },
  };
});
