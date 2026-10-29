import { ACCESS_HASH_KEY, hashCode, normalizeCode } from '../src/auth.ts'
import { resolveStore } from '../src/apps/storage.ts'

export default async function main(input: { code: string }) {
  var store = await resolveStore()
  await store.set(ACCESS_HASH_KEY, await hashCode(normalizeCode(input.code)))
  return { ok: true }
}
