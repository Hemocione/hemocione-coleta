import { getCollectionRequestPublicByToken } from "~/server/services/collectionRequest";

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Token is required",
    });
  }

  const request = await getCollectionRequestPublicByToken(token);

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
