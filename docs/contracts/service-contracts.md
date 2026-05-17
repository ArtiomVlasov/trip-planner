# Service Interaction Contracts

Внутренние контракты между backend-слоями: routers -> services -> repositories.

## 1) Prompt Processing

### Contract: `handle_prompt(prompt: str, user_id: int) -> None`
- Вход:
  - `prompt`: сырой текст пользователя.
  - `user_id`: авторизованный пользователь.
- Выход: нет тела (контекст сохраняется в БД).
- Ошибки:
  - `RuntimeError` -> конвертируется в `HTTP 400`.
  - Любые прочие -> `HTTP 500`.

### Contract: `handle_prompt_guest(prompt: str) -> ParsedGuestContext`
- Вход: `prompt`.
- Выход: распарсенный guest-контекст.
- Side effect: сохраняется в guest storage через `save_guest(ip, parsed)`.

## 2) Route Building

### Contract: `collect_places(user_id: int) -> list[Waypoint]`
- Получает кандидаты точек из БД и внешних источников.

### Contract: `build_route(user_id: int, waypoints: list[Waypoint]) -> RoutePayload`
- Собирает финальную структуру маршрута для фронтенда.

### Guest contracts
- `load_guest(ip) -> ParsedGuestContext | None`
- `collect_places_guest(db, parsed) -> list[Waypoint]`
- `build_route_guest(waypoints) -> RoutePayload`

## 3) Partner Runtime

### Contract: `get_recommendations(...) -> RecommendationsOut`
- Вход: контекст пользователя/локации/бюджета.
- Логика: активные `PartnerPlace` + `RouteInsertionRule` -> score -> top N.
- Выход: отсортированные рекомендации.

### Contract: `insert_into_route(RouteInsertRequest) -> RouteInsertOut`
- Вход: `trip_id`, `route_id`, `day`, `partner_place_id`.
- Side effect: запись `EventLog(event_type='impression')`.
- Выход: подтверждение вставки.

## 4) CRM Contracts

### Partners Repo Boundary
- `get_partners(...) -> (items, total)`
- `create_partner(data) -> Partner`
- `update_partner(partner, data) -> Partner`

### Places Boundary
- Поиск/создание place с geospatial фильтрацией.

### Route Rules Boundary
- CRUD для правил вставки партнера в маршрут.

### Settlements Boundary
- Генерация и обновление расчетов по периодам.

## 5) Non-functional Contracts

- Таймаут внешних AI/Places вызовов должен контролироваться сервисным слоем.
- Репозитории не должны содержать бизнес-решения маршрутизации, только доступ к данным.
- Routers не должны содержать сложную бизнес-логику (только orchestration + маппинг ошибок).

## 6) Ошибки и соглашения

- Router переводит доменные исключения в HTTP-коды.
- Service возвращает доменные структуры (DTO), а не HTTP-ответы.
- Repository возвращает ORM/DTO и не знает о веб-слое.

