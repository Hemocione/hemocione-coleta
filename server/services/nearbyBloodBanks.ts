import { z } from "zod";
import { bloodBank } from "~/server/models";
import { getNearbyOndeDoarBloodBanks } from "~/server/services/ondeDoar";

const { BloodBank } = bloodBank;
const EARTH_RADIUS_METERS = 6_371_000;

export type NearbyBloodBankAvailability = "active" | "inactive" | "missing";

export interface NearbyBloodBank {
  _id?: string;
  name: string;
  slug: string | null;
  logo: string | null;
  bloodBanksLocationId: string;
  distanceMeters?: number;
  availability: NearbyBloodBankAvailability;
  origin: "coleta" | "ondedoar";
}

const coordinateSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export function parseNearbyCoordinates(query: unknown) {
  const asNumber = (value: unknown) =>
    typeof value === "string"
      ? value.trim() === ""
        ? Number.NaN
        : Number(value)
      : value;
  const result = z
    .object({
      lat: z.preprocess(asNumber, z.number()),
      lng: z.preprocess(asNumber, z.number()),
    })
    .pipe(coordinateSchema)
    .safeParse(query);

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid latitude or longitude",
    });
  }
  return result.data;
}

function asString(value: unknown) {
  return value?.toString?.() || "";
}

function distanceMeters(
  latitude: number,
  longitude: number,
  coordinates: unknown,
) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return undefined;
  const [bankLongitude, bankLatitude] = coordinates;
  if (
    typeof bankLongitude !== "number" ||
    typeof bankLatitude !== "number" ||
    !Number.isFinite(bankLongitude) ||
    !Number.isFinite(bankLatitude)
  ) {
    return undefined;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(bankLatitude - latitude);
  const longitudeDelta = toRadians(bankLongitude - longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(bankLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapLocalBank(
  bank: any,
  latitude: number,
  longitude: number,
  availability: NearbyBloodBankAvailability,
  fallbackDistanceMeters?: number,
): NearbyBloodBank {
  const localDistanceMeters = distanceMeters(
    latitude,
    longitude,
    bank.location?.coordinates,
  );
  return {
    _id: asString(bank._id) || undefined,
    name: bank.name,
    slug: availability === "active" ? bank.slug || null : null,
    logo: bank.logo ?? null,
    bloodBanksLocationId: asString(bank.bloodBanksLocationId),
    distanceMeters: localDistanceMeters ?? fallbackDistanceMeters,
    availability,
    origin: "coleta",
  };
}

export async function getNearbyBloodBanks(
  latitude: number,
  longitude: number,
): Promise<NearbyBloodBank[]> {
  const [localBanks, ondeDoarBanks] = await Promise.all([
    BloodBank.find(
      {
        active: true,
        hidden: { $ne: true },
        coverageArea: {
          $geoIntersects: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          },
        },
      },
      {
        name: 1,
        slug: 1,
        logo: 1,
        bloodBanksLocationId: 1,
        location: 1,
        active: 1,
        hidden: 1,
      },
    )
      .lean()
      .exec(),
    getNearbyOndeDoarBloodBanks(latitude, longitude),
  ]);

  const externalIds = [...new Set(ondeDoarBanks.map((bank) => bank.bloodBanksLocationId))];
  const localByExternalId = new Map<string, any>();
  if (externalIds.length > 0) {
    const matchingBanks = await BloodBank.find(
      { bloodBanksLocationId: { $in: externalIds } },
      {
        name: 1,
        slug: 1,
        logo: 1,
        bloodBanksLocationId: 1,
        active: 1,
        hidden: 1,
      },
    )
      .lean()
      .exec();
    for (const bank of matchingBanks) {
      localByExternalId.set(asString(bank.bloodBanksLocationId), bank);
    }
  }

  const resultById = new Map<string, NearbyBloodBank>();
  for (const bank of localBanks) {
    const id = asString(bank.bloodBanksLocationId);
    if (id) resultById.set(id, mapLocalBank(bank, latitude, longitude, "active"));
  }

  for (const externalBank of ondeDoarBanks) {
    const localBank = localByExternalId.get(externalBank.bloodBanksLocationId);
    if (localBank?.hidden) continue;
    if (localBank?.active) {
      resultById.set(
        externalBank.bloodBanksLocationId,
        mapLocalBank(
          localBank,
          latitude,
          longitude,
          "active",
          externalBank.distanceMeters,
        ),
      );
      continue;
    }
    if (localBank) {
      resultById.set(
        externalBank.bloodBanksLocationId,
        mapLocalBank(
          localBank,
          latitude,
          longitude,
          "inactive",
          externalBank.distanceMeters,
        ),
      );
      continue;
    }
    resultById.set(externalBank.bloodBanksLocationId, {
      name: externalBank.name,
      slug: null,
      logo: null,
      bloodBanksLocationId: externalBank.bloodBanksLocationId,
      distanceMeters: externalBank.distanceMeters,
      availability: "missing",
      origin: "ondedoar",
    });
  }

  const availabilityPriority: Record<NearbyBloodBankAvailability, number> = {
    active: 0,
    inactive: 1,
    missing: 1,
  };

  return [...resultById.values()].sort(
    (a, b) =>
      availabilityPriority[a.availability] - availabilityPriority[b.availability] ||
      (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
  );
}
