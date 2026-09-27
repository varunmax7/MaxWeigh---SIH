import { describe, expect, it } from 'vitest';
import { convertMass, formatMass, MassParseError, parseMass } from './units.js';

describe('parseMass', () => {
  it.each([
    ['10.005 kg', '10005'],
    ['10005 g', '10005'],
    ['250 mg', '0.25'],
    ['2.5 t', '2500000'],
    ['-5 g', '-5'],
    ['  12  g  ', '12'],
  ])('parses %s → %s g', (input, expected) => {
    expect(parseMass(input)).toBe(expected);
  });

  it('assumes the given unit when none is written', () => {
    expect(parseMass('10005')).toBe('10005'); // default assumed unit: g
    expect(parseMass('10.005', 'kg')).toBe('10005');
  });

  it('is case-insensitive on the unit', () => {
    expect(parseMass('1 KG')).toBe('1000');
  });

  it('rejects a comma as ambiguous', () => {
    expect(() => parseMass('10,005')).toThrow(MassParseError);
    expect(() => parseMass('10,005')).toThrow(/comma/);
  });

  it('rejects unparseable input', () => {
    expect(() => parseMass('heavy')).toThrow(MassParseError);
    expect(() => parseMass('10 lb')).toThrow(MassParseError);
    expect(() => parseMass('')).toThrow(MassParseError);
  });
});

describe('convertMass / formatMass', () => {
  it('converts grams to another unit', () => {
    expect(convertMass('10000', 'kg').toFixed()).toBe('10');
  });

  it('formats with a fixed number of decimal places and the unit suffix', () => {
    expect(formatMass('10000', 'kg', 3)).toBe('10.000 kg');
    expect(formatMass('250', 'mg', 0)).toBe('250000 mg');
  });
});
