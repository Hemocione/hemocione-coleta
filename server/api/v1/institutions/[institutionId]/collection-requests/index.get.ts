import {
  assertUserAccessToInstitutionId,
  useHemocioneUserAuth,
} from "~/server/services/auth";
import { getCollectionRequestsByInstitution } from "~/server/services/collectionRequest";

export default defineEventHandler(async (event) => {
  try {
    const institutionId = getRouterParam(event, "institutionId");

    if (!institutionId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Institution ID is required",
      });
    }

    const user = useHemocioneUserAuth(event);
    assertUserAccessToInstitutionId(user, institutionId);

    // Get query parameters
    const query = getQuery(event);
    const status = query.status as string;
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;

    // Get collection requests
    const result = await getCollectionRequestsByInstitution(
      institutionId,
      { ...(status && { status }) },
      { page, limit }
    );

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  } catch (error: any) {
    console.error("Error fetching institution collection requests:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Internal server error",
    });
  }
});
