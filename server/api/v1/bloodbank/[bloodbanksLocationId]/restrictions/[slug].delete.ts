import { deleteRestrictionItem } from "~/server/services/bloodBank";

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");
  const slug = getRouterParam(event, "slug");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Blood bank location ID is required",
    });
  }

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
