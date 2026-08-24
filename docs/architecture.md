# Architecture

```text
MCP client
  │ HTTPS + user bearer token
  ▼
mcp.primes.co.th (Node.js 24.19.0)
  ├─ Host/Origin validation
  ├─ Laravel token introspection
  ├─ per-user tool visibility
  ├─ Permission Guard + team-scope guard
  └─ structured audit
  │ HTTPS + service key + forwarded user token
  ▼
sale.primes.co.th/api/mcp/v1 (Laravel)
  ├─ service-key middleware
  ├─ Sanctum/user authentication
  ├─ authoritative role/team/permission check
  ├─ read repository
  └─ daily audit channel
  ▼
Prime Forecast V3 data (read only)
```

## Trust boundaries

- Client เป็น untrusted: ห้ามรับ `role`, `team_id` หรือ permission จาก request แล้วเชื่อทันที
- Node เชื่อ identity context เฉพาะ response ที่ได้จาก Laravel ผ่าน HTTPS พร้อม service key
- Laravel เป็น policy enforcement point ที่มีสิทธิ์ตัดสินขั้นสุดท้าย Node guard เป็น defense in depth
- Node ไม่มี database credentials และไม่มี business write route allowlist
- `X-Prime-MCP-Key` ใช้ยืนยัน service-to-service; user bearer token ใช้ระบุตัวผู้ใช้ ทั้งสองค่าไม่ถูกเขียนลง audit

## Availability

- `/healthz`: process ยังทำงาน ไม่แตะ Laravel
- `/readyz`: ตรวจ Laravel Gateway; ตอบ 503 เมื่อ dependency ไม่พร้อม
- MCP เป็น stateless จึง restart หรือ scale ได้โดยไม่สูญเสีย session state
- Audit ส่งแบบ best effort หลัง tool call; failure ถูกบันทึกที่ stderr แต่ไม่ทำให้ผล read ที่สำเร็จกลายเป็น failure

## Authentication note

MCP server ทำหน้าที่ OAuth resource server และเผยแพร่ `/.well-known/oauth-protected-resource` แล้ว แต่ Laravel ต้องมี Authorization Server metadata/flow ที่สอดคล้องกับ client ที่จะใช้จริง ก่อนเชื่อมผ่าน ChatGPT/Codex hosted UI ใน production การทดสอบภายในสามารถใช้ bearer token ที่ client จัดการเองได้

