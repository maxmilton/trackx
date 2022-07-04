#!/bin/bash

set -x
set -Eeuo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)
repo_root_dir="${script_dir}/../.."
config_path="${repo_root_dir}/packages/trackx-api/trackx.config.js.template"

docker run --rm ci/trackx-api /usr/bin/node cli.js --help
docker run --rm ci/trackx-api /usr/bin/node cli.js --version
docker run --rm ci/trackx-api /usr/bin/node cli.js install --help
docker run --rm ci/trackx-api /usr/bin/node cli.js adduser --help

docker run --rm \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --env CONFIG_PATH="/data/trackx.config.js" \
  --env DB_PATH="/tmp/db/trackx.db" \
  --tmpfs /tmp/db:rw,noexec,nodev,nosuid,uid=5063,gid=5063,mode=0700,size=10m \
  --mount type=bind,src="$config_path",dst=/data/trackx.config.js,ro \
  --mount type=bind,src="${repo_root_dir}/packages/trackx-api/migrations/master.sql",dst=/data/db/master.sql \
  ci/trackx-api /usr/bin/node cli.js install

docker run --rm \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --env CONFIG_PATH="/data/trackx.config.js" \
  --mount type=bind,src="$config_path",dst=/data/trackx.config.js,ro \
  ci/trackx-api /usr/bin/node cli.js adduser -u user@example.com -p 12345678
