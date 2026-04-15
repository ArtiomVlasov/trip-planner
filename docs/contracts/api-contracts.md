# API Contracts (Trip Planner)

Документ фиксирует внешние REST-контракты backend по текущему коду (`components/backend/main.py`, `components/backend/routers/**`).

## 1) Auth & User

### `POST /register`
- Назначение: регистрация пользователя.
- Request: `UserRegistration`.
- Response: `{ status, token, user_id }`.
- Ошибки: `400` (ошибка регистрации), `500`.

### `POST /login`
- Назначение: вход пользователя.
- Request: `UserLogin`.
- Response: `{ access_token, token_type }`.
- Ошибки: `401` (неверные credentials), `500`.

### `GET /users/me`
- Назначение: получить профиль текущего пользователя.
- Auth: Bearer token.
- Response: профиль + preferences/starting_point/availability.
- Ошибки: `401`, `500`.

### `PUT /users/me`
- Назначение: обновить профиль текущего пользователя.
- Auth: Bearer token.
- Request: `dict` (ожидается `user` + вложенные данные).
- Response: `{ status: "ok" }`.
- Ошибки: `400`, `401`, `500`.

## 2) Route Generation Runtime

### `POST /prompt/`
- Назначение: принять текстовый запрос пользователя для подготовки контекста маршрута.
- Auth:
  - С токеном: пользовательский режим.
  - Без токена: guest-режим (контекст по IP).
- Request: `{ prompt: string }`.
- Response: `{ status: "ok" }` или `{ status: "ok", mode: "guest" }`.
- Ошибки: `400` (нет prompt/ошибка доменной логики), `500`.

### `GET /route/`
- Назначение: построить итоговый маршрут.
- Auth:
  - С токеном: маршрут пользователя.
  - Без токена: маршрут гостя на базе сохраненного guest context.
- Response: объект маршрута (формируется `services.route_builder`).
- Ошибки: `400` (нет guest context/нет валидных точек), `500`.

## 3) Service Utilities

### `GET /`
- Health/basic ping.

### `GET /api/maps-key`
- Назначение: отдать ключ карты из env (`GOOGLE_PLACES_API_KEY`).
- Ошибки: `500` если ключ не задан.

## 4) CRM Contracts

### Partners (`/api/v1/crm/partners`)
- `GET ""`: список партнеров (фильтры: `status`, `category`, `city`, `page`, `limit`).
- `POST ""`: создать партнера (`PartnerCreate`).
- `POST /login`: login партнера (`PartnerLogin`).
- `PATCH /{partner_id}`: обновить партнера (`PartnerUpdate`).

### Places (`/api/v1/crm/places`)
- `GET /search`: поиск мест (`external_id`, `name`, `lat`, `lng`, `radius_m`).
- `POST ""`: создать место (`CrmPlaceCreate`).

### Partner Places (`/api/v1/crm/partner-places`)
- `POST ""`: создать связку partner-place (`PartnerPlaceCreate`).
- `PATCH /{partner_place_id}`: обновить (`PartnerPlaceUpdate`).

### Route Rules (`/api/v1/crm/route-rules`)
- `GET ""`: список правил (`partner_id`, `status`, `trigger_type`, `city`).
- `POST ""`: создать правило (`RouteRuleCreate`).
- `PATCH /{rule_id}`: обновить (`RouteRuleUpdate`).

### Events (`/api/v1/crm/events`)
- `GET ""`: список событий (`partner_id`, `event_type`, `from`, `to`, `page`, `limit`).

### Settlements (`/api/v1/crm/settlements`)
- `GET ""`: список расчетов (`partner_id`, `period_start`, `period_end`, `status`, `page`, `limit`).
- `POST /generate`: сгенерировать расчеты (`SettlementGenerateRequest`).
- `PATCH /{settlement_id}`: обновить расчет (`SettlementUpdate`).

## 5) Partner Runtime Contracts

### `/api/v1/partners`
- `GET /recommendations`: runtime рекомендации partner places (`user_id`, `trip_id`, `day`, `lat`, `lng`, `context_type`, `budget_level`).
- `POST /route/insert`: вставка партнерского места в маршрут (`RouteInsertRequest`).

### `/api/v1/events`
- `POST /partner`: лог партнерского события (`EventCreate`).

## 6) Общие правила ошибок
- `401` — auth/token ошибка.
- `404` — сущность не найдена.
- `409` — конфликт (например, duplicate partner login / place id).
- `500` — внутренняя ошибка.

## 7) Versioning
- Для CRM/Partner API используется префикс `/api/v1/...`.
- Для пользовательских runtime endpoint'ов (`/prompt/`, `/route/`) версия пока не префиксована.

