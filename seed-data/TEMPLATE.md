# Sual Hazırlama Təlimatı

Bu fayl `quiz-questions.json` üçün format və qayda xülasəsidir. Əsas workflow `.gemini/skills/sual.md` faylındadır və `/sual` və ya `/SUAL` yazılıb material göndərildikdə həmin qaydalar tətbiq edilməlidir.

## Əsas Məqsəd

Göndərilən materialdan layihənin strukturuna uyğun maksimum sayda keyfiyyətli quiz sualı hazırlanmalıdır. Suallar kateqoriyaya və çətinlik səviyyəsinə görə düzgün ayrılmalı, təkrar olmamalı və Azərbaycan dilində yazılmalıdır.

Əsas məqsəd istifadəçinin nəzəri biliklərini möhkəmləndirməkdir. Buna görə hər səhifə ayrıca analiz edilməli, əsas anlayışlardan təxminən 5 və daha artıq keyfiyyətli sual çıxarılmalıdır. Səhifədə termin, diaqram, komanda, alət, hücum mərhələsi, müdafiə metodu və ya səbəb-nəticə izahı varsa, bunların hər biri ayrıca sual mənbəyi kimi nəzərə alınmalıdır.

Yanlış cavablar da öyrədici olmalıdır. Hər yanlış variant mümkün qədər eyni mövzu ailəsində başqa bir real anlayışın düzgün izahı kimi yazılmalı, amma cari sualın cavabı olmamalıdır. İstifadəçi bir sualı cavablandıranda digər variantlardan da əlavə nəzəri bilik öyrənməlidir.

## Sualın JSON Strukturu

Hər sual `seed-data/quiz-questions.json` faylına aşağıdakı formatda əlavə edilməlidir:

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

## Sahələrin İzahı

| Sahə | Tip | Dəyərlər | İzah |
|------|-----|----------|------|
| `categoryId` | number | 1, 2, 3, 4, 5, 6, 7 | Kateqoriya ID-si |
| `difficulty` | string | `"Başlanğıc"`, `"Orta"`, `"Peşəkar"` | Çətinlik səviyyəsi |
| `question` | string | Azərbaycan dili | Sual mətni |
| `correctKey` | string | `"A"`, `"B"`, `"C"`, `"D"` | Düzgün cavabın açarı |
| `options` | array | 4 element | Hər suala həmişə 4 cavab seçimi |
| `options[].key` | string | `"A"`, `"B"`, `"C"`, `"D"` | Seçimin açarı |
| `options[].text` | string | Azərbaycan dili | Seçimin mətni |
| `options[].explanation` | string | Azərbaycan dili | Niyə düzgün və ya yanlış olduğunun izahı |

## Kateqoriya ID-ləri

| ID | Kateqoriya | Əhatə |
|----|------------|-------|
| 1 | Ümumi | CIA, şifrələmə, autentifikasiya, hücum növləri, risk idarəetmə |
| 2 | Network Security and Attacks | TCP/IP, DNS, firewall, VPN, IDS/IPS, paket analizi, MITM, ARP/DHCP hücumları, Wi-Fi hücumları |
| 3 | Web Security | OWASP, XSS, SQLi, CSRF, SSRF, API təhlükəsizliyi |
| 4 | Active Directory | Kerberos, LDAP, GPO, privilege escalation, domain hücumları |
| 5 | SOC | SIEM, log analizi, alert triage, incident response, threat hunting |
| 6 | Code Review | Statik analiz, input validasiyası, SAST, secure coding, Secure SDLC |
| 7 | Müsahibə sualları | Junior/Middle/Senior müsahibə, real case-lər |

## Çətinlik Səviyyələri

| Səviyyə | Hədəf | Sual Üslubu |
|---------|-------|-------------|
| `Başlanğıc` | Yeni başlayanlar | Əsas anlayışlar, terminlər, tərif sualları |
| `Orta` | 1-3 il təcrübə | Praktiki tətbiq, ssenari, səbəb-nəticə |
| `Peşəkar` | 3+ il təcrübə | Dərin texniki analiz, arxitektura, real-world case-lər |

## Materialdan Sual Hazırlama Qaydası

1. Materialı əvvəlcə səhifə-səhifə oxu, sonra mövzu bloklarına böl.
2. Hər səhifədə əsas anlayışları, terminləri, alətləri, komandaları, hücum/müdafiə mərhələlərini və praktiki nəticələri qeyd et.
3. Hər səhifədən təxminən 5 və daha artıq keyfiyyətli sual çıxartmağa çalış.
4. Hər blokun uyğun kateqoriyasını müəyyən et.
5. Sualları `Başlanğıc`, `Orta`, `Peşəkar` səviyyələrinə real çətinliyinə görə ayır.
6. Eyni mövzudan fərqli çətinliklərdə sual çıxarmaq olar, amma eyni biliyi təkrar yoxlama.
7. Mövcud `quiz-questions.json` faylını yoxla və təkrar sual əlavə etmə.
8. Düzgün cavabları A, B, C, D arasında balanslı payla.
9. Yanlış variantları real, əlaqəli və öyrədici seç; onlar eyni mövzu ailəsində başqa anlayışların düzgün cavabı ola bilər, amma cari suala cavab olmamalıdır.
10. Mövzudan qopmuş absurd variantlardan istifadə etmə. NAT sualında hub/switch, Wireshark sualında Evil Twin, ARP sualında WPA handshake kimi əlaqəsiz variantlar qəbul edilmir.
11. Lazım gəldikdə “Heç biri düzgün deyil”, “Bütün fikirlər düzgündür”, “Yalnız A və B doğrudur” kimi çaşdırıcı variantlardan istifadə etmək olar, amma onlar real məntiqə uyğun olmalıdır.
12. “Materialda belədir”, “materialdakı anlayış” kimi mənbə prosesini göstərən ifadələr yazma.
13. Hər variant üçün öyrədici izah yaz.
14. Materialdan kənar, əsassız fakt əlavə etmə.
15. JSON formatını validasiya et.

## Ağıllı Yanlış Variant Qaydası

1. Əvvəl materialdan cavab bankı yarat: terminlər, təriflər, alət məqsədləri, hücum mərhələləri və müdafiə yanaşmaları.
2. Hər sual üçün 1 düzgün cavab seç.
3. Digər 3 variantı həmin cavab bankından, mütləq eyni konkret mövzu ailəsindən götür.
4. Yanlış variant həmin sualın cavabı olmamalı, amma eyni mövzuda başqa sualın və ya başqa anlayışın düzgün cavabı ola bilər.
5. İzahda variantın eyni mövzuda hansı anlayışa aid olduğunu və niyə cari suala uyğun olmadığını qısa göstər.
6. Məqsəd: istifadəçi düzgün cavabı bilsə belə, həmin mövzu ailəsində digər 3 anlayışı da öyrənsin.

## Kateqoriya Başlıqlarının Uyğunlaşdırılması

Materialdan hazırlanan suallar kateqoriya daxilindəki mövzu başlıqlarını dəyişməyi tələb edirsə, `seed-data/quiz-categories.json` faylı da yenilənməlidir.

Xüsusilə `Network Security and Attacks` üçün:

1. Sualların əsas alt mövzuları `topics` siyahısında görünməlidir.
2. TCP/IP, OSI, DNS, firewall, VPN, IDS/IPS, routing, subnetting, packet analysis və şəbəkə hücumları kimi mövzular materiala uyğun başlıq kimi istifadə oluna bilər.
3. Başlıqlar qısa, Azərbaycan dilində və sualları qruplaşdıracaq səviyyədə olmalıdır.
4. `title`, `id`, `icon`, `color`, `sortOrder` sahələri zərurət olmadıqca dəyişdirilməməlidir.
5. Dəyişiklikdən sonra hansı başlıqların yeniləndiyi bildirilməlidir.

## Vacib Qaydalar

1. Hər sualın 4 seçimi olmalıdır: A, B, C, D.
2. Hər seçimin izahı olmalıdır.
3. `correctKey` düzgün seçimin key-i ilə uyğun olmalıdır.
4. Suallar və izahlar Azərbaycan dilində yazılmalıdır.
5. İzahlar sadəcə "Düzgün" və ya "Yanlış" olmamalıdır; səbəb göstərilməlidir.
6. Bir sualda yalnız bir əsas bilik yoxlanmalıdır.
7. Təkrar suallar əlavə edilməməlidir.
8. Maksimum sayda sual çıxarılmalıdır, amma keyfiyyət pozulmamalıdır.
9. `quiz-questions.json` yalnız JSON massiv formatında qalmalıdır.

## Faylı Necə Redaktə Etmək

1. `seed-data/quiz-questions.json` faylını aç.
2. Mövcud sualları yoxla.
3. Massivə yeni sual obyektlərini əlavə et.
4. JSON formatının düzgünlüyünü yoxla.
5. Dəyişiklikdən sonra neçə sual əlavə edildiyini, kateqoriya və çətinlik bölgüsünü bildir.

Development-də frontend bu faylı birbaşa oxuyur. Production-da backend seeder bu faylı oxuyub database-ə yazır.
