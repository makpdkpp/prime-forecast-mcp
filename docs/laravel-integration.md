# ผสาน Laravel Gateway เข้ากับ Prime Forecast V3

โฟลเดอร์ `laravel-example/` เป็น source scaffold สำหรับนำไปวางใน repository Laravel จริง ไม่ใช่ Laravel application แยก

1. Copy classes ตาม namespace ไปยัง `app/`
2. include `routes/api-mcp.php` จาก `routes/api.php`
3. เพิ่ม alias `mcp.service` → `RequireMcpServiceKey` ใน middleware configuration ของ Laravel version ที่ใช้อยู่
4. merge `prime_mcp` จาก `config/services.php.fragment` เข้า `config/services.php`
5. implement และ bind interfaces ต่อไปนี้ใน service provider:
   - `McpPrincipalResolver` — map user/role/team/permissions/token expiry
   - `SalesTeamResolver` — หา team ปัจจุบันของ salesperson และ fail closed
   - `ForecastReadRepository` — reuse query/service ของ V3 แบบ read-only
6. เพิ่ม `PRIME_MCP_SERVICE_KEY` ค่าเดียวกับ `LARAVEL_MCP_SERVICE_TOKEN` ฝั่ง Node และตั้ง `PRIME_MCP_AUDIT_CHANNEL=daily`
7. เขียน Laravel feature tests ตาม `permission-matrix.md`

ห้าม copy SQL/model names แบบเดาเข้าสู่ production และห้าม bind repository จนกว่าจะ review field-level data exposure แล้ว Controller ตั้งใจให้ Laravel ตรวจ authorization ซ้ำ แม้ Node จะซ่อน tools มาแล้ว

