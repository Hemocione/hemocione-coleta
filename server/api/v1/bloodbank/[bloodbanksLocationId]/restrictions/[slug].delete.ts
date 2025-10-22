import { deleteRestrictionItem } from "~/server/services/bloodBank";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");
  const slug = getRouterParam(event, "slug");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Blood bank location ID is required",
    });
  }
  assertUserAccessToBloodBanksLocationId(
    event.context.auth.user,
    bloodBanksLocationId
  );

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Restriction slug is required",
    });
  }

  try {
    const updatedChecklist = await deleteRestrictionItem(
      bloodBanksLocationId,
      slug
    );

    return {
      success: true,
      data: updatedChecklist,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Failed to delete restriction item",
    });
  }
});
