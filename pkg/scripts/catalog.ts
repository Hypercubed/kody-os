import { install_from_catalog, list_catalog, update_from_catalog } from '../src/index.ts'
import { clear_dev_catalog_base, set_dev_catalog_base } from '../src/apps/index.ts'

type Input =
  | { op: 'install'; id: string; base?: string }
  | { op: 'update'; id: string; base?: string }
  | { op: 'list'; base?: string }
  | { op: 'dev-base'; base?: string }

export default async function main(input: Input) {
  if (input.op === 'install') return await install_from_catalog(input.id, undefined, input.base)
  if (input.op === 'update') return await update_from_catalog(input.id, undefined)
  if (input.op === 'dev-base') {
    if (input.base !== undefined) return await set_dev_catalog_base(input.base, undefined)
    return await clear_dev_catalog_base(undefined)
  }
  return list_catalog(input.base)
}
