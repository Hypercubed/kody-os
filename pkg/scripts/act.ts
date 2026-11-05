import { act, get_app_state } from '../src/index.ts'

// Run one declarative action against the mock store, with a
// state read before and after for verification. Run from pkg/
// with kody dev stopped (see scripts/add-app.ts):
//   kody execute --target mock --file scripts/act.ts \
//     --params '{"id":"daily-feed","action":"set_feed","args":{"value":"<feed xml>"}}'
// The params ARE the act call: { id, action, args }.
type Input = { id: string; action: string; args?: Record<string, unknown> }

export default async function main(input: Input) {
  var before = await get_app_state(input.id)
  var result = await act(input.id, input.action, input.args || {})
  var after = await get_app_state(input.id)
  return { before: before, result: result, after: after }
}
