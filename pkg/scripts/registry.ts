import { add_app, list_apps, remove_app } from '../src/index.ts'

type Input =
  | { op: 'add'; definition: Parameters<typeof add_app>[0] }
  | { op: 'list' }
  | { op: 'remove'; id: string }

export default async function main(input: Input) {
  if (input.op === 'add') return await add_app(input.definition)
  if (input.op === 'remove') return await remove_app(input.id)
  return await list_apps()
}
