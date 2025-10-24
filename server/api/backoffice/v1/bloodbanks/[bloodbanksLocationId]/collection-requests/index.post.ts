import { z } from "zod";
import { createCollectionRequest } from "~/server/services/collectionRequest";
import { assertSecretAuth } from "~/server/services/auth";

const bodySchema = z.object({
  institutionId: z.uuid("institutionId deve ser um UUID válido"),
  requestedByUserId: z.uuid("requestedByUserId deve ser um UUID válido"),
  requestedDates: z
    .array(
      z.object({
        availableDateId: z
          .string()
          .regex(
            /^[0-9a-fA-F]{24}$/,
            "availableDateId deve ser um ObjectId válido"
          ),
        slotIds: z
          .array(
            z
              .string()
              .regex(/^[0-9a-fA-F]{24}$/, "slotId deve ser um ObjectId válido")
          )
          .optional(),
      })
    )
    .min(1, "Pelo menos uma data deve ser solicitada")
    .max(3, "Máximo de 3 datas podem ser solicitadas"),
});

export default defineEventHandler(async (event) => {
  try {
    // Get bloodBanksLocationId from route params
    const bloodBanksLocationId = getRouterParam(event, "bloodbanksLocationId");

    if (!bloodBanksLocationId) {
      throw createError({
        statusCode: 400,
        statusMessage: "bloodBanksLocationId é obrigatório",
      });
    }

    // Validate UUID format for bloodBanksLocationId
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bloodBanksLocationId)) {
      throw createError({
        statusCode: 400,
        statusMessage: "bloodBanksLocationId deve ser um UUID válido",
      });
    }

    // Validate request body
    const validatedData = await readValidatedBody(event, bodySchema.parse);

    // Create collection request
    const collectionRequest = await createCollectionRequest(
      bloodBanksLocationId,
      {
        institutionId: validatedData.institutionId,
        requestedByUserId: validatedData.requestedByUserId,
        requestedDates: validatedData.requestedDates,
      }
    );

    return {
      success: true,
      data: collectionRequest,
    };
  } catch (error: any) {
    console.error("Error creating collection request:", error);

    // Handle validation errors
    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos",
        data: error.errors,
      });
    }

    // Handle business logic errors
    if (error.message === "Blood bank not found") {
      throw createError({
        statusCode: 404,
        statusMessage: "Banco de sangue não encontrado",
      });
    }

    if (
      error.message ===
      "One or more requested dates are invalid or don't belong to this blood bank"
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Uma ou mais datas solicitadas são inválidas ou não pertencem a este banco de sangue",
      });
    }

    if (error.message === "Failed to retrieve created request") {
      throw createError({
        statusCode: 500,
        statusMessage: "Erro ao recuperar solicitação criada",
      });
    }

    // Handle other errors
    throw error;
  }
});
