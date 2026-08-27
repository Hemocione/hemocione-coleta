import { getInstitutionProfile } from "~/server/services/hemocioneId";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  const token = event.context.auth?.token;
  const institutionId = getRouterParam(event, "institutionId");
  if (!token || !institutionId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (!z.string().uuid().safeParse(institutionId).success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid institution ID" });
  }

  let institution;
  try {
    institution = await getInstitutionProfile(token, institutionId);
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.response?.status;
    if ([400, 401, 403, 404].includes(statusCode)) {
      throw createError({
        statusCode,
        statusMessage: error?.data?.statusMessage || error?.message,
      });
    }
    throw error;
  }
  return { institution };
});
