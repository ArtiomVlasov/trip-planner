# Trip Planner Frontend

React + TypeScript frontend for the Trip Planner application.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Yandex Maps JavaScript API

## Run Locally

```bash
npm ci
npm run dev
```

Dev API default:

- `http://localhost:8000`

## Build

```bash
npm run build
```

## Environment

Supported frontend variables:

```env
VITE_API_BASE_URL=
VITE_YANDEX_MAPS_API_KEY=
```

Behavior:

- in dev, the app falls back to `http://localhost:8000`
- in production, the app uses relative API paths when `VITE_API_BASE_URL` is empty
- if `VITE_YANDEX_MAPS_API_KEY` is set, the map uses it directly
- otherwise the app requests `GET /api/maps-key` from the backend

## Docker

The production image is built with:

```bash
docker build \
  --build-arg VITE_API_BASE_URL= \
  --build-arg VITE_YANDEX_MAPS_API_KEY=your_browser_key \
  -t trip-planner-frontend .
```

The container serves the built static app with Nginx on port `8080`.

## Production Notes

- `GET /api/maps-key` now returns `YANDEX_MAPS_API_KEY` from the backend.
- Recommended browser key restriction: `HTTP referrers`.
- External reverse proxy should send API traffic to the backend and web traffic to the frontend container.

See the root [README.md](/Users/ilyazyryanov/PycharmProjects/trip-planner/README.md) for full deployment details.
