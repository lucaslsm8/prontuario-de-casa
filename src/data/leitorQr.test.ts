import { describe, expect, it } from 'vitest';
import { conviteDoQr } from './leitorQr';

describe('conviteDoQr', () => {
  it('aceita só PCASA1:', () => {
    expect(conviteDoQr('  PCASA1:abc\n')).toBe('PCASA1:abc');
    expect(conviteDoQr('PCASA1:')).toBeNull();
    expect(conviteDoQr('https://exemplo.com')).toBeNull();
  });
});
