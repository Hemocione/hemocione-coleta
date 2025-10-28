import { z } from "zod";
import { bloodBank } from "~/server/models";
const { BloodBank } = bloodBank;

const querySchema = z.object({
  lat: z.string().transform((v) => parseFloat(v)),
  lng: z.string().transform((v) => parseFloat(v)),
});

export default defineEventHandler(async (event) => {
  // Auth is enforced by server/middleware/auth.ts for /api/v1/* (non-public)
  const query = await getQuery(event);
  const { lat, lng } = querySchema.parse(query);

  const point = {
    type: "Point",
    coordinates: [lng, lat] as [number, number],
  } as const;

  const banks = await BloodBank.find(
    {
      coverageArea: { $geoIntersects: { $geometry: point } },
    },
    { name: 1, slug: 1, logo: 1, bloodBanksLocationId: 1, location: 1 }
  )
    .lean()
    .exec();

  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const withDistance = banks.map((b: any) => {
    if (!b?.location?.coordinates) return { ...b };
    const [blng, blat] = b.location.coordinates as [number, number];
    const dLat = toRad(blat - lat);
    const dLng = toRad(blng - lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) *
        Math.cos(toRad(blat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return { ...b, distanceMeters: d };
  });

  withDistance.sort(
    (a: any, b: any) =>
      (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
  );

  return {
    success: true,
    data: withDistance.map((b: any) => ({
      _id: b._id?.toString?.() || "",
      name: b.name,
      slug: b.slug,
      logo: b.logo ?? null,
      bloodBanksLocationId: b.bloodBanksLocationId?.toString?.() || "",
      distanceMeters: b.distanceMeters,
    })),
  };
});
