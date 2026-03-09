import { getCommitmentTermByToken } from "~/server/services/commitmentTerm";

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Token is required",
    });
  }

  const term = await getCommitmentTermByToken(token);

  if (!term) {
    throw createError({
      statusCode: 404,
      statusMessage: "Commitment term not found",
    });
  }

  return {
    success: true,
    data: {
      _id: term._id,
      generatedContent: term.generatedContent,
      status: term.status,
      sentAt: term.sentAt,
      acknowledgedAt: term.acknowledgedAt,
      createdAt: term.createdAt,
    },
  };
});
