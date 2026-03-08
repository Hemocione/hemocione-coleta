import { acknowledgeCommitmentTerm } from "~/server/services/commitmentTerm";

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Token is required",
    });
  }

  const term = await acknowledgeCommitmentTerm(token);

  if (!term) {
    throw createError({
      statusCode: 404,
      statusMessage:
        "Commitment term not found or already acknowledged",
    });
  }

  return {
    success: true,
    data: {
      _id: term._id,
      status: term.status,
      acknowledgedAt: term.acknowledgedAt,
    },
  };
});
