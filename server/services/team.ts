import { Types } from "mongoose";
import { team } from "~/server/models";
const { Team } = team;

export interface TeamData {
  _id: string | Types.ObjectId;
  bloodBanksLocationId: string | Types.UUID;
  name: string;
  color: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getTeamsByBloodBanksLocationId(
  bloodBanksLocationId: string
): Promise<TeamData[]> {
  return await Team.find({
    bloodBanksLocationId,
    deletedAt: null,
  })
    .sort({ _id: 1 })
    .lean();
}

export async function getTeamById(teamId: string): Promise<TeamData | null> {
  return await Team.findOne({
    _id: teamId,
    deletedAt: null,
  }).lean();
}

export async function createTeam(
  bloodBanksLocationId: string,
  name: string,
  color: string
): Promise<TeamData> {
  // Check if team name already exists for this bloodbank
  const existingTeam = await Team.findOne({
    bloodBanksLocationId,
    name,
    deletedAt: null,
  });

  if (existingTeam) {
    throw new Error("Team name already exists for this bloodbank");
  }

  const team = new Team({
    bloodBanksLocationId,
    name,
    color,
  });

  const savedTeam = await team.save();
  return savedTeam.toObject();
}

export async function updateTeam(
  teamId: string,
  bloodBanksLocationId: string,
  updates: { name?: string; color?: string }
): Promise<TeamData | null> {
  // Verify team belongs to bloodbank
  const existingTeam = await Team.findOne({
    _id: teamId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!existingTeam) {
    throw new Error("Team not found or does not belong to this bloodbank");
  }

  // If updating name, check for uniqueness
  if (updates.name && updates.name !== existingTeam.name) {
    const duplicateTeam = await Team.findOne({
      bloodBanksLocationId,
      name: updates.name,
      deletedAt: null,
      _id: { $ne: teamId },
    });

    if (duplicateTeam) {
      throw new Error("Team name already exists for this bloodbank");
    }
  }

  const updatedTeam = await Team.findOneAndUpdate(
    { _id: teamId, bloodBanksLocationId, deletedAt: null },
    updates,
    { new: true, lean: true }
  );

  return updatedTeam;
}

export async function deleteTeam(
  teamId: string,
  bloodBanksLocationId: string
): Promise<boolean> {
  // Verify team belongs to bloodbank
  const existingTeam = await Team.findOne({
    _id: teamId,
    bloodBanksLocationId,
    deletedAt: null,
  });

  if (!existingTeam) {
    throw new Error("Team not found or does not belong to this bloodbank");
  }

  const result = await Team.findOneAndUpdate(
    { _id: teamId, bloodBanksLocationId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );

  return !!result;
}
