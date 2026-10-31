import { install_from_catalog, list_catalog, update_from_catalog } from '../src/index.ts'

type Input =
  | { op: 'install'; id: string }
  | { op: 'update'; id: string }
  | { op: 'list' }

export default async function main(input: Input) {
  if (input.op === 'install') return await install_from_catalog(input.id)
  if (input.op === 'update') return await update_from_catalog(input.id)
  return list_catalog()
}
