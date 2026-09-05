# Durable MIC Kernel

The kernel stores orchestration state in PostgreSQL and exposes it through a small Fastify API. Every command carries an `Idempotency-Key`. Repeating a command with the same key returns the original entity and does not create another audit or outbox event.

```mermaid
sequenceDiagram
    participant Client
    participant API as Fastify API
    participant DB as PostgreSQL
    participant Dispatcher
    participant Queue as pg-boss
    participant Worker

    Client->>API: command + Idempotency-Key
    API->>DB: BEGIN
    API->>DB: entity + audit_event + outbox_event
    API->>DB: COMMIT
    API-->>Client: persisted entity
    Dispatcher->>DB: pending outbox rows (FOR UPDATE SKIP LOCKED)
    Dispatcher->>Queue: send with outbox ID singleton key
    Dispatcher->>DB: set delivered_at
    Queue->>Worker: event
    Worker->>DB: insert processed_event ON CONFLICT DO NOTHING
```

The domain tables are `projects`, `repositories`, `work_items`, `runs` and `questions`. `audit_events` provides an append-only command trail. `outbox_events` bridges committed domain changes to pg-boss. `processed_events` is the consumer-side idempotency ledger, so a dispatcher crash after enqueueing but before marking delivery can safely cause redelivery.

Migrations live in `drizzle/` and run at service startup. Production requires `DATABASE_URL`. Integration tests use real PostgreSQL binaries and keep their data under the ignored project-local `.runtime/` directory; they do not install or configure a system database.

The critical acceptance test closes the first application and database pool after creating state, opens a new application and pool, reads the state back, dispatches the committed event, then deliberately makes the outbox row eligible again. It proves one domain row, one audit row, one outbox row and one processed-event side effect remain.

## Commands

```sh
DATABASE_URL=postgres://user:password@127.0.0.1:5432/mic npm run db:migrate
DATABASE_URL=postgres://user:password@127.0.0.1:5432/mic npm run dev
npm run test:integration
```

The HTTP contract is checked in as `docs/openapi.json`.
