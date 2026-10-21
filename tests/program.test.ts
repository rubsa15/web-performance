import { describe, expect, it } from 'vitest';
import { buildProgram } from '../src/program.js';

describe('buildProgram', () => {
  it('se llama wperf y describe su propósito en la ayuda', () => {
    const help = buildProgram().helpInformation();
    expect(help).toContain('Usage: wperf');
    expect(help).toContain('Audita el rendimiento');
  });
});
