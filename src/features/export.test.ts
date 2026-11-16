import { describe, expect, it } from 'vitest';
import { toCsv } from './export';

describe('exportación CSV', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    expect(toCsv(['a', 'b'], [['José, Pablo', 'dijo "hola"'], ['línea\nnueva', null]])).toBe('a,b\r\n"José, Pablo","dijo ""hola"""\r\n"línea\nnueva",');
  });
});
