Material göndərildikdə Kiberaz.az layihəsi üçün aşağıdakı qaydalarla quiz sualları hazırla.

$ARGUMENTS

# Quiz Sual Sistemi

Bu command-in əsas işi istifadəçinin göndərdiyi materiallardan Kiberaz.az layihəsi üçün keyfiyyətli quiz sualları hazırlamaqdır. `/sual` yazılıb material göndərildikdə dərhal bu qaydalarla işləməyə başla.

## Əsas Tapşırıq

Materialdan mümkün qədər çox sual çıxart. Əsas hədəf yalnız imtahan yaratmaq deyil, test edən istifadəçinin nəzəri biliklərini möhkəmləndirməkdir. Buna görə materialdakı əsas anlayışlar, terminlər, səbəb-nəticə əlaqələri, hücum mexanizmləri, müdafiə yolları və alətlərin məqsədi ayrıca yoxlanmalıdır. Suallar:

1. Layihənin mövcud JSON strukturuna uyğun olmalıdır.
2. Kateqoriyalara düzgün bölünməlidir.
3. Çətinlik səviyyəsinə düzgün ayrılmalıdır.
4. Təkrar olmamalıdır.
5. Azərbaycan dilində yazılmalıdır.
6. Təlim məqsədli, aydın və texniki baxımdan düzgün olmalıdır.
7. Hər cavab variantı üçün izah verilməlidir.
8. Yanlış cavablar da öyrədici olmalıdır; istifadəçi düzgün cavabı tapsa belə, digər variantlardan əlavə anlayışlar öyrənməlidir.

Materialdakı hər real anlayış, termin, ssenari, hücum/müdafiə metodu, konfiqurasiya, risk, analiz addımı və praktiki nəticə potensial sual mənbəyidir. Sual sayını süni şəkildə azaltma; material imkan verdiyi qədər maksimum sual hazırla.

## Maksimum Sual Çıxarma Qaydası

Hər mövzudan mümkün olan ən çox keyfiyyətli sual çıxarılmalıdır. Sual yazmağa başlamazdan əvvəl mövzunun bütün bucaqlarını siyahıla, sonra hər bucaq üçün sual yaz:

```
Mövzunun bucaqları:
  → Tərif / nədir?
  → Məqsəd / niyə istifadə olunur?
  → İş prinsipi / necə işləyir?
  → Fərqlər / başqa anlayışla müqayisə
  → Protokol / format / rəqəm xüsusiyyətləri
  → Hücum / istismar ssenarisi
  → Müdafiə / qarşı tədbirlər
  → Real alət / komanda / nümunə
  → Səhv anlaşılma / ümumi yanlışlıq
```

Hər bucaqdan ən azı 1 sual çıxarmağa çalış. Bir bucaqdan sual yaza bilmirsənsə — səbəb ya materialda o məlumat yoxdur, ya da həmin bucaq bu mövzu üçün uyğun deyil. Bu halda o bucağı burax; süni sual uydurma.

Səhifə üzrə minimum hədəf:

1. Hər səhifəni ayrıca nəzərdən keçir.
2. Hər səhifədən əsas anlayışlara görə təxminən 5 və daha artıq sual çıxarmağa çalış.
3. Səhifədə diaqram, komanda, mərhələ, cədvəl, protokol axını və ya hücum zənciri varsa, hər birindən ayrıca sual hazırlamaq olar.
4. Səhifə çox sadədirsə və 5 keyfiyyətli sual vermirsə, sual sayını süni artırma; həmin çatışmazlığı növbəti əlaqəli səhifələrin anlayışları ilə kompensasiya et.
5. Uzun materiallarda ümumi hədəf materialın səhifə sayına uyğun geniş sual bankı yaratmaqdır; məsələn 100+ səhifəlik materialdan yalnız 50-60 sual çıxarmaq kifayət sayılmır.
6. Suallar istifadəçinin nəzəri biliyini möhkəmləndirməlidir: tərif, məqsəd, iş prinsipi, fərqlər, risklər, müdafiə, alətlərin rolu və real ssenari nəticələri ayrıca yoxlanmalıdır.

## Fayl Xəritəsi

```text
c:\kiberaz.az\
├── seed-data\
│   ├── quiz-categories.json
│   ├── quiz-questions.json      ← Bütün suallar buraya əlavə edilir
│   └── TEMPLATE.md              ← Sual formatı və qayda xülasəsi
│
├── Kiberaz.Domain\
│   ├── Enums\DifficultyLevel.cs
│   └── Entities\
│       ├── QuizCategory.cs
│       ├── QuizQuestion.cs
│       └── QuizQuestionOption.cs
│
├── Kiberaz.Application\
│   ├── DTOs\Quiz\
│   └── Interfaces\IQuizService.cs
│
├── Kiberaz.Infrastructure\
│   ├── Data\AppDbContext.cs
│   ├── Data\QuizSeeder.cs
│   └── Services\QuizService.cs
│
├── Kiberaz.Api\Controllers\QuizController.cs
└── kiberaz-ui\src\
    ├── services\quizService.ts
    └── data\mockData.ts
```

## Sualın JSON Strukturu

Hər sual `seed-data/quiz-questions.json` massivinə bu formatda əlavə edilməlidir:

```json
{
  "categoryId": 2,
  "difficulty": "Başlanğıc",
  "question": "Sual mətni burada yazılır?",
  "correctKey": "B",
  "options": [
    {
      "key": "A",
      "text": "Birinci cavab seçimi",
      "explanation": "Bu cavabın niyə düzgün və ya yanlış olduğunun izahı"
    },
    {
      "key": "B",
      "text": "İkinci cavab seçimi",
      "explanation": "Bu cavabın niyə düzgün və ya yanlış olduğunun izahı"
    },
    {
      "key": "C",
      "text": "Üçüncü cavab seçimi",
      "explanation": "Bu cavabın niyə düzgün və ya yanlış olduğunun izahı"
    },
    {
      "key": "D",
      "text": "Dördüncü cavab seçimi",
      "explanation": "Bu cavabın niyə düzgün və ya yanlış olduğunun izahı"
    }
  ]
}
```

## Sahələr

| Sahə | Tip | Dəyərlər | Qayda |
|------|-----|----------|-------|
| `categoryId` | number | 2, 3 | Sualın mövzusuna uyğun kateqoriya ID-si |
| `difficulty` | string | `Başlanğıc`, `Orta`, `Peşəkar` | Sualın real çətinliyinə uyğun səviyyə |
| `question` | string | Azərbaycan dili | Aydın, bir mənalı sual mətni |
| `correctKey` | string | `A`, `B`, `C`, `D` | Düzgün cavabın açarı |
| `options` | array | 4 element | Həmişə A, B, C, D seçimləri |
| `options[].key` | string | `A`, `B`, `C`, `D` | Seçimin açarı |
| `options[].text` | string | Azərbaycan dili | Cavab variantı |
| `options[].explanation` | string | Azərbaycan dili | Düzgün və ya yanlış olmasının təlim izahı |

## Kateqoriya Seçimi (Aktiv Kateqoriyalar)

| ID | Kateqoriya | Mövzular |
|----|------------|----------|
| 2 | Network Security and Attacks | TCP/IP, DNS, firewall, VPN, IDS/IPS, routing, paket analizi, MITM, ARP/DHCP hücumları, Wi-Fi hücumları və digər şəbəkə hücumları |
| 3 | Web Security | OWASP, XSS, SQLi, CSRF, SSRF, auth zəiflikləri, API təhlükəsizliyi |

Kateqoriya seçərkən sualın əsas bilik sahəsini götür. Məsələn SQL Injection mövzusu backend kodla bağlı olsa belə, əsas mövzu web zəifliyi isə `categoryId: 3` seç. Hal-hazırda yalnız **Network (2)** və **Web (3)** kateqoriyaları aktivdir — digər kateqoriyalar sonradan əlavə ediləcək.

## Çətinlik Seçimi

| Səviyyə | Nə vaxt seçilir | Sual üslubu |
|---------|------------------|-------------|
| `Başlanğıc` | Termin, tərif, əsas məqsəd, sadə fərqləndirmə | "Nədir?", "Hansı məqsədlə istifadə olunur?" |
| `Orta` | Praktiki tətbiq, ssenari, alət seçimi, səbəb-nəticə | "Bu vəziyyətdə nə edilməlidir?", "Hansı risk yaranır?" |
| `Peşəkar` | Dərin texniki analiz, arxitektura, real hücum/müdafiə zənciri, prioritetləşdirmə | "Ən doğru yanaşma hansıdır?", "Hansı indikator daha güclüdür?" |

Material eyni mövzuda müxtəlif dərinliklər verirsə, həmin mövzudan həm `Başlanğıc`, həm `Orta`, həm də `Peşəkar` səviyyəsində ayrı suallar hazırlamaq olar. Ancaq suallar eyni məzmunu təkrar etməməlidir.

---

## Professional Sual Mühəndisliyi Alqoritmi (8 Fazalı Pipeline)

> **ƏSAS PRİNSİP:** Hər sual bir mini-dərsdir. İstifadəçi düzgün cavabı bilsə də bilməsə də, 4 variantın hər birinin izahından **4 fərqli fakt** öyrənməlidir. Buna görə 4 variant da eyni mövzu ailəsindən olmalı, hamısı texniki baxımdan doğru fakt daşımalı, amma yalnız 1-i sualın cavabı olmalıdır.

---

### Faza 0 — Material Kəşfi (Oxumadan Əvvəl)

Materiala toxunmadan əvvəl bu qiymətləndirməni et və nəticəni elan et:

```
1. Materialın həcmini qiymətləndir: neçə bölüm / səhifə / mövzu var?
2. Hər bölümdən təxmini bilik atomu sayını hesabla.
3. Ümumi hədəf sual sayını elan et:
   "Bu materialdan təxminən ~X sual çıxarılacaq (Y Başlanğıc, Z Orta, W Peşəkar)"
4. Uzun material (10+ səhifə) aşkar edildikdə — Chunk Protokolunu aktivləşdir.
```

**Chunk Protokolu (10+ səhifəlik materiallarda):**
- İlk cavabda yalnız Faza 0 hesabatını ver, materiala girişlə tanış ol.
- Hər cavabda 1–2 bölümü işlə, sonda mini-hesabat ver:
  `"[N] sual əlavə edildi | [M] sual qaldı | Davam edim?"`
- İstifadəçinin "davam et" deməsini gözlə; özbaşına bütün materialı bir dəfəyə emal etmə.

---

### Faza 1 — Material Analizi: Bilik Atomlarının Çıxarılması

Materialı oxumazdan əvvəl bu cədvəli zehində qur:

```
MÖVZU AİLƏSİ → Alt anlayışlar → Hər anlayışın tərifı / məqsədi / fərqi / riski
```

Material oxunduqda hər səhifədən **bilik atomları** çıxart. Bilik atomu = ən kiçik müstəqil texniki fakt.

Nümunə (ARP mövzusu):
```
Atom 1: ARP Request — broadcast olaraq göndərilir (FF:FF:FF:FF:FF:FF)
Atom 2: ARP Reply — unicast olaraq cavab verilir
Atom 3: ARP Cache — MAC-IP uyğunluqlarını müvəqqəti saxlayır
Atom 4: ARP Spoofing — saxta ARP Reply göndərərək trafiki yönləndirir
Atom 5: Gratuitous ARP — host öz IP-MAC cütlüyünü elan edir
Atom 6: ARP Cache Poisoning — ARP cədvəlində saxta qeydlər yaradır
```

**Atom İzləmə Cədvəli** — hər bölüm bitdikdə doldur:
```
✅ Suala çevrildi: [atom1], [atom2], [atom5]
⏭ Buraxıldı:      [atom3] — Faza 2 ailə tapılmadı (4 variant yığılmadı)
                   [atom4] — Kateqoriya aktiv deyil (AD/SOC/digər)
                   [atom6] — Mövcud sualda artıq yoxlanılır (təkrar)
```

**Qayda:** Hər bilik atomu potensial olaraq ya düzgün cavab, ya da yanlış variant rolunda istifadə oluna bilər.

---

### Faza 1.5 — Mövzunun Tam Əhatə Xəritəsi (Coverage Map)

Materialda **sıralanmış alt hissələri olan strukturlu mövzular** aşkar edildikdə bu fazanı tətbiq et. Məqsəd: həmin mövzunun **hər alt hissəsini** ən azı bir sual ilə əhatə etmək.

**Strukturlu mövzu əlaməti:** Nömrəli siyahı, qat/mərhələ/addım/komponentin dəqiq sayı, cədvəl və ya ardıcıl proseslər mövcuddur.

**Tez-tez rast gəlinən strukturlu mövzular:**

| Mövzu | Alt hissələr | Minimum sual sayı |
|-------|-------------|-------------------|
| OSI Modeli | 7 qat (Physical, Data Link, Network, Transport, Session, Presentation, Application) | **hər qat üçün ≥1 sual** |
| TCP/IP Modeli | 4 qat (Network Access, Internet, Transport, Application) | hər qat üçün ≥1 sual |
| TCP 3-Way Handshake | 3 addım (SYN, SYN-ACK, ACK) | 3 addımı birlikdə yoxlayan ≥1 sual |
| DHCP DORA | 4 addım (Discover, Offer, Request, Acknowledge) | ≥1 sual (hər addım variant ola bilər) |
| Kill Chain | 7 mərhələ (Recon, Weaponize, Deliver, Exploit, Install, C2, Action) | hər mərhələ üçün ≥1 sual |
| OWASP Top 10 | 10 kateqoriya | ≥5 fərqli kateqoriya üzrə sual |
| CIA Triadası | 3 prinsip (Confidentiality, Integrity, Availability) | ≥1 sual |
| Kerberos axını | TGT, TGS, Service Ticket, KDC | ≥1 sual |

**Alqoritm:**

```
1. Materialda strukturlu mövzu var mı? → Varsa, alt hissə siyahısını çıxart.
2. Hər alt hissə üçün:
   a. Tərif/məqsəd sualı (Başlanğıc)
   b. Bu alt hissənin xüsusiyyəti / hansı PDU/protokol/funksiyaya aid olduğu (Orta)
   c. Real ssenari / hücum / müdafiə kontekstindəki rolu (Peşəkar — mümkünsə)
3. Alt hissələr arası müqayisə sualları:
   - "X qatı Y qatından nə ilə fərqlənir?"
   - "Hansı qat Z funksiyasını yerinə yetirir?"
   - "Aşağıdakı protokollardan hansı X qatında işləyir?"
4. Ümumi struktur sualı:
   - Bütün qatları/addımları sıralayan sual
   - Ən çox qarışdırılan cütləri müqayisə edən sual
```

**OSI Modeli üçün nümunə əhatə yoxlaması:**

```
✅ Layer 1 (Physical)     — kabel növü, bit ötürümü, hub, repeater
✅ Layer 2 (Data Link)    — MAC, Ethernet frame, switch, ARP
✅ Layer 3 (Network)      — IP, routing, router, paket
✅ Layer 4 (Transport)    — TCP/UDP, port, seqment, 3-way handshake
✅ Layer 5 (Session)      — sessiya idarəsi, NetBIOS, RPC
✅ Layer 6 (Presentation) — şifrələmə, sıxışdırma, format çevirməsi, TLS
✅ Layer 7 (Application)  — HTTP, DNS, FTP, SMTP, tətbiq protokolları
✅ Ümumi                  — PDU adları, hansı cihaz hansı qatda işləyir, OSI vs TCP/IP
```

**QƏTİ QAYDA:** Strukturlu mövzuda hər alt hissəyə aid heç olmasa **1 sual** hazırlanmalıdır. Hər hansı alt hissə tamamilə suallanmadan buraxılmamalıdır. Material həmin alt hissə haqqında məlumat vermirsə, ümumi texniki bilik əsasında o qata aid sual əlavə etmək olar — amma bu sual materialdan kənar fakt kimi deyil, ümumi mövzu biliyini tamamlayan sual kimi yazılmalıdır.

---

### Faza 2 — Sual Ailəsinin Müəyyən Edilməsi

Hər sual yaratmazdan əvvəl onun **Sual Ailəsini** (Question Family) müəyyən et. Sual Ailəsi = sualın aid olduğu ən dar texniki alt mövzu.

| Sual | Sual Ailəsi | Ailə üzvləri (variant pool) |
|------|-------------|----------------------------|
| "ARP Request hansı üsulla göndərilir?" | ARP protokol mexanizmi | broadcast, unicast, multicast, anycast |
| "NAT-ın əsas məqsədi nədir?" | NAT funksiyası | IP ünvan çevrimi, port mapping, SNAT, DNAT |
| "XSS hücumunun əsas hədəfi nədir?" | XSS mexanizmi | DOM manipulyasiya, cookie oğurluğu, session hijack, defacement |
| "Kerberos-da TGT-nin rolu nədir?" | Kerberos autentifikasiya axını | TGT, TGS, Service Ticket, KDC |

**QƏTİ QAYDA:** Variant yazmağa başlamazdan əvvəl Sual Ailəsini dəqiq təyin et. Əgər 4 variant eyni ailədən tapılmırsa, sualı yenidən formalaşdır və ya ailəni bir pillə genişləndir (amma heç vaxt fərqli mövzuya keçmə).

---

### Faza 3 — Cavab Kainatının (Answer Universe) Qurulması

Sual Ailəsi müəyyən edildikdən sonra həmin ailə daxilində **Cavab Kainatı** yarat — sualla eyni qrammatik formada, eyni məna müstəvisində olan bütün mümkün cavablar siyahısı.

**Cavab Kainatı qaydaları:**

1. **Qrammatik bərabərlik:** Bütün variantlar eyni nitq hissəsindən olmalıdır.
2. **Uzunluq bərabərliyi:** Variantların mətni təxminən eyni uzunluqda olmalıdır.
3. **Texniki doğruluq:** Hər variant öz-özlüyündə texniki baxımdan **doğru bir fakt** olmalıdır — amma bu sualın cavabı olmamalıdır.
4. **Çaşdırıcı yaxınlıq:** Yanlış variantlar düzgün cavaba **mümkün qədər yaxın** olmalıdır.

**Nümunə:**

Sual: "TCP three-way handshake prosesinin düzgün ardıcıllığı hansıdır?"
```
A: SYN → SYN-ACK → ACK   ← DÜZGÜNdür
B: SYN → ACK → SYN-ACK   ← YANLIŞ amma eyni bayraqları ehtiva edir
C: SYN-ACK → SYN → ACK   ← YANLIŞ amma eyni bayraqları ehtiva edir
D: ACK → SYN → SYN-ACK   ← YANLIŞ amma eyni bayraqları ehtiva edir
```

**Pis nümunə (YASAQ):**
```
A: SYN → SYN-ACK → ACK
B: DNS sorğusu göndərilir
C: ARP broadcast edilir
D: ICMP Echo Request göndərilir
```
B, C, D tamamilə fərqli protokol ailələrindəndir — eliminasiya ilə cavab tapıla bilər.

---

### Faza 4 — Distraktor (Yanlış Variant) Seçimi Alqoritmi

**Distraktor Tipi 1 — Ailə Daxili Əkiz (ən yüksək prioritet):**
```
Sual: "DORA prosesində IP ünvan təklifi hansı addımda verilir?"
Düzgün: Offer   |   Distraktorlar: Discover, Request, Acknowledge
```

**Distraktor Tipi 2 — Ailə Daxili Qonşu:**
```
Sual: "ARP spoofing hücumunda təcavüzkar nə göndərir?"
Düzgün: Saxta ARP Reply   |   Distraktorlar: Saxta ARP Request, Gratuitous ARP paketi, RARP sorğusu
```

**Distraktor Tipi 3 — Texniki Çaşdırıcı:**
```
Sual: "Firewall-un əsas məqsədi nədir?"
Düzgün: Şəbəkə trafikini filtrasiya edərək icazəsiz girişin qarşısını almaq
Distraktorlar:
  - Şəbəkə trafikini şifrələyərək məxfiliyini qorumaq (VPN-in işidir)
  - Şəbəkə trafikini izləyərək anomaliyaları aşkar etmək (IDS-in işidir)
  - Şəbəkə trafikini balanslaşdıraraq performansı artırmaq (load balancer-in işidir)
```

---

### Faza 5 — Çaşdırıcı Meta-Variantların İstifadəsi

**5a. "Bütün variantlar düzgündür" tipi:**
- YALNIZ həqiqətən bütün digər 3 variant doğru olduqda düzgün cavab ola bilər.
- Hər 15–20 sualda bir dəfə istifadə et.

**5b. "Heç biri düzgün deyil" tipi:**
- YALNIZ həqiqətən heç bir digər variant düzgün olmadıqda düzgün cavab ola bilər.
- Hər 20–25 sualda bir dəfə istifadə et.

**5c. "Yalnız A və C düzgündür" tipi:**
- Birlikdə işləyən konseptləri tanımağı yoxlayır.

**QƏTİ QAYDALAR:**
1. Meta-variant istifadə edildikdə digər 3 variant eyni sual ailəsindən olmalıdır.
2. Meta-variant heç vaxt digər variantlardan asanlıqla fərqlənən olmamalıdır.
3. Meta-variant düzgün cavab deyilsə, izahı xüsusilə ətraflı olmalıdır.

---

### Faza 6 — İzah Mühəndisliyi (Explanation Engineering)

İzah = hər variantın mini-dərsi. İstifadəçi cavabı bildikdən sonra hər 4 izahı oxuyaraq əlavə 3 fakt öyrənməlidir.

**Düzgün variant izahı:**
```
"Düzgün cavab. [Faktin qısa izahı]. [Niyə bu cavab digərlərindən dəqiq olaraq fərqlənir]. [Əlavə kontekst]."
```

**Yanlış variant izahı:**
```
"Yanlış. [Bu fakt əslində nəyə aiddir / nə vaxt doğrudur]. [Niyə bu sualın cavabı deyil]. [Əlavə öyrədici fakt]."
```

**QƏTİ YASAQLAR:**
- ❌ "Bu yanlışdır." (səbəbsiz)
- ❌ "Düzgün cavab A-dır." (izahsız)
- ❌ "Bu variant sualın cavabı deyil." (niyə deyil?)
- ❌ "Bu başqa mövzuya aiddir." (hansı mövzuya?)

**MƏCBURİ elementlər:**
- ✅ Bu fakt əslində harada/nə zaman doğrudur
- ✅ Niyə bu konkret sualın cavabı deyil
- ✅ Əlavə bilik verən 1 cümlə

---

### Faza 7 — Keyfiyyət Qapısı (Quality Gate)

Hər sual hazırlandıqdan sonra bu yoxlama siyahısından keçirilməlidir. Hər hansı biri "Xeyr" olarsa, sual düzəldilməlidir:

| # | Yoxlama | Keçdi? |
|---|---------|--------|
| 1 | Bütün 4 variant eyni Sual Ailəsindəndir? | ✅/❌ |
| 2 | Hər variant öz-özlüyündə texniki baxımdan doğru bir faktdır (amma yalnız 1-i sualın cavabıdır)? | ✅/❌ |
| 3 | Variantlar qrammatik və uzunluq baxımından bərabərdir? | ✅/❌ |
| 4 | İstifadəçi mövzunu bilməsə, eliminasiya ilə cavabı tapa bilməz? | ✅/❌ |
| 5 | Hər izah ən azı 1 əlavə fakt öyrədir? | ✅/❌ |
| 6 | Düzgün cavabın Key-i (A/B/C/D) əvvəlki suallarla balanslıdır? | ✅/❌ |
| 7 | Sual mətni aydın, birmənalı və Azərbaycan dilində qrammatik düzgündür? | ✅/❌ |
| 8 | Heç bir variant absurd, uydurma və ya mövzudan kənar deyil? | ✅/❌ |
| 9 | Meta-variant (əgər varsa) qaydalarına uyğundur? | ✅/❌ |
| 10 | Bu sual mövcud sual bankında təkrar deyil? | ✅/❌ |
| 11 | Çətinlik balansı: Başlanğıc ~40%, Orta ~40%, Peşəkar ~20%? | ✅/❌ |

---

### Nümunə — Tam Pipeline Tətbiqi

**Material:** "DHCP DORA prosesi: Discover, Offer, Request, Acknowledge"

**Faza 0:** ~8 atom → hədəf ~4 sual (2 Başlanğıc, 1 Orta, 1 Peşəkar)

**Faza 1 — Bilik atomları:**
```
- Discover: müştəri broadcast göndərir (255.255.255.255)
- Offer: server IP təklif edir
- Request: müştəri təklifi qəbul edir (broadcast — digər serverlərə xəbər vermək üçün)
- Acknowledge: server IP ünvanını rəsmi təsdiq edir
- DHCP Starvation: saxta Discover paketləri ilə IP pool-unu tükətmə hücumu
- Rogue DHCP: şəbəkəyə saxta DHCP server qoşaraq yanlış konfiqurasiya yaymaq
- DHCP Lease: IP ünvanının müvəqqəti istifadə müddəti
- DHCP Relay: fərqli subnet-dəki DHCP serverinə sorğunu yönləndirmək
```

**Faza 2 — Sual Ailəsi:** DORA prosesinin addımları

**Faza 3 — Cavab Kainatı:** Discover, Offer, Request, Acknowledge

```json
{
  "categoryId": 2,
  "difficulty": "Başlanğıc",
  "question": "DHCP DORA prosesində müştəri hansı addımda IP ünvan təklifini qəbul etdiyini bildirir?",
  "correctKey": "C",
  "options": [
    {
      "key": "A",
      "text": "Discover",
      "explanation": "Yanlış. Discover DORA-nın ilk addımıdır — müştəri şəbəkədə DHCP server axtarmaq üçün broadcast sorğu göndərir. Bu addımda hələ heç bir IP təklifi yoxdur, müştəri sadəcə mövcud serverləri kəşf edir."
    },
    {
      "key": "B",
      "text": "Offer",
      "explanation": "Yanlış. Offer DORA-nın ikinci addımıdır — DHCP server müştəriyə IP ünvan təklif edir. Burada server təklif verir, amma müştəri hələ heç nəyi qəbul etməyib. Şəbəkədə birdən çox DHCP server varsa, hər biri ayrıca Offer göndərə bilər."
    },
    {
      "key": "C",
      "text": "Request",
      "explanation": "Düzgün cavab. Request DORA-nın üçüncü addımıdır — müştəri alınan təkliflərdən birini seçib qəbul etdiyini broadcast olaraq bildirir. Broadcast olmasının səbəbi digər DHCP serverlərin də bu seçimdən xəbər tutub öz təkliflərini geri götürməsidir."
    },
    {
      "key": "D",
      "text": "Acknowledge",
      "explanation": "Yanlış. Acknowledge DORA-nın son addımıdır — server müştərinin Request-ini qəbul edib IP ünvanını rəsmi olaraq təsdiq edir və lease müddətini bildirir. Bu addım serverin cavabıdır, müştərinin deyil."
    }
  ]
}
```

**Atom İzləmə:**
```
✅ Suala çevrildi: Discover, Offer, Request, Acknowledge, DHCP Starvation, Rogue DHCP
⏭ Buraxıldı:      DHCP Lease — Orta səviyyə sual kimi növbəti iterasiyaya saxlanıldı
                   DHCP Relay — Peşəkar səviyyə; ayrı mövzu kimi işlənəcək
```

**Faza 7:** ✅ Hamısı DORA ailəsindəndir, hamısı real DHCP addımlarıdır, qrammatik bərabərdir, hər izah əlavə fakt öyrədir, çətinlik balansı uyğundur.

---

## Materialdan Sual Çıxarma Ardıcıllığı

1. **Faza 0** — Material həcmini qiymətləndir, hədəf sual sayını elan et, uzun materialda Chunk Protokolunu aktivləşdir.
2. **Faza 1** — Hər səhifədən bilik atomlarını çıxart; atom izləmə cədvəlini doldur.
3. **Faza 1.5** — Strukturlu mövzu aşkar edildikdə Coverage Map qur.
4. **Faza 2** — Atomları Sual Ailəsinə qruplaşdır (hər ailədə ≥4 atom lazımdır).
5. **Faza 3** — Hər Sual Ailəsi üçün Cavab Kainatını qur.
6. **Faza 4** — Distraktorları prioritet sırası ilə seç: Əkiz > Qonşu > Texniki Çaşdırıcı.
7. **Faza 5** — Hər 15–20 sualda bir meta-variant əlavə et.
8. **Faza 6** — İzahları mini-dərs strukturunda yaz.
9. **Faza 7** — Hər sualı 11 maddəlik Keyfiyyət Qapısından keçir.
10. Düzgün cavab Key-ini (A/B/C/D) ardıcıl suallar arasında balanslı paylaşdır.
11. Eyni mövzudan həm `Başlanğıc`, həm `Orta`, həm `Peşəkar` sual çıxarmaq olar — amma hər biri fərqli bilik atomunu yoxlamalıdır.
12. Oxşar sualları birləşdir, təkrarları sil.
13. Materialdan kənar fakt əlavə etmə.
14. JSON-un sintaktik düzgünlüyünü yoxla.

---

## Düzgün Kateqoriya və Alt Başlıq Seçimi

**[MÜTLƏQİ QAYDA]** Hər sual yazılmadan əvvəl iki addım mütləq yerinə yetirilməlidir:

### Addım 1 — Düzgün `categoryId` seçimi

```
Sual şəbəkə protokolu, cihaz, OSI/TCP-IP, routing, Wi-Fi, ARP, DHCP,
paket analizi, MITM, şəbəkə hücumu haqqındadır?
  → categoryId: 2 (Network Security and Attacks)

Sual veb tətbiq zəifliyi (XSS, SQLi, CSRF, SSRF, API) haqqındadır?
  → categoryId: 3 (Web Security)
```

Hal-hazırda yalnız bu 2 kateqoriya aktivdir. Material digər sahəyə (AD, SOC, Code Review və s.) aiddirsə, sual hazırlama — istifadəçiyə bildir ki, bu kateqoriya hələ aktiv deyil.

**Qarışdırılan hallar:** SSRF ilə daxili şəbəkəyə giriş → `categoryId: 3`; ARP Spoofing ilə HTTP trafik → `categoryId: 2`.

### Addım 2 — Düzgün alt başlığa yerləşdirmə

| Mövzu | Alt başlıq |
|-------|-----------|
| OSI Layer 1-3 | `OSI Modeli` |
| TCP/UDP, portlar | `TCP/UDP və Portlar` |
| ARP, MAC, switch | `ARP və Data Link` |
| IP, routing, NAT | `IP, Routing və NAT` |
| DHCP | `DHCP Konfiqurasiyası` |
| DNS | `DNS Protokolu` |
| Firewall, IDS/IPS | `Firewall və IDS/IPS` |
| VPN, tunnel | `VPN və Şifrəli Tunellər` |
| Wi-Fi standartları | `Wi-Fi Standartları` |
| ARP Spoofing, MITM | `ARP Poisoning` |
| DHCP Starvation | `DHCP Starvation` |
| Evil Twin, Deauth | `Evil Twin` |
| Wireshark, tcpdump | `Paket Analizi` |

---

## Təkrar Sual Yoxlaması

Yeni sual əlavə etməzdən əvvəl `seed-data/quiz-questions.json` faylındakı mövcud sualları yoxla.

**Təkrar sayılır:**
1. Eyni anlayışı eyni çətinlikdə soruşan sual.
2. Sual mətni fərqli olsa da, eyni düzgün cavabı eyni kontekstdə yoxlayan sual.
3. Yalnız cavab variantları dəyişdirilmiş oxşar sual.

**Təkrar olmayan:**
1. Eyni mövzunun fərqli aspektini soruşur.
2. Eyni mövzunu fərqli çətinlikdə yoxlayır.
3. Fərqli praktiki ssenari və ya analiz məqsədi daşıyır.

---

## Redaktə Proseduru

1. `seed-data/quiz-questions.json` faylını oxu.
2. Mövcud sualları yadda saxla, təkrarları yoxla.
3. Materialdan yeni sualları hazırla.
4. Sualları JSON massivinə əlavə et.
5. JSON formatını validasiya et.
6. Dəyişiklikdən sonra hesabat ver:

```
Əlavə edildi: N sual
Kateqoriya bölgüsü: Network (X) | Web (Y)
Çətinlik bölgüsü: Başlanğıc (A) | Orta (B) | Peşəkar (C)
Mövzu bölgüsü:
  OSI Modeli — 14 sual
    ├── Layer 1 Physical     → 2 sual (1 Başlanğıc, 1 Orta)
    └── ...
Buraxıldı: N atom — səbəb (kateqoriya aktiv deyil / ailə tam deyil / təkrar)
```

---

## Vacib Qaydalar

1. Hər sualın 4 seçimi olmalıdır: A, B, C, D.
2. Hər seçimin izahı olmalıdır.
3. `correctKey` seçimlərdən biri ilə uyğun olmalıdır.
4. Suallar və izahlar Azərbaycan dilində olmalıdır.
5. Sual mətnləri aydın, qrammatik və texniki baxımdan dəqiq olmalıdır.
6. Bir sualda yalnız bir əsas bilik yoxlanmalıdır.
7. Maksimum sayda keyfiyyətli sual çıxart; keyfiyyəti pozan süni sual artırma etmə.
8. JSON-a şərh, trailing comma və ya əlavə mətn yazma.
9. `quiz-questions.json` yalnız JSON massiv formatında qalmalıdır.
10. **[MÜTLƏQİ QAYDA]** Suallar mövzu və alt kateqoriya əsaslı qruplaşdırılmalıdır; JSON-a da bu ardıcıllıqla yazılmalıdır.

---

## Dual-Mode Arxitektura

```text
Development:
seed-data/quiz-questions.json → quizService.ts → QuizView.tsx

Production:
seed-data/quiz-questions.json → QuizSeeder.cs → Database → QuizController.cs → quizService.ts
```

## API Endpoints

```text
GET    /api/quiz/categories
GET    /api/quiz/questions?categoryId=2&difficulty=Orta&count=10
POST   /api/quiz/questions
DELETE /api/quiz/questions/{id}
```
