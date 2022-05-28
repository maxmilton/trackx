# Install NPM modules including building node-gyp binaries e.g., better-sqlite3
FROM debian:bullseye-slim@sha256:18795937e0baf0c62356592f125b1a42b6f4cffa0bda8e2007824ac8a78ac28a AS install_deps
ENV SQLITE_TOOLS_URL https://www.sqlite.org/2022/sqlite-tools-linux-x86-3380500.zip
ENV SQLITE_TOOLS_SHA3 42a62a0914967cdd9ba6e409750744da5a4cd03a34cbd3208fe8443523fdfacc
RUN set -xe \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    g++ \
    gpg \
    libc6-i386 \
    make \
    python3 \
    rhash \
    unzip \
  && KEYRING=/usr/share/keyrings/nodesource.gpg \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | gpg --dearmor | tee "$KEYRING" >/dev/null \
  && echo "deb [signed-by=$KEYRING] https://deb.nodesource.com/node_18.x bullseye main" | tee /etc/apt/sources.list.d/nodesource.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    nodejs
# Although better-sqlite3 has sqlite3 compiled in, we also need a standalone
# sqlite3 to generate DB table stats data
#   ↳ packages/trackx-api/src/routes/dash/stats.ts
RUN set -xe \
  && curl -fsSL "$SQLITE_TOOLS_URL" -o sqlite-tools.zip \
  && echo "${SQLITE_TOOLS_SHA3} sqlite-tools.zip" | rhash --sha3-256 -c - \
  && unzip -j sqlite-tools.zip
RUN npm install -g pnpm
COPY . /data/
WORKDIR /data/
RUN set -xe \
  && pnpm config set package-import-method=copy \
  && pnpm install --prod --no-lockfile

# Make release image
FROM debian:bullseye-slim@sha256:18795937e0baf0c62356592f125b1a42b6f4cffa0bda8e2007824ac8a78ac28a
ENV NODE_ENV production
RUN set -xe \
  && groupadd -g 5063 -r nodejs \
  && useradd -r -u 5063 -M -s /sbin/nologin -g nodejs nodejs
WORKDIR /data/
COPY --from=install_deps --chown=nodejs:nodejs /data/ /data/
COPY --from=install_deps /usr/bin/node /usr/bin/node
COPY --from=install_deps /sqlite3 /usr/bin/sqlite3
# Fustratingly, SQLite don't provide official 64-bit precompiled binaries so we
# need to add 32-bit C libs to run their 32-bit binary
COPY --from=install_deps /lib/ld-linux.so.2 /lib/ld-linux.so.2
COPY --from=install_deps /lib32/libdl-2.31.so /lib32/libdl.so.2
COPY --from=install_deps /lib32/libm-2.31.so /lib32/libm.so.6
COPY --from=install_deps /lib32/libc-2.31.so /lib32/libc.so.6
USER nodejs:nodejs
CMD ["/usr/bin/node", "--report-on-fatalerror", "server.js"]
