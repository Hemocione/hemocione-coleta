import { Types } from "mongoose";
import { technicalVisit } from "~/server/models";
const { TechnicalVisit } = technicalVisit;

export interface TechnicalVisitData {
  _id: string | Types.ObjectId;
  bloodBanksLocationId: string | Types.UUID;
  institutionId?: string | Types.UUID | null;
  address: string;
  location?: { type: "Point"; coordinates: number[] } | null;
  visitDate: Date;
  outcome: "approved" | "rejected" | "pending";
  notes?: string | null;
  visitedBy: string | Types.UUID;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTechnicalVisitData {
  bloodBanksLocationId: string;
  institutionId?: string | null;
  address: string;
  location?: { type: "Point"; coordinates: [number, number] } | null;
  visitDate: Date;
  outcome: "approved" | "rejected" | "pending";
  notes?: string | null;
  visitedBy: string;
}

export interface UpdateTechnicalVisitData {
  address?: string;
  institutionId?: string | null;
  location?: { type: "Point"; coordinates: [number, number] } | null;
  visitDate?: Date;
  outcome?: "approved" | "rejected" | "pending";
  notes?: string | null;
}

export async function createTechnicalVisit(
  data: CreateTechnicalVisitData
): Promise<TechnicalVisitData> {
  const visit = new TechnicalVisit(data);
  const saved = await visit.save();
  return saved.toObject() as unknown as TechnicalVisitData;
}

export async function getTechnicalVisitsByBloodBank(
  bloodBanksLocationId: string,
  filters: {
    outcome?: string;
    institutionId?: string;
  } = {},
  pagination: { page: number; limit: number } = { page: 1, limit: 20 }
): Promise<{
  data: TechnicalVisitData[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const query: Record<string, any> = {
    bloodBanksLocationId,
    deletedAt: null,
  };

  if (filters.outcome) {
    query.outcome = filters.outcome;
  }
  if (filters.institutionId) {
    query.institutionId = filters.institutionId;
  }

  const total = await TechnicalVisit.countDocuments(query);
  const skip = (pagination.page - 1) * pagination.limit;

  const data = await TechnicalVisit.find(query)
    .sort({ visitDate: -1 })
    .skip(skip)
    .limit(pagination.limit)
    .lean();

  return {
    data: data as unknown as TechnicalVisitData[],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function getTechnicalVisitById(
  bloodBanksLocationId: string,
  visitId: string
): Promise<TechnicalVisitData | null> {
  return await TechnicalVisit.findOne({
    _id: visitId,
    bloodBanksLocationId,
    deletedAt: null,
  }).lean() as TechnicalVisitData | null;
}

export async function updateTechnicalVisit(
  bloodBanksLocationId: string,
  visitId: string,
  updates: UpdateTechnicalVisitData
): Promise<TechnicalVisitData | null> {
  const existing = await TechnicalVisit.findOne({
    _id: visitId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!existing) {
    return null;
  }

  const updated = await TechnicalVisit.findOneAndUpdate(
    { _id: visitId, bloodBanksLocationId, deletedAt: null },
    updates,
    { new: true, lean: true }
  );

  return updated as TechnicalVisitData | null;
}

export async function deleteTechnicalVisit(
  bloodBanksLocationId: string,
  visitId: string
): Promise<boolean> {
  const existing = await TechnicalVisit.findOne({
    _id: visitId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!existing) {
    return false;
  }

  await TechnicalVisit.findOneAndUpdate(
    { _id: visitId, bloodBanksLocationId, deletedAt: null },
    { deletedAt: new Date() }
  );

  return true;
}
