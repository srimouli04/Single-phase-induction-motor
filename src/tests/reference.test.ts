import { describe, expect, it } from 'vitest';
import { FORMULAS, FORMULA_GROUPS, resultText, searchFormulas, searchGlossary, type Formula, type FormulaGroupId } from '../content/formulas';
import { GLOSSARY, getTerm } from '../content/glossary';
import { isSectionId } from '../content/sections';
import { abs } from '../simulations/complex';
import { lineCurrent, summarize } from '../simulations/metrics';
import { DEFAULT_INPUTS, EXAMPLE_MOTOR, electricalFor, solveAtSlip, synchronousSpeedRpm } from '../simulations/motorModel';

const formula = (id: string): Formula => {
  const f = FORMULAS.find((x) => x.id === id);
  if (!f) throw new Error(`no formula ${id}`);
  return f;
};
const ids = (list: { id: string }[]): string[] => list.map((x) => x.id);

/** Evaluates the arithmetic printed after the last "=" of a worked example, using only the text a student reads. */
function calculate(working: string): number {
  const rhs = working
    .slice(working.lastIndexOf('=') + 1)
    .replace(/×10\^\{(−?)(\d+)\}/g, (_m, sign: string, d: string) => `e${sign ? '-' : ''}${d}`)
    .replace(/sin\s*(\d+(?:\.\d+)?)°/g, (_m, d: string) => String(Math.sin((Number(d) * Math.PI) / 180)))
    .replace(/(\d)π/g, '$1×π');
  const tokens: string[] = [];
  const next = /\s*(\d+(?:\.\d+)?(?:e-?\d+)?|[()+−×÷²π])/y;
  let end = 0;
  for (let m = next.exec(rhs); m; m = next.exec(rhs)) {
    tokens.push(m[1]);
    end = next.lastIndex;
  }
  if (rhs.slice(end).trim() !== '') throw new Error(`cannot read "${rhs.slice(end).trim()}" in "${working}"`);
  let i = 0;
  const atom = (): number => {
    const t = tokens[i++];
    if (t === '(') {
      const v = sum();
      if (tokens[i++] !== ')') throw new Error(`missing ")" in "${working}"`);
      return v;
    }
    if (t === 'π') return Math.PI;
    const n = Number(t);
    if (t === undefined || Number.isNaN(n)) throw new Error(`unexpected "${t}" in "${working}"`);
    return n;
  };
  const power = (): number => {
    let v = atom();
    while (tokens[i] === '²') {
      i++;
      v *= v;
    }
    return v;
  };
  const product = (): number => {
    let v = power();
    while (tokens[i] === '×' || tokens[i] === '÷') v = tokens[i++] === '×' ? v * power() : v / power();
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (tokens[i] === '+' || tokens[i] === '−') v = tokens[i++] === '+' ? v + product() : v - product();
    return v;
  };
  const v = sum();
  if (i !== tokens.length) throw new Error(`left over "${tokens.slice(i).join('')}" in "${working}"`);
  return v;
}

describe('the worked-example calculator used by these tests', () => {
  it('reads the arithmetic the sheet prints', () => {
    expect(calculate('N_s = 120 × 60 ÷ 4')).toBe(1800);
    expect(calculate('s = (1800 − 1746) ÷ 1800')).toBeCloseTo(0.03, 12);
    expect(calculate('T_2 ÷ T_1 = (96 ÷ 120)²')).toBeCloseTo(0.64, 12);
    expect(calculate('ω_s = 4π × 60 ÷ 4')).toBeCloseTo(60 * Math.PI, 9);
    expect(calculate('X_c = 1 ÷ (2π × 60 × 150×10^{−6})')).toBeCloseTo(1 / (2 * Math.PI * 60 * 150e-6), 9);
    expect(calculate('T ÷ T_{max} = sin 30°')).toBeCloseTo(0.5, 12);
    expect(calculate('T_f = 2 × 3 × 4² ÷ 8')).toBe(12);
    expect(calculate('a = 2 + 3 × 4 − 5')).toBe(9);
  });
  it('refuses what it cannot read, so a typo in a worked example cannot slip through', () => {
    for (const bad of ['x = 2 × abc', 'x = (2 + 3', 'x = 2 +', 'x = 2 3', 'x = 4 ÷ 2)']) expect(() => calculate(bad), bad).toThrow();
  });
});

describe('formula sheet content', () => {
  it('has at least 15 formulas with their own ids, spread over every group', () => {
    expect(FORMULAS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ids(FORMULAS)).size).toBe(FORMULAS.length);
    for (const g of Object.keys(FORMULA_GROUPS) as FormulaGroupId[]) expect(FORMULAS.filter((f) => f.group === g).length, g).toBeGreaterThanOrEqual(3);
    expect(FORMULAS.every((f) => f.group in FORMULA_GROUPS)).toBe(true);
  });

  it('describes every formula completely: symbols, use and a worked example', () => {
    for (const f of FORMULAS) {
      expect(f.name.length, `${f.id} name`).toBeGreaterThan(3);
      expect(f.expr.length, `${f.id} expr`).toBeGreaterThan(5);
      expect(f.symbols.length, `${f.id} symbols`).toBeGreaterThanOrEqual(2);
      expect(f.use.length, `${f.id} use`).toBeGreaterThan(30);
      expect(f.example, `${f.id} example`).toBeDefined();
      expect(f.example?.given.length, `${f.id} given`).toBeGreaterThanOrEqual(1);
      expect(f.example?.working, `${f.id} working`).toContain('=');
    }
  });

  it('links only to glossary terms and sections that exist, and to no others', () => {
    for (const f of FORMULAS) {
      for (const t of f.related ?? []) expect(getTerm(t), `${f.id} → ${t}`).toBeDefined();
      if (f.tryIt) {
        expect(isSectionId(f.tryIt.target), `${f.id} target`).toBe(true);
        expect(f.tryIt.label.length, `${f.id} label`).toBeGreaterThan(10);
      }
    }
  });

  it('keeps the glossary consistent: unique ids, complete entries, related terms that exist', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ids(GLOSSARY)).size).toBe(GLOSSARY.length);
    expect(new Set(GLOSSARY.map((g) => g.term)).size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) {
      expect(g.short.length, `${g.id} short`).toBeGreaterThan(20);
      expect(g.long.length, `${g.id} long`).toBeGreaterThan(40);
      for (const rel of g.related ?? []) {
        expect(getTerm(rel), `${g.id} → ${rel}`).toBeDefined();
        expect(rel, `${g.id} relates to itself`).not.toBe(g.id);
      }
    }
  });
});

describe('worked examples', () => {
  // Worked by hand, independently of the code: 120·60/4, 4π·60/4, (1800−1746)/1800, ...
  const BY_HAND: Record<string, string> = {
    'sync-speed': '1800 rpm',
    'sync-omega': '188.5 rad/s',
    slip: '0.03',
    'rotor-speed': '1746 rpm',
    'rotor-frequency': '1.8 Hz',
    'backward-slip': '1.97',
    'electrical-angle': '90°',
    'pulsating-field': '0.4 T',
    'start-torque-phase': '50 %',
    'capacitor-reactance': '17.7 Ω',
    'switch-speed': '1350 rpm',
    'net-torque': '0.857 N·m',
    'field-torque': '0.905 N·m',
    'equation-of-motion': '518 rad/s²',
    'voltage-torque': '64 %',
    'shaft-power': '146 W',
    efficiency: '71 %',
    'power-factor': '0.52',
  };

  it('are all covered by a hand calculation, and give the same printed result', () => {
    expect(Object.keys(BY_HAND).sort()).toEqual(ids(FORMULAS).sort());
    for (const f of FORMULAS) expect(resultText(f.example!), f.id).toBe(BY_HAND[f.id]);
  });

  it('can be redone from the printed working and give the printed result', () => {
    for (const f of FORMULAS) {
      const e = f.example!;
      const done = calculate(e.working) * (e.unit === '%' ? 100 : 1);
      expect(Math.abs(done - e.value), `${f.id}: ${e.working}`).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(e.value)));
      expect(done.toFixed(e.digits), `${f.id} printed result`).toBe(e.value.toFixed(e.digits));
    }
  });

  it('agree with the model the Physics lab runs on', () => {
    const main = solveAtSlip(EXAMPLE_MOTOR, electricalFor(DEFAULT_INPUTS, EXAMPLE_MOTOR, false), 0.03);
    expect(Math.abs(formula('net-torque').example!.value - (main.torqueF - main.torqueB))).toBeLessThan(0.001);
    expect(Math.abs(formula('field-torque').example!.value - main.torqueF)).toBeLessThan(0.001);
    // the printed R_F and |I_f| are the model's
    expect(formula('field-torque').example!.given).toContainEqual(['R_F', `${main.zF.re.toFixed(2)} Ω`]);
    expect(formula('field-torque').example!.given).toContainEqual(['|I_f|', `${abs(main.iF).toFixed(3)} A`]);
    expect(formula('sync-speed').example!.value).toBe(synchronousSpeedRpm(60, 4));
  });

  it('use the figures the Physics lab shows for its default settings', () => {
    const lab = summarize(DEFAULT_INPUTS);
    const given = (id: string) => Object.fromEntries(formula(id).example!.given);
    expect(given('shaft-power').N).toBe(`${Math.round((lab.startup.finalOmega * 60) / (2 * Math.PI))} rpm`);
    expect(given('efficiency')['P_{out}']).toBe(`${Math.round(lab.outputPower)} W`);
    expect(given('efficiency')['P_{in}']).toBe(`${Math.round(lab.run.inputPower)} W`);
    expect(given('power-factor').P).toBe(`${Math.round(lab.run.inputPower)} W`);
    expect(given('power-factor').I).toBe(`${lineCurrent(lab.run).toFixed(1)} A`);
    expect(given('equation-of-motion')['T_{motor}']).toBe(`${lab.startTorque.toFixed(2)} N·m`);
    // the printed power factor and efficiency are the same to the digit the Lab shows
    expect(formula('power-factor').example!.value.toFixed(2)).toBe(lab.run.powerFactor.toFixed(2));
    expect(Math.round(formula('efficiency').example!.value)).toBe(Math.round(100 * lab.efficiency!));
    // initial acceleration: from the exact starting torque it differs from the printed one by less than 1 rad/s²
    expect(Math.abs(formula('equation-of-motion').example!.value - (lab.startTorque - DEFAULT_INPUTS.loadTorque) / DEFAULT_INPUTS.inertia)).toBeLessThan(1);
    expect(formula('capacitor-reactance').example!.remark).toContain(`${Math.round(lab.start.auxLeadDeg)}°`);
  });
});

describe('searching the formulas', () => {
  it('returns everything for an empty or blank query, and nothing for nonsense', () => {
    expect(searchFormulas('')).toHaveLength(FORMULAS.length);
    expect(searchFormulas('   ')).toHaveLength(FORMULAS.length);
    expect(searchFormulas('xyzzy')).toEqual([]);
  });

  it('narrows by group, and the group sizes add up', () => {
    const groups = Object.keys(FORMULA_GROUPS) as FormulaGroupId[];
    expect(groups.reduce((n, g) => n + searchFormulas('', g).length, 0)).toBe(FORMULAS.length);
    expect(searchFormulas('', 'power').every((f) => f.group === 'power')).toBe(true);
    expect(searchFormulas('slip', 'power')).toEqual([]);
    expect(searchFormulas('slip', 'speed').length).toBeGreaterThanOrEqual(3);
    expect(searchFormulas('slip').length).toBeGreaterThanOrEqual(searchFormulas('slip', 'speed').length);
  });

  it('finds a formula by its name, in any case', () => {
    for (const f of FORMULAS) {
      expect(ids(searchFormulas(f.name)), f.name).toContain(f.id);
      expect(ids(searchFormulas(f.name.toUpperCase())), f.name).toContain(f.id);
    }
  });

  it('finds a formula by a symbol, with or without the markup characters', () => {
    expect(ids(searchFormulas('N_s'))).toContain('sync-speed');
    expect(ids(searchFormulas('ns'))).toContain('sync-speed');
    expect(ids(searchFormulas('ω_s'))).toEqual(expect.arrayContaining(['sync-omega', 'field-torque']));
    expect(ids(searchFormulas('T_{net}'))).toContain('net-torque');
    expect(ids(searchFormulas('tnet'))).toContain('net-torque');
    expect(ids(searchFormulas('X_c'))).toContain('capacitor-reactance');
  });

  it('finds a formula by the name of a Greek letter or another keyword', () => {
    expect(ids(searchFormulas('omega'))).toContain('sync-omega');
    expect(ids(searchFormulas('phi'))).toContain('start-torque-phase');
    expect(ids(searchFormulas('horsepower'))).toContain('shaft-power');
    expect(ids(searchFormulas('microfarad'))).toContain('capacitor-reactance');
  });

  it('needs every word to match, in any order', () => {
    const both = searchFormulas('capacitor reactance');
    expect(ids(both)).toContain('capacitor-reactance');
    expect(ids(searchFormulas('reactance capacitor'))).toEqual(ids(both));
    expect(searchFormulas('capacitor xyzzy')).toEqual([]);
    expect(searchFormulas('capacitor reactance').length).toBeLessThanOrEqual(searchFormulas('capacitor').length);
  });
});

describe('searching the glossary', () => {
  it('returns every term for an empty query, in alphabetical order, without reordering the glossary itself', () => {
    const first = GLOSSARY[0].id;
    const all = searchGlossary('');
    expect(all).toHaveLength(GLOSSARY.length);
    const terms = all.map((g) => g.term);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b)));
    expect(GLOSSARY[0].id).toBe(first);
  });

  it('finds every term by its own name', () => {
    for (const g of GLOSSARY) expect(ids(searchGlossary(g.term)), g.term).toContain(g.id);
  });

  it('finds terms by words and symbols in their explanations', () => {
    expect(ids(searchGlossary('capacitor'))).toContain('capacitor');
    expect(ids(searchGlossary('N_s'))).toContain('syncSpeed');
    expect(ids(searchGlossary('CAPACITOR'))).toEqual(ids(searchGlossary('capacitor')));
    expect(searchGlossary('xyzzy')).toEqual([]);
  });
});
