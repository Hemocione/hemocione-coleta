import type { H3Event } from "h3";
import { verifyAndReturnData } from "./jwt";
const config = useRuntimeConfig();

export interface BloodBankRole {
  bloodBanksLocationId: string;
  role: "admin" | "staff";
}

export function assertSecretAuth(event: H3Event) {
  const headers = event.headers;
  const secret = headers.get("x-secret");

  if (secret !== config.secret) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }
}

const BLOODTYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOODTYPES)[number];

const GENDERS = ["M", "F", "O"] as const;
export type Gender = (typeof GENDERS)[number];

export interface HemocioneUserAuthTokenData {
  id: string;
  givenName: string;
  surName: string;
  bloodType: BloodType;
  email: string;
  phone: string;
  document: string;
  gender: Gender;
  bloodBankRoles: BloodBankRole[];
}

export function useHemocioneUserAuth(event: H3Event) {
  const headers = event.headers;
  const token = headers.get("Authorization")?.replace("Bearer", "").trim();
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized - Missing Token",
    });
  }

  try {
    const hemocioneUser =
      verifyAndReturnData<HemocioneUserAuthTokenData>(token);
    return hemocioneUser;
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized - Invalid Token",
    });
  }
}

export function assertHemocioneIdIntegrationSecret(event: H3Event) {
  const headers = event.headers;
  const secret = headers.get("x-hemocione-integration-secret");
  if (secret !== config.hemocioneIdIntegrationSecret) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }
}

export function assertUserAccessToBloodBanksLocationId(
  user: HemocioneUserAuthTokenData,
  bloodBankLocationId: string,
  neededRoles?: BloodBankRole["role"][]
) {
  if (!user.bloodBankRoles.length) {
    throw createError({
      statusCode: 403,
      statusMessage: "User does not have access to any bloodbank",
    });
  }
  if (
    !user.bloodBankRoles.some(
      (role) => role.bloodBanksLocationId === bloodBankLocationId
    )
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "User does not have access to this bloodbank",
    });
  }

  if (
    neededRoles?.length &&
    !neededRoles.some((role) =>
      user.bloodBankRoles.some((r) => r.role === role)
    )
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "User does not have the required roles",
    });
  }
}

export function useHemocioneUserAuthOrHemocioneIdIntegrationSecret(
  event: H3Event
) {
  try {
    return useHemocioneUserAuth(event);
  } catch (e) {
    assertHemocioneIdIntegrationSecret(event);
  }
}
