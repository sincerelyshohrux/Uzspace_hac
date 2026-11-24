# SiteSentinel — demo ssenariy

Uzspace Hackathon 2026 · Illegal Construction Monitoring · jamoa **Potential**

Asosiy variant **5 daqiqa**, qisqa variant **3 daqiqa** (pastda). Har bir qadamda: nima bosiladi
va nima aytiladi. Raqamlar `outputs/` dagi haqiqiy natijadan olingan (Sentinel-2, Toshkent, 2023 → 2025).

---

## Bir qarashda: asosiy raqamlar

| | |
|---|---|
| Hudud | Toshkent shahri, 13 tuman |
| Davr | T1 = 2023 iyun–sentyabr, T2 = 2025 iyun–sentyabr (har biri 4 ta Sentinel-2 surati) |
| Topilgan o'zgarishlar | **250** ta, umumiy **985 ga** |
| Cheklangan zonada | **131** ta (52 %) |
| Yuqori xavf (≥ 60) | **91** ta |
| Eng ko'p tumanlar | Sergeli 58 · Yashnobod 54 · Bektemir 23 |
| Zonalar | qishloq xo'jaligi yeri 59 · elektr liniyasi 44 · kanal 37 · temir yo'l 11 · park 11 · daryo 8 · qabriston 7 |
| Eng kichik aniqlanadigan obyekt | ~500 m² (10 m piksel) |
| Aniqlik | hali o'lchanmagan: 350 nuqtali namuna tayyor, jamoa belgilayapti |

---

## Tayyorgarlik

**Bir kun oldin**
- [ ] `make test`: hammasi yashil bo'lishi kerak.
- [ ] Agar belgilash tugagan bo'lsa: `make evaluate`, keyin Model aniqligi sahifasida haqiqiy raqamlarni tekshirish.
- [ ] Ekran yozuvini (2–3 daqiqa) zaxira sifatida yozib olish: internet yoki noutbuk ishlamay qolsa ko'rsatiladi.
- [ ] Taqdimot noutbukida brauzer zoomi 100 %, ekran ≥ 1440 px, qorong'i mavzu.

**30 daqiqa oldin**
- [ ] `make demo-reset`: oldingi sinovlardagi holat va izohlarni tozalash (alertlar saqlanadi).
- [ ] `make dev` ni ishga tushirib, http://localhost:5173 ni ochish.
- [ ] **TSH-2025-0003** ni bir marta ochish: yuqori aniqlikdagi rasmlar keshga tushadi.
- [ ] Brauzerda faqat bitta tab qoldirish, bildirishnomalarni o'chirish.
- [ ] Til: hakamlar o'zbekcha bo'lsa **UZ**, xorijiy hakam bo'lsa **EN** (tepada almashtiriladi).

---

## Asosiy ssenariy (5 daqiqa)

### 0:00 — Muammo (30 s) · *gapiradi: Asliddin*
**Ekran:** Monitoring, xarita butun Toshkent bo'ylab.

> "Shahar tez qurilmoqda. Inspektorlar kanal, elektr liniyasi yoki park hududidagi yangi qurilishni
> ko'pincha qurilish tugagandan keyin bilishadi. Biz har oyda ochiq sun'iy yo'ldosh rasmlarini
> solishtirib, qayerda yangi qurilish paydo bo'lganini va qaysi birini **birinchi** tekshirish
> kerakligini ko'rsatamiz."

### 0:30 — Qayerda? (45 s) · *Saidazizxon*
**Bosiladi:** hech narsa. Xarita va chap ro'yxatni ko'rsatish, keyin pastdagi vaqt shkalasida ▶ (play).

> "2023 va 2025 yillar orasida 250 ta o'zgarish topildi, umumiy maydoni 985 gektar. Ularning yarmidan
> ko'pi cheklangan zonada. Ro'yxat xavf bo'yicha tartiblangan: inspektor tepadan boshlaydi.
> Vaqt shkalasi qurilish taxminan qachon boshlanganini ko'rsatadi."

**Bosiladi:** Qatlamlar tugmasi, keyin zonalarni yoqish. Elektr liniyasi va kanal chiziqlari ko'rinadi.

### 1:15 — Nega bu yer? (1 min 30 s) · *Abdukarim*
**Bosiladi:** ro'yxatdan **TSH-2025-0003** (Sergeli, ball 98). Xarita shu joyga uchib boradi.

**Oldin/Keyin:** "Yuqori aniqlik" tanlangan. Slayderni sekin chapdan o'ngga suring.

> "2023 yilda bu yerda dala edi. 2025 yilda — taxminan 14,7 gektarlik yangi bino va maydon.
> Muhimi: bu obyekt **elektr uzatish liniyasining qo'riqlash zonasi** bilan kesishadi."

**Bosiladi:** "Sentinel-2" tugmasi.

> "Model mana shu 10 metrli Sentinel-2 rasmlarida ishlaydi. Yuqori aniqlikdagi Esri rasmi faqat
> odam ko'zi bilan tekshirish uchun: model undan foydalanmagan. Buni panelning o'zida ham yozib qo'ydik."

**Pastga aylantirish:** "Nega tekshirish kerak" bo'limi va ball omillari.

> "Ball qora quti emas. 98 = o'zgarish signali × zona og'irligi × maydon. Ruxsatnoma ma'lumoti yo'q,
> shuning uchun u ballni na oshiradi, na tushiradi. Har bir omilning sababi yozilgan."

**Qisqa ko'rsatish:** "Dalillar va manbalar" — aniq surat sanalari (2023-06-03 … 2025-09-27).

### 2:45 — Keyin nima qilinadi? (1 min) · *Shohruxbek*
**Avval** izoh maydoniga yozing: *"Joyida tekshiruv rejalashtirildi"*, **keyin** "Tekshiruvga olish" ni bosing (izoh holat bilan birga saqlanadi).

> "Inspektor holatni o'zgartiradi, izoh qoldiradi. Har bir harakat tarixga yoziladi: kim, qachon, nima."

**Bosiladi:** "PDF hisobot".

> "Joyga chiqish uchun bir sahifalik hisobot: koordinata, rasmlar, zona, ball formulasi va dalil
> manbalari. Hisobotda ham 'noqonuniy' degan so'z yo'q: bu tekshiruvga yo'llanma, hukm emas."

### 3:45 — Umumiy manzara (45 s) · *Saidazizxon*
**Bosiladi:** tepada **Statistika**.

> "Rahbar uchun: tumanlar, zonalar, oylar bo'yicha. Sergeli va Yashnobod oldinda."

**Bosiladi:** "Tumanlar bo'yicha" grafikida Sergelining qizil qismi. Xaritada faqat Sergeli va cheklangan zonadagi alertlar ochiladi.

> "Har bir grafikdan to'g'ridan-to'g'ri ish ro'yxatiga o'tish mumkin."

### 4:30 — Halollik va keyingi qadam (30 s) · *Mirahmad*
**Bosiladi:** **Model aniqligi**.

> "Biz aniqlikni o'ylab topmaymiz. Shahar bo'ylab 350 ta tasodifiy nuqtani ko'r usulda belgilayapmiz:
> belgilovchi model javobini ko'rmaydi. Natija oddiy indeks farqi va Random Forest bilan solishtiriladi."

*(Agar `make evaluate` bajarilgan bo'lsa, shu yerda haqiqiy precision, recall va F1 aytiladi.)*

> "Keyingi qadam: rasmiy ruxsatnomalar reyestriga ulanish va yuqori aniqlikdagi milliy suratlar.
> Shunda kichik uylarni ham topish va ruxsatsiz qurilishni avtomatik ajratish mumkin."

---

## Qisqa variant (3 daqiqa)

1. Muammo (20 s).
2. Xarita: 250 ta o'zgarish, yarmi zonada (30 s).
3. **TSH-2025-0003**: Oldin/Keyin slayder, elektr liniyasi zonasi, ball izohi (1 min 10 s).
4. Holatni "Tekshiruvda" ga o'tkazish va PDF (40 s).
5. Model aniqligi: halol baholash rejasi va keyingi qadam (20 s).

---

## Zaxira rejalar

| Muammo | Nima qilinadi |
|---|---|
| Internet yo'q, yuqori aniqlikdagi rasm chiqmadi | "Sentinel-2" tugmasini bosing: rasmlar lokal. Esri rasmlari uchun oldindan yozilgan videoni ko'rsating. |
| Backend ishlamayapti | Sozlamalar (⚙) → "Demo ma'lumotga o'tish". Xuddi shu haqiqiy natijalar brauzerning o'zidan yuklanadi; holatlar brauzerda saqlanadi. |
| Noutbuk ishlamay qoldi | Ekran yozuvi telefon yoki boshqa noutbukda. |
| Xarita sekin | Ro'yxatdan alertni bosish baribir ishlaydi; 3D rejimni yoqmang. |

---

## Hakamlar savollariga tayyor javoblar

**"Bu noqonuniy qurilishni aniqlaydimi?"**
Yo'q. Tizim *yangi qurilish* va uning *cheklangan zonaga* tushishini topadi. Noqonuniylikni faqat
ruxsatnoma bilan solishtirish va inspektor tekshiruvi aniqlaydi. Reyestr ulansa, ruxsatnomasi bor
obyektlarning balli avtomatik pasayadi (formulada omil tayyor: mos kelsa ×0.2).

**"Aniqligingiz qancha?"**
Hali o'lchanmagan va biz raqam o'ylab topmaymiz. Shahar bo'ylab 350 nuqtali tabaqalangan tasodifiy
namuna tuzilgan: 100 tasi alertlar ichida, 100 tasi filtrlangan nomzodlarda, 150 tasi qolgan hududda.
Belgilash ko'r usulda; natija maydon bo'yicha tortiladi. *(Belgilash tugasa — haqiqiy raqamlar.)*

**"Nega Sentinel-2? Aniqligi past-ku."**
Bepul, har 5 kunda yangilanadi, butun mamlakatni qamraydi, API kaliti kerak emas. Kamchiligi:
~500 m² dan kichik obyektlar ko'rinmaydi. Arxitektura rasm manbasiga bog'liq emas: yuqori
aniqlikdagi milliy suratlar shu pipeline'ga ulanadi.

**"Mavsumiy dalalar yolg'on signal bermaydimi?"**
Beradi, shuning uchun filtr bor: T2 davrida biror oy yashil bo'lgan joy (NDVI cho'qqisi ≥ 0,45)
dala deb tashlanadi. Obyekt darajasida ham NDBI va NDVI chegaralari bor. Suv va qirg'oqlar MNDWI bilan chiqariladi.

**"Ball qanday hisoblanadi?"**
`100 × o'zgarish signali × zona og'irligi × maydon omili × ruxsatnoma omili`. Zona og'irliklari
xavfga qarab: elektr liniyasi 1.0, kanal/daryo 0.9, park 0.8, qishloq xo'jaligi yeri 0.7,
temir yo'l/qabriston 0.6, zona yo'q 0.3. Ball — ustuvorlik tartibi, ehtimollik emas.

**"Zonalar qayerdan?"**
OpenStreetMap. Himoya kengliklari (kanal 30 m, daryo 50 m, elektr liniyasi 30 m, temir yo'l 25 m)
taxminiy; rasmiy chegaralar bilan almashtirish oson.

**"Qancha tez ishlaydi, qancha turadi?"**
Rasmlar bir marta yuklab olingach (~1 GB, internet tezligiga bog'liq), butun Toshkent uchun qayta hisoblash keshdan ishlaydi. Ma'lumot va dasturlar ochiq, litsenziya to'lovi yo'q.

**"Real joriy qilish uchun nima kerak?"**
1) ruxsatnomalar reyestriga API; 2) rasmiy zona chegaralari; 3) yuqori aniqlikdagi suratlar;
4) inspektorlar uchun login va rollar. Ish jarayoni (holat, tarix, PDF) allaqachon tayyor.

---

## Rollar

| Kim | Qism |
|---|---|
| Asliddin | Muammo, xulosa, savollarni taqsimlash |
| Saidazizxon | Xarita, statistika (sichqoncha shu odamda) |
| Abdukarim | Oldin/Keyin, zonalar, Sentinel-2 haqidagi savollar |
| Shohruxbek | Inspektor ish jarayoni, PDF, texnik savollar |
| Mirahmad | Aniqlik va baholash metodikasi |
