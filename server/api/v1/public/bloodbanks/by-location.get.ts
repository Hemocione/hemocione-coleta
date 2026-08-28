import {
  getNearbyBloodBanks,
  parseNearbyCoordinates,
} from "~/server/services/nearbyBloodBanks";

export default defineEventHandler(async (event) => {
  const { lat, lng } = parseNearbyCoordinates(getQuery(event));
  return {
    success: true,
    data: await getNearbyBloodBanks(lat, lng),
  };
});
