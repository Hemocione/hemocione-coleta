import {
  cancelCollectionRequestByInstitution,
  getCollectionRequestIdByToken,
} from "~/server/services/collectionRequest";
import { useHemocioneUserAuth } from "~/server/services/auth";

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: "Token is required" });
  }

  const authToken = event.headers
    .get("Authorization")
    ?.replace("Bearer", "")
    .trim();
  if (!authToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required to cancel a request",
    });
  }

  const user = useHemocioneUserAuth(event);
  const requestInfo = await getCollectionRequestIdByToken(token);
  if (!requestInfo) {
    throw createError({ statusCode: 404, statusMessage: "Solicitacao nao encontrada" });
  }
  if (requestInfo.requestedByUserId !== user.id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Voce nao tem permissao para cancelar esta solicitacao",
    });
  }

  const body = await readBody(event);
  const reason = body?.reason?.trim() || undefined;
  if (reason && reason.length > 1000) {
    throw createError({
      statusCode: 400,
      statusMessage: "Reason must be at most 1000 characters",
    });
  }

  let updatedRequest;
  try {
    updatedRequest = await cancelCollectionRequestByInstitution(
      requestInfo.requestId,
      user.id,
      reason
    );
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 400,
      statusMessage: error.message || "Não foi possível cancelar a solicitação",
    });
  }

  return {
    success: true,
    data: updatedRequest,
    message: "Solicitacao cancelada com sucesso",
  };
});
