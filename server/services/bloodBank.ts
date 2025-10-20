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
