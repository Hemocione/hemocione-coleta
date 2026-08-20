import { assertSecretAuth } from "~/server/services/auth";
import { getCollectionRequests } from "~/server/services/collectionRequest";

export default defineEventHandler(async (event) => {
  // Keep backoffice authentication outside the business-error handler.
  assertSecretAuth(event);

  try {
    const query = getQuery(event);
    const institutionId = query.institutionId as string;
    const bloodBanksLocationId = query.bloodBanksLocationId as string;
    const status = query.status as string;
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;

    const result = await getCollectionRequests(
      {
        ...(institutionId && { institutionId }),
        ...(bloodBanksLocationId && { bloodBanksLocationId }),
        ...(status && { status }),
      },
      { page, limit }
    );

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  } catch (error: any) {
    console.error("Error fetching collection requests:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
