// Minimal module declarations for verovio, which ships no TypeScript types.
// Only the surface used by validate-musicxml.ts is declared.

declare module "verovio/wasm" {
  export interface VerovioModule {
    cwrap: (...args: unknown[]) => (...args: unknown[]) => unknown;
  }
  const createVerovioModule: () => Promise<VerovioModule>;
  export default createVerovioModule;
}

declare module "verovio/esm" {
  import type { VerovioModule } from "verovio/wasm";

  export class VerovioToolkit {
    constructor(module: VerovioModule);
    getVersion(): string;
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    getPageCount(): number;
    getLog(): string;
    renderToSVG(pageNumber: number): string;
  }

  export function enableLogToBuffer(value: number, module: VerovioModule): void;
}
