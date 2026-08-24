# Deploy ผ่าน Plesk + GitHub (ไม่มี Terminal)

## 1. เตรียม GitHub

1. สร้าง private repository และ push branch ที่ CI ผ่านแล้ว
2. ใน Plesk ไปที่ **Websites & Domains → Git → Add Repository** เลือก remote Git hosting
3. ถ้า private repository ให้เพิ่ม public SSH key ที่ Plesk สร้างเป็น GitHub Deploy Key แบบ read-only
4. เลือก branch สำหรับ production และเริ่มด้วย **Manual deployment** จนผ่าน smoke test
5. Copy webhook URL จาก Repository Settings ไป GitHub → Settings → Webhooks → Push events

## 2. สร้าง subdomain และ HTTPS

1. สร้าง `mcp.primes.co.th` ชี้ DNS มาที่ shared host
2. ออก Let's Encrypt certificate และบังคับ redirect HTTP → HTTPS
3. ตรวจว่า `https://mcp.primes.co.th/healthz` ไม่มี certificate warning

## 3. ตั้ง Node.js ใน Plesk

- Node.js version: `24.19.0`
- Application mode: `Production`
- Application root: directory ที่ Git deploy repository นี้
- Document root: directory ที่ Plesk กำหนดสำหรับ subdomain (ไม่มี static asset ที่ต้อง expose)
- Application startup file: `app.js`
- Package manager: `npm`
- กด **NPM Install** หลัง deploy ครั้งแรกและทุกครั้งที่ `package-lock.json` เปลี่ยน

ตั้ง Environment Variables จาก `.env.example` โดยเฉพาะ:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=<ใช้ค่าที่ Plesk จัดให้ หาก Plesk inject ให้ไม่ต้อง override>
PUBLIC_BASE_URL=https://mcp.primes.co.th
ALLOWED_HOSTS=mcp.primes.co.th
LARAVEL_BASE_URL=https://sale.primes.co.th
LARAVEL_MCP_SERVICE_TOKEN=<random secret อย่างน้อย 32 ตัวอักษร>
LARAVEL_TIMEOUT_MS=8000
AUDIT_SINK=laravel
AUDIT_TIMEOUT_MS=2000
LOG_LEVEL=info
```

`ALLOWED_ORIGINS` ให้เพิ่มเฉพาะ browser origins ที่ทดสอบจริง; non-browser MCP clients ไม่ส่ง Origin และไม่ต้องเพิ่ม wildcard ห้าม commit secret หรือ `.env`

## 4. ตั้ง Laravel

Deploy Laravel integration ผ่าน Git ของ `sale.primes.co.th`, เพิ่ม `PRIME_MCP_SERVICE_KEY` ค่าเดียวกับฝั่ง Node, bind adapters จริง และรัน tests ผ่านกลไก CI ก่อน deploy เนื่องจาก host ไม่มี Terminal จึงต้อง commit route/provider/config changes ให้ครบและหลีกเลี่ยงขั้นตอนที่ต้องแก้ production ด้วย `artisan` แบบ manual

ถ้า production เปิด route/config cache อยู่ ให้กำหนด cache rebuild เป็น **Additional Deployment Actions** ใน Plesk เฉพาะเมื่อ provider อนุญาตคำสั่ง PHP; หากฟีเจอร์นี้ไม่มี ให้ผู้ดูแล host ทำ cache refresh ห้ามเปิด traffic ทั้งที่ route ใหม่ยังไม่ถูกโหลด

## 5. Smoke test จากหน้าเว็บ/เครื่องภายนอก

1. `/healthz` → 200 และ `mode=read-only`
2. `/readyz` → 200 หลัง Laravel Gateway พร้อม
3. `/mcp` ไม่มี token → 401 พร้อม `WWW-Authenticate`
4. รัน permission matrix ด้วยบัญชี test ทั้ง 3 role
5. ตรวจ Laravel daily log ว่ามี audit event และไม่มี token/forecast payload

เมื่อครบจึงเปลี่ยน Git deployment เป็น Automatic ได้ Plesk รองรับ webhook เพื่อ pull/deploy หลัง push; ควรคง GitHub branch protection และบังคับ CI ก่อน merge

## Rollback โดยไม่มี Terminal

เลือก commit ที่ผ่านการทดสอบล่าสุดใน GitHub, revert ผ่าน pull request แล้วให้ Plesk pull/deploy commit revert จากนั้นกด Restart App และตรวจ `/healthz`/`/readyz` ใหม่ อย่าลบไฟล์หรือแก้ `node_modules` ผ่าน File Manager

