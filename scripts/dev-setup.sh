#!/bin/bash
set -Eeuo pipefail

# Set up the environment for development:
#  1. Install node dependencies.
#  2. Run a build of all packages.
#  3. Run trackx CLI install; set up and check the database.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)

export NODE_ENV=development

pnpm install --dir "${script_dir}/.."
pnpm run --dir "${script_dir}/.." build
pnpm run --dir "${script_dir}/../packages/trackx-cli" trackx -- install
