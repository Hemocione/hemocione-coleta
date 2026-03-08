import { Types } from "mongoose";
import { commitmentTerm } from "~/server/models";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
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
  sentAt?: Date | null;
  status: "draft" | "sent" | "acknowledged";
  acknowledgedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommitmentTermData {
  bloodBanksLocationId: string;
  collectionRequestId?: string | null;
  technicalVisitId?: string | null;
  generatedContent: string;
  sentTo: string;
  status?: "draft" | "sent" | "acknowledged";
}

export function renderTemplate(
  template: string,
  params: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] ?? match;
  });
}

export async function getTemplateForBloodBank(
  bloodBanksLocationId: string
): Promise<string> {
  const bloodBank =
    await getBloodBankByBloodBanksLocationId(bloodBanksLocationId);
  return bloodBank?.commitmentTermTemplate || DEFAULT_COMMITMENT_TERM_TEMPLATE;
}

export async function createCommitmentTerm(
  data: CreateCommitmentTermData
): Promise<CommitmentTermData> {
  const term = new CommitmentTerm(data);
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
