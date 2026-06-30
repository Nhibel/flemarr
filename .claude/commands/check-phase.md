---
description: Verify that a phase from ROADMAP.md is actually complete by checking every acceptance criterion against the current codebase.
---

# /check-phase

You are verifying that phase **$ARGUMENTS** of this project is complete.

1. **Open `ROADMAP.md`** and locate phase $ARGUMENTS.
2. For **every acceptance criterion** in that phase:
   - State the criterion verbatim.
   - Show the concrete evidence that it's met: file paths, test names, command outputs.
   - If you cannot verify it without running something, run it (typecheck, lint, tests, dev server smoke check) and report.
   - If a criterion is **not** met, say so explicitly. Do not paper over it.
3. **Summarize**: phase complete, or phase not complete. If not, list the remaining items as a checklist.

Do not modify code during this command. Verification only.
