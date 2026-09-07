/**
 * gifenc não publica tipos próprios. Declaração mínima cobrindo só a API
 * usada em scripts/export-gif.ts — ver https://github.com/mattdesl/gifenc.
 */
declare module 'gifenc' {
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number): number[][];
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: number[][]): Uint8Array;

  export interface GIFEncoderWriteFrameOptions {
    palette?: number[][];
    delay?: number;
    transparent?: boolean;
    dispose?: number;
  }

  export interface GIFEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GIFEncoderWriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { auto?: boolean }): GIFEncoderInstance;
  export default GIFEncoder;
}
