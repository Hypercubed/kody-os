import { mintOtp } from '../src/auth.ts'
import { resolveStore } from '../src/apps/storage.ts'

// Local-dev OTP mint: run with
// `kody execute --target mock --file scripts/mint-dev-otp.ts` from pkg/.
// Returns the 4-digit code exactly once; it is single use, valid for
// 10 minutes, and burns into a 30-day session cookie on first use.
// Treat the returned code like a password and enter it promptly after
// starting `kody dev` — do not store it in a file, definition, or log.
// This script does not change the gate: it is the local equivalent of
// the hosted `mint_otp` export. Mint while `kody dev` is stopped, then
// start it (or restart it afterward); writes made while the preview is
// running never reach its in-memory snapshot.
export default async function main() {
  var store = await resolveStore()
  return await mintOtp(store)
}
