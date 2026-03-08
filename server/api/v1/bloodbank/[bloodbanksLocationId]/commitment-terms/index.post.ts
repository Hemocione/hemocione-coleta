import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import {
  createCommitmentTerm,
  getTemplateForBloodBank,
  renderTemplate,
} from "~/server/services/commitmentTerm";

const createCommitmentTermSchema = z.object({
  collectionRequestId: z.string().nullish(),
  technicalVisitId: z.string().nullish(),
  sentTo: z.string().min(1).max(200),
  templateParams: z.record(z.string(), z.string()).optional(),
  customContent: z.string().max(20000).nullish(),
  status: z.enum(["draft", "sent"]).optional().default("draft"),
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
  const parsed = createCommitmentTermSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  }

  try {
    let generatedContent: string;

    if (parsed.data.customContent) {
      generatedContent = parsed.data.customContent;
    } else {
      const template = await getTemplateForBloodBank(bloodBanksLocationId);
      generatedContent = renderTemplate(
        template,
        parsed.data.templateParams || {}
      );
    }

    const term = await createCommitmentTerm({
      bloodBanksLocationId,
      collectionRequestId: parsed.data.collectionRequestId ?? undefined,
      technicalVisitId: parsed.data.technicalVisitId ?? undefined,
      generatedContent,
      sentTo: parsed.data.sentTo,
      status: parsed.data.status,
    });

    return {
      success: true,
      data: term,
    };
  } catch (error: any) {
    console.error("Error creating commitment term:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create commitment term",
    });
  }
});
