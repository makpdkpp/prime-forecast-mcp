# Sales creation pilot (Phase 2)

Default remains read-only. Enable only on Demo after Laravel deployment/migration.

Node environment:

```dotenv
PUBLIC_BASE_URL=https://mcp-demo.primes.co.th
LARAVEL_BASE_URL=https://demo.primes.co.th
AUDIT_SINK=laravel
MCP_SALES_CREATE_ENABLED=false
```

Laravel requires APP_ENV=staging, PRIME_MCP_ENABLED=true,
PRIME_MCP_AUDIT_ENABLED=true, PRIME_MCP_SALES_CREATE_ENABLED=true and
PRIME_MCP_SALES_CREATE_USER_IDS containing selected tester IDs.
Apply migration 2026_10_02_000001_create_mcp_sales_drafts_table first.
Then enable MCP_SALES_CREATE_ENABLED=true and restart Node.

Reauthorize OAuth: both mcp:read and mcp:sales:create are needed. The user must
approve a separate write-scope consent screen. Only allowlisted Sales and Team Admin
accounts are eligible; Admin is not a writer in this pilot. Noneligible accounts
requesting both scopes receive 403; use read-only scope for those accounts.
Existing read tokens continue to work without write tools.

Tools:

- get_sales_create_options: search/page existing customers and resolve catalog IDs.
- prepare_sales_project: strict fields, own team only, UUID idempotency key.
  Stores an encrypted 15-minute draft, not a project. Show confirmation_url to user.
- get_sales_project_draft: check after user confirmation. Only created with project_id
  means a business project was saved.

The user must open the URL and confirm in their own Laravel web session.
Never ask the assistant to open or submit approval. No MCP endpoint can confirm a draft.
Changed details require a new draft; identical retries reuse the key.
Do not create a new key automatically after a timeout. Retry the original key.

Plesk: deploy both repos with flags off; back up Demo DB, run Laravel migrate --force
and config:clear via PHP script artisan. Then enable tester gates, NPM Install/restart
Node, reconnect OAuth. No production activation is included.

Local checks: npm test (HTTP MCP tests use mocked Laravel responses).
Laravel tests cover ownership, token/role/config gates, validation, encrypted draft,
browser CSRF/session, duplicate confirmation, expiry/revocation, atomic audit rollback
and OAuth consent. Live Demo and MySQL concurrent confirmation remain acceptance steps.

Rollback: turn both write flags off and revoke pilot tokens. Preserve audit and
draft records. Do not automatically delete projects or roll back migrations.
