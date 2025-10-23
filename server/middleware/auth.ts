import { useHemocioneUserAuth, assertSecretAuth } from "~/server/services/auth";

export default defineEventHandler((event) => {
  // only run this for API routes
  if (!event.path.startsWith("/api/v1")) {
    return;
  }

  if (event.path.startsWith("/api/backoffice")) {
    return assertSecretAuth(event);
  }

  const token = event.headers
    .get("Authorization")
    ?.replace("Bearer", "")
    .trim();
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized - Missing Token",
    });
  }

  const user = useHemocioneUserAuth(event);
  if (!user.bloodBankRoles.length) {
    throw createError({
      statusCode: 401,
      statusMessage: "User does not have any blood bank roles",
    });
  }

  event.context.auth = {
    token,
    user,
  };
});
