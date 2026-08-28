import {
  getNearbyBloodBanks,
  parseNearbyCoordinates,
} from "~/server/services/nearbyBloodBanks";

export default defineEventHandler(async (event) => {
  const { lat, lng } = parseNearbyCoordinates(getQuery(event));
  const banks = await getNearbyBloodBanks(lat, lng);

  return {
    success: true,
    data: banks
      .filter((bank) => bank.availability === "active")
      .map((bank) => ({
        _id: bank._id || "",
        name: bank.name,
        slug: bank.slug,
        logo: bank.logo,
        bloodBanksLocationId: bank.bloodBanksLocationId,
        distanceMeters: bank.distanceMeters,
      })),
  };
});
