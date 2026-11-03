import type { CharData } from './data';
import { experienceToNextLevel } from './leveling';
import type { DialogChoice, DialogNode } from '../ui/dialog';
import tutorial from './professionTutorial.json';

export type WorkshopMissionJob = keyof typeof tutorial.jobs;
export const WORKSHOP_MISSION_JOBS = Object.keys(tutorial.jobs) as WorkshopMissionJob[];
export const WORKSHOP_MISSION_REWARD = { experience: 10, pelines: 0 };
export const workshopMissionNeedsGathering = (job: WorkshopMissionJob) => tutorial.jobs[job].recipe === null;

export interface WorkshopMissionProgress {
  status: 'active' | 'completed';
  progress: boolean;
  jobIds: string[];
  startedAt: number;
  completedAt?: number;
}

export interface WorkshopMissionService {
  getState: () => CharData;
  act: (action: string, args: Record<string, unknown>) => Promise<boolean>;
  master: string;
}

interface WorkshopCatalog {
  professions: Record<string, string>;
  teachers: Record<string, { id: string; location: string; x: number; z: number; radius?: number }>;
  recipes: Record<string, { job: string; seconds: number }>;
  nodes: Record<string, { job: string }>;
}

export const workshopMissionId = (job: WorkshopMissionJob) => `workshop-${job}` as const;
export const isWorkshopMissionId = (id: string): id is `workshop-${WorkshopMissionJob}` =>
  id.startsWith('workshop-') && WORKSHOP_MISSION_JOBS.includes(id.slice('workshop-'.length) as WorkshopMissionJob);

export function workshopMissionTitle(profession: string) {
  return `Práctica de ${profession}`;
}

export function workshopMissionActivity(job: WorkshopMissionJob, profession: string) {
  return workshopMissionNeedsGathering(job)
    ? `Equipa la herramienta del oficio y completa una extracción normal de ${profession} en Pompelín.`
    : `Fabrica y recoge una pieza de ${profession} con una receta normal. Si aún no conoces una receta, el maestro puede ayudarte a elegirla.`;
}

export function workshopMissionObjective(job: WorkshopMissionJob, profession: string, progress: boolean) {
  if (progress) return `Vuelve a hablar con el maestro de ${profession} para completar la práctica.`;
  return `${workshopMissionActivity(job, profession)} Después, vuelve a hablar con su maestro.`;
}

export function addWorkshopMission(nodes: Record<string, DialogNode>, job: WorkshopMissionJob, profession: string, service: WorkshopMissionService): DialogChoice {
  const state = () => service.getState();
  const mission = () => state().rpg?.workshopMissions?.[job];
  const reward = { title: workshopMissionTitle(profession), objective: workshopMissionObjective(job, profession, false), ...WORKSHOP_MISSION_REWARD };
  nodes.workshop_mission = {
    get text() {
      const current = mission();
      if (!current) return `¿Te apetece probar ${profession} con una tarea pequeña? Haz una acción normal del oficio y vuelve a hablar conmigo.`;
      if (current.progress) return `Ya has hecho la práctica de ${profession}. Cuando quieras, confirmamos que la terminaste.`;
      return `La práctica sigue pendiente. ${workshopMissionObjective(job, profession, false)}`;
    },
    get quest() {
      const current = mission();
      return !current ? reward : current.status === 'active' && current.progress
        ? { ...reward, objective: workshopMissionObjective(job, profession, true), turnIn: true }
        : undefined;
    },
    choices: [
      { text: 'Aceptar misión', when: () => !mission() && state().rpg?.tutorial?.status === 'completed', action: () => service.act('workshop_mission_accept', { job, master: service.master }), next: 'workshop_mission' },
      { text: 'Completar misión', when: () => mission()?.status === 'active' && mission()?.progress === true, action: () => service.act('workshop_mission_complete', { job, master: service.master }), next: 'workshop_mission_done' },
      { text: 'Volver a mis preguntas', next: 'intro' },
    ],
  };
  nodes.workshop_mission_done = {
    text: `Gracias por probar ${profession}. Has ganado ${WORKSHOP_MISSION_REWARD.experience} XP. Cuando quieras, puedes seguir con otros oficios.`,
    choices: [{ text: 'Volver a mis preguntas', next: 'intro' }],
  };
  return {
    text: '¿Hay alguna práctica para mí?',
    next: 'workshop_mission',
    when: () => state().rpg?.tutorial?.status === 'completed' && mission()?.status !== 'completed',
  };
}

function requireTeacher(data: CharData, job: string, master: unknown, catalog: WorkshopCatalog) {
  const teacher = catalog.teachers[job];
  if (!teacher || master !== teacher.id || data.location !== teacher.location || !data.position
    || Math.hypot(data.position.x - teacher.x, data.position.z - teacher.z) > (teacher.radius ?? 3)) {
    throw new Error('Acércate al maestro de este oficio.');
  }
  return teacher;
}

export function workshopMissionAction(data: CharData, action: string, args: Record<string, unknown>, now: number, catalog: WorkshopCatalog) {
  const state = data.rpg;
  if (!state) throw new Error('No se han cargado tus oficios.');
  const job = String(args.job ?? '');
  if (!WORKSHOP_MISSION_JOBS.includes(job as WorkshopMissionJob)) throw new Error('Elige un oficio válido.');
  requireTeacher(data, job, args.master, catalog);
  const missions = state.workshopMissions ??= {};
  const mission = missions[job];
  if (action === 'workshop_mission_accept') {
    if (state.tutorial?.status !== 'completed') throw new Error('Completa primero la iniciación a un oficio.');
    if (mission) throw new Error('Esta práctica ya está aceptada o completada.');
    missions[job] = { status: 'active', progress: false, jobIds: [], startedAt: now };
    return;
  }
  if (action !== 'workshop_mission_complete') throw new Error('Acción de misión de taller no válida.');
  if (mission?.status !== 'active') throw new Error('No tienes esta práctica pendiente.');
  if (!mission.progress) throw new Error('Completa primero una acción normal de este oficio.');

  if (data.level < 50) {
    let experience = data.experience + WORKSHOP_MISSION_REWARD.experience;
    while (data.level < 50 && experience >= experienceToNextLevel(data.level)) {
      experience -= experienceToNextLevel(data.level);
      data.level++;
    }
    data.experience = data.level >= 50 ? experienceToNextLevel(50) : experience;
  }
  missions[job] = { ...mission, status: 'completed', completedAt: now };
}

export function workshopMissionEvent(data: CharData, action: string, args: Record<string, unknown>, previous: CharData, catalog: WorkshopCatalog) {
  const missions = data.rpg?.workshopMissions;
  if (!missions) return;
  const id = String(args.id ?? '');
  const recipe = catalog.recipes[id];
  const node = catalog.nodes[id];
  const previousJobs = new Set(previous.rpg?.jobs.map(task => task.id) ?? []);

  for (const [job, mission] of Object.entries(missions)) {
    if (mission.status !== 'active') continue;
    if (action === 'collect' || action === 'cancel') {
      if (!mission.jobIds.includes(id)) continue;
      if (action === 'collect') mission.progress = true;
      mission.jobIds = mission.jobIds.filter(jobId => jobId !== id);
      continue;
    }
    if (mission.progress) continue;
    if (action === 'gather_finish' && node?.job === job) {
      mission.progress = true;
    } else if (action === 'craft' && recipe?.job === job) {
      if (recipe.seconds === 0) {
        mission.progress = true;
      } else {
        const newJobs = data.rpg?.jobs.filter(task => task.recipe === id && !previousJobs.has(task.id)).map(task => task.id) ?? [];
        mission.jobIds.push(...newJobs);
      }
    }
  }
}
