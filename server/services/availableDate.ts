import { availableDate, team } from "~/server/models";
const { AvailableDate } = availableDate;
const { Team } = team;
import type { AvailableDateStatus } from "~/server/models/availableDate";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { Types } from "mongoose";

dayjs.extend(utc);
dayjs.extend(timezone);

export type { AvailableDateStatus };

export interface AvailableDateData {
  _id: string;
  bloodBanksLocationId: string;
  date: string;
  year: number;
  isAllTeams: boolean;
  status: AvailableDateStatus;
  slots: Array<{
    _id: string;
    teamId: string;
    startTime: Date;
    endTime: Date;
    locked: boolean;
  }>;
  allSlotsLocked?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotConfig {
  type: "global" | "individual";
  globalStartTime?: string;
  globalEndTime?: string;
  teamIds?: string[];
  slots?: Array<{
    teamId: string;
    startTime: string;
    endTime: string;
  }>;
}

export async function getAvailableDatesByBloodBank(
  bloodBanksLocationId: string,
  options?: {
    start?: string;
    end?: string;
    monthsAhead?: number;
    year?: number;
    excludeStatuses?: AvailableDateStatus[];
  }
): Promise<AvailableDateData[]> {
  const query: Record<string, any> = {
    bloodBanksLocationId,
    deletedAt: null,
  };

  if (options?.excludeStatuses?.length) {
    // Registros legados sem o campo status equivalem a "released" e não
    // devem ser afetados por este filtro: $nin não casa com campo ausente.
    query.status = { $nin: options.excludeStatuses };
  }

  const today = dayjs();
  // Começar a partir de 3 dias no futuro
  const threeDaysFromNow = today.add(3, "day");
  const start = options?.start ? dayjs(options.start) : threeDaysFromNow;
  const end = options?.end
    ? dayjs(options.end)
    : threeDaysFromNow.add(options?.monthsAhead ?? 12, "month");

  // Ensure range boundaries and format match stored format 'YYYY-MM-DD'
  const startStr = start.format("YYYY-MM-DD");
  const endStr = end.format("YYYY-MM-DD");

  // Keep year filter for index usage if provided
  if (options?.year) {
    query.year = options.year;
  }

  query.date = { $gte: startStr, $lte: endStr };

  const availableDates = await AvailableDate.find(query)
    .sort({ date: 1 })
    .lean();

  return availableDates as unknown as AvailableDateData[];
}

export async function getAvailableDateById(
  availableDateId: string
): Promise<AvailableDateData | null> {
  const availableDate = await AvailableDate.findOne({
    _id: availableDateId,
    deletedAt: null,
  }).lean();

  return availableDate as AvailableDateData | null;
}

export async function getAvailableDateByDate(
  bloodBanksLocationId: string,
  date: string
): Promise<AvailableDateData | null> {
  const availableDate = await AvailableDate.findOne({
    bloodBanksLocationId,
    date: date,
    deletedAt: null,
  }).lean();

  return availableDate as AvailableDateData | null;
}

export async function updateAvailableDateStatus(
  availableDateId: string,
  bloodBanksLocationId: string,
  status: AvailableDateStatus
): Promise<AvailableDateData | null> {
  // Escopo por bloodBanksLocationId garante que a data pertence ao banco.
  const updated = await AvailableDate.findOneAndUpdate(
    { _id: availableDateId, bloodBanksLocationId, deletedAt: null },
    { $set: { status } },
    { new: true, lean: true }
  );

  return updated as AvailableDateData | null;
}

export async function createAvailableDate(
  bloodBanksLocationId: string,
  date: string,
  isAllTeams: boolean,
  slotsConfig: SlotConfig,
  status: AvailableDateStatus = "released"
): Promise<AvailableDateData> {
  // Extract year from date string for indexing
  const year = parseInt(date.split("-")[0]);

  // Verificar se já existe availableDate para esta data e se está no futuro
  const todayStr = dayjs().format("YYYY-MM-DD");
  if (date < todayStr) {
    throw new Error("Não é possível criar datas no passado");
  }
  const existingDate = await getAvailableDateByDate(bloodBanksLocationId, date);
  if (existingDate) {
    throw new Error("Já existe uma data cadastrada para este dia");
  }

  // Bloqueada/pendente não tem equipes nem horários — apenas marca a data.
  if (status !== "released") {
    const blockedOrPendingDate = new AvailableDate({
      bloodBanksLocationId,
      date,
      year,
      isAllTeams: false,
      status,
      slots: [],
    });

    try {
      const savedAvailableDate = await blockedOrPendingDate.save();
      return savedAvailableDate.toObject() as unknown as AvailableDateData;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error("Já existe uma data cadastrada para este dia");
      }
      throw error;
    }
  }

  // Obter timezone do banco de sangue
  const bloodBank = await getBloodBankByBloodBanksLocationId(
    bloodBanksLocationId
  );
  const bloodBankTimezone = bloodBank?.timezone || "America/Sao_Paulo";

  let teamIds: string[] = [];

  if (isAllTeams) {
    // Buscar todos os teams ativos do bloodbank
    const teams = await Team.find({
      bloodBanksLocationId,
      deletedAt: null,
    }).lean();
    teamIds = teams.map((team) => team._id?.toString() || "");
  } else {
    teamIds = slotsConfig.teamIds || [];
  }

  // Validar que todos os teams pertencem ao bloodbank
  if (teamIds.length > 0) {
    const validTeams = await Team.find({
      _id: { $in: teamIds },
      bloodBanksLocationId,
      deletedAt: null,
    }).lean();

    if (validTeams.length !== teamIds.length) {
      throw new Error("Um ou mais times não pertencem a este banco de sangue");
    }
  }

  // Criar slots baseado na configuração
  const slots = [];

  if (slotsConfig.type === "global") {
    // Horário global para todos os teams
    let globalStartTime: Date;
    let globalEndTime: Date;

    // Converter horários do timezone do banco de sangue para UTC
    const startTimeLocal = dayjs.tz(
      `${date}T${slotsConfig.globalStartTime}`,
      bloodBankTimezone
    );
    const endTimeLocal = dayjs.tz(
      `${date}T${slotsConfig.globalEndTime}`,
      bloodBankTimezone
    );
    globalStartTime = startTimeLocal.utc().toDate();
    globalEndTime = endTimeLocal.utc().toDate();

    // Validar horários
    if (globalStartTime >= globalEndTime) {
      throw new Error("Horário de início deve ser anterior ao horário de fim");
    }

    for (const teamId of teamIds) {
      slots.push({
        teamId: new Types.ObjectId(teamId),
        startTime: globalStartTime,
        endTime: globalEndTime,
        locked: false,
      });
    }
  } else {
    // Horário individual por team
    if (!slotsConfig.slots || slotsConfig.slots.length === 0) {
      throw new Error("Slots individuais devem ser fornecidos");
    }

    for (const slot of slotsConfig.slots) {
      let startTime: Date;
      let endTime: Date;

      // Converter horários do timezone do banco de sangue para UTC
      const startTimeLocal = dayjs.tz(
        `${date}T${slot.startTime}`,
        bloodBankTimezone
      );
      const endTimeLocal = dayjs.tz(
        `${date}T${slot.endTime}`,
        bloodBankTimezone
      );
      startTime = startTimeLocal.utc().toDate();
      endTime = endTimeLocal.utc().toDate();

      // Validar horários
      if (startTime >= endTime) {
        throw new Error(
          `Horário inválido para o time ${slot.teamId}: início deve ser anterior ao fim`
        );
      }

      slots.push({
        teamId: new Types.ObjectId(slot.teamId),
        startTime,
        endTime,
        locked: false,
      });
    }
  }

  const availableDate = new AvailableDate({
    bloodBanksLocationId,
    date: date,
    year,
    isAllTeams,
    status: "released",
    slots,
  });

  try {
    const savedAvailableDate = await availableDate.save();
    return savedAvailableDate.toObject() as unknown as AvailableDateData;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new Error("Já existe uma data cadastrada para este dia");
    }
    throw error;
  }
}

export async function updateSlot(
  availableDateId: string,
  bloodBanksLocationId: string,
  slotId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    locked?: boolean;
  }
): Promise<AvailableDateData | null> {
  // Obter timezone do banco de sangue
  const bloodBank = await getBloodBankByBloodBanksLocationId(
    bloodBanksLocationId
  );
  const bloodBankTimezone = bloodBank?.timezone || "America/Sao_Paulo";

  // Verificar se availableDate pertence ao bloodbank
  const availableDate = await AvailableDate.findOne({
    _id: availableDateId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!availableDate) {
    throw new Error(
      "Data não encontrada ou não pertence a este banco de sangue"
    );
  }

  // Encontrar o slot
  const slot = availableDate.slots.id(slotId);
  if (!slot) {
    throw new Error("Slot não encontrado");
  }

  // Preparar updates
  const slotUpdates: any = {};

  if (updates.startTime !== undefined) {
    // Converter horário do timezone do banco de sangue para UTC
    const startTimeLocal = dayjs.tz(
      `${availableDate.date}T${updates.startTime}`,
      bloodBankTimezone
    );
    const newStartTime = startTimeLocal.utc().toDate();
    slotUpdates["slots.$.startTime"] = newStartTime;
  }

  if (updates.endTime !== undefined) {
    // Converter horário do timezone do banco de sangue para UTC
    const endTimeLocal = dayjs.tz(
      `${availableDate.date}T${updates.endTime}`,
      bloodBankTimezone
    );
    const newEndTime = endTimeLocal.utc().toDate();
    slotUpdates["slots.$.endTime"] = newEndTime;
  }

  if (updates.locked !== undefined) {
    slotUpdates["slots.$.locked"] = updates.locked;
  }

  // Validar que startTime < endTime se ambos foram fornecidos
  const finalStartTime =
    updates.startTime !== undefined
      ? dayjs
          .tz(`${availableDate.date}T${updates.startTime}`, bloodBankTimezone)
          .utc()
          .toDate()
      : slot.startTime;

  const finalEndTime =
    updates.endTime !== undefined
      ? dayjs
          .tz(`${availableDate.date}T${updates.endTime}`, bloodBankTimezone)
          .utc()
          .toDate()
      : slot.endTime;

  if (finalStartTime >= finalEndTime) {
    throw new Error("Horário de início deve ser anterior ao horário de fim");
  }

  // Se está no modo "todas as equipes" e um horário foi alterado, migrar para individual
  if (
    availableDate.isAllTeams &&
    (updates.startTime !== undefined || updates.endTime !== undefined)
  ) {
    // Apenas atualizar o isAllTeams para false e o slot específico
    const updatedAvailableDate = await AvailableDate.findOneAndUpdate(
      {
        _id: availableDateId,
        bloodBanksLocationId,
        deletedAt: null,
        "slots._id": slotId,
      },
      {
        $set: {
          isAllTeams: false,
          ...slotUpdates,
        },
      },
      { new: true }
    );

    if (!updatedAvailableDate) {
      return null;
    }

    // Converter para o formato esperado
    return {
      ...updatedAvailableDate.toObject(),
      _id: updatedAvailableDate._id?.toString() || "",
      bloodBanksLocationId:
        updatedAvailableDate.bloodBanksLocationId.toString(),
      slots: updatedAvailableDate.slots.map((slot) => ({
        ...slot.toObject(),
        _id: slot._id?.toString() || "",
        teamId: slot.teamId.toString(),
      })),
    } as AvailableDateData;
  }

  // Atualizar slot normalmente (modo individual)
  const updatedAvailableDate = await AvailableDate.findOneAndUpdate(
    {
      _id: availableDateId,
      bloodBanksLocationId,
      deletedAt: null,
      "slots._id": slotId,
    },
    { $set: slotUpdates },
    { new: true }
  );

  if (!updatedAvailableDate) {
    return null;
  }

  // Converter para o formato esperado
  return {
    ...updatedAvailableDate.toObject(),
    _id: updatedAvailableDate._id?.toString() || "",
    bloodBanksLocationId: updatedAvailableDate.bloodBanksLocationId.toString(),
    slots: updatedAvailableDate.slots.map((slot) => ({
      ...slot.toObject(),
      _id: slot._id?.toString() || "",
      teamId: slot.teamId.toString(),
    })),
  } as AvailableDateData;
}

export async function addTeamsToAvailableDate(
  availableDateId: string,
  bloodBanksLocationId: string,
  teamIds: string[],
  defaultStartTime: string,
  defaultEndTime: string
): Promise<AvailableDateData | null> {
  // Verificar se availableDate pertence ao bloodbank
  const availableDate = await AvailableDate.findOne({
    _id: availableDateId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!availableDate) {
    throw new Error(
      "Data não encontrada ou não pertence a este banco de sangue"
    );
  }

  // Validar que todos os teams pertencem ao bloodbank
  const validTeams = await Team.find({
    _id: { $in: teamIds },
    bloodBanksLocationId,
    deletedAt: null,
  }).lean();

  if (validTeams.length !== teamIds.length) {
    throw new Error("Um ou mais times não pertencem a este banco de sangue");
  }

  // Verificar quais teams já estão incluídos
  const existingTeamIds = availableDate.slots.map((slot) =>
    slot.teamId.toString()
  );
  const newTeamIds = teamIds.filter((id) => !existingTeamIds.includes(id));

  if (newTeamIds.length === 0) {
    throw new Error(
      "Todos os times selecionados já estão incluídos nesta data"
    );
  }

  // Criar novos slots
  const newSlots = newTeamIds.map((teamId) => ({
    teamId: new Types.ObjectId(teamId),
    startTime: new Date(`${availableDate.date}T${defaultStartTime}:00.000Z`),
    endTime: new Date(`${availableDate.date}T${defaultEndTime}:00.000Z`),
    locked: false,
  }));

  // Validar horários padrão
  if (newSlots[0].startTime >= newSlots[0].endTime) {
    throw new Error("Horário de início deve ser anterior ao horário de fim");
  }

  // Adicionar novos slots
  const updatedAvailableDate = await AvailableDate.findOneAndUpdate(
    { _id: availableDateId, bloodBanksLocationId, deletedAt: null },
    { $push: { slots: { $each: newSlots } } },
    { new: true, lean: true }
  );

  return updatedAvailableDate as AvailableDateData | null;
}

export async function removeTeamFromAvailableDate(
  availableDateId: string,
  bloodBanksLocationId: string,
  teamId: string
): Promise<AvailableDateData | null> {
  // Verificar se availableDate pertence ao bloodbank
  const availableDate = await AvailableDate.findOne({
    _id: availableDateId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!availableDate) {
    throw new Error(
      "Data não encontrada ou não pertence a este banco de sangue"
    );
  }

  // Encontrar o slot do team
  const slot = availableDate.slots.find((s) => s.teamId.toString() === teamId);
  if (!slot) {
    throw new Error("Time não encontrado nesta data");
  }

  // Verificar se slot não está locked
  if (slot.locked) {
    throw new Error("Não é possível remover um time com slot travado");
  }

  // Remover slot
  const updatedAvailableDate = await AvailableDate.findOneAndUpdate(
    { _id: availableDateId, bloodBanksLocationId, deletedAt: null },
    { $pull: { slots: { teamId } } },
    { new: true, lean: true }
  );

  return updatedAvailableDate as AvailableDateData | null;
}

export async function deleteAvailableDate(
  availableDateId: string,
  bloodBanksLocationId: string
): Promise<boolean> {
  // Verificar se availableDate pertence ao bloodbank
  const availableDate = await AvailableDate.findOne({
    _id: availableDateId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!availableDate) {
    throw new Error(
      "Data não encontrada ou não pertence a este banco de sangue"
    );
  }

  // Verificar se algum slot está locked
  const hasLockedSlots = availableDate.slots.some((slot) => slot.locked);
  if (hasLockedSlots) {
    throw new Error("Não é possível deletar uma data com slots travados");
  }

  // Soft delete
  const result = await AvailableDate.findOneAndUpdate(
    { _id: availableDateId, bloodBanksLocationId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );

  return !!result;
}

export async function addTeamToFutureAvailableDates(
  bloodBanksLocationId: string,
  teamId: string
): Promise<void> {
  const todayStr = dayjs().format("YYYY-MM-DD");

  // Buscar availableDates futuras com isAllTeams = true
  const futureAvailableDates = await AvailableDate.find({
    bloodBanksLocationId,
    isAllTeams: true,
    date: { $gte: todayStr },
    deletedAt: null,
  });

  const teamObjectId = new Types.ObjectId(teamId);

  // Adicionar novo team a cada availableDate (idempotente)
  for (const availableDate of futureAvailableDates) {
    // Verificar se o team já tem slot nesta data
    const alreadyHasSlot = availableDate.slots.some(
      (slot) => slot.teamId.toString() === teamId
    );
    if (alreadyHasSlot) {
      continue;
    }

    const firstSlot = availableDate.slots[0];
    if (!firstSlot) {
      continue;
    }

    const newSlot = {
      teamId: teamObjectId,
      startTime: firstSlot.startTime,
      endTime: firstSlot.endTime,
      locked: false,
    };

    await AvailableDate.findOneAndUpdate(
      { _id: availableDate._id },
      { $push: { slots: newSlot } }
    );
  }
}

export interface BulkAvailableDateEntry {
  date: string;
  isAvailable: boolean;
  teamId?: string | null;
}

export interface BulkAvailableDateResult {
  created: number;
  deleted: number;
  skipped: number;
  errors: string[];
}

export async function bulkSetAvailableDates(
  bloodBanksLocationId: string,
  entries: BulkAvailableDateEntry[]
): Promise<BulkAvailableDateResult> {
  const bloodBank = await getBloodBankByBloodBanksLocationId(
    bloodBanksLocationId
  );
  const bloodBankTimezone = bloodBank?.timezone || "America/Sao_Paulo";

  const result: BulkAvailableDateResult = {
    created: 0,
    deleted: 0,
    skipped: 0,
    errors: [],
  };

  const todayStr = dayjs().format("YYYY-MM-DD");

  // Fetch all existing dates for this location to avoid N+1 queries
  const allDates = entries.map((e) => e.date);
  const existingDates = await AvailableDate.find({
    bloodBanksLocationId,
    date: { $in: allDates },
    deletedAt: null,
  });
  const existingDateMap = new Map(
    existingDates.map((d) => [d.date, d])
  );

  // Fetch all teams for this location
  const teams = await Team.find({
    bloodBanksLocationId,
    deletedAt: null,
  }).lean();
  const teamIds = teams.map((t) => t._id!.toString());

  for (const entry of entries) {
    try {
      if (entry.date < todayStr) {
        result.skipped++;
        continue;
      }

      const existing = existingDateMap.get(entry.date);

      if (entry.isAvailable) {
        // Create date if it doesn't exist
        if (existing) {
          result.skipped++;
          continue;
        }

        const year = parseInt(entry.date.split("-")[0]);
        const isAllTeams = !entry.teamId;
        const slotsTeamIds = isAllTeams
          ? teamIds
          : [entry.teamId!];

        // Validate teamId if specific
        if (entry.teamId && !teamIds.includes(entry.teamId)) {
          result.errors.push(
            `${entry.date}: time ${entry.teamId} não pertence a este banco de sangue`
          );
          continue;
        }

        // Default times: 08:00-17:00 in blood bank timezone
        const startTimeLocal = dayjs.tz(
          `${entry.date}T08:00`,
          bloodBankTimezone
        );
        const endTimeLocal = dayjs.tz(
          `${entry.date}T17:00`,
          bloodBankTimezone
        );
        const startTime = startTimeLocal.utc().toDate();
        const endTime = endTimeLocal.utc().toDate();

        const slots = slotsTeamIds.map((tId) => ({
          teamId: new Types.ObjectId(tId),
          startTime,
          endTime,
          locked: false,
        }));

        try {
          const newDate = new AvailableDate({
            bloodBanksLocationId,
            date: entry.date,
            year,
            isAllTeams,
            slots,
          });
          await newDate.save();
          result.created++;
        } catch (error: any) {
          if (error.code === 11000) {
            result.skipped++;
          } else {
            result.errors.push(`${entry.date}: ${error.message}`);
          }
        }
      } else {
        // Delete date if it exists and has no locked slots
        if (!existing) {
          result.skipped++;
          continue;
        }

        const hasLockedSlots = existing.slots.some(
          (slot) => slot.locked || slot.lockedBy
        );
        if (hasLockedSlots) {
          result.errors.push(
            `${entry.date}: não é possível remover, possui slots travados por coletas`
          );
          continue;
        }

        await AvailableDate.findOneAndUpdate(
          { _id: existing._id, deletedAt: null },
          { deletedAt: new Date() }
        );
        result.deleted++;
      }
    } catch (error: any) {
      result.errors.push(`${entry.date}: ${error.message}`);
    }
  }

  return result;
}

export async function removeSlotsFromFutureAvailableDates(
  bloodBanksLocationId: string,
  teamId: string
): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Buscar availableDates futuras
  const futureAvailableDates = await AvailableDate.find({
    bloodBanksLocationId,
    date: { $gte: today },
    deletedAt: null,
  });

  let removedSlotsCount = 0;

  // Remover slots não-locked do team
  for (const availableDate of futureAvailableDates) {
    const slotsToRemove = availableDate.slots.filter(
      (slot) => slot.teamId.toString() === teamId && !slot.locked
    );

    if (slotsToRemove.length > 0) {
      await AvailableDate.findOneAndUpdate(
        { _id: availableDate._id },
        { $pull: { slots: { teamId, locked: false } } }
      );
      removedSlotsCount += slotsToRemove.length;
    }
  }

  return removedSlotsCount;
}
