import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '../types/document-model';

describe('document-model', () => {
  it('SCHEMA_VERSION should be 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
