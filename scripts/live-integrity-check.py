#!/usr/bin/env python3
"""Live integrity check against the published Kody package.

Runs AFTER every publish, BEFORE the package is made public or announced.
Read-only: imports and reads only. Installs nothing, writes no app state,
does not mutate the live instance. Exit 0 when every check passes;
non-zero on any failure, naming the failed check and the observed value.

Checks (in order; the import check fails fast):
  1. import-resolution - the MCP surface is importable from the app entry
  2. list              - list_apps() returns the installed apps
  3. catalog           - list_catalog(base) ids equal the manifest ids
  4. fingerprint       - installed app-store matches its manifest entry
  5. state-read        - get_app_state() reads live state

Execution backend (in order of precedence):
  1. --bridge-command template (or KODY_MCP_BRIDGE_COMMAND): the VM's Kody
     MCP client.py path. The template receives {code} (the ESM module) and
     {params} (JSON) and must print the run's returned JSON to stdout.
  2. `kody execute --code <esm> --json` on PATH (the default): cloud
     execute, which resolves `kody:` imports against the PUBLISHED build.

  --bridge is shorthand for a client.py file: it runs
     python3 <bridge> exec --code <esm>
  and parses the same JSON envelope. If your client's subcommand differs,
  pass the full template via --bridge-command instead.

The fingerprint comparison needs fingerprintDefinition over the installed
definition. The exact implementation lives in pkg/src/apps/registry.ts, so
when `bun` and the repo checkout are present (the normal case: this script
is versioned in the repo and run from a checkout) the script computes the
fingerprint with that exact code. Otherwise it falls back to the embedded
pure-Python port below, which is byte-identical for definitions without an
inline-SVG icon (the app-store uses a text glyph, so the specified check is
always exact). An SVG icon under the fallback reports the check as
unverifiable rather than guessing.

Usage:
  scripts/live-integrity-check.py [--package kody:@hypercubed/kody-os]
      [--catalog-base https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/]
      [--bridge PATH | --bridge-command 'python3 client.py exec --code {code}']
      [--simulate-default-only] [--timeout 120] [--json] [--verbose]

  --simulate-default-only verifies the fail path without a broken publish:
  the import check asserts against a stub module exporting only `default`
  and must fail naming import-resolution.
"""

import argparse
import json
import os
import shlex
import subprocess
import sys
import tempfile
import urllib.request

DEFAULT_PACKAGE = "kody:@hypercubed/kody-os"
DEFAULT_CATALOG_BASE = "https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/"
REQUIRED_MCP_KEYS = [
    "install_from_catalog",
    "add_app",
    "list_apps",
    "get_app",
    "get_app_state",
    "act",
]
HTTP_TIMEOUT = 30

# Read-only allowlist: the only MCP functions this script ever invokes.
# Anything else (add_app, act, install_from_catalog, update_from_catalog,
# remove_app, ...) is never called, so a run cannot write by construction.
READ_ONLY_FNS = {"list_apps", "list_catalog", "get_app", "get_app_state"}


class CheckFailed(Exception):
    def __init__(self, check, observed):
        self.check = check
        self.observed = observed
        super().__init__("check %s failed: %s" % (check, observed))


def run_esm(code, params=None, timeout=120, bridge=None, bridge_command=None, verbose=False):
    """Run an ESM module via cloud execute; return the module's result."""
    if bridge_command:
        cmd = bridge_command.format(
            code=shlex.quote(code), params=shlex.quote(json.dumps(params or {}))
        )
        proc = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        out = proc.stdout.strip()
    elif bridge:
        proc = subprocess.run(
            ["python3", bridge, "exec", "--code", code],
            capture_output=True, text=True, timeout=timeout
        )
        out = proc.stdout.strip()
    else:
        proc = subprocess.run(
            ["kody", "execute", "--code", code, "--json"],
            capture_output=True, text=True, timeout=timeout
        )
        out = proc.stdout.strip()
    if proc.returncode != 0:
        raise CheckFailed(
            "execute-transport",
            "executor exited %d: %s" % (proc.returncode, (proc.stderr or out)[-500:]),
        )
    try:
        envelope = json.loads(out)
    except ValueError:
        raise CheckFailed("execute-transport", "executor printed non-JSON: %s" % out[-300:])
    if isinstance(envelope, dict) and envelope.get("isError") is True:
        raise CheckFailed("execute-transport", "execute reported isError: %s" % out[-500:])
    try:
        result = envelope["structuredContent"]["result"]
    except (KeyError, TypeError):
        raise CheckFailed("execute-transport", "no structuredContent.result in: %s" % out[-300:])
    if isinstance(result, dict) and result.get("error"):
        # A module-level { error } return (e.g. a build/no-export failure
        # surfaced as JSON) is data, not transport failure: return it.
        return result
    return result


def check_import_resolution(run, package, simulate_default_only=False):
    """Core check, runs first: the MCP surface resolves from the app entry."""
    if simulate_default_only:
        code = (
            "const pkg = { default: function main() {} };\n"
            "export default async function main() {\n"
            "  return { keys: Object.keys(pkg).sort() };\n"
            "}\n"
        )
    else:
        code = (
            "import * as pkg from %s;\n"
            "export default async function main() {\n"
            "  return { keys: Object.keys(pkg).sort() };\n"
            "}\n" % json.dumps(package)
        )
    res = run(code)
    keys = res.get("keys") if isinstance(res, dict) else None
    if not isinstance(keys, list):
        raise CheckFailed("import-resolution", "namespace import returned no keys: %r" % (res,))
    if keys == ["default"] or (set(keys) == {"default"}):
        raise CheckFailed(
            "import-resolution",
            "namespace import returned only `default` (app entry lacks the MCP re-exports)",
        )
    missing = [k for k in REQUIRED_MCP_KEYS if k not in keys]
    if missing:
        raise CheckFailed(
            "import-resolution",
            "namespace import missing %s; got keys %s" % (",".join(missing), ",".join(keys)),
        )
    if not simulate_default_only:
        # Single named imports resolve for the same set (spot-check two;
        # a broken build fails with "No matching export" at bundle time).
        for name in ("install_from_catalog", "act"):
            named_code = (
                "import { %s } from %s;\n"
                "export default async function main() {\n"
                "  return { type: typeof %s };\n"
                "}\n" % (name, json.dumps(package), name)
            )
            try:
                named = run(named_code)
            except CheckFailed as exc:
                raise CheckFailed(
                    "import-resolution",
                    "single named import { %s } failed: %s" % (name, exc.observed),
                )
            if not isinstance(named, dict) or named.get("type") != "function":
                raise CheckFailed(
                    "import-resolution",
                    "single named import { %s } is not a function: %r" % (name, named),
                )
    return keys


def check_list(run):
    res = run(
        "import { list_apps } from %s;\n"
        "export default async function main() {\n"
        "  return { apps: await list_apps() };\n"
        "}\n" % json.dumps(PACKAGE_REF[0])
    )
    apps = res.get("apps") if isinstance(res, dict) else None
    if not isinstance(apps, list) or len(apps) == 0:
        raise CheckFailed("list", "list_apps() returned empty/non-list: %r" % (res,))
    for entry in apps:
        if not isinstance(entry, dict) or not entry.get("id") or not entry.get("label"):
            raise CheckFailed("list", "list_apps() entry missing id/label: %r" % (entry,))
        if not isinstance(entry.get("schemaVersion"), int):
            raise CheckFailed(
                "list", "list_apps() entry %r missing schemaVersion" % (entry.get("id"),)
            )
    ids = sorted(e["id"] for e in apps)
    if "app-store" not in ids:
        raise CheckFailed("list", "list_apps() has no app-store; ids: %s" % ",".join(ids))
    return apps


def fetch_manifest(catalog_base):
    url = catalog_base + "catalog.json"
    req = urllib.request.Request(url, headers={"User-Agent": "kody-os-live-integrity-check/1"})
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            body = resp.read().decode("utf-8")
    except Exception as exc:
        raise CheckFailed("catalog", "could not fetch %s: %s" % (url, exc))
    try:
        manifest = json.loads(body)
    except ValueError:
        raise CheckFailed("catalog", "manifest at %s is not JSON" % url)
    apps = manifest.get("apps") if isinstance(manifest, dict) else None
    if not isinstance(apps, list) or len(apps) == 0:
        raise CheckFailed("catalog", "manifest at %s has no apps list" % url)
    return apps


def check_catalog(run, catalog_base, manifest_apps):
    res = run(
        "import { list_catalog } from %s;\n"
        "export default async function main() {\n"
        "  return { apps: await list_catalog(%s) };\n"
        "}\n" % (json.dumps(PACKAGE_REF[0]), json.dumps(catalog_base))
    )
    apps = res.get("apps") if isinstance(res, dict) else None
    if not isinstance(apps, list):
        raise CheckFailed("catalog", "list_catalog() returned non-list: %r" % (res,))
    got = sorted(e["id"] for e in apps if isinstance(e, dict) and e.get("id"))
    want = sorted(e["id"] for e in manifest_apps if isinstance(e, dict) and e.get("id"))
    if got != want:
        raise CheckFailed(
            "catalog",
            "list_catalog() ids (%d: %s) != manifest ids (%d: %s)"
            % (len(got), ",".join(got), len(want), ",".join(want)),
        )
    return apps


# --- Fingerprint: pure-Python port of pkg/src/apps/definition.ts ---
# canonicalizeDefinition -> stableStringify -> FNV-1a x2. Byte-identical to
# the TypeScript for definitions without an inline-SVG icon (SVG needs
# sanitizeSvgIcon; the fallback refuses rather than guessing). Verified
# against `bun -e fingerprintDefinition` for app-store and clock on
# 2026-11-08. If definition.ts changes these functions, re-verify:
#   bun -e 'import { fingerprintDefinition } from "./pkg/src/apps/registry.ts"; ...'
_DEFINITION_SCHEMA_VERSION = 5


def _stable_stringify(value):
    if value is None or not isinstance(value, (dict, list)):
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(_stable_stringify(x) for x in value) + "]"
    parts = []
    for key in sorted(value.keys()):
        if value[key] is None:
            continue
        parts.append(json.dumps(key, ensure_ascii=False) + ":" + _stable_stringify(value[key]))
    return "{" + ",".join(parts) + "}"


def _migrate_action(action):
    if not isinstance(action, dict):
        return action
    if isinstance(action.get("effects"), list):
        return action
    if isinstance(action.get("effect"), dict):
        out = {k: v for k, v in action.items() if k != "effect"}
        out["effects"] = [action["effect"]]
        return out
    return action


def _derive_open_as(ui):
    if not isinstance(ui, dict):
        return "page"
    if ui.get("openAs") in ("page", "modal"):
        return ui["openAs"]
    placements = ui.get("placements")
    if isinstance(placements, list) and "modal" in placements and "page" not in placements:
        return "modal"
    return "page"


def _sanitize_capabilities(caps):
    if not isinstance(caps, dict):
        return None
    out = {}
    has_any = False
    for kind in ("feeds", "proxy"):
        if kind in caps:
            out[kind] = [
                {
                    "name": e["name"],
                    "url": e["url"],
                    "ttlSeconds": e["ttlSeconds"] if isinstance(e.get("ttlSeconds"), int) else 3600,
                    "maxBytes": e["maxBytes"] if isinstance(e.get("maxBytes"), int) else 65536,
                }
                for e in caps[kind]
            ]
            has_any = True
    if "manageApps" in caps:
        out["manageApps"] = caps["manageApps"]
        has_any = True
    if "theme" in caps:
        theme = caps["theme"] or {}
        out["theme"] = {"view": theme.get("view") is True, "set": theme.get("set") is True}
        has_any = True
    return out if has_any else None


def _is_svg_icon(value):
    return isinstance(value, str) and value.lstrip().lower().startswith("<svg")


def _canonicalize(definition):
    raw_files = (definition.get("bundle") or {}).get("files") or {}
    files = {k: str(v) for k, v in raw_files.items()}
    icon = definition.get("icon")
    if _is_svg_icon(icon):
        raise ValueError("svg-icon-fingerprint-unsupported")
    actions = {}
    for name, action in (definition.get("actions") or {}).items():
        actions[name] = _migrate_action(action)
    ui = definition.get("ui") or {}
    ui_out = {}
    if ui.get("title") is not None:
        ui_out["title"] = ui["title"]
    ui_out["openAs"] = _derive_open_as(ui)
    if ui.get("actions") is not None:
        ui_out["actions"] = ui["actions"]
    if ui.get("hideState") is not None:
        ui_out["hideState"] = ui["hideState"]
    if ui.get("menuBar") is not None:
        ui_out["menuBar"] = ui["menuBar"]
    out = {
        "id": definition["id"],
        "name": definition["name"],
        "label": definition.get("label") or definition["name"],
        "schemaVersion": _DEFINITION_SCHEMA_VERSION,
        "icon": icon,
        "category": definition.get("category"),
        "description": definition.get("description"),
        "capabilities": _sanitize_capabilities(definition.get("capabilities")),
        "bundle": {"entry": "index.html", "files": files},
        "ui": ui_out,
        "stateSchema": definition.get("stateSchema"),
        "actions": actions,
    }
    if definition.get("catalogVersion") is not None:
        out["catalogVersion"] = definition["catalogVersion"]
    if definition.get("installMode") is not None:
        out["installMode"] = definition["installMode"]
    if definition.get("minPackageVersion") is not None:
        out["minPackageVersion"] = definition["minPackageVersion"]
    return out


def _utf16_units(text):
    # charCodeAt() iterates UTF-16 code units; astral chars are surrogate pairs.
    units = []
    for char in text:
        point = ord(char)
        if point > 0xFFFF:
            point -= 0x10000
            units.append(0xD800 + (point >> 10))
            units.append(0xDC00 + (point & 0x3FF))
        else:
            units.append(point)
    return units


def fingerprint_definition(definition):
    """FNV-1a x2 fingerprint; raises ValueError for SVG icons (see above)."""
    canon = _canonicalize(definition)
    canon.pop("catalogVersion", None)
    canon.pop("installMode", None)
    text = _stable_stringify(canon)
    hash1 = 2166136261
    hash2 = 2166136261
    for code in _utf16_units(text):
        hash1 = ((hash1 ^ code) * 16777619) & 0xFFFFFFFF
        hash2 = ((hash2 ^ (code + 0x9E3779B9)) * 16777619) & 0xFFFFFFFF
    return "fnv:%d-%d-%d" % (hash1, hash2, len(text))


def fingerprint_with_repo(definition):
    """Exact fingerprint via the repo's own registry.ts; None when unavailable."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    registry = os.path.join(repo_root, "pkg", "src", "apps", "registry.ts")
    if not os.path.isfile(registry):
        return None
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(definition, handle)
        def_path = handle.name
    snippet = (
        "import { fingerprintDefinition } from %s;\n"
        "const def = JSON.parse(await Bun.file(%s).text());\n"
        "console.log(fingerprintDefinition(def));\n"
    ) % (json.dumps(registry), json.dumps(def_path))
    try:
        proc = subprocess.run(
            ["bun", "-e", snippet], capture_output=True, text=True, timeout=60
        )
    except (OSError, subprocess.SubprocessError):
        return None
    finally:
        try:
            os.unlink(def_path)
        except OSError:
            pass
    if proc.returncode != 0:
        return None
    value = proc.stdout.strip().splitlines()
    return value[-1].strip() if value else None


def check_fingerprint(run, catalog_base, manifest_apps):
    entries = [e for e in manifest_apps if isinstance(e, dict) and e.get("id") == "app-store"]
    if not entries:
        raise CheckFailed("fingerprint", "manifest at %s has no app-store entry" % catalog_base)
    manifest = entries[0]
    expected_fp = manifest.get("fingerprint")
    expected_cv = manifest.get("catalogVersion")
    res = run(
        "import { get_app } from %s;\n"
        "export default async function main() {\n"
        "  return { entry: await get_app(\"app-store\") };\n"
        "}\n" % json.dumps(PACKAGE_REF[0])
    )
    entry = res.get("entry") if isinstance(res, dict) else None
    if not isinstance(entry, dict) or "definition" not in entry:
        raise CheckFailed("fingerprint", "get_app(\"app-store\") failed: %r" % (res,))
    installed = entry["definition"]
    installed_cv = installed.get("catalogVersion")
    problems = []
    if installed_cv != expected_cv:
        problems.append(
            "catalogVersion mismatch (installed %r != manifest %r)"
            % (installed_cv, expected_cv)
        )
    actual_fp = fingerprint_with_repo(installed)
    method = "repo registry.ts (exact)"
    if actual_fp is None:
        method = "embedded port"
        try:
            actual_fp = fingerprint_definition(installed)
        except ValueError as exc:
            raise CheckFailed(
                "fingerprint",
                "app-store icon needs sanitizeSvgIcon; %s; run from a repo checkout "
                "with bun so the exact registry.ts implementation is used" % (exc,),
            )
    if actual_fp != expected_fp:
        problems.append(
            "fingerprint mismatch (%s: installed %s != manifest %s)"
            % (method, actual_fp, expected_fp)
        )
    if problems:
        raise CheckFailed("fingerprint", "app-store: " + "; ".join(problems))
    return {"catalogVersion": installed_cv, "fingerprint": actual_fp}


def check_state_read(run):
    res = run(
        "import { get_app_state } from %s;\n"
        "export default async function main() {\n"
        "  return { state: await get_app_state(\"app-store\") };\n"
        "}\n" % json.dumps(PACKAGE_REF[0])
    )
    state = res.get("state") if isinstance(res, dict) else None
    if isinstance(state, dict) and "error" in state:
        raise CheckFailed("state-read", "get_app_state(\"app-store\") error: %s" % state["error"])
    if not isinstance(state, dict):
        raise CheckFailed("state-read", "get_app_state(\"app-store\") not an object: %r" % (res,))
    return state


PACKAGE_REF = [DEFAULT_PACKAGE]


def snapshot_ids(run):
    """Read-only pre/post snapshot: ids plus per-app catalogVersion."""
    res = run(
        "import { get_app, list_apps } from %s;\n"
        "export default async function main() {\n"
        "  const apps = await list_apps();\n"
        "  const versions = {};\n"
        "  for (const a of apps) {\n"
        "    const e = await get_app(a.id);\n"
        "    versions[a.id] = (e && e.definition && e.definition.catalogVersion) || null;\n"
        "  }\n"
        "  return { ids: apps.map(function (a) { return a.id; }).sort(), versions: versions };\n"
        "}\n" % json.dumps(PACKAGE_REF[0])
    )
    if not isinstance(res, dict) or not isinstance(res.get("ids"), list):
        raise CheckFailed("read-only-guard", "snapshot failed: %r" % (res,))
    return res


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--package", default=DEFAULT_PACKAGE)
    parser.add_argument("--catalog-base", default=DEFAULT_CATALOG_BASE)
    parser.add_argument("--bridge", default=os.environ.get("KODY_MCP_BRIDGE", ""))
    parser.add_argument(
        "--bridge-command", default=os.environ.get("KODY_MCP_BRIDGE_COMMAND", "")
    )
    parser.add_argument("--simulate-default-only", action="store_true")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)
    PACKAGE_REF[0] = args.package

    results = {}

    def run(code):
        return run_esm(
            code,
            timeout=args.timeout,
            bridge=args.bridge or None,
            bridge_command=args.bridge_command or None,
            verbose=args.verbose,
        )

    try:
        before = snapshot_ids(run)
        results["import-resolution"] = check_import_resolution(
            run, args.package, simulate_default_only=args.simulate_default_only
        )
        if args.simulate_default_only:
            # The fail path must fail: reaching here means the checker is broken.
            raise CheckFailed(
                "import-resolution",
                "simulate-default-only did not fail (checker broken): keys %r"
                % (results["import-resolution"],),
            )
        results["list"] = [e["id"] for e in check_list(run)]
        manifest_apps = fetch_manifest(args.catalog_base)
        catalog_apps = check_catalog(run, args.catalog_base, manifest_apps)
        results["catalog"] = sorted(e["id"] for e in catalog_apps if isinstance(e, dict))
        results["fingerprint"] = check_fingerprint(run, args.catalog_base, manifest_apps)
        results["state-read"] = check_state_read(run)
        after = snapshot_ids(run)
        if before["ids"] != after["ids"] or before["versions"] != after["versions"]:
            raise CheckFailed(
                "read-only-guard",
                "installed set changed during the run (before %r, after %r)"
                % (before, after),
            )
        results["read-only-guard"] = "unchanged (%d apps)" % len(after["ids"])
    except CheckFailed as exc:
        if args.json:
            print(json.dumps({"ok": False, "failed": exc.check, "observed": exc.observed}))
        else:
            print("FAIL %s: %s" % (exc.check, exc.observed))
        return 1
    if args.json:
        print(json.dumps({"ok": True, "checks": results}))
    else:
        for name in ("import-resolution", "list", "catalog", "fingerprint", "state-read"):
            print("PASS %s" % name)
        print("PASS read-only-guard")
        print("live integrity check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())