import type { FishingPhase, FishingResult, FishingSessionConfig } from '../types';

export class FishingMinigameController {
  constructor(
    hostElement: HTMLElement,
    initialConfig?: FishingSessionConfig,
    options?: { enableDebugPanel?: boolean }
  );

  on(event: 'phaseChange', callback: (phase: FishingPhase) => void): () => void;
  on(event: 'bite', callback: () => void): () => void;
  on(event: 'progress', callback: (data: { progress: number; tension: number }) => void): () => void;
  on(event: 'catch', callback: (result: FishingResult) => void): () => void;
  on(event: 'escape', callback: (result: FishingResult) => void): () => void;
  on(event: 'complete', callback: (result: FishingResult) => void): () => void;
  on(event: 'cancel', callback: () => void): () => void;
  on(event: string, callback: (data: any) => void): () => void;

  off(event: string, callback: Function): void;

  setZone(zoneId: string): void;
  setEquipment(rodId: string, baitId?: string): void;
  cancel(): void;
  restart(): void;
  destroy(): void;

  static launch(
    target: HTMLElement,
    config?: FishingSessionConfig
  ): FishingMinigameController;
}

