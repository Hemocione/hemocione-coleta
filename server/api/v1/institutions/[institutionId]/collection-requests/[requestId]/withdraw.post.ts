import { withdrawCollectionRequest } from "~/server/services/collectionRequest";
import { collectionRequest } from "~/server/models";
import { getUserInstitutions } from "~/server/services/hemocioneId";

const { CollectionRequest } = collectionRequest;

export default defineEventHandler(async (event) => {
  try {
    const institutionId = getRouterParam(event, "institutionId");
    const requestId = getRouterParam(event, "requestId");

    if (!institutionId || !requestId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Institution ID and Request ID are required",
      });
    }

    const token = event.context.auth?.token;
    if (!token) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    const institutions = await getUserInstitutions(token);
    if (!institutions.some((institution) => institution.id === institutionId)) {
      throw createError({
        statusCode: 403,
        statusMessage: "User does not have access to this institution",
      });
    }

    const request = await CollectionRequest.findOne({
      _id: requestId,
      institutionId,
      deletedAt: null,
    }).lean();

    if (!request) {
      throw createError({
        statusCode: 404,
        statusMessage: "Collection request not found for this institution",
      });
    }

    if (request.status !== "pending") {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Apenas solicitações pendentes podem ser retiradas pela instituição",
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
      event.context.auth.user.id,
      reason
    );

    return {
      success: true,
      data: updatedRequest,
      message: "Solicitação retirada com sucesso",
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
