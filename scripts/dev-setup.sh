#!/bin/bash
#
# Set up the environment for development.

set -Eeuo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)

export NODE_ENV=development

pnpm install --dir "${script_dir}/.."
pnpm run --dir "${script_dir}/.." build
pnpm run --dir "${script_dir}/../packages/trackx-cli" trackx -- install
