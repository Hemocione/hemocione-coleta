import { updateRestrictionItem } from "~/server/services/bloodBank";
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

  const body = await readBody(event);

  // Validate request body - at least one field must be provided
  if (!body.title && !body.description) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "At least one field (title or description) must be provided",
    });
  }

  const updates: { title?: string; description?: string } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "Title must be a string",
      });
    }

    if (body.title.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Title cannot be empty",
      });
    }

    if (body.title.length > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: "Title must be 100 characters or less",
      });
    }

    updates.title = body.title;
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "Description must be a string",
      });
    }

    if (body.description.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Description cannot be empty",
      });
    }

    if (body.description.length > 1000) {
      throw createError({
        statusCode: 400,
        statusMessage: "Description must be 1000 characters or less",
      });
    }

    updates.description = body.description;
  }

  try {
    const updatedChecklist = await updateRestrictionItem(
      bloodBanksLocationId,
      slug,
      updates
    );

    return {
      success: true,
      data: updatedChecklist,
    };
  } catch (error: any) {
    if (error.message === "Blood bank not found") {
      throw createError({
        statusCode: 404,
        statusMessage: "Blood bank not found",
      });
    }

    if (error.message === "Restriction item not found") {
      throw createError({
        statusCode: 404,
        statusMessage: "Restriction item not found",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Failed to update restriction item",
    });
  }
});
