import { getUserInstitutions } from "~/server/services/hemocioneId";

export default defineEventHandler(async (event) => {
  const token = event.context.auth?.token;
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const institutions = await getUserInstitutions(token);
  return { institutions };
});
