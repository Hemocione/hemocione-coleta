import { AvailableDate } from "~/server/models/availableDate";
import { Team } from "~/server/models/team";
import { getBloodBankByBloodBanksLocationId } from "~/server/services/bloodBank";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export interface AvailableDateData {
  _id: string;
  bloodBanksLocationId: string;
  date: Date;
  year: number;
  isAllTeams: boolean;
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
  year?: number,
  month?: number
): Promise<AvailableDateData[]> {
  const query: any = {
    bloodBanksLocationId,
    deletedAt: null,
  };

  if (year) {
    query.year = year;
  }

  if (month !== undefined) {
    // Filtrar por mês específico
    const startDate = new Date(year || new Date().getFullYear(), month, 1);
    const endDate = new Date(year || new Date().getFullYear(), month + 1, 0);

    query.date = {
      $gte: startDate,
      $lte: endDate,
    };
  }

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
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const availableDate = await AvailableDate.findOne({
    bloodBanksLocationId,
    date: targetDate,
    deletedAt: null,
  }).lean();

  return availableDate as AvailableDateData | null;
}

export async function createAvailableDate(
  bloodBanksLocationId: string,
  date: string,
  isAllTeams: boolean,
  slotsConfig: SlotConfig
): Promise<AvailableDateData> {
  // Obter timezone do banco de sangue
  const bloodBank = await getBloodBankByBloodBanksLocationId(
    bloodBanksLocationId
  );
  const bloodBankTimezone = bloodBank?.timezone || "America/Sao_Paulo";

  // Processar data considerando timezone do banco de sangue
  // Converter data do timezone do banco para UTC
  // Exemplo: se banco está em GMT-3 e seleciona 24/10,
  // a data em UTC deve ser 23/10 às 21:00 (meia-noite local = 21:00 UTC)
  const localDate = dayjs.tz(date, bloodBankTimezone);
  const targetDate = localDate.utc().toDate();
  const year = targetDate.getUTCFullYear();

  // Verificar se já existe availableDate para esta data
  const existingDate = await getAvailableDateByDate(bloodBanksLocationId, date);
  if (existingDate) {
    throw new Error("Já existe uma data cadastrada para este dia");
  }

  let teamIds: string[] = [];

  if (isAllTeams) {
    // Buscar todos os teams ativos do bloodbank
    const teams = await Team.find({
      bloodBanksLocationId,
      deletedAt: null,
    }).lean();
    teamIds = teams.map((team) => team._id);
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
        teamId,
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
        teamId: slot.teamId,
        startTime,
        endTime,
        locked: false,
      });
    }
  }

  const availableDate = new AvailableDate({
    bloodBanksLocationId,
    date: targetDate,
    year,
    isAllTeams,
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
    const newStartTime = new Date(
      `${availableDate.date.toISOString().split("T")[0]}T${
        updates.startTime
      }:00.000Z`
    );
    slotUpdates["slots.$.startTime"] = newStartTime;
  }

  if (updates.endTime !== undefined) {
    const newEndTime = new Date(
      `${availableDate.date.toISOString().split("T")[0]}T${
        updates.endTime
      }:00.000Z`
    );
    slotUpdates["slots.$.endTime"] = newEndTime;
  }

  if (updates.locked !== undefined) {
    slotUpdates["slots.$.locked"] = updates.locked;
  }

  // Validar que startTime < endTime se ambos foram fornecidos
  const finalStartTime =
    updates.startTime !== undefined
      ? new Date(
          `${availableDate.date.toISOString().split("T")[0]}T${
            updates.startTime
          }:00.000Z`
        )
      : slot.startTime;

  const finalEndTime =
    updates.endTime !== undefined
      ? new Date(
          `${availableDate.date.toISOString().split("T")[0]}T${
            updates.endTime
          }:00.000Z`
        )
      : slot.endTime;

  if (finalStartTime >= finalEndTime) {
    throw new Error("Horário de início deve ser anterior ao horário de fim");
  }

  // Atualizar slot
  const updatedAvailableDate = await AvailableDate.findOneAndUpdate(
    {
      _id: availableDateId,
      bloodBanksLocationId,
      deletedAt: null,
      "slots._id": slotId,
    },
    { $set: slotUpdates },
    { new: true, lean: true }
  );

  return updatedAvailableDate as AvailableDateData | null;
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
  const existingTeamIds = availableDate.slots.map((slot) => slot.teamId);
  const newTeamIds = teamIds.filter((id) => !existingTeamIds.includes(id));

  if (newTeamIds.length === 0) {
    throw new Error(
      "Todos os times selecionados já estão incluídos nesta data"
    );
  }

  // Criar novos slots
  const newSlots = newTeamIds.map((teamId) => ({
    teamId,
    startTime: new Date(
      `${
        availableDate.date.toISOString().split("T")[0]
      }T${defaultStartTime}:00.000Z`
    ),
    endTime: new Date(
      `${
        availableDate.date.toISOString().split("T")[0]
      }T${defaultEndTime}:00.000Z`
    ),
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
  const slot = availableDate.slots.find((s) => s.teamId === teamId);
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
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Buscar availableDates futuras com isAllTeams = true
  const futureAvailableDates = await AvailableDate.find({
    bloodBanksLocationId,
    isAllTeams: true,
    date: { $gte: today },
    deletedAt: null,
  });

  // Adicionar novo team a cada availableDate
  for (const availableDate of futureAvailableDates) {
    const firstSlot = availableDate.slots[0];
    const newSlot = {
      teamId,
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
      (slot) => slot.teamId === teamId && !slot.locked
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
