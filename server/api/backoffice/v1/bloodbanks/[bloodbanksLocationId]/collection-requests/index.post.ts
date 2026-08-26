import { z } from "zod";
import { createCollectionRequest } from "~/server/services/collectionRequest";
import { assertSecretAuth } from "~/server/services/auth";

const hostSchema = z.object({
  name: z.string().min(1, "Nome do ponto focal é obrigatório").max(200),
  email: z.string().email("Email do ponto focal deve ser válido"),
  phone: z.string().min(1, "Telefone do ponto focal é obrigatório").max(20),
});

const addressSchema = z.object({
  street: z.string().min(1, "Rua é obrigatória").max(300),
  number: z.string().min(1, "Número é obrigatório").max(20),
  complement: z.string().max(200).optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório").max(200),
  city: z.string().min(1, "Cidade é obrigatória").max(200),
  state: z.string().min(2, "Estado é obrigatório").max(2),
  zipCode: z.string().min(8, "CEP é obrigatório").max(10),
});

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
        priority: z
          .number()
          .int("priority deve ser um número inteiro")
          .min(1, "priority deve ser entre 1 e 3")
          .max(3, "priority deve ser entre 1 e 3")
          .optional(),
      })
    )
    .min(1, "Pelo menos uma data deve ser solicitada")
    .max(3, "Máximo de 3 datas podem ser solicitadas"),
  host: hostSchema,
  address: addressSchema.optional(),
});

export default defineEventHandler(async (event) => {
  // Fora do try por simetria com a outra rota de backoffice e para que a recusa
  // por credencial nao passe pelo tratamento de erro de negocio abaixo.
  assertSecretAuth(event);

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
        host: validatedData.host,
        address: validatedData.address,
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
