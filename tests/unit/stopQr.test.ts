import { issueStopQrToken, verifyStopQrToken } from '../../backend/src/engine/stopQr.js';

export function runStopQrTests(assert: (description: string, pass: boolean) => void) {
  const secret = 'test-secret-with-at-least-thirty-two-characters';
  const now = 1_800_000_000_000;
  const payload = { version: 1 as const, routeId: 'route-1', stopId: 'stop-2', issuedAt: now, expiresAt: now + 60_000 };
  const token = issueStopQrToken(payload, secret);
  const verified = verifyStopQrToken(token, secret, now + 1);
  assert('Signed stop QR token verifies with its signing secret', verified?.routeId === 'route-1' && verified.stopId === 'stop-2');
  const tokenParts = token.split('.');
  tokenParts[2] = (tokenParts[2][0] === 'a' ? 'b' : 'a') + tokenParts[2].slice(1);
  assert('Tampered stop QR token is rejected', verifyStopQrToken(tokenParts.join('.'), secret, now + 1) === null);
  assert('Expired stop QR token is rejected', verifyStopQrToken(token, secret, now + 60_000) === null);
  assert('Stop QR token signed with a different secret is rejected', verifyStopQrToken(token, secret + '-wrong', now + 1) === null);
  assert('Malformed QR token is rejected', verifyStopQrToken('YB1.not-a-token', secret, now + 1) === null);
}
