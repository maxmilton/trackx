# Installation

xx

- Frontend is a couple of static headless apps
  - Needs to be compiled with your configuration values
  - Be safely be used with a CDN, even with the HTML cached!
- Backend is a Node.js server

  - Reads a config file on init
  - Safe to use a prebuilt docker image

- Explain:
  - hybrid docker and local file approach
    - ~~easier to get running~~
    - much more control
    - not scalable (but neither is TrackX)

## System requirements

To complete this guide you'll need:

- A Unix-like development environment (Linux, macOS, WSL, etc.). If you're on Windows it's recommended you [install WSL](https://docs.microsoft.com/en-us/windows/wsl/install) and set up your development environment in WSL.
- [Git](https://git-scm.com/), [Docker](https://docs.docker.com/get-docker/), [Docker Compose](https://docs.docker.com/compose/cli-command/#installing-compose-v2), [Node.js](https://nodejs.org/en/download/), and [pnpm](https://pnpm.io/installation) installed in your development environment.
- Docker installed on your server.
- A Linux server with SSH access — a free [AWS EC2 VM](https://aws.amazon.com/free/) or [GCP GCE VM](https://cloud.google.com/free) instance should be enough even for moderate traffic throughput.

## Install steps

TODO: Simplify and refine install process.

> Note: Steps with <span class="tag">SERVER</span> should be done on the server, otherwise perform the step in your development environment.

<!-- TODO: Add tips from https://code.visualstudio.com/docs/containers/ssh -->

1. Git clone or download the source code from <https://github.com/maxmilton/trackx>.
1. Edit the frontend configuration; `packages/trackx-dash/trackx.config.js`.
1. Create a docker compose configuration file from the template and edit if necessary:
   ```sh
   cp docker-compose.yml.template docker-compose.yml
   ```
1. Run the build script:
   ```sh
   ./scripts/build
   ```
1. Copy the resulting `trackx.tar.gz` file to your server.
1. In a new terminal, SSH into your server.
1. <span class="tag">SERVER</span> Unpack `trackx.tar.gz` into `/opt/trackx/`:
   ```sh
   mkdir -p /opt/trackx && tar -xzf trackx.tar.gz -C /opt/trackx && rm trackx.tar.gz
   ```
1. <span class="tag">SERVER</span> Create a backend config from the template and edit:
   ```sh
   cp /opt/trackx/etc/trackx.config.js.template /opt/trackx/etc/trackx.config.js
   ```
1. <span class="tag">SERVER</span> Configure Nginx:
   1. Add your TLS certificate and key files to `/opt/trackx/etc/nginx/certs/`
   1. Edit `/opt/trackx/etc/nginx/conf.d/api.trackx.app.conf`
   1. Edit `/opt/trackx/etc/nginx/conf.d/dash.trackx.app.conf`
1. <span class="tag">SERVER</span> Set file ownership:
   ```sh
   sudo chown -R 506:506 /opt/trackx && sudo chown -R root:root /opt/trackx/etc/nginx && sudo chmod 400 /opt/trackx/etc/nginx/certs/*
   ```
1. Deploy the Docker images to your server:
   ```sh
   DOCKER_HOST='ssh://user@yourserver' docker compose up --build --no-start
   ```
1. <span class="tag">SERVER</span> Run initial install:
   ```sh
   /opt/trackx/bin/trackx install
   ```
1. <span class="tag">SERVER</span> Create new user/s, then add them to your `/opt/trackx/etc/trackx.config.js` file:
   ```sh
   /opt/trackx/bin/trackx adduser
   ```
1. <span class="tag">SERVER</span> Verify your configuration and database. This is optional but highly recommended after changing any configuration and after deployments:
   ```sh
   /opt/trackx/bin/trackx check --all
   ```
1. Start the services:
   ```sh
   DOCKER_HOST='ssh://user@yourserver' docker compose up --build -d
   ```
1. Watch the logs to make sure everything is working correctly:
   ```sh
   DOCKER_HOST='ssh://user@yourserver' docker compose logs -f
   ```

## Tips

- The install process above will build docker images on your server. This can require significant system resources. Be mindful when using a resource constrained machine.
- Use a CDN service (such as [Cloudflare](https://www.cloudflare.com)) in front of your TrackX instance to serve static assets and add a layer of security to your API.
