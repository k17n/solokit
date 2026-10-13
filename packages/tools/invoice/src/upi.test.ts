import { describe, expect, it } from 'vitest';
import { buildUpiPayload } from './upi';

describe('buildUpiPayload', () => {
  it('builds a upi://pay link', () => {
    expect(
      buildUpiPayload({
        upiId: 'asha@okhdfc',
        payeeName: 'Asha Rao Consulting',
        amountMinor: 7776000,
        note: 'Invoice 2026-27/0001',
      }),
    ).toBe('upi://pay?pa=asha@okhdfc&pn=Asha%20Rao%20Consulting&am=77760.00&cu=INR&tn=Invoice%202026-27%2F0001');
  });

  it('omits the note when there is none', () => {
    expect(buildUpiPayload({ upiId: 'a.b@upi', payeeName: 'A', amountMinor: 50 })).toBe(
      'upi://pay?pa=a.b@upi&pn=A&am=0.50&cu=INR',
    );
  });

  it('writes whole rupees with two decimals', () => {
    expect(buildUpiPayload({ upiId: 'ab@upi', payeeName: 'A', amountMinor: 100 })).toContain('am=1.00');
    expect(buildUpiPayload({ upiId: 'ab@upi', payeeName: 'A', amountMinor: 12345 })).toContain('am=123.45');
  });

  it('encodes special characters in the payee name and note', () => {
    const link = buildUpiPayload({ upiId: 'ab@upi', payeeName: 'R&D Co.', amountMinor: 100, note: 'a&b=c' });
    expect(link).toContain('pn=R%26D%20Co.');
    expect(link).toContain('tn=a%26b%3Dc');
  });

  it('rejects a malformed UPI id or a non-positive amount', () => {
    expect(() => buildUpiPayload({ upiId: 'no-at', payeeName: 'A', amountMinor: 100 })).toThrow(RangeError);
    expect(() => buildUpiPayload({ upiId: 'ab@upi&x=1', payeeName: 'A', amountMinor: 100 })).toThrow(RangeError);
    expect(() => buildUpiPayload({ upiId: 'ab@upi', payeeName: 'A', amountMinor: 0 })).toThrow(RangeError);
    expect(() => buildUpiPayload({ upiId: 'ab@upi', payeeName: 'A', amountMinor: 1.5 })).toThrow(RangeError);
  });
});
