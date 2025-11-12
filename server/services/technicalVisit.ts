import { technicalVisit, bloodBank } from "~/server/models";
const { TechnicalVisit } = technicalVisit;
const { BloodBank } = bloodBank;
import { getInstitutionsByIds } from "./hemocioneId";

export interface TechnicalVisitWithDetails {
  _id: string;
  bloodBankId: string;
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
  institutionBanner?: string;
  date: Date;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

export async function getTechnicalVisitsByBloodBank(
  bloodBanksLocationId: string
): Promise<TechnicalVisitWithDetails[]> {
  // First, find the blood bank by bloodBanksLocationId to get the _id
  const bloodBankDoc = await BloodBank.findOne({
    bloodBanksLocationId,
  }).lean();

  if (!bloodBankDoc) {
    return [];
  }

  // Get all technical visits for this blood bank, ordered by date (newest first)
  const visits = await TechnicalVisit.find({
    bloodBankId: bloodBankDoc._id,
  })
    .sort({ date: -1 })
    .lean();

  if (visits.length === 0) {
    return [];
  }

  // Get unique institution IDs
  const institutionIds = Array.from(
    new Set(visits.map((v) => v.institutionId.toString()))
  );

  // Fetch institution details
  const institutions = await getInstitutionsByIds(institutionIds);
  
  console.log("=== DEBUG getTechnicalVisitsByBloodBank ===");
  console.log("Requested institution IDs:", institutionIds);
  console.log("Institutions returned:", institutions.length);
  institutions.forEach((inst) => {
    console.log(`  - ${inst.id}: ${inst.name}`);
  });

  // Create institution lookup map
  const institutionMap = new Map(
    institutions.map((inst) => [inst.id, inst])
  );

  // Build visits with details
  const visitsWithDetails: TechnicalVisitWithDetails[] = visits.map(
    (visit) => {
      const institution = institutionMap.get(visit.institutionId.toString());

      return {
        _id: visit._id.toString(),
        bloodBankId: visit.bloodBankId.toString(),
        institutionId: visit.institutionId.toString(),
        institutionName:
          institution?.name || `Instituição ${visit.institutionId.toString().substring(0, 8)}...`,
        institutionLogo: institution?.logo,
        institutionBanner: institution?.banner,
        date: visit.date,
        status: visit.status as "pending" | "approved" | "rejected",
        createdAt: visit.createdAt,
        updatedAt: visit.updatedAt,
      };
    }
  );

  return visitsWithDetails;
}

