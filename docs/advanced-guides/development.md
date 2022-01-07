# Development

This page is for developers working on TrackX itself.

Developers should use a Unix-like environment (Linux, macOS, WSL, etc.). If you're on windows, it's recommended you [install WSL](https://docs.microsoft.com/en-us/windows/wsl/install) and set up your development environment in there. You'll also need to have [Git](https://git-scm.com/), [Docker](https://docs.docker.com/get-docker/), [Docker Compose](https://docs.docker.com/compose/install/), [Node.js](https://nodejs.org/en/download/), and [pnpm](https://pnpm.io/installation) installed.

We use `pnpm` for node package management. Don't worry if you havn't used pnpm (or any of the other tools) before, you should be able to get started just by running the bellow commands.

If you need help, start a [discussion on GitHub](https://github.com/maxmilton/trackx/discussions).

## Installation

1. Fork or clone <https://github.com/maxmilton/trackx>.
1. Install dependencies:
   ```sh
   pnpm install
   ```
1. Run the initial setup script (builds packages and sets up a database):
   ```sh
   pnpm run setup
   ```

## Development build

Run the following, each in a new terminal:

```sh
pnpn run serve
```

```sh
cd packages/trackx-api
pnpn run dev
```

```sh
cd packages/trackx-dash
pnpm run dev
```

```sh
cd packages/trackx-login
pnpm run dev
```

Open <http://localhost:5000> in your browser. Alternatively, open <http://localhost:5001> for the API without rate limiting. If you use 5001, you'll need to change `REPORT_API_ENDPOINT` and `DASH_ORIGIN` in `packages/trackx-api/trackx.config.js`.

Log in with email `dev@user` and password `development`.

## Production build

> Note: Most packages output build artifacts to `./dist` within the package's directory. A notable exception is `trackx-login` which outputs to `trackx-dash/dist`.

> Note: For a full build and packing for deployment see the [installation guide](#/getting-started/installation.md).

```sh
pnpm build
```

## Linting & testing

```sh
pnpm run lint
```

```sh
pnpm run test
```

## Visualise dash bundles

Run the following, each in a new terminal:

```sh
pnpn run serve
```

```sh
cd packages/trackx-dash
pnpm run viz
```

Open <http://localhost:5001/viz.html> in your browser.

## Documentation development

```sh
cd docs/dev
pnpm install
pnpm run serve
```

Open <http://localhost:3000/dev> in your browser.
