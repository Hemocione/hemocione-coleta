import { assertUserAccessToBloodBanksLocationId } from "~/server/services/auth";
import { getTechnicalVisitsByBloodBank } from "~/server/services/technicalVisit";

export default defineEventHandler(async (event) => {
  const user = event.context.auth.user;
  const bloodBanksLocationId = getRouterParam(
    event,
    "bloodbanksLocationId"
  );

  if (!bloodBanksLocationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bloodbank location ID is required",
    });
  }

  assertUserAccessToBloodBanksLocationId(user, bloodBanksLocationId);

  const query = getQuery(event);
  const outcome = query.outcome as string | undefined;
  const institutionId = query.institutionId as string | undefined;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 20;

  try {
    const result = await getTechnicalVisitsByBloodBank(
      bloodBanksLocationId,
      {
        ...(outcome && { outcome }),
        ...(institutionId && { institutionId }),
      },
      { page, limit }
    );

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  } catch (error: any) {
    console.error("Error fetching technical visits:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch technical visits",
    });
  }
});
