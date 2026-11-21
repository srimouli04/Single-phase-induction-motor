// One-call summary of a lab configuration: used by the Lab, the guided experiments and the fault simulator.
import {
  EXAMPLE_MOTOR,
  breakdownTorque,
  electricalFor,
  hasStartCircuit,
  solveAtSpeed,
  syncOmega,
  synchronousSpeedRpm,
  type LabInputs,
  type MotorParams,
  type Solution,
} from './motorModel.ts';
import { analyzeStartup, buildCurves, type CurvePack, type StartupAnalysis, type StartupOutcome } from './dynamics.ts';

export interface LabSummary {
  inputs: LabInputs;
  motor: MotorParams;
  nsRpm: number;
  curves: CurvePack;
  startup: StartupAnalysis;
  /** Standstill solution with the start circuit as wired. */
  start: Solution;
  /** Net torque at standstill with the start circuit as wired [N.m] (0 for a main-winding-only motor). */
  startTorque: number;
  /** Line current at standstill [A rms]. */
  startCurrent: number;
  /** Operating point at the final speed and switch state (quasi-static phasor solution). */
  run: Solution;
  /** True when the motor ends up turning; otherwise `run` is the locked / humming condition. */
  running: boolean;
  /** Mechanical output at the shaft, torque x speed [W]. */
  outputPower: number;
  /** Output / input power [0..1], null when the motor is not turning. */
  efficiency: number | null;
  breakdown: { torque: number; speedRpm: number };
  /** Breakdown torque / load torque (null for zero load). */
  overloadMargin: number | null;
}

export interface SummaryOptions {
  /** Simulated time limit [s]. */
  tMax?: number;
  /** Initial speed as a fraction of synchronous speed ("spin the shaft by hand"). */
  startFraction?: number;
}

export function summarize(inputs: LabInputs, motor: MotorParams = EXAMPLE_MOTOR, opts: SummaryOptions = {}): LabSummary {
  const nsRpm = synchronousSpeedRpm(inputs.frequencyHz, inputs.poles);
  const omega0 = (opts.startFraction ?? 0) * syncOmega(inputs.frequencyHz, inputs.poles);
  const startup = analyzeStartup(inputs, { motor, tMax: opts.tMax ?? 12, omega0 });
  const curves = buildCurves(inputs, motor);
  // At standstill the start circuit is connected unless the switch is stuck open (PSC has no switch).
  const auxAtStart = hasStartCircuit(inputs) && (inputs.method === 'psc' || inputs.switchFault !== 'stuck-open');
  const start = solveAtSpeed(motor, electricalFor(inputs, motor, auxAtStart), 0);
  const run = solveAtSpeed(motor, electricalFor(inputs, motor, startup.auxOnAtEnd), startup.finalOmega);
  const running = Math.abs(startup.finalOmega) > 0.05 * syncOmega(inputs.frequencyHz, inputs.poles);
  const outputPower = running ? inputs.loadTorque * Math.abs(startup.finalOmega) : 0;
  const breakdown = breakdownTorque(motor, electricalFor(inputs, motor, startup.auxOnAtEnd));
  return {
    inputs,
    motor,
    nsRpm,
    curves,
    startup,
    start,
    startTorque: start.torqueNet,
    startCurrent: Math.hypot(start.iLine.re, start.iLine.im),
    run,
    running,
    outputPower,
    efficiency: running && run.inputPower > 0 ? Math.min(1, outputPower / run.inputPower) : null,
    breakdown,
    overloadMargin: inputs.loadTorque > 0 ? breakdown.torque / inputs.loadTorque : null,
  };
}

/** True when the motor ends up turning against its normal direction (e.g. auxiliary leads swapped). */
export const turnsInReverse = (s: LabSummary): boolean => s.running && s.startup.finalOmega < 0;

/** Magnitude of the line current phasor [A rms]. */
export const lineCurrent = (s: Solution): number => Math.hypot(s.iLine.re, s.iLine.im);
export const mainCurrent = (s: Solution): number => Math.hypot(s.iMain.re, s.iMain.im);
export const auxCurrent = (s: Solution): number => Math.hypot(s.iAux.re, s.iAux.im);

export const OUTCOME_TEXT: Record<StartupOutcome, { label: string; tone: 'ok' | 'warn' | 'bad'; detail: string }> = {
  settles: { label: 'Starts and settles', tone: 'ok', detail: 'The motor accelerates and settles at a steady speed.' },
  'no-start': { label: 'Does not start', tone: 'bad', detail: 'The net torque at standstill cannot overcome the load, so the rotor stays still and hums.' },
  stalls: { label: 'Stalls', tone: 'bad', detail: 'The rotor accelerated but could not keep up with the load and slowed back to a stop.' },
  cycles: { label: 'Cycles on and off', tone: 'warn', detail: 'The start circuit keeps cutting out and cutting back in as the speed hunts around the switch speed.' },
  slow: { label: 'Still accelerating', tone: 'warn', detail: 'The motor had not reached a steady speed by the end of the simulated time.' },
};
