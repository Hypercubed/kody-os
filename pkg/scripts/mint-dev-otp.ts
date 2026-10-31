import { mintOtp } from '../src/auth.ts'
import { resolveStore } from '../src/apps/storage.ts'

// Local-dev OTP mint, matching the seed-dev-hash.ts pattern: run with
// `kody execute --target mock --file scripts/mint-dev-otp.ts` from pkg/.
// Returns the 4-digit code exactly once; it is single use, valid for
// 10 minutes, and burns into a 30-day session cookie on first use.
// Treat the returned code like a password and enter it promptly after
// starting `kody dev` — do not store it in a file, definition, or log.
// This script does not change the gate: it is the interim local
// equivalent of the hosted `mint_otp` export, usable before the
// remove-legacy-code change retires the seeded dev code.
export default async function main() {
  var store = await resolveStore()
  return await mintOtp(store)
}
