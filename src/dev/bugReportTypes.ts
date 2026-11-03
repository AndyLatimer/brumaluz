export type ReportCategory = 'bug' | 'visual' | 'suggestion' | 'combat' | 'quest' | 'performance';
export type ReportSeverity = 'low' | 'normal' | 'high' | 'blocker';
export type ReportStatus = 'pending' | 'in_progress' | 'resolved';

export interface BugReportLocation {
  zone: string;
  zoneName: string;
  position: { x: number; y: number; z: number };
  yawDegrees: number;
}

export interface BugReportCamera {
  yaw: number;
  pitch: number;
  dist: number;
}

export interface BugReportCharacter {
  name: string;
  race: string;
  cls: string;
  level?: number;
  health?: number;
  maxHealth?: number;
}

export interface BugReportRenderStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface BugReportSystem {
  userAgent: string;
  viewport: { width: number; height: number };
  pixelRatio: number;
  graphicsMode: 'normal' | 'compatible';
  fps?: number;
  renderStats?: BugReportRenderStats;
  deviceType?: 'desktop' | 'tablet' | 'mobile';
}

export interface BugReportGameplay {
  activeQuests?: string[];
  target?: string | null;
  openWindow?: string | null;
}

export interface BugReportLogEntry {
  type: 'log' | 'warn' | 'error' | 'exception';
  message: string;
  timestamp: string;
}

export interface BugReport {
  id: string;
  timestamp: string;
  dateFormatted: string;
  title: string;
  description: string;
  category: ReportCategory;
  severity: ReportSeverity;
  status: ReportStatus;
  resolutionNotes?: string;
  screenshot?: string; // base64 data URL (anotada o final)
  originalScreenshot?: string; // base64 captura limpia sin anotaciones
  screenshotPath?: string; // ruta relativa en disco, e.g. "reports/screenshots/rep-123.jpg"
  screenshotUrl?: string; // URL dev, e.g. "/__dev/reports/screenshot/rep-123"
  location: BugReportLocation;
  camera: BugReportCamera;
  character: BugReportCharacter;
  system: BugReportSystem;
  gameplay?: BugReportGameplay;
  logs?: BugReportLogEntry[];
}
