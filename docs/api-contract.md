# Laravel API Gateway contract

Base URL: `https://sale.primes.co.th/api/mcp/v1`

ทุก endpoint ต้องใช้ `X-Prime-MCP-Key`; endpoint ผู้ใช้ต้องใช้ `Authorization: Bearer <user-token>` เพิ่มด้วย Response สำเร็จใช้ `{ "data": ... }` และ error ใช้ `{ "code": "...", "message": "..." }`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | service | readiness ของ Gateway |
| POST | `/auth/context` | service + user | introspect token/role/scope |
| GET | `/forecast/me` | service + user | forecast ของ caller |
| GET | `/teams/{teamId}/forecasts` | service + user | team-scoped forecasts |
| GET | `/sales/{salesId}/forecast` | service + user | salesperson forecast |
| GET | `/forecast/company` | service + user | company aggregate; Admin only |
| POST | `/audit-events` | service | บันทึก security audit เท่านั้น |

`POST` สองรายการข้างต้นไม่ใช่ business write tools: รายการแรกเป็น token introspection และรายการที่สองเป็น append-only security audit

## Auth context response

```json
{
  "data": {
    "user": { "id": 101 },
    "role": "sales",
    "team_ids": [10],
    "permissions": ["forecast.self.read"],
    "token_expires_at": 1790000000
  }
}
```

`token_expires_at` เป็น Unix seconds หรือ ISO-8601 ก็ได้ แต่ต้องเป็นเวลาหมดอายุจริง ห้ามส่งค่าอนันต์/ค่าคงที่

## Query rules

- `date_from`, `date_to`: `YYYY-MM-DD`; `date_to >= date_from`
- `page >= 1`
- `1 <= per_page <= 100`
- Laravel ต้องใช้ route model/query scope ที่ fail closed และต้องตรวจ team membership จาก database ไม่ใช่จากค่าที่ Node ส่งมา

## Error status

- `401`: service key หรือ user token ไม่ถูกต้อง/หมดอายุ
- `403`: authenticated แต่ไม่มี role/permission/team scope
- `422`: query validation ไม่ผ่าน
- `429`: rate limit
- `5xx`: dependency/internal failure; ห้ามแนบ stack trace หรือ SQL ใน production

