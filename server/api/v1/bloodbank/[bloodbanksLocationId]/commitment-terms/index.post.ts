import { z } from "zod";
import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import {
  createCommitmentTerm,
  getTemplateForBloodBank,
  renderTemplate,
} from "~/server/services/commitmentTerm";
import { sendWhatsAppNotificationToPhone } from "~/server/services/notification";
import { buildPublicUrl } from "~/utils/publicUrl";

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
    const bloodBank = await getBloodBankByBloodBanksLocationId(
      bloodBanksLocationId
    );
    let generatedContent: string;

    if (parsed.data.customContent) {
      generatedContent = parsed.data.customContent;
    } else {
      const template = await getTemplateForBloodBank(bloodBanksLocationId);
      generatedContent = renderTemplate(
        template,
        {
          ...(parsed.data.templateParams || {}),
          bloodBankName: bloodBank?.name || "Banco de sangue",
        }
      );
    }

    const term = await createCommitmentTerm({
      bloodBanksLocationId,
      collectionRequestId: parsed.data.collectionRequestId ?? undefined,
      technicalVisitId: parsed.data.technicalVisitId ?? undefined,
      generatedContent,
      sentTo: parsed.data.sentTo,
      signedByName:
        [user.givenName, user.surName].filter(Boolean).join(" ") ||
        user.email,
      signedAt: new Date(),
      status: parsed.data.status,
    });

    if (parsed.data.status === "sent" && parsed.data.sentTo) {
      try {
        const termUrl = buildPublicUrl(`/termo/${term.accessToken}`);

        await sendWhatsAppNotificationToPhone({
          phone: parsed.data.sentTo,
          templateName: "commitment_term_generated",
          params: {
            bloodBankName: bloodBank?.name || "Banco de sangue",
            termUrl,
            hostName: parsed.data.templateParams?.hostName || "",
          },
        });
      } catch (err) {
        console.error(
          "[commitment-term] Failed to send WhatsApp notification:",
          err
        );
      }
    }

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
