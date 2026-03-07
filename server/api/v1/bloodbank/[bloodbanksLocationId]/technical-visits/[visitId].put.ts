import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { updateTechnicalVisit } from "~/server/services/technicalVisit";

const updateTechnicalVisitSchema = z.object({
  institutionId: z.string().uuid().nullish(),
  address: z.string().min(1).max(500).optional(),
  location: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .nullish(),
  visitDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional(),
  outcome: z.enum(["approved", "rejected", "pending"]).optional(),
  notes: z.string().max(2000).nullish(),
});

export default defineEventHandler(async (event) => {
  const user = event.context.auth.user;
  const bloodBanksLocationId = getRouterParam(
    event,
    "bloodbanksLocationId"
  );
  const visitId = getRouterParam(event, "visitId");

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID is required",
    });
  }

  if (!visitId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Visit ID is required",
    });
  }

  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  const body = await readBody(event);
  const parsed = updateTechnicalVisitSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  }

  try {
    const updates: Record<string, any> = {};
    if (parsed.data.address !== undefined) updates.address = parsed.data.address;
    if (parsed.data.institutionId !== undefined)
      updates.institutionId = parsed.data.institutionId;
    if (parsed.data.location !== undefined)
      updates.location = parsed.data.location;
    if (parsed.data.visitDate !== undefined)
      updates.visitDate = new Date(parsed.data.visitDate);
    if (parsed.data.outcome !== undefined) updates.outcome = parsed.data.outcome;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

    const visit = await updateTechnicalVisit(
      bloodBanksLocationId,
      visitId,
      updates
    );

    if (!visit) {
      throw createError({
        statusCode: 404,
        statusMessage: "Technical visit not found",
      });
    }

    return {
      success: true,
      data: visit,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("Error updating technical visit:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to update technical visit",
    });
  }
});
