## 1. Registry: time source and calendar op

- [ ] 1.1 Add `fromNow` to `set`-effect validation (string target required, mutually exclusive with `value`/`fromArg`) and verify `add_app` rejects `fromNow` on a non-string field and alongside `value`, with no writes
- [ ] 1.2 Implement `fromNow` application in `act` (writes current ISO 8601 UTC time, same atomicity path as every effect) and verify a Refresh action updates only the time field via `get_app_state`
- [ ] 1.3 Implement the deterministic `calendar` effect op (month grid from integer offset; invalid offset type rejected, no partial writes) and verify identical offsets produce byte-identical grids

## 2. Test apps

- [ ] 2.1 Add `helloClockDefinition` (string `time` + Refresh action via `fromNow`, generic rendering only) and verify add → act → state shows a fresh timestamp
- [ ] 2.2 Add `helloCalendarDefinition` (integer `monthOffset`, grid string, prev/next-month actions) and verify navigation recomputes the grid deterministically for known offsets
- [ ] 2.3 Verify both apps export/import round-trip byte-identical through a blank store, and that neither definition relies on template-specific rendering

## 3. Verification

- [ ] 3.1 Run the full change checks (all prior suites green plus new `fromNow`/`calendar` cases) and verify `openspec validate` passes for the change
