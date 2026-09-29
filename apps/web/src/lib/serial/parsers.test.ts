import { describe, expect, it } from 'vitest';
import { buildCustomProfile, getSerialParserProfile } from './parsers.js';

describe('and-style profile', () => {
  const profile = getSerialParserProfile('and-style');
  if (!profile) throw new Error('and-style profile missing');

  it('parses a stable reading', () => {
    expect(profile.parse('ST,+00123.45,g')).toEqual({ value: '123.45', unit: 'g', stable: true });
  });

  it('parses an unstable reading', () => {
    expect(profile.parse('US,-0012.3,kg')).toEqual({ value: '-12.3', unit: 'kg', stable: false });
  });

  it('ignores an overload line', () => {
    expect(profile.parse('OL,+99999.9,g')).toBeNull();
  });

  it('ignores a non-matching line', () => {
    expect(profile.parse('garbage output')).toBeNull();
  });
});

describe('generic-csv profile', () => {
  const profile = getSerialParserProfile('generic-csv');
  if (!profile) throw new Error('generic-csv profile missing');

  it('parses value,unit,stable', () => {
    expect(profile.parse('12.345,kg,stable')).toEqual({
      value: '12.345',
      unit: 'kg',
      stable: true,
    });
  });

  it('parses value,unit,unstable', () => {
    expect(profile.parse('12.345,kg,unstable')).toEqual({
      value: '12.345',
      unit: 'kg',
      stable: false,
    });
  });

  it('rejects a non-numeric value', () => {
    expect(profile.parse('abc,kg,stable')).toBeNull();
  });

  it('rejects a line with the wrong field count', () => {
    expect(profile.parse('12.345,kg')).toBeNull();
  });
});

describe('buildCustomProfile', () => {
  it('parses named capture groups', () => {
    const profile = buildCustomProfile('(?<value>-?\\d+(?:\\.\\d+)?)\\s*(?<unit>[a-z]+)');
    expect(profile.parse('45.6 kg')).toEqual({ value: '45.6', unit: 'kg', stable: true });
  });

  it('respects an explicit stable group', () => {
    const profile = buildCustomProfile('(?<value>\\d+)\\|(?<unit>\\w+)\\|(?<stable>ST|US)');
    expect(profile.parse('10|g|US')).toEqual({ value: '10', unit: 'g', stable: false });
  });

  it('never throws on an invalid pattern — it just matches nothing', () => {
    const profile = buildCustomProfile('(unterminated');
    expect(() => profile.parse('anything')).not.toThrow();
    expect(profile.parse('anything')).toBeNull();
  });
});
