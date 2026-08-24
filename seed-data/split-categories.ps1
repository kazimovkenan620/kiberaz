$json = Get-Content 'C:\kiberaz.az\seed-data\quiz-questions.json' -Raw | ConvertFrom-Json

$attackKeywords = @(
    'ARP spoofing', 'ARP poisoning', 'ARP zəhər',
    'MITM', 'Man-in-the-Middle',
    'DHCP spoofing', 'DHCP starvation', 'rogue DHCP',
    'MAC flood', 'MAC Flood',
    'Evil Twin', 'Evil twin', 'Rogue access point', 'Rogue AP',
    'deauthentication', 'Deauthentication',
    'Bettercap', 'bettercap', 'arp\.spoof', 'net\.probe',
    'SSLstrip', 'sslstrip',
    'handshake tutulduqdan', 'handshake tutmaq', 'handshake tut',
    'WPA/WPA2 handshake',
    'monitor mode',
    'airodump', 'aircrack',
    'IP forwarding aktiv', 'IP forwarding deaktiv',
    'MAC whitelist bypass',
    'passiv trafik tutma',
    'JavaScript injection',
    'strace kimi',
    'virtual adapter',
    'offline brute-force', 'offline parol',
    '5 GHz handshake',
    'Rogue AP ile Evil Twin',
    'Hidden.*SSID.*aşkarlamaq',
    'HTTP proxy.*ARP spoofing',
    'switch.*lokal.*passiv sniffing'
)

$updated = 0
foreach ($q in $json) {
    if ($q.categoryId -eq 2) {
        $isAttack = $false
        foreach ($kw in $attackKeywords) {
            if ($q.question -match $kw) {
                $isAttack = $true
                break
            }
        }
        if ($isAttack) {
            $q.categoryId = 8
            $updated++
        }
    }
}

Write-Host "Updated $updated questions to categoryId 8"
$json | ConvertTo-Json -Depth 10 | Set-Content 'C:\kiberaz.az\seed-data\quiz-questions.json' -Encoding UTF8
Write-Host "Done saving!"
