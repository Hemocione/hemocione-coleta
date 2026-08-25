import { z } from "zod";
import {
  getCollectionRequestIdByToken,
  respondToTechnicalVisitProposal,
} from "~/server/services/collectionRequest";
import { useHemocioneUserAuth } from "~/server/services/auth";

const bodySchema = z.object({
  decision: z.enum(["accepted", "declined"]),
  selectedDateId: z.string(),
});

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Token is required",
    });
  }

  const authToken = event.headers
    .get("Authorization")
    ?.replace("Bearer", "")
    .trim();

  if (!authToken) {
    throw createError({
      statusCode: 401,
      statusMessage:
        "Authentication required to respond to a technical visit proposal",
    });
  }

  const user = useHemocioneUserAuth(event);
  const userId = user.id;

  const requestInfo = await getCollectionRequestIdByToken(token);

  if (!requestInfo) {
    throw createError({
      statusCode: 404,
      statusMessage: "Solicitação não encontrada",
    });
  }

  if (requestInfo.requestedByUserId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage:
        "Você não tem permissão para responder a esta solicitação",
    });
  }

  const parsed = bodySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Dados inválidos para responder à proposta de visita técnica",
    });
  }

  try {
    const updatedRequest = await respondToTechnicalVisitProposal(
      requestInfo.requestId,
      {
        decision: parsed.data.decision,
        selectedDateId: parsed.data.selectedDateId,
        respondedBy: userId,
      }
    );

    return {
      success: true,
      data: updatedRequest,
      message: "Proposta de visita técnica respondida com sucesso",
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 400,
      statusMessage:
        error.message || "Não foi possível responder à proposta de visita técnica",
    });
  }
});
