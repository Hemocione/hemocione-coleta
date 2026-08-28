import { z } from "zod";

export const ONDEDOAR_BLOOD_BANK_RADIUS_KM = 50;
const EARTH_RADIUS_METERS = 6_371_000;
const uuidSchema = z.string().uuid();

export interface OndeDoarBloodBank {
  bloodBanksLocationId: string;
  name: string;
  origin: "ondedoar";
  distanceMeters: number;
}

export interface OndeDoarBloodBankLocation {
  bloodBanksLocationId: string;
  name: string;
  origin: "ondedoar";
}

interface OndeDoarPoint {
  id?: unknown;
  bloodBanksLocationId?: unknown;
  name?: unknown;
  displayName?: unknown;
  type?: unknown;
  loc?: { coordinates?: unknown };
}

function haversineDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normaliseBloodBanksLocationId(point: OndeDoarPoint) {
  // OndeDoar receives Hemocione ID's bloodBanksLocations.id as point.id.
  if (
    point.id !== undefined &&
    point.bloodBanksLocationId !== undefined &&
    point.id !== point.bloodBanksLocationId
  ) {
    return null;
  }
  const providerId = point.bloodBanksLocationId ?? point.id;
  const result = uuidSchema.safeParse(providerId);
  return result.success ? result.data : null;
}

function getCoordinates(point: OndeDoarPoint) {
  if (!Array.isArray(point.loc?.coordinates) || point.loc.coordinates.length !== 2) {
    return null;
  }

  const [longitude, latitude] = point.loc.coordinates;
  if (
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return { longitude, latitude };
}

async function fetchOndeDoarPoints(): Promise<OndeDoarPoint[] | null> {
  const configuredUrl = useRuntimeConfig().ondedoarApiUrl?.trim();
  if (!configuredUrl) return [];

  let response: unknown;
  try {
    response = await $fetch(`${configuredUrl.replace(/\/$/, "")}/api/v1/points`, {
      method: "GET",
    });
  } catch {
    console.warn("[ondedoar] blood bank source unavailable");
    return null;
  }

  const points = Array.isArray(response)
    ? response
    : response && typeof response === "object" && "data" in response
      ? (response as { data: unknown }).data
      : [];
  return Array.isArray(points) ? points : [];
}

function getBloodBankLocation(point: OndeDoarPoint): OndeDoarBloodBankLocation | null {
  if (!point || typeof point !== "object") return null;
  if (point.type !== "bloodbank") return null;
  const bloodBanksLocationId = normaliseBloodBanksLocationId(point);
  const name =
    typeof point.displayName === "string"
      ? point.displayName.trim()
      : typeof point.name === "string"
        ? point.name.trim()
        : "";
  if (!bloodBanksLocationId || !name || name.length > 200) return null;
  return { bloodBanksLocationId, name, origin: "ondedoar" };
}

export async function getOndeDoarBloodBankByLocationId(
  bloodBanksLocationId: string,
): Promise<OndeDoarBloodBankLocation | null> {
  const points = await fetchOndeDoarPoints();
  if (!points) return null;

  return (
    points
      .filter(
        (point): point is OndeDoarPoint =>
          Boolean(point) && typeof point === "object",
      )
      .map(getBloodBankLocation)
      .find((point) => point?.bloodBanksLocationId === bloodBanksLocationId) ||
    null
  );
}

export async function getNearbyOndeDoarBloodBanks(
  latitude: number,
  longitude: number,
): Promise<OndeDoarBloodBank[]> {
  const points = await fetchOndeDoarPoints();
  if (!points) return [];

  const maxDistanceMeters = ONDEDOAR_BLOOD_BANK_RADIUS_KM * 1000;
  return points
    .filter((point): point is OndeDoarPoint => {
      return (
        Boolean(point) &&
        typeof point === "object" &&
        (point as OndeDoarPoint).type === "bloodbank"
      );
    })
    .map((point) => {
      const location = getBloodBankLocation(point);
      const coordinates = getCoordinates(point);
      if (!location || !coordinates) return null;

      const distanceMeters = haversineDistanceMeters(
        latitude,
        longitude,
        coordinates.latitude,
        coordinates.longitude,
      );
      if (distanceMeters > maxDistanceMeters) return null;

      return {
        bloodBanksLocationId: location.bloodBanksLocationId,
        name: location.name,
        origin: "ondedoar" as const,
        distanceMeters,
      };
    })
    .filter((point): point is OndeDoarBloodBank => point !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
