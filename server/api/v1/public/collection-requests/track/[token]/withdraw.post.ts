import { getCollectionRequestIdByToken, withdrawCollectionRequest } from "~/server/services/collectionRequest";
import { useHemocioneUserAuth } from "~/server/services/auth";

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
      statusMessage: "Authentication required to withdraw a request",
    });
  }

  const user = useHemocioneUserAuth(event);
  const userId = user.id;

  const requestInfo = await getCollectionRequestIdByToken(token);

  if (!requestInfo) {
    throw createError({
      statusCode: 404,
      statusMessage: "Solicitacao nao encontrada",
    });
  }

  if (requestInfo.requestedByUserId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Voce nao tem permissao para retirar esta solicitacao",
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

  const updatedRequest = await withdrawCollectionRequest(
    requestInfo.requestId,
    userId,
    reason
  );

  return {
    success: true,
    data: updatedRequest,
    message: "Solicitacao retirada com sucesso",
  };
});
