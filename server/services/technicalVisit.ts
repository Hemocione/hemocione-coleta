import { Types } from "mongoose";
import { collectionRequest, technicalVisit } from "~/server/models";
const { TechnicalVisit } = technicalVisit;
const { CollectionRequest } = collectionRequest;
import { getInstitutionsByIds } from "~/server/services/hemocioneId";
import { notifyCollectionRequestStatusTransition } from "./collectionRequestNotification";

function normalizeAddress(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatCollectionRequestAddress(request: {
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
}): string {
  if (!request.address) return "";
  const address = request.address;
  return [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city} - ${address.state}`,
    address.zipCode,
  ]
    .filter(Boolean)
    .join(", ");
}

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
  registeredRetroactively?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  institutionName?: string;
  institutionAddress?: string;
  collectionRequest?: {
    _id: string;
    institutionId: string;
    status: string;
    eventSlug?: string;
    host?: {
      name: string;
      email: string;
      phone: string;
    };
  };
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
  registeredRetroactively?: boolean;
}

export interface UpdateTechnicalVisitData {
  address?: string;
  institutionId?: string | null;
  location?: { type: "Point"; coordinates: [number, number] } | null;
  visitDate?: Date;
  outcome?: "approved" | "rejected" | "pending";
  notes?: string | null;
}

async function enrichTechnicalVisits(
  visits: TechnicalVisitData[],
  bloodBanksLocationId: string
): Promise<TechnicalVisitData[]> {
  if (visits.length === 0) return visits;

  const visitIds = visits.map((visit) => visit._id.toString());
  const linkedRequests = await CollectionRequest.find({
    technicalVisitId: { $in: visitIds },
    bloodBanksLocationId,
    deletedAt: null,
  }).lean();

  const requestByVisitId = new Map(
    linkedRequests.map((request) => [
      request.technicalVisitId?.toString(),
      request,
    ])
  );
  const visitsWithoutInstitution = visits.filter(
    (visit) =>
      !visit.institutionId && !requestByVisitId.has(visit._id.toString())
  );
  const inferredInstitutionByVisitId = new Map<string, string>();

  if (visitsWithoutInstitution.length) {
    const requestsWithAddresses = await CollectionRequest.find({
      bloodBanksLocationId,
      deletedAt: null,
      address: { $exists: true },
    }).lean();
    const requestsByAddress = new Map<string, Set<string>>();

    requestsWithAddresses.forEach((request) => {
      const address = normalizeAddress(formatCollectionRequestAddress(request));
      if (!address) return;
      const institutionIds = requestsByAddress.get(address) || new Set<string>();
      institutionIds.add(request.institutionId.toString());
      requestsByAddress.set(address, institutionIds);
    });

    visitsWithoutInstitution.forEach((visit) => {
      const institutionIds = requestsByAddress.get(normalizeAddress(visit.address));
      if (institutionIds?.size === 1) {
        inferredInstitutionByVisitId.set(
          visit._id.toString(),
          Array.from(institutionIds)[0]
        );
      }
    });
  }
  const institutionIds = Array.from(
    new Set(
      visits
        .map((visit) => visit.institutionId?.toString())
        .concat(
          linkedRequests.map((request) => request.institutionId?.toString())
        )
        .concat(Array.from(inferredInstitutionByVisitId.values()))
        .filter((institutionId): institutionId is string => Boolean(institutionId))
    )
  );
  const institutions = institutionIds.length
    ? await getInstitutionsByIds(institutionIds)
    : [];
  const institutionById = new Map(
    institutions.map((institution) => [institution.id, institution])
  );

  return visits.map((visit) => {
    const request = requestByVisitId.get(visit._id.toString());
    const institutionId =
      visit.institutionId?.toString() ||
      request?.institutionId?.toString() ||
      inferredInstitutionByVisitId.get(visit._id.toString());
    const institution = institutionId
      ? institutionById.get(institutionId)
      : undefined;

    return {
      ...visit,
      ...(institutionId && { institutionId }),
      ...(institution?.name && { institutionName: institution.name }),
      ...(institution?.address && { institutionAddress: institution.address }),
      ...(request && {
        collectionRequest: {
          _id: request._id.toString(),
          institutionId: request.institutionId.toString(),
          status: request.status,
          ...(request.eventSlug && { eventSlug: request.eventSlug }),
          ...(request.host && {
            host: {
              name: request.host.name,
              email: request.host.email,
              phone: request.host.phone,
            },
          }),
        },
      }),
    };
  });
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

  const enrichedData = await enrichTechnicalVisits(
    data as unknown as TechnicalVisitData[],
    bloodBanksLocationId
  );

  return {
    data: enrichedData,
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
  const visit = await TechnicalVisit.findOne({
    _id: visitId,
    bloodBanksLocationId,
    deletedAt: null,
  }).lean() as TechnicalVisitData | null;

  if (!visit) return null;

  const [enrichedVisit] = await enrichTechnicalVisits(
    [visit],
    bloodBanksLocationId
  );
  return enrichedVisit || null;
}

export async function linkTechnicalVisitToCollectionRequest(
  requestId: string,
  bloodBanksLocationId: string,
  technicalVisitId: string | Types.ObjectId
) {
  const updatedRequest = await CollectionRequest.findOneAndUpdate(
    {
      _id: requestId,
      bloodBanksLocationId,
      status: "awaiting_technical_visit",
      technicalVisitId: { $exists: false },
      deletedAt: null,
    },
    { $set: { technicalVisitId } },
    { new: true }
  );

  if (!updatedRequest) {
    throw new Error("Collection request is not available for a new technical visit");
  }

  return updatedRequest;
}

export async function updateTechnicalVisit(
  bloodBanksLocationId: string,
  visitId: string,
  updates: UpdateTechnicalVisitData,
  changedByUserId?: string
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

  if (
    updated &&
    (updates.outcome === "approved" || updates.outcome === "rejected")
  ) {
    const nextStatus =
      updates.outcome === "approved"
        ? "technical_visit_confirmed"
        : "rejected";
    const rejectionReason =
      updates.outcome === "rejected"
        ? updated.notes || "Technical visit rejected"
        : undefined;

    const updatedCollectionRequest = await CollectionRequest.findOneAndUpdate(
      {
        technicalVisitId: visitId,
        bloodBanksLocationId,
        status: "awaiting_technical_visit",
        deletedAt: null,
      },
      {
        $set: {
          status: nextStatus,
          ...(rejectionReason && { rejectionReason }),
        },
        $push: {
          statusHistory: {
            status: nextStatus,
            changedAt: new Date(),
            changedBy: changedByUserId || updated.visitedBy?.toString(),
            reason:
              updates.outcome === "approved"
                ? "Technical visit approved"
                : rejectionReason,
          },
        },
      },
      { new: true }
    );

    if (updatedCollectionRequest?._id) {
      await notifyCollectionRequestStatusTransition({
        requestId: updatedCollectionRequest._id.toString(),
        bloodBanksLocationId,
        transition: "technical_visit_verdict",
        technicalVisitResult:
          updates.outcome === "approved" ? "Aprovada" : "Reprovada",
      });
    }
  }

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
