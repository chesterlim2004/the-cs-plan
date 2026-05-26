# Architecture

The CS Plan is a TypeScript monorepo with separate frontend, backend, shared schemas, seeded data, and curriculum evaluation packages.

## Subsystems

- `apps/web`: React/Vite dashboard for login, onboarding, planner, requirements, and settings.
- `apps/api`: Express API for auth, users, profiles, plans, modules, and requirement evaluation.
- `packages/shared`: Zod schemas and shared TypeScript types used across frontend and backend.
- `packages/rules-engine`: Pure functions that evaluate plans against versioned requirement JSON.
- `packages/data`: Seeded NUSMods-like module data and CS requirement rules.

## Data Flow

1. User signs in with Google OAuth.
2. API stores or updates the user and sets an HTTP-only session cookie.
3. Frontend requests `/api/me` and redirects to onboarding if no profile exists.
4. User creates a profile and a default plan.
5. Planner calls module and plan APIs to persist changes.
6. Requirement progress is calculated by sending a saved plan to the backend, which calls the pure rules engine.

## Database Collections

- `users`: Google identity and app role.
- `studentProfiles`: programme, cohort, graduation semester, and primary plan.
- `plans`: user-owned semester plan with module and placeholder items.
- `modules`: cached module data used by search and planner cards.
- `requirementSets`: versioned curriculum rules stored as data, not code conditionals.

## Rules Engine

Curriculum evaluation is isolated from Express and React. The engine accepts a requirement set and a plan, then returns progress rows with completed units/modules, missing items, contributing plan items, and warnings.

This keeps future expansion data-driven: adding cohorts, programmes, or requirement buckets should primarily require new rule data rather than new backend route logic.

## Future Extension Points

- GPA and S/U data should be added as separate `gradeRecords`, not embedded into module metadata.
- Scenario planning should duplicate or branch `plans`.
- Sharing should use separate `shareLinks` with read-only scoped tokens.
- Admin curriculum editing should update `requirementSets`, with audit logs added before production use.
