---
description: "Run attended BMAD Story Breakdown for an accepted SPEC.md"
---

@skills/bmad-spec

Run the skill's **Story Breakdown** operation in attended interactive mode. The current working directory is the project root. Read the accepted `SPEC.md`, its adjacent `.memlog.md`, every declared companion, and the Story schema before proposing anything.

This invocation is interactive even though MIC transports turns programmatically. Walk the capabilities and constraints with the user, propose independently reviewable Stories, and obtain the human `spec_checkpoint`, `done_checkpoint`, and optional `invoke_dev_with` judgement for every Story. Ask clear questions and stop for the user's response when judgement is required. Do not re-run the normal spec creation operation. Do not write `stories.yaml` until the required Story decisions have been resolved.

$ARGUMENTS
