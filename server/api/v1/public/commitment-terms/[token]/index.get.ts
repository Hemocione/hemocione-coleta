import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import {
  getCommitmentTermByToken,
  renderTemplate,
} from "~/server/services/commitmentTerm";

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Token is required",
    });
  }

  const term = await getCommitmentTermByToken(token);

  if (!term) {
    throw createError({
      statusCode: 404,
      statusMessage: "Commitment term not found",
    });
  }

  const bloodBank = await getBloodBankByBloodBanksLocationId(
    term.bloodBanksLocationId.toString()
  );

  return {
    success: true,
    data: {
      generatedContent: renderTemplate(term.generatedContent, {
        bloodBankName: bloodBank?.name || "",
      }),
      status: term.status,
      sentAt: term.sentAt,
      signedByName: term.signedByName ?? null,
      signedAt: term.signedAt ?? null,
      acknowledgedAt: term.acknowledgedAt,
      createdAt: term.createdAt,
    },
  };
});
