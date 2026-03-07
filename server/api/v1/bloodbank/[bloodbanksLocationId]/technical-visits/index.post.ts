import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { createTechnicalVisit } from "~/server/services/technicalVisit";

const createTechnicalVisitSchema = z.object({
  institutionId: z.string().uuid().nullish(),
  address: z.string().min(1).max(500),
  location: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .nullish(),
  visitDate: z.string().datetime({ offset: true }).or(z.string().date()),
  outcome: z.enum(["approved", "rejected", "pending"]),
  notes: z.string().max(2000).nullish(),
});

export default defineEventHandler(async (event) => {
  const user = event.context.auth.user;
  const bloodBanksLocationId = getRouterParam(
    event,
    "bloodbanksLocationId"
  );

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID is required",
    });
  }

  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  const body = await readBody(event);
  const parsed = createTechnicalVisitSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  }

  try {
    const visit = await createTechnicalVisit({
      bloodBanksLocationId,
      institutionId: parsed.data.institutionId ?? undefined,
      address: parsed.data.address,
      location: parsed.data.location ?? undefined,
      visitDate: new Date(parsed.data.visitDate),
      outcome: parsed.data.outcome,
      notes: parsed.data.notes ?? undefined,
      visitedBy: user.id,
    });

    return {
      success: true,
      data: visit,
    };
  } catch (error: any) {
    console.error("Error creating technical visit:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create technical visit",
    });
  }
});
