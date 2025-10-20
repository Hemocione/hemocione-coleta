import { BloodBank } from "~/server/models/bloodBank";

export async function getBloodBankByBloodBanksLocationId(
  bloodBanksLocationId: string
) {
  return await BloodBank.findOne({
    bloodBanksLocationId,
  }).lean();
}

export async function getBloodBanksByBloodBanksLocationIds(
  bloodBanksLocationIds: string[]
) {
  // Clean the input array to remove any whitespace/newlines
  const cleanLocationIds = bloodBanksLocationIds.map((id) => id.trim());

  const bloodBanks = await BloodBank.find({
    bloodBanksLocationId: { $in: cleanLocationIds },
  })
    .lean()
    .exec();

  return bloodBanks;
}

export async function updateBloodBankCoverageArea(
  bloodBanksLocationId: string,
  coverageArea: {
    type: "Polygon";
    coordinates: number[][][];
  }
) {
  const updatedBloodbank = await BloodBank.findOneAndUpdate(
    { bloodBanksLocationId },
    {
      coverageArea: {
        type: "Polygon",
        coordinates: coverageArea.coordinates,
      },
    },
    { new: true, lean: true }
  );

  return updatedBloodbank;
}
