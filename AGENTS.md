# Repository instructions

This repository owns the executable MIC application. Product policy, research, roadmaps, epics, and delivery planning belong in the sibling [`../mic_product_development`](../mic_product_development) repository. Host setup and hardware configuration belong in [`../machine_setup`](../machine_setup).

Before changing MIC's domain model, lifecycle, API vocabulary, UI labels, prompts, or BMAD workflow presentation, read and follow [`../mic_product_development/policy/scrum-and-product-terminology.md`](../mic_product_development/policy/scrum-and-product-terminology.md).

Keep these distinctions explicit:

- formal Scrum terms and commitments;
- MIC product-management extensions such as Brief, Feature, Epic, and Delivery Case;
- BMAD workflow and artifact names.

Also keep three levels separate: the current **MIC implementation** effort, the **MIC product** being changed, and future **MIC-managed delivery** represented inside the application. Runtime Product Goals, Epics, Scrum Sprints, and BMAD workflows do not implicitly prescribe how the current coding work is organized. Do not cross that boundary unless the user explicitly asks to reconsider the MIC implementation process.

For MIC-managed software delivery, BMAD owns adaptive planning depth, specification, story decomposition, Build, review, and technical retrospective workflows. MIC owns Product interaction, durable orchestration, exact-revision decisions, worktrees, projections, evidence, and audit around BMAD. Do not add a parallel generic MIC specification, breakdown, or Build path.

Do not call an Epic story sequence or `sprint-status.yaml` a Scrum Sprint unless MIC has an explicit timebox, Sprint Goal, selected Product Backlog Items, and resulting Increment.
