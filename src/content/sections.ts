export type SectionId =
  | 'overview'
  | 'explorer'
  | 'field'
  | 'starting'
  | 'lab'
  | 'faults'
  | 'experiments'
  | 'quiz'
  | 'reference';

export interface SectionInfo {
  id: SectionId;
  number: number;
  title: string;
  blurb: string;
  stage: number; // index into STAGES, -1 = reference material
  next?: SectionId; // suggested next step
}

/** Suggested learning sequence. */
export const STAGES = [
  { label: 'Explore the motor', entry: 'overview' },
  { label: 'Understand the magnetic field', entry: 'field' },
  { label: 'Learn how starting works', entry: 'starting' },
  { label: 'Run simulations', entry: 'lab' },
  { label: 'Diagnose faults', entry: 'faults' },
  { label: 'Test knowledge', entry: 'experiments' },
] as const satisfies readonly { label: string; entry: SectionId }[];

export const SECTIONS: SectionInfo[] = [
  { id: 'overview', number: 1, title: 'Motor overview', blurb: 'What the motor is, where it is used, and the path from supply to shaft.', stage: 0, next: 'explorer' },
  { id: 'explorer', number: 2, title: '3D motor explorer', blurb: 'Rotate, explode and inspect a representative capacitor-start motor.', stage: 0, next: 'field' },
  { id: 'field', number: 3, title: 'Cross-section & field', blurb: 'Pulsating, double-revolving and two-winding magnetic fields.', stage: 1, next: 'starting' },
  { id: 'starting', number: 4, title: 'Starting methods', blurb: 'Split-phase, capacitor-start, PSC, CSCR and shaded-pole motors.', stage: 2, next: 'lab' },
  { id: 'lab', number: 5, title: 'Physics lab', blurb: 'Adjust the motor, run start-up, read torque-speed and current graphs.', stage: 3, next: 'faults' },
  { id: 'faults', number: 6, title: 'Fault simulator', blurb: 'Fifteen failures, from shorted turns and a shorted stator core to a jammed rotor: how each works, how it damages the motor and what protects it.', stage: 4, next: 'experiments' },
  { id: 'experiments', number: 7, title: 'Guided experiments', blurb: 'Eight structured experiments: predict, run, observe, explain.', stage: 5, next: 'quiz' },
  { id: 'quiz', number: 8, title: 'Knowledge check', blurb: 'Eighteen questions with hints, feedback and a topic breakdown.', stage: 5, next: 'reference' },
  { id: 'reference', number: 9, title: 'Formulas & glossary', blurb: 'Searchable formula sheet with worked examples, and glossary.', stage: -1 },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<SectionId, SectionInfo>;
export const isSectionId = (v: string): v is SectionId => v in SECTION_BY_ID;
