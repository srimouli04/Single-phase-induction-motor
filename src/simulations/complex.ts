// Minimal complex-number helpers for phasor calculations (no dependencies).
export interface Complex {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });
export const J: Complex = { re: 0, im: 1 };

export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const scale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k });
export const div = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export const arg = (a: Complex): number => Math.atan2(a.im, a.re);
export const polar = (mag: number, angle: number): Complex => ({
  re: mag * Math.cos(angle),
  im: mag * Math.sin(angle),
});
export const isFiniteComplex = (a: Complex): boolean => Number.isFinite(a.re) && Number.isFinite(a.im);
