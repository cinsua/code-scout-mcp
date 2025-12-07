---
description: Run lint:all and fix
agent: tsdev
model: opencode/grok-code
---

npm run lint:all (runnit, it exist in package.json, no need to check)
make a todo list with maximum 9 problems. one task for each problem
for each fix:
- spawn a @lintworker subaget to fix the issue, give the task using task_teplate
- when spawned subagent returns with a result, if done correctly, mark the todo. if dont dont do nothing now
- loop until all task were DONE | ERROR | BAD_TASK

**RULES**
- you can spawn in parallell up to 3 subagents
- you can spawn in parallell just ONE per file at the same time
- NEVER spawn a second subagent working in the same file until the last agent working in that file report back
- when a subagent returns working on a file, if there were more errors/warning to fix in that file, that file is released and ready to spawn other subagent

when all spawn agents finish, the make a report with done fix actions, and undone fix actions

task_template:
```json
{
  "task_id": "string",
  "task": "string", // 'fix {problem} in {lines}'
  "file": "string | null"
}
