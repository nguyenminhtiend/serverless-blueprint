import { describe, expect, it } from 'vitest';

describe('Basic Unit Test Example', () => {
  it('should demonstrate basic testing', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  it('should test string operations', () => {
    const greeting = 'Hello World';
    expect(greeting).toContain('World');
    expect(greeting.length).toBe(11);
  });
});
