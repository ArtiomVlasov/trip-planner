# Load testing

The project uses [k6](https://k6.io/) for backend load tests.

## Local Docker run

Start the application:

```bash
docker compose -f compose.yml up --build
```

Run a small smoke load test against the Docker network:

```bash
npm run load:smoke
```

Run a longer baseline test:

```bash
npm run load:baseline
```

Run against an already deployed target:

```bash
BASE_URL=https://test.liberty-music.lol npm run load:baseline:target
```

The summary JSON is written to `tests/load/results/summary.json`.

## Deployed environments

- `https://test.liberty-music.lol`: test environment. Use this for regular `baseline`, `stress`, and `spike` runs.
- `https://trip.liberty-music.lol`: production environment. Prefer `smoke` or a short approved `baseline` run.

Examples:

```bash
BASE_URL=https://test.liberty-music.lol npm run load:baseline:target
BASE_URL=https://test.liberty-music.lol npm run load:stress:target
BASE_URL=https://trip.liberty-music.lol npm run load:smoke:target
```

## Profiles

- `smoke`: 1 virtual user for 30 seconds. Use this after deploys or before a larger run.
- `baseline`: 5 virtual users for 5 minutes. Use this as the regular comparison point.
- `stress`: ramps from 10 to 50 virtual users. Use this only on staging or an approved production window.
- `spike`: jumps to 60 virtual users. Use this to check burst behavior.

## Write traffic

By default, tests are read-only except for `/prompt/`, which currently returns a stub and does not persist data.

To include event writes to `/api/v1/events/partner`, opt in explicitly:

```bash
INCLUDE_WRITES=true npm run load:baseline
```

Do not enable writes against production unless the team accepts the extra `event_logs` rows.

## Direct k6 run

If k6 is installed locally:

```bash
k6 run \
  -e BASE_URL=http://localhost:8000 \
  -e PROFILE=baseline \
  --summary-export tests/load/results/summary.json \
  tests/load/trip-planner.k6.js
```

## Manual CI run

Use the `Load Test` GitHub Actions workflow. It is manual on purpose: choose the target URL and profile before running it.

The workflow offers both deployed targets and defaults to `https://test.liberty-music.lol`.
