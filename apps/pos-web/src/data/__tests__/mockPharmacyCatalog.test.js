import { describe, it, expect } from 'vitest';
import { formatStockText } from '../mockPharmacyCatalog';

describe('formatStockText', () => {
  it('formats single unit stock correctly', () => {
    expect(formatStockText(1, 1)).toBe('1 un.');
    expect(formatStockText(15, 1)).toBe('15 un.');
  });

  it('formats boxes and loose units correctly for positive stock', () => {
    // 45 units with 20 units/box -> 2 boxes + 5 loose units
    expect(formatStockText(45, 20)).toBe('2 caj. y 5 un. (45 total)');
    // 40 units with 20 units/box -> 2 boxes
    expect(formatStockText(40, 20)).toBe('2 cajas (40 un.)');
    // 5 units with 20 units/box -> 5 loose units
    expect(formatStockText(5, 20)).toBe('5 un. sueltas');
  });

  it('formats negative stock (discrepancies/deficits) correctly', () => {
    // -45 units with 20 units/box -> -2 caj. y -5 un. (-45 total)
    expect(formatStockText(-45, 20)).toBe('-2 caj. y -5 un. (-45 total)');
    // -40 units with 20 units/box -> -2 cajas (-40 un.)
    expect(formatStockText(-40, 20)).toBe('-2 cajas (-40 un.)');
    // -5 units with 20 units/box -> -5 un. sueltas
    expect(formatStockText(-5, 20)).toBe('-5 un. sueltas');
  });

  it('handles zero and null values gracefully', () => {
    expect(formatStockText(0, 20)).toBe('0 un. sueltas');
    expect(formatStockText(undefined, 20)).toBe('0 un.');
  });
});
