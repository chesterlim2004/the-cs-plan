# Milestone 1

## Delivered Features

- Google OAuth login with HTTP-only session cookie.
- Protected API routes and plan ownership checks.
- Profile onboarding for Computer Science, cohort, and graduation semester.
- Saved module planner with semester columns and placeholders.
- Module search using seeded NUSMods-like data.
- Requirement progress from a standalone data-driven rules engine.
- JSON plan export/import endpoints as stretch support.
- Documentation for setup, architecture, and current limitations.

## Known Limitations

- Curriculum rules are a representative Milestone 1 subset, not an official NUS degree audit.
- Prerequisite warnings are advisory and depend on seeded module data.
- GPA/SU planning, scenarios, sharing, and all-NUS support are intentionally deferred.
- Google OAuth must be configured manually in Google Cloud before login works.

## Future Plan

1. Expand requirement rules for the selected CS cohort.
2. Add GPA and S/U planning on top of saved plans.
3. Add scenario duplication and comparison.
4. Add a read-only sharing flow.
5. Add admin tooling for maintaining requirement JSON safely.
