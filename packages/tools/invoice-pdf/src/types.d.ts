// fontkit ships no types; declare only what the tests use.
declare module 'fontkit' {
  export interface Font {
    familyName: string;
    copyright?: string;
    numGlyphs: number;
    hasGlyphForCodePoint(codePoint: number): boolean;
  }
  export function create(buffer: Uint8Array): Font;
}
