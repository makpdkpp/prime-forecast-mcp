# Phase 1 plan และ approval gates

## เป้าหมาย

เปิดให้ AI อ่าน forecast ตามสิทธิ์เดิมของ Prime Forecast V3 โดยไม่ให้ Node เชื่อ role/team จาก client และไม่ให้ Node ติดต่อฐานข้อมูล production โดยตรง

## ขอบเขตที่พัฒนาแล้ว

1. Node.js remote MCP ที่ `/mcp` แบบ stateless Streamable HTTP
2. Bearer-token verification ผ่าน Laravel `POST /api/mcp/v1/auth/context`
3. Permission Guard สองชั้น: ซ่อน tool ที่ไม่มีสิทธิ์ และตรวจ role/permission/team scope ก่อนอ่านข้อมูล
4. Laravel Gateway client ที่เรียก business endpoints ด้วย `GET` เท่านั้น
5. `/healthz` สำหรับ process liveness และ `/readyz` สำหรับ Laravel dependency readiness
6. Structured audit log ไป stdout และ Laravel audit endpoint โดยไม่บันทึก bearer token หรือ response payload
7. Automated permission/integration tests และ GitHub Actions CI
8. Laravel integration scaffold ซึ่งจงใจไม่สมมติชื่อ model/table ของระบบจริง

## สิ่งที่ยังต้องทำกับ Laravel V3 จริง

- Implement และ bind `McpPrincipalResolver`, `SalesTeamResolver`, `ForecastReadRepository`
- ยืนยัน mapping role ให้เหลือ canonical values: `sales`, `team_admin`, `admin`
- ยืนยัน permissions: `forecast.self.read`, `forecast.team.read`, `forecast.company.read`
- ให้ token introspection ส่งวันหมดอายุจริงและ fail closed เมื่อ token ถูก revoke
- เพิ่ม feature tests ฝั่ง Laravel กับ factory/user/team จริง
- ตรวจว่า forecast repository ใช้ read connection/queries เท่านั้น
- ตัดสินใจและทดสอบ OAuth 2.1 Authorization Code + PKCE สำหรับ ChatGPT/Codex hosted client หรือกำหนด client ที่จัดการ bearer tokenภายนอก

## Gate ก่อนเปิด production read access

- [ ] Node test suite ผ่าน 100%
- [ ] Laravel feature tests ผ่าน 100%
- [ ] บัญชี Sales เห็นและเรียกได้เฉพาะข้อมูลตนเอง
- [ ] Team Admin ข้าม team ID ไม่ได้ทั้งใน Node และ Laravel
- [ ] Admin อ่าน company aggregate ได้ แต่ไม่มี write endpoint/tool
- [ ] Token หมดอายุ/revoke ตอบ 401 และไม่มีข้อมูลรั่ว
- [ ] Laravel ล่มแล้ว `/readyz` ตอบ 503; `/healthz` ยังตอบได้
- [ ] Audit event มี actor/tool/outcome/request ID และไม่มี token/forecast payload
- [ ] HTTPS certificate ของทั้งสอง domain ถูกต้อง
- [ ] Secret อยู่ใน Plesk Environment Variables ไม่อยู่ใน Git
- [ ] ผู้ดูแล Prime Forecast อนุมัติ permission matrix และข้อมูลที่ส่งออก

## Gate ก่อนพิจารณา write tools ในอนาคต

ต้องผ่าน production read-only soak period, threat-model review, explicit human approval flow, idempotency, before/after audit, rollback plan และ test matrix แยกต่างหาก การผ่าน Phase 1 ไม่ถือเป็นการอนุมัติ write tools

