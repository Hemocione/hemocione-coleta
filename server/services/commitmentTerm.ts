import { Types } from "mongoose";
import { commitmentTerm } from "~/server/models";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import { normalizeCommitmentTermTemplate } from "~/utils/commitmentTermTemplate";
const { CommitmentTerm } = commitmentTerm;

export const DEFAULT_COMMITMENT_TERM_TEMPLATE = `TERMO DE COMPROMISSO

Pelo presente instrumento, a instituição {{institutionName}}, localizada em {{address}}, se compromete a cumprir as condições estabelecidas pelo banco de sangue {{bloodBankName}} para a realização da coleta de sangue.

O(A) responsável pelo local, {{hostName}}, se compromete a:

1. Garantir espaço físico adequado para a realização da coleta;
2. Divulgar a campanha de doação de sangue entre os colaboradores e comunidade;
3. Assegurar o número mínimo de doadores conforme acordado previamente;
4. Fornecer apoio logístico necessário no dia da coleta;
5. Seguir todas as normas e orientações sanitárias indicadas pelo banco de sangue.

Data: {{date}}

___________________________
{{hostName}}
Representante da Instituição

___________________________
{{bloodBankName}}`;

export interface CommitmentTermData {
  _id: string | Types.ObjectId;
  bloodBanksLocationId: string | Types.UUID;
  collectionRequestId?: string | Types.ObjectId | null;
  technicalVisitId?: string | Types.ObjectId | null;
  generatedContent: string;
  sentTo: string;
  signedByName?: string | null;
  signedAt?: Date | null;
  sentAt?: Date | null;
  status: "draft" | "sent" | "acknowledged";
  acknowledgedAt?: Date | null;
  accessToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommitmentTermData {
  bloodBanksLocationId: string;
  collectionRequestId?: string | null;
  technicalVisitId?: string | null;
  generatedContent: string;
  sentTo: string;
  signedByName?: string | null;
  signedAt?: Date | null;
  status?: "draft" | "sent" | "acknowledged";
}

export function renderTemplate(
  template: string,
  params: Record<string, string>
): string {
  return normalizeCommitmentTermTemplate(template).replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (match, key) => params[key] ?? match
  );
}

export async function getTemplateForBloodBank(
  bloodBanksLocationId: string
): Promise<string> {
  const bloodBank =
    await getBloodBankByBloodBanksLocationId(bloodBanksLocationId);
  return normalizeCommitmentTermTemplate(
    bloodBank?.commitmentTermTemplate || DEFAULT_COMMITMENT_TERM_TEMPLATE
  );
}

export async function createCommitmentTerm(
  data: CreateCommitmentTermData
): Promise<CommitmentTermData> {
  const term = new CommitmentTerm({
    ...data,
    generatedContent: normalizeCommitmentTermTemplate(data.generatedContent),
    signedAt: data.signedByName ? data.signedAt || new Date() : null,
  });
  const saved = await term.save();
  return saved.toObject() as unknown as CommitmentTermData;
}

export async function getCommitmentTermsByBloodBank(
  bloodBanksLocationId: string,
  filters: {
    status?: string;
    collectionRequestId?: string;
  } = {},
  pagination: { page: number; limit: number } = { page: 1, limit: 20 }
): Promise<{
  data: CommitmentTermData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const query: Record<string, any> = {
    bloodBanksLocationId,
  };

  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.collectionRequestId) {
    query.collectionRequestId = filters.collectionRequestId;
  }

  const total = await CommitmentTerm.countDocuments(query);
  const skip = (pagination.page - 1) * pagination.limit;

  const data = await CommitmentTerm.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pagination.limit)
    .lean();

  return {
    data: data as unknown as CommitmentTermData[],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function getCommitmentTermById(
  bloodBanksLocationId: string,
  termId: string
): Promise<CommitmentTermData | null> {
  return (await CommitmentTerm.findOne({
    _id: termId,
    bloodBanksLocationId,
  }).lean()) as CommitmentTermData | null;
}

export async function getCommitmentTermByToken(
  token: string
): Promise<CommitmentTermData | null> {
  return (await CommitmentTerm.findOne({
    accessToken: token,
  }).lean()) as CommitmentTermData | null;
}

export async function acknowledgeCommitmentTerm(
  token: string
): Promise<CommitmentTermData | null> {
  const term = await CommitmentTerm.findOneAndUpdate(
    { accessToken: token, status: { $in: ["draft", "sent"] } },
    { status: "acknowledged", acknowledgedAt: new Date() },
    { new: true }
  ).lean();
  return term as CommitmentTermData | null;
}

export async function markCommitmentTermSent(
  termId: string | Types.ObjectId,
  sentAt?: Date
): Promise<CommitmentTermData | null> {
  const term = await CommitmentTerm.findOneAndUpdate(
    { _id: termId, status: "draft" },
    { status: "sent", sentAt: sentAt || new Date() },
    { new: true }
  ).lean();
  return term as CommitmentTermData | null;
}
