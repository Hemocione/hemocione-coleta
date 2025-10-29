import { currentUserTokenDecoder } from "~/utils/currentUserTokenDecoder";
import { getBloodBanksByBloodBanksLocationIds } from "./bloodBank";

interface BloodBankRole {
  bloodBanksLocationId: string;
  role: "admin" | "staff";
}

interface Me {
  id: string;
  givenName: string;
  surName: string;
  bloodType: string;
  email: string;
  phone: string;
  document: string;
  birthDate: string;
  bloodBankRoles: BloodBankRole[];
}

interface EnrichedBloodBankRole extends BloodBankRole {
  slug: string;
  active: boolean;
  name: string;
  logo: string | null;
}

export interface EnrichedMe extends Me {
  bloodBankRoles: EnrichedBloodBankRole[];
}

// Institution interfaces
export interface Institution {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  logo?: string;
  banner?: string;
  status: "pending" | "validated" | "rejected";
}

export interface InstitutionListResponseItem {
  institution: Institution;
}
export type InstitutionListResponse = InstitutionListResponseItem[];

export interface CreateInstitutionPayload {
  name: string;
  legalName: string;
  document: string;
  kind: string;
  address: string;
  phone: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
}

export async function getMe(token: string): Promise<EnrichedMe> {
  const config = useRuntimeConfig();

  const userData = await $fetch<Me>(
    `${config.public.hemocioneIdApiUrl}/users/me`,
    {
      method: "GET",
      headers: {
        Authorization: token.startsWith("Bearer") ? token : `Bearer ${token}`,
      },
    }
  );

  // Get blood bank roles from JWT token since /me API doesn't return them
  const jwtUserData = currentUserTokenDecoder(token);

  const localBloodBanks = await getBloodBanksByBloodBanksLocationIds(
    jwtUserData?.bloodBankRoles?.map((role) => role.bloodBanksLocationId) || []
  );

  const enrichedBloodBankRoles: EnrichedBloodBankRole[] = localBloodBanks
    .map((bloodBank) => {
      const bloodBankRole = jwtUserData?.bloodBankRoles?.find(
        (role) =>
          role.bloodBanksLocationId.toString() ===
          bloodBank.bloodBanksLocationId.toString()
      );

      if (!bloodBankRole) {
        return null;
      }

      return {
        bloodBanksLocationId: bloodBank.bloodBanksLocationId.toString(),
        role: bloodBankRole.role,
        slug: bloodBank.slug,
        active: bloodBank.active,
        name: bloodBank.name,
        logo: bloodBank.logo ?? null,
      };
    })
    .filter((role): role is EnrichedBloodBankRole => role !== null);

  const result = Object.assign(userData, {
    bloodBankRoles: enrichedBloodBankRoles,
  });

  return result;
}

export async function getInstitutionsByIds(
  institutionIds: string[]
): Promise<Institution[]> {
  const config = useRuntimeConfig();

  const response = await $fetch<InstitutionListResponse>(
    `${config.public.hemocioneIdApiUrl}/backoffice/institutions`,
    {
      method: "POST",
      headers: {
        "x-secret": config.hemocioneIdIntegrationSecret,
        "Content-Type": "application/json",
      },
      body: {
        institutionIds,
      },
    }
  );

  // TODO: fix this type system
  return (response as unknown as { institutions: Institution[] }).institutions;
}

export async function createInstitution(
  token: string,
  payload: CreateInstitutionPayload
): Promise<Institution> {
  const config = useRuntimeConfig();
  const response = await $fetch<{ message: string; institution: Institution }>(
    `${config.public.hemocioneIdApiUrl}/institutions`,
    {
      method: "POST",
      headers: {
        Authorization: token.startsWith("Bearer") ? token : `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: payload,
    }
  );
  return response.institution;
}

export async function getUserInstitutions(
  token: string
): Promise<Institution[]> {
  const config = useRuntimeConfig();
  const response = await $fetch<InstitutionListResponse>(
    `${config.public.hemocioneIdApiUrl}/users/me/institutions`,
    {
      method: "GET",
      headers: {
        Authorization: token.startsWith("Bearer") ? token : `Bearer ${token}`,
      },
    }
  );
  const institutions = response?.map((data) => data.institution) || [];
  return institutions;
}
