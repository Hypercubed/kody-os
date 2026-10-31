import { add_app } from '../src/index.ts'

// Install one app definition directly from a JSON file, with no
// wrapping: run from pkg/ with
//   kody execute --target mock --file scripts/add-app.ts --params "$(cat myapp.json)"
// The params ARE the definition (the same shape as the hosted
// `add_app` MCP export). Do not wrap them as {"op":"add","definition":...}
// — that shape belongs to scripts/registry.ts, not to this script.
// Re-adding an existing id overwrites the definition and preserves
// state by default, like add_app. As with every local registry write,
// do this before starting `kody dev`, or restart it afterward: a
// running preview keeps its mock state in memory.
export default async function main(definition: Parameters<typeof add_app>[0]) {
  return await add_app(definition)
}
