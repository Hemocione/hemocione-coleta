import { z } from "zod";
import { createBloodBank } from "~/server/services/bloodBank";
import { assertSecretAuth } from "~/server/services/auth";

const bodySchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  logo: z.string().url("Logo deve ser uma URL válida").optional(),
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens"
    )
    .max(50, "Slug deve ter no máximo 50 caracteres")
    .optional(),
  bloodBanksLocationId: z.uuid("bloodBanksLocationId deve ser um UUID válido"),
  timezone: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  try {
    // Validate request body
    const body = await readBody(event);
    const validatedData = bodySchema.parse(body);

    // Create blood bank
    const bloodBank = await createBloodBank({
      name: validatedData.name,
      logo: validatedData.logo,
      slug: validatedData.slug,
      bloodBanksLocationId: validatedData.bloodBanksLocationId,
      timezone: validatedData.timezone,
    });

    return {
      success: true,
      data: {
        id: bloodBank._id,
        name: bloodBank.name,
        slug: bloodBank.slug,
        bloodBanksLocationId: bloodBank.bloodBanksLocationId,
        logo: bloodBank.logo,
        timezone: bloodBank.timezone,
        active: bloodBank.active,
        createdAt: bloodBank.createdAt,
        updatedAt: bloodBank.updatedAt,
      },
    };
  } catch (error: any) {
    console.error("Error creating blood bank:", error);

    // Handle validation errors
    if (error.name === "ZodError") {
      throw createError({
        statusCode: 400,
        statusMessage: "Dados inválidos",
        data: error.errors,
      });
    }

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = "Dados duplicados";

      if (field === "slug") {
        message = "Slug já existe";
      } else if (field === "bloodBanksLocationId") {
        message = "ID de localização já existe";
      }

      throw createError({
        statusCode: 409,
        statusMessage: message,
      });
    }

    // Handle other errors
    throw createError({
      statusCode: 500,
      statusMessage: "Erro interno do servidor",
    });
  }
});
