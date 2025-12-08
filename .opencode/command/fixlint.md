---
description: Run lint:all and fix
agent: tsdev
model: opencode/grok-code
---

## Purpose
Orchestrate parallel linting fixes by spawning and managing `@lintworker` subagents to fix entire files.

## Workflow

### 1. Initial Analysis
```bash
npm run lint:all
```
Analyze output and **group issues by file**. Create a TODO list with **maximum 9 files** (one task per file).

### 2. Task Distribution Strategy

**Parallelization Rules:**
- ✅ Spawn up to **3 subagents in parallel** (max concurrency)
- ✅ Spawn **ONE subagent per file** at the same time
- ❌ **NEVER** spawn a second subagent on a file until the current one reports back
- ✅ Each worker fixes **ALL issues** in their assigned file

### 3. Task Assignment

For each file with lint issues:

**Send to `@lintworker` using task_template:**
```json
{
  "task_id": "string",
  "task": "fix all lint issues in this file",
  "file": "string",
  "issues": ["array of issue descriptions"]
}
```

**Task ID format:** `task_01`, `task_02`, ..., `task_09`

**Examples:**

```json
{
  "task_id": "task_01",
  "task": "fix all lint issues in this file",
  "file": "src/components/UserCard.tsx",
  "issues": [
    "line 12: prefer-const - 'data' is never reassigned",
    "line 45: no-unused-vars - 'userData' is defined but never used",
    "line 67: semi - missing semicolon"
  ]
}
```

```json
{
  "task_id": "task_02",
  "task": "fix all lint issues in this file",
  "file": "src/utils/helpers.ts",
  "issues": [
    "line 23: @typescript-eslint/prefer-nullish-coalescing - use ?? instead of ||",
    "line 56: import/order - imports must be sorted",
    "line 89: no-console - unexpected console.log statement"
  ]
}
```

### 4. Response Handling

**Expected response from `@lintworker`:**
```json
{
  "task_id": "string",
  "result": "DONE|PARTIAL|ERROR|BAD_TASK",
  "msg": "string",
  "fixed": ["array of successful fixes"],
  "failed": ["array of failed fixes with reasons"]
}
```

**Result codes:**
- `DONE`: All issues fixed successfully
- `PARTIAL`: Some issues fixed, some failed (still progress)
- `ERROR`: Could not fix any issue due to errors
- `BAD_TASK`: Task is malformed or file doesn't exist

**Action on response:**

| Result | Action | Mark as |
|--------|--------|---------|
| `DONE` | ✅ File completely fixed | Complete |
| `PARTIAL` | ⚠️ File partially fixed | Complete (with warnings) |
| `ERROR` | ❌ No progress made | Failed |
| `BAD_TASK` | ❌ Invalid task | Failed |

### 5. Loop Logic

```
WHILE (tasks remaining in TODO):
  IF (active_subagents < 3):
    FOR each pending task:
      IF (task.file NOT currently being worked on):
        SPAWN @lintworker with task
        MARK task as "in progress"
        BREAK if active_subagents == 3
  
  WAIT for subagent response
  
  WHEN subagent responds:
    UPDATE TODO with result
    active_subagents -= 1
```

**Exit condition:** All tasks have received a response (`DONE | PARTIAL | ERROR | BAD_TASK`)

### 6. Final Report

When all subagents finish, generate a comprehensive report:

#### ✅ Fully Fixed Files (DONE)
```
✓ src/components/UserCard.tsx
  - Fixed 3/3 issues
  - line 12: changed let to const
  - line 45: removed unused variable 'userData'
  - line 67: added missing semicolon

✓ src/index.ts
  - Fixed 1/1 issue
  - line 5: removed console.log statement
```

#### ⚠️ Partially Fixed Files (PARTIAL)
```
⚠ src/utils/helpers.ts
  - Fixed 2/4 issues
  - line 23: changed || to ??
  - line 56: sorted imports
  
  Failed fixes:
  - line 89: console.log in complex expression - requires manual review
  - line 120: type inference too complex - needs explicit type annotation
```

#### ❌ Failed Files (ERROR)
```
✗ src/api/client.ts
  - Fixed 0/5 issues
  - Error: File has syntax errors, cannot parse
  - Recommendation: Fix syntax errors first, then re-run lint
```

#### ❌ Invalid Tasks (BAD_TASK)
```
✗ src/config.ts
  - Task rejected
  - Reason: File does not exist at specified path
```

#### 📊 Summary
```
Total files: 7
✓ Fully fixed: 4 (57%)
⚠ Partially fixed: 2 (29%)
✗ Failed: 1 (14%)
✗ Invalid: 0 (0%)

Total issues: 23
✓ Fixed: 18 (78%)
✗ Remaining: 5 (22%)
```

## Example Execution Flow

```
[00:00] Running npm run lint:all...
[00:01] Found 18 issues across 5 files

TODO LIST (5 files):
[ ] task_01: src/components/UserCard.tsx (3 issues)
[ ] task_02: src/utils/helpers.ts (4 issues)
[ ] task_03: src/api/client.ts (5 issues)
[ ] task_04: src/index.ts (1 issue)
[ ] task_05: src/hooks/useData.ts (5 issues)

[00:01] Spawning 3 workers in parallel...
  → @lintworker task_01 (src/components/UserCard.tsx)
  → @lintworker task_02 (src/utils/helpers.ts)
  → @lintworker task_03 (src/api/client.ts)

[00:05] task_01 returned: DONE
  ✓ Fixed 3/3 issues in src/components/UserCard.tsx

[00:05] Spawning next worker...
  → @lintworker task_04 (src/index.ts)

[00:07] task_04 returned: DONE
  ✓ Fixed 1/1 issue in src/index.ts

[00:07] Spawning next worker...
  → @lintworker task_05 (src/hooks/useData.ts)

[00:09] task_02 returned: PARTIAL
  ⚠ Fixed 2/4 issues in src/utils/helpers.ts
  Failed: 2 issues require manual review

[00:12] task_03 returned: ERROR
  ✗ Could not fix src/api/client.ts - syntax errors present

[00:14] task_05 returned: DONE
  ✓ Fixed 5/5 issues in src/hooks/useData.ts

[00:14] All workers finished!

────────────────────────────────────────
FINAL REPORT

✅ Fully Fixed (3 files):
  ✓ src/components/UserCard.tsx (3/3)
  ✓ src/index.ts (1/1)
  ✓ src/hooks/useData.ts (5/5)

⚠️ Partially Fixed (1 file):
  ⚠ src/utils/helpers.ts (2/4)
    Failed: line 89, line 120

❌ Failed (1 file):
  ✗ src/api/client.ts (0/5)
    Reason: Syntax errors prevent linting

📊 Summary:
  Files: 3 ✓, 1 ⚠, 1 ✗
  Issues: 11/18 fixed (61%)
────────────────────────────────────────
```

## Key Constraints Summary

1. **Max 9 files** in TODO list
2. **Max 3 parallel** subagents
3. **1 subagent per file** at a time
4. **All issues per file** assigned to single worker
5. **No retry logic** during execution (just mark and report)
6. **Comprehensive final report** with statistics
