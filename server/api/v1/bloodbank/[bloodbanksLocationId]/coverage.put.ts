import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { updateBloodBankCoverageArea } from "~/server/services/bloodBank";

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
  const { coverageArea } = body;

  if (!coverageArea) {
    throw createError({
      statusCode: 400,
      statusMessage: "Coverage area is required",
    });
  }

  // Validate coverage area structure
  if (!coverageArea.type || coverageArea.type !== "Polygon") {
    throw createError({
      statusCode: 400,
      statusMessage: "Coverage area must be a Polygon",
    });
  }

  if (!coverageArea.coordinates || !Array.isArray(coverageArea.coordinates)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Coverage area coordinates are required",
    });
  }

  // Update bloodbank coverage area
  const updatedBloodbank = await updateBloodBankCoverageArea(
    selectedBloodBanksLocationId,
    coverageArea
  );

  if (!updatedBloodbank) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bloodbank not found",
    });
  }

  return {
    success: true,
    data: {
      id: updatedBloodbank._id,
      name: updatedBloodbank.name,
      slug: updatedBloodbank.slug,
      bloodBanksLocationId: updatedBloodbank.bloodBanksLocationId,
      logo: updatedBloodbank.logo,
      location: updatedBloodbank.location,
      coverageArea: updatedBloodbank.coverageArea,
      hasLocation: !!updatedBloodbank.location,
      hasCoverageArea: !!updatedBloodbank.coverageArea,
      timezone: updatedBloodbank.timezone,
    },
  };
});
