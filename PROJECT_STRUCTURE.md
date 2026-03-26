# Trip Planner - Project Documentation
## Project Vision
Trip Planner is an AI-powered travel planning platform that automates route generation,
integrates real-time events and weather, and provides personalized recommendations 
based on user interests and preferences.
## Key Features
- AI-powered route generation using Google Gemini API
- Real-time integration of events and weather data
- Multi-POI management with rich information display
- Budget tracking and expense management
- Route sharing and collaboration
- Navigation integration with Google/Apple Maps
- Partner integration for businesses and travel agencies
## Project Structure
### Backend (FastAPI + PostgreSQL)
Location: components/backend/
Key modules:
- models.py          - SQLAlchemy ORM models
- schemas.py         - Pydantic validation schemas
- db.py              - Database configuration
- services/          - Business logic
- repositories/      - Data access layer
- routers/           - API endpoints
### Frontend (React + TypeScript)
Location: components/frontend/
Key modules:
- src/pages/         - Page components
- src/components/    - Reusable UI components
- src/hooks/         - React hooks
- src/App.tsx        - Main app component
## Development Priorities
### Phase 1 (MVP)
- Authentication system (DONE)
- Route creation with AI
- POI display and search
- Map integration
- Basic navigation
### Phase 2
- Event integration
- Weather integration
- Budget tracker
- Route sharing
- Mobile optimization
### Phase 3
- Analytics dashboard
- Partner management
- Advanced filtering
- Offline support
- Native mobile apps
## Technology Stack
### Backend
- Framework: FastAPI
- ORM: SQLAlchemy
- Database: PostgreSQL + PostGIS
- Cache: Redis
- External APIs: Google Gemini, OpenWeatherMap, Eventbrite
### Frontend
- Framework: React 18
- Language: TypeScript
- Build: Vite
- Styling: Tailwind CSS
- UI Components: shadcn/ui
- Maps: Google Maps API
## Git Strategy
- Main branch: Production ready code
- Dev branch: Integration branch
- Feature branches: Created from dev, one per user story
Example: feature/UC-1-user-registration
## Deployment
- Backend: FastAPI + Uvicorn (Docker)
- Frontend: Vite static build (CDN)
- Database: PostgreSQL on cloud provider
- Environment: Development, Staging, Production
## Documentation References
- Backend tasks: components/backend/tasks.md
- Frontend tasks: components/frontend/tasks.md
- Root tasks: tasks.md
---
Generated: 2026-03-26
