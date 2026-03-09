import { getCollectionRequestPublic } from "~/server/services/collectionRequest";

export default defineEventHandler(async (event) => {
  const requestId = getRouterParam(event, "requestId");

  if (!requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request ID is required",
    });
  }

  const request = await getCollectionRequestPublic(requestId);

  if (!request) {
    throw createError({
      statusCode: 404,
      statusMessage: "Collection request not found",
    });
  }

  return {
    success: true,
    data: request,
  };
});
