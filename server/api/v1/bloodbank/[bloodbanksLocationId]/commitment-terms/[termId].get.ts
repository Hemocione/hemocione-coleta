import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getCommitmentTermById } from "~/server/services/commitmentTerm";

export default defineEventHandler(async (event) => {
  const user = event.context.auth.user;
  const bloodBanksLocationId = getRouterParam(
    event,
    "bloodbanksLocationId"
  );
  const termId = getRouterParam(event, "termId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID is required",
    });
  }

  if (!termId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Term ID is required",
    });
  }

  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  try {
    const term = await getCommitmentTermById(bloodBanksLocationId, termId);

    if (!term) {
      throw createError({
        statusCode: 404,
        statusMessage: "Commitment term not found",
      });
    }

    return {
      success: true,
      data: term,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("Error fetching commitment term:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch commitment term",
    });
  }
});
