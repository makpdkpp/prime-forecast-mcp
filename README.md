# Prime Forecast MCP

Read-only MCP gateway ระยะที่ 1 สำหรับ Prime Forecast V3

- Production Laravel: `https://sale.primes.co.th`
- Remote MCP: `https://mcp.primes.co.th/mcp`
- Runtime: Node.js `24.19.0`
- Plesk startup file: `app.js`
- Transport: stateless Streamable HTTP
- Data path: MCP → Laravel API Gateway → Prime Forecast V3
- Phase 1 policy: ไม่มี create/update/delete/write tool

## เครื่องมือระยะที่ 1

| Tool | Sales | Team Admin | Admin |
|---|---:|---:|---:|
| `get_my_forecast` | ✓ | ✓ | ✓ |
| `list_team_forecasts` | — | ✓ (เฉพาะทีมที่ดูแล) | ✓ |
| `get_sales_forecast` | — | ✓ (เฉพาะทีมที่ดูแล) | ✓ |
| `get_company_forecast` | — | — | ✓ |

ทุก tool มี MCP annotations เป็น `readOnlyHint: true`, `destructiveHint: false` และตรวจทั้ง role กับ explicit permission จาก Laravel

## เริ่มในเครื่องพัฒนา

```powershell
Copy-Item .env.example .env
npm install
npm test
$env:NODE_ENV='development'
$env:LARAVEL_MCP_SERVICE_TOKEN='local-test-service-token'
node app.js
```

ค่าจากไฟล์ `.env` ไม่ได้ถูกโหลดอัตโนมัติใน production; ให้ตั้งผ่าน Plesk Environment Variables โดยตรง

## เอกสาร

- [แผนและเกณฑ์อนุมัติ Phase 1](docs/phase-1-plan.md)
- [สถาปัตยกรรมและ security boundaries](docs/architecture.md)
- [Laravel API contract](docs/api-contract.md)
- [วิธีผสาน Laravel V3](docs/laravel-integration.md)
- [Deploy ผ่าน Plesk/GitHub โดยไม่มี Terminal](docs/deploy-plesk.md)
- [Permission test matrix](docs/permission-matrix.md)

## สถานะสำคัญ

ตัว Node MCP และ automated tests พร้อมแล้ว แต่ยัง **ห้ามเปิด production data** จนกว่าจะทำ adapter ของ Laravel ให้เข้ากับ model/schema จริง, ทดสอบด้วยบัญชี Sales / Team Admin / Admin จริงครบทุกกรณี และยืนยันกลไก OAuth 2.1 หรือ token issuance ที่จะใช้กับ client จริง ห้ามเพิ่ม write tools จนกว่าจะผ่าน approval gate ใน `docs/phase-1-plan.md`

