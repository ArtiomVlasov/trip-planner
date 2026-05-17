# Architecture and UML (Textual)

Ниже текстовые UML-диаграммы в формате Mermaid (можно рендерить в большинстве markdown-viewers).

## 1) System Context (C4-like)

```mermaid
flowchart LR
    U[Traveler / Tourist] --> FE[Frontend React App]
    A[Travel Agency] --> FE
    B[Partner Business] --> CRM[CRM APIs]

    FE --> BE[FastAPI Backend]
    CRM --> BE

    BE --> DB[(PostgreSQL + PostGIS)]
    BE --> AI[Stub Prompt Service]
    BE --> MAPS[Yandex Maps]
    BE --> EVT[External Events/Weather APIs]
```

## 2) Backend Component Diagram

```mermaid
flowchart TB
    subgraph Backend[FastAPI Backend]
        R1[main.py endpoints]
        R2[routers/crm/*]
        R3[routers/partner_runtime.py]
        S1[services/prompt_stub_handler.py]
        S2[services/collect_places.py]
        S3[services/route_builder.py]
        S4[services/auth_utils.py]
        REPO[repositories/*]
        SCH[schemas.py]
    end

    R1 --> S1
    R1 --> S2
    R1 --> S3
    R1 --> S4
    R2 --> REPO
    R3 --> REPO
    S2 --> REPO
    S3 --> REPO
    REPO --> DB[(PostgreSQL)]
    S1 --> AI[Stub]
```

## 3) Sequence: Route Generation (User)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend /prompt/ + /route/
    participant AI as Stub
    participant DB as PostgreSQL

    User->>FE: Вводит prompt
    FE->>BE: POST /prompt/ {prompt}
    BE->>AI: return stub response
    AI-->>BE: stub payload
    BE->>DB: save query/context
    BE-->>FE: 200 OK

    FE->>BE: GET /route/
    BE->>DB: collect places data
    BE->>BE: return stub route
    BE-->>FE: Stub payload
    FE-->>User: Сообщение "затычка"
```

## 4) Sequence: Partner Insertion Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as /api/v1/partners
    participant DB as PostgreSQL

    FE->>BE: GET /recommendations
    BE->>DB: load active PartnerPlace + rules
    DB-->>BE: partner candidates
    BE->>BE: score/sort
    BE-->>FE: recommendations

    FE->>BE: POST /route/insert
    BE->>DB: write EventLog(impression)
    DB-->>BE: ok
    BE-->>FE: RouteInsertOut
```

## 5) Domain/Class Diagram (Core entities)

```mermaid
classDiagram
    class User {
      +id
      +username
      +email
      +password
    }
    class Preferences {
      +max_walking_distance_meters
      +budget_level
      +rating_threshold
      +transport_mode
    }
    class Route {
      +id
      +user_id
      +name
      +date_range
    }
    class Place {
      +id
      +place_id
      +name
      +location
      +rating
      +types
    }
    class Partner {
      +id
      +name
      +login
      +status
    }
    class PartnerPlace {
      +id
      +partner_id
      +place_id
      +priority_weight
      +commission_type
    }
    class RouteInsertionRule {
      +id
      +partner_place_id
      +trigger_type
      +priority_boost
      +status
    }
    class EventLog {
      +id
      +event_type
      +partner_place_id
      +trip_id
      +event_ts
    }
    class Settlement {
      +id
      +partner_id
      +period_start
      +period_end
      +amount
      +status
    }

    User "1" --> "1" Preferences
    User "1" --> "*" Route
    Route "*" --> "*" Place
    Partner "1" --> "*" PartnerPlace
    Place "1" --> "*" PartnerPlace
    PartnerPlace "1" --> "*" RouteInsertionRule
    PartnerPlace "1" --> "*" EventLog
    Partner "1" --> "*" Settlement
```

## 6) Textual Architecture Description

- Стиль: layered monolith (FastAPI) с выделенными слоями routers/services/repositories.
- Data store: PostgreSQL + PostGIS для гео-операций (`ST_DWithin`, точки маршрута).
- AI orchestration: `prompt -> parse -> collect -> build route`.
- CRM and runtime partner recommendations изолированы в `/api/v1/crm/*` и `/api/v1/partners/*`.
- Auth: JWT Bearer для пользовательского контура и login для партнерского контура.
- Guest mode: контекст запроса хранится по IP, затем используется для `GET /route/`.

## 7) Architectural Constraints

- Не смешивать бизнес-логику и HTTP-слой.
- Все внешние зависимости (AI/maps/events) должны иметь обработку таймаутов/ошибок.
- Контракты DTO фиксируются в `schemas.py`.
- Все изменения endpoint-ов должны синхронизироваться с `docs/contracts/api-contracts.md`.
