import { withdrawCollectionRequest } from "~/server/services/collectionRequest";
import { collectionRequest } from "~/server/models";
import { useHemocioneUserAuth } from "~/server/services/auth";

const { CollectionRequest } = collectionRequest;

export default defineEventHandler(async (event) => {
  const requestId = getRouterParam(event, "requestId");

  if (!requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request ID is required",
    });
  }

  // This is a public route but requires authentication for withdraw
  const token = event.headers
    .get("Authorization")
    ?.replace("Bearer", "")
    .trim();

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required to withdraw a request",
    });
  }

  const user = useHemocioneUserAuth(event);
  const userId = user.id;

  // Verify the request exists and was created by this user
  const request = await CollectionRequest.findOne({
    _id: requestId,
    requestedByUserId: userId,
    status: "pending",
    deletedAt: null,
  }).lean();

  if (!request) {
    throw createError({
      statusCode: 404,
      statusMessage:
        "Solicitação não encontrada ou você não tem permissão para retirá-la",
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
    requestId,
    userId,
    reason
  );

  return {
    success: true,
    data: updatedRequest,
    message: "Solicitação retirada com sucesso",
  };
});
