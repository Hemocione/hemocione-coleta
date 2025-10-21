import { addRestrictionItem } from "~/server/services/bloodBank";

export default defineEventHandler(async (event) => {
  const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Blood bank location ID is required",
    });
  }

  const body = await readBody(event);

  // Validate request body
  if (!body.title || !body.description) {
    throw createError({
      statusCode: 400,
      statusMessage: "Title and description are required",
    });
  }

  if (typeof body.title !== "string" || typeof body.description !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Title and description must be strings",
    });
  }

  if (body.title.trim().length === 0 || body.description.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Title and description cannot be empty",
    });
  }

  if (body.title.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: "Title must be 100 characters or less",
    });
  }

  if (body.description.length > 1000) {
    throw createError({
      statusCode: 400,
      statusMessage: "Description must be 1000 characters or less",
    });
  }

  try {
    const updatedChecklist = await addRestrictionItem(
      bloodBanksLocationId,
      body.title,
      body.description
    );

    return {
      success: true,
      data: updatedChecklist,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Failed to add restriction item",
    });
  }
});
