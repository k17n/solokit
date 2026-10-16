import { contrastRatio } from '@solokit/profile';

function parse(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function toHex(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

/** `weightA` of colour `a` over colour `b`, as upper-case #RRGGBB. */
export function mixHex(a: string, b: string, weightA: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const mix = (x: number, y: number) => x * weightA + y * (1 - weightA);
  return `#${toHex(mix(ar, br))}${toHex(mix(ag, bg))}${toHex(mix(ab, bb))}`.toUpperCase();
}

/** White or near-black text, whichever reads better on the background. */
export function readableOn(background: string): string {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#111827', background) ? '#FFFFFF' : '#111827';
}
