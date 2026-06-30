---
description: Start work on a specific phase from ROADMAP.md. Reads the phase, plans the tasks, and proposes the first concrete step.
---

# /start-phase

You are starting work on phase **$ARGUMENTS** of this project.

Before touching any code:

1. **Open `ROADMAP.md`** and read the entire phase $ARGUMENTS section, including all acceptance criteria.
2. **Open `CLAUDE.md`** and re-read the "How to work on this project" section. In particular: do not start phase $ARGUMENTS work if the previous phase is incomplete.
3. **Check the codebase** for any in-progress work in this phase's area. List what exists and what's missing.
4. **Open `ARCHITECTURE.md`** and any relevant `docs/*.md` files for this phase. Quote the constraints that apply.
5. **Produce a plan** as a numbered list of concrete steps, each step being something you'd commit as a single change. For each step, name the files you'd create or edit and the tests you'd add.
6. **Stop and ask the user to approve the plan** before doing anything else.

Do not skip step 6. The user wants to review the plan first.
