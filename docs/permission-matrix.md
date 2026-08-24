# Permission test matrix

| Scenario | Expected |
|---|---|
| no token / malformed token / revoked token | HTTP 401 + `WWW-Authenticate` |
| Sales lists tools | เห็นเฉพาะ `get_my_forecast` |
| Sales requests team/company tool | tool ไม่ปรากฏและ call ตรงต้อง fail |
| Team Admin lists tools | เห็น self + team + salesperson |
| Team Admin reads assigned team | allow |
| Team Admin changes `team_id` เป็นทีมอื่น | deny ก่อนเรียก forecast endpoint และ Laravel deny ซ้ำ |
| Team Admin reads salesperson outside team | Laravel deny |
| Admin lists tools | เห็นทั้ง 4 read tools |
| Admin reads company aggregate | allow |
| role ถูกต้องแต่ขาด explicit permission | deny/tool hidden |
| Laravel timeout/unavailable | tool error แบบ retryable; `/readyz` = 503 |
| audit sink unavailable | read result ไม่เปลี่ยน; stderr มี delivery failure |
| any tool metadata | `readOnlyHint=true`, `destructiveHint=false` |
| registry scan | ไม่มีชื่อ/handler ที่เป็น create/update/delete/write |

รัน Node matrix ด้วย `npm run test:permissions` ส่วน Laravel ต้องเพิ่ม feature tests ใน repository `sale.primes.co.th` โดยใช้ฐานข้อมูล test เท่านั้น

