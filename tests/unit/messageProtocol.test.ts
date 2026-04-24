import { describe, expect, it } from 'vitest';

import { isRuntimeRequest } from '../../src/shared/messageProtocol';

describe('isRuntimeRequest', () => {
  it('accepts getKeywords request shape without payload', () => {
    expect(isRuntimeRequest({ type: 'getKeywords' })).toBe(true);
    expect(isRuntimeRequest({ type: 'getKeywords', payload: {} })).toBe(false);
  });
});
