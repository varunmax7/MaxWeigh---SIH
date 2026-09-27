import { describe, expect, it } from 'vitest';
import { D, Decimal, isMultipleOf, roundToStep, toDec } from './decimal.js';

describe('D', () => {
  it('parses a string, wraps a number, and passes through a Decimal unchanged', () => {
    expect(D('1.5').toFixed()).toBe('1.5');
    expect(D(2).toFixed()).toBe('2');
    const original = new Decimal('3.25');
    expect(D(original)).toBe(original);
  });
});

describe('toDec', () => {
  it('serializes without exponential notation', () => {
    expect(toDec(new Decimal('0.0000001'))).toBe('0.0000001');
    expect(toDec(new Decimal('123456789012345'))).toBe('123456789012345');
  });
});

describe('roundToStep', () => {
  it('rounds half away from zero to the nearest step', () => {
    expect(roundToStep(new Decimal('12.4'), new Decimal(5)).toFixed()).toBe('10');
    expect(roundToStep(new Decimal('12.5'), new Decimal(5)).toFixed()).toBe('15');
    expect(roundToStep(new Decimal('-12.5'), new Decimal(5)).toFixed()).toBe('-15');
  });

  it('rejects a non-positive step', () => {
    expect(() => roundToStep(new Decimal(10), new Decimal(0))).toThrow(RangeError);
    expect(() => roundToStep(new Decimal(10), new Decimal(-1))).toThrow(RangeError);
  });
});

describe('isMultipleOf', () => {
  it('is true for an exact multiple and false otherwise', () => {
    expect(isMultipleOf(new Decimal(10), new Decimal(5))).toBe(true);
    expect(isMultipleOf(new Decimal(11), new Decimal(5))).toBe(false);
  });

  it('is false for a non-positive step', () => {
    expect(isMultipleOf(new Decimal(10), new Decimal(0))).toBe(false);
    expect(isMultipleOf(new Decimal(10), new Decimal(-5))).toBe(false);
  });
});
