import { cleanFields, normaliseAddress } from '@solokit/profile';
import type { Client } from './model';

export function normaliseClient(client: Client): Client {
  const { address, ...rest } = client;
  const result = cleanFields(rest as Client, { gstin: (v) => v.toUpperCase(), pan: (v) => v.toUpperCase(), email: (v) => v.toLowerCase() }, ['name']);
  result.address = normaliseAddress(address);
  return result;
}
