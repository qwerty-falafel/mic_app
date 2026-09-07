export const runtimeResponsibilities = {
  Scrum: ['Product Goal', 'ordered Product Backlog', 'Sprint Goal and timebox', 'Sprint selection', 'inspection and adaptation', 'usable Increment'],
  JiraPatterns: ['Product hierarchy', 'discovery and roadmap views', 'backlog interaction', 'Board flow', 'relationships and filters'],
  BMAD: ['adaptive software planning', 'SPEC.md', 'Story Breakdown and stories.yaml', 'bounded Build', 'technical review findings', 'technical retrospective'],
  MIC: ['durable orchestration', 'worktree isolation', 'human approval of exact revisions', 'questions and recovery', 'Product projections', 'evidence and audit'],
  boundaries: {
    technicalReview: 'BMAD produces findings, evidence, and recommendations.',
    humanApproval: 'MIC records and enforces the human decision for an exact artifact revision.',
    selfApproval: false,
    oneProductBacklog: true,
    sprintStatusArtifactCreatesScrumSprint: false,
    boardStatusAdvancesBmadGate: false,
  },
  authorities: {
    productBacklogOrder: 'MIC/Scrum',
    scrumSprintMembership: 'MIC/Scrum',
    boardFlowStatus: 'MIC/Jira pattern',
    planningContent: 'BMAD artifact at an exact Git-backed revision',
    buildExecutionStatus: 'BMAD session projected by MIC',
    approvalDecision: 'Human through MIC',
  },
} as const;
