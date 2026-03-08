import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { updateCommitmentTermSettings } from "~/server/services/bloodBank";

const updateSettingsSchema = z.object({
  commitmentTermTemplate: z.string().max(10000).nullish(),
  autoGenerateCommitmentTerm: z.boolean().optional(),
});

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

  const body = await readBody(event);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request body",
      data: parsed.error.issues,
    });
  }

  const settings = await updateCommitmentTermSettings(
    selectedBloodBanksLocationId,
    parsed.data
  );

  return {
    success: true,
    data: settings,
  };
});
