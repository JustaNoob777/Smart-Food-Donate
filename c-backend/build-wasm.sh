#!/usr/bin/env bash
# Rebuild public/ds.wasm from the C data-structure engine.
#
# Needs a wasm-capable clang, e.g. wasi-sdk:
#   https://github.com/WebAssembly/wasi-sdk/releases
#
#   ./c-backend/build-wasm.sh /path/to/wasi-sdk-25.0-x86_64-linux
#
# The module is freestanding (-nostdlib): wasm_api.c ships its own
# memcpy/memset and a bump allocator, so no WASI runtime is required in
# the browser.
set -euo pipefail

SDK="${1:-${WASI_SDK:-}}"
if [ -z "$SDK" ]; then
  echo "Usage: $0 <wasi-sdk-dir>   (or set WASI_SDK=...)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$SDK/bin/clang" \
  --target=wasm32-unknown-unknown -nostdlib -O2 -Wall -Wextra \
  -Wl,--no-entry -Wl,--export-memory \
  -Wl,--initial-memory=16777216 -Wl,--max-memory=134217728 \
  -Wl,-z,stack-size=131072 \
  "$ROOT/c-backend/ds.c" "$ROOT/c-backend/wasm_api.c" \
  -o "$ROOT/public/ds.wasm"

echo "wrote $ROOT/public/ds.wasm ($(wc -c < "$ROOT/public/ds.wasm") bytes)"
