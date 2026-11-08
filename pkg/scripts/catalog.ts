import { install_from_catalog, list_catalog, update_from_catalog } from '../src/index.ts'

type Input =
  | { op: 'install'; id: string; base?: string }
  | { op: 'update'; id: string; base?: string }
  | { op: 'list'; base?: string }

export default async function main(input: Input) {
  if (input.op === 'install') return await install_from_catalog(input.id, undefined, input.base)
  if (input.op === 'update') return await update_from_catalog(input.id, undefined)
  return list_catalog(input.base)
}
