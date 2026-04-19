## Prerequisites

To set up the project, ensure you have the following installed:

1. **Taskfile**: Download and install Taskfile by following the instructions [here](https://taskfile.dev/#/installation).
2. **Bash**: Ensure you have a Bash shell available on your system.

## Installation

Run the following command to install Flutter and UV dependencies:

```bash
task install-deps
```

## Docker Compose

The project can be started in three separate containers:

- `frontend` on `127.0.0.1:8080`
- `backend` on `127.0.0.1:8000`

1. Create a root `.env` file based on [.env.example](/Users/ilyazyryanov/PycharmProjects/trip-planner/.env.example).
2. Fill in API keys and, if needed, adjust database credentials.
3. Start the stack:

```bash
docker compose -f compose.yml up --build
```

Notes:

- Docker Compose starts a local PostGIS database automatically.
- The default `DB_HOST=db` uses Docker's internal network between containers.
- The database is not exposed on the host by default.
- On first startup, the database initializes the `postgis` extension automatically.
- For domain deployment behind host nginx, leave `VITE_API_BASE_URL` empty so the frontend uses the same origin.
- `BACKEND_CORS_ORIGINS` should include `https://liberty-music.lol` and `https://www.liberty-music.lol`.

## Load testing

Backend load tests live in `tests/load` and run with k6.

Start the stack first:

```bash
docker compose -f compose.yml up --build
```

Then run:

```bash
npm run load:smoke
npm run load:baseline
```

For deployed targets:

```bash
BASE_URL=https://trip.liberty-music.lol npm run load:smoke:target
BASE_URL=https://test.liberty-music.lol npm run load:baseline:target
```

Use `https://test.liberty-music.lol` for normal load runs and `https://trip.liberty-music.lol` only for smoke or an agreed production window. Stress and spike profiles are available through `npm run load:stress` and `npm run load:spike`; use them only on staging or during an agreed production window. More details are in `tests/load/README.md`.
