---
description: Run all the test checks and lints
agent: tsdev
model: zai-coding-plan/glm-4.6
---

Run all the jest test, ts checks, lint:all checks
## Workflow

### 1. Initial Analysis
```bash
npm run typecheck
npm run lint:all
npm run test
```

### 2. Report

Based on the commands prepare an output forrmated:

```markdown
# Review on codebase status

## **File**: `src/api/client.ts`
**typecheck**: describe the errors [OPTIONAL if errors was found]
**lint**: describe the errors [OPTIONAL if errors was found]
**test**: describe the errors [OPTIONAL if errors was found]

## **File**: `src/types/errors.ts`
**typecheck**: describe the errors [OPTIONAL if errors was found]
**lint**: describe the errors [OPTIONAL if errors was found]
**test**: describe the errors [OPTIONAL if errors was found]

## **File**: `src/services/userService.ts`
**typecheck**: describe the errors [OPTIONAL if errors was found]
**lint**: describe the errors [OPTIONAL if errors was found]
**test**: describe the errors [OPTIONAL if errors was found]
```
