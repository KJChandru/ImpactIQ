# Skill: Test Generation

## Purpose

Generate a targeted test checklist for each impacted module, based on the nature of the change and the module's role in the system.

## Input

- Impacted modules with severity ratings
- Feature description
- Architecture context (what the module does and who depends on it)

## Output

```json
{
  "tests": [
    {
      "module": "Auth",
      "cases": [
        "Verify OAuth token exchange completes within 2s",
        "Verify refresh token rotation invalidates old token",
        "Verify session expiry triggers re-authentication, not silent failure",
        "Verify concurrent login attempts don't create duplicate sessions"
      ]
    }
  ]
}
```

## Rules

- Minimum 3 test cases per high-severity module
- Minimum 1 test case per medium-severity module
- Low-severity modules: monitoring checklist only (no test cases required)
- Test cases must name specific behaviors, not generic "test the module" placeholders
- Include edge cases relevant to the feature (concurrent requests, timeouts, rollback scenarios)

## Integration

This skill is embedded in the Impact Analysis skill output — it does not run as a separate API call. The `tests` field is part of the `/api/analyze` response.
