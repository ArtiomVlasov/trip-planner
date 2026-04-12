# Trip Planner - Tasks Index

## Как читать задачи
- У каждой задачи отдельный файл `task-*.md` с описанием, требованиями и критериями приемки.
- Индексы по направлениям находятся в `components/backend/tasks.md` и `components/frontend/tasks.md`.
- Статусы: `DONE`, `IN PROGRESS`, `TODO`.

## Каталоги задач
- Backend: `components/backend/tasks/`
- Frontend: `components/frontend/tasks/`

## Основные индексы
- Backend index: `components/backend/tasks.md`
- Frontend index: `components/frontend/tasks.md`
- Сводный индекс: `TASKS_INDEX.md`

## Принцип ветвления
- Для каждой задачи создается отдельная ветка: `feature/<task-id>-<slug>`
- После тестов и review изменения сливаются в `dev`

## Продуктовые источники
- Vision/CJM/US/UC используются как источник требований для каждого `task-*.md`

