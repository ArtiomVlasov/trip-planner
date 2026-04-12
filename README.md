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

The project can be started in two separate containers:

- `frontend` on `http://localhost:8080`
- `backend` on `http://localhost:8000`

1. Create a root `.env` file based on [.env.example](/Users/ilyazyryanov/PycharmProjects/trip-planner/.env.example).
2. Fill in your database credentials and API keys.
3. Start the stack:

```bash
docker compose -f compose.yml up --build
```

Notes:

- `backend` expects an existing Postgres database via `DB_*` variables.
- The default `DB_HOST=host.docker.internal` is convenient when Postgres runs on the host machine.
- Frontend API base URL is configured at build time through `VITE_API_BASE_URL`.
