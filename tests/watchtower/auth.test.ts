import { describe, expect, it } from 'vitest';
import { parseServiceAccount } from '../../lib/watchtower/http/auth';
import { HttpError } from '../../lib/watchtower/http/types';

const account = { project_id: 'p', client_email: 'sa@p.iam.gserviceaccount.com', private_key: '-----BEGIN-----\\nabc\\n-----END-----\\n' };

function codeOf(raw: string | undefined) {
  try {
    parseServiceAccount(raw);
  } catch (e) {
    return (e as HttpError).code;
  }
  return 'ok';
}

describe('parseServiceAccount', () => {
  it('reads raw JSON and turns escaped newlines in the key into real ones', () => {
    const out = parseServiceAccount(JSON.stringify(account));
    expect(out.private_key).toBe('-----BEGIN-----\nabc\n-----END-----\n');
  });

  it('reads base64-encoded JSON', () => {
    const out = parseServiceAccount(Buffer.from(JSON.stringify(account)).toString('base64'));
    expect(out.client_email).toBe(account.client_email);
  });

  it('reports missing, unparseable and incomplete values with distinct codes', () => {
    expect(codeOf(undefined)).toBe('auth_unconfigured');
    expect(codeOf('  ')).toBe('auth_unconfigured');
    expect(codeOf('{"project_id": "p",')).toBe('auth_misconfigured');
    expect(codeOf(JSON.stringify({ project_id: 'p' }))).toBe('auth_misconfigured');
  });
});
