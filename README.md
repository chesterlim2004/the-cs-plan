# The CS Plan

Milestone 1 technical proof of concept for NUS Orbital Apollo: Google login, profile onboarding, a saved module planner, module search, and degree requirement progress powered by a standalone rules engine.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod
- Backend: Node.js, Express, TypeScript, MongoDB Atlas, Mongoose
- Shared packages: reusable schemas, seeded data, and pure requirement evaluation logic

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment files:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. Create a Google Cloud OAuth client:

   - App name: `The CS Plan`
   - Scopes: `openid`, `email`, `profile`
   - JavaScript origin: `http://localhost:5173`
   - Redirect URI: `http://localhost:4000/api/auth/google/callback`

4. Fill `apps/api/.env` with your MongoDB URI, Google credentials, and session secret.

5. Seed local module and requirement data:

   ```bash
   npm run seed
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

Frontend runs on `http://localhost:5173`; API runs on `http://localhost:4000`.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

## Milestone 1 Scope

Included: Google OAuth, user profile, planner CRUD, module search, requirement progress, seeded data, tests, and documentation.

Not included yet: GPA/SU planner, scenario planning, sharing links, admin editor, all-NUS faculty support, double degree, major, or minor support.
