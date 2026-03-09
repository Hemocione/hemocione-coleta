import { withdrawCollectionRequest } from "~/server/services/collectionRequest";
import { collectionRequest } from "~/server/models";

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

    // Verify the request belongs to this institution
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

    const withdrawnByUserId = event.context.auth.user.id;

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
      withdrawnByUserId,
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
