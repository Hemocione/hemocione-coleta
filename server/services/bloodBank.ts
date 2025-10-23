import { BloodBank } from "~/server/models/bloodBank";
import slugify from "slugify";

export async function getBloodBankByBloodBanksLocationId(
  bloodBanksLocationId: string
) {
  return await BloodBank.findOne({
    bloodBanksLocationId,
  }).lean();
}

export async function getBloodBankBySlug(slug: string) {
  return await BloodBank.findOne({
    slug,
  }).lean();
}

export async function getBloodBanksLocationIdBySlug(
  slug: string
): Promise<string | null> {
  const bloodBank = await getBloodBankBySlug(slug);
  return bloodBank?.bloodBanksLocationId?.toString() || null;
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

// Restriction Checklist Methods

export async function getRestrictionChecklist(bloodBanksLocationId: string) {
  const bloodBank = await BloodBank.findOne(
    { bloodBanksLocationId },
    { restrictionChecklist: 1 }
  ).lean();

  return bloodBank?.restrictionChecklist || [];
}

export async function addRestrictionItem(
  bloodBanksLocationId: string,
  title: string,
  description: string
) {
  // Generate slug from title
  let baseSlug = slugify(title, { lower: true, strict: true });

  // Get current checklist to check for duplicates
  const bloodBank = await BloodBank.findOne(
    { bloodBanksLocationId },
    { restrictionChecklist: 1 }
  ).lean();

  const existingSlugs = (bloodBank?.restrictionChecklist || []).map(
    (item) => item.slug
  );

  // Ensure slug is unique
  let slug = baseSlug;
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const newItem = {
    slug,
    title: title.trim(),
    description: description.trim(),
  };

  const updatedBloodBank = await BloodBank.findOneAndUpdate(
    { bloodBanksLocationId },
    { $push: { restrictionChecklist: newItem } },
    { new: true, lean: true }
  );

  return updatedBloodBank?.restrictionChecklist || [];
}

export async function updateRestrictionItem(
  bloodBanksLocationId: string,
  slug: string,
  updates: { title?: string; description?: string }
) {
  const bloodBank = await BloodBank.findOne(
    { bloodBanksLocationId },
    { restrictionChecklist: 1 }
  ).lean();

  if (!bloodBank?.restrictionChecklist) {
    throw new Error("Blood bank not found");
  }

  const itemIndex = bloodBank.restrictionChecklist.findIndex(
    (item) => item.slug === slug
  );
  if (itemIndex === -1) {
    throw new Error("Restriction item not found");
  }

  const updateFields: any = {};

  if (updates.title !== undefined) {
    updateFields[`restrictionChecklist.${itemIndex}.title`] =
      updates.title.trim();

    // If title changed, regenerate slug
    const newSlug = slugify(updates.title, { lower: true, strict: true });
    const existingSlugs = bloodBank.restrictionChecklist
      .filter((_, index) => index !== itemIndex)
      .map((item) => item.slug);

    let finalSlug = newSlug;
    let counter = 1;
    while (existingSlugs.includes(finalSlug)) {
      finalSlug = `${newSlug}-${counter}`;
      counter++;
    }

    updateFields[`restrictionChecklist.${itemIndex}.slug`] = finalSlug;
  }

  if (updates.description !== undefined) {
    updateFields[`restrictionChecklist.${itemIndex}.description`] =
      updates.description.trim();
  }

  const updatedBloodBank = await BloodBank.findOneAndUpdate(
    { bloodBanksLocationId },
    { $set: updateFields },
    { new: true, lean: true }
  );

  return updatedBloodBank?.restrictionChecklist || [];
}

export async function deleteRestrictionItem(
  bloodBanksLocationId: string,
  slug: string
) {
  const updatedBloodBank = await BloodBank.findOneAndUpdate(
    { bloodBanksLocationId },
    { $pull: { restrictionChecklist: { slug } } },
    { new: true, lean: true }
  );

  return updatedBloodBank?.restrictionChecklist || [];
}
