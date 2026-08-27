import { setResponseHeader } from "h3";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import {
  getCommitmentTermByToken,
  renderTemplate,
} from "~/server/services/commitmentTerm";
import { createCommitmentTermPdf } from "~/server/utils/commitmentTermPdf";

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

  setResponseHeader(event, "content-type", "application/pdf");
  setResponseHeader(
    event,
    "content-disposition",
    'attachment; filename="termo-de-compromisso.pdf"'
  );

  return createCommitmentTermPdf(
    renderTemplate(term.generatedContent, {
      bloodBankName: bloodBank?.name || "",
    })
  );
});
