const fs = require('fs');

const filePath = 'C:\\kiberaz.az\\seed-data\\quiz-questions.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Hücum suallarını aşkarlamaq üçün açar sözlər
const attackPatterns = [
  /ARP spoofing/i,
  /ARP poisoning/i,
  /MITM/i,
  /Man-in-the-Middle/i,
  /DHCP spoofing/i,
  /DHCP starvation/i,
  /rogue DHCP/i,
  /MAC flood/i,
  /Evil Twin/i,
  /Rogue access point/i,
  /Rogue AP/i,
  /deauthentication/i,
  /Bettercap/i,
  /arp\.spoof/i,
  /net\.probe/i,
  /SSLstrip/i,
  /handshake tutulduqdan/i,
  /handshake tutmaq/i,
  /WPA\/WPA2 handshake/i,
  /monitor mode/i,
  /airodump/i,
  /aircrack/i,
  /IP forwarding aktiv/i,
  /IP forwarding deaktiv/i,
  /MAC whitelist bypass/i,
  /passiv trafik tutma/i,
  /JavaScript injection/i,
  /strace kimi/i,
  /virtual adapter/i,
  /offline brute-force/i,
  /offline parol/i,
  /5 GHz handshake/i,
  /Hidden.*SSID.*aşkarlamaq/i,
  /HTTP proxy.*ARP spoofing/i,
  /switch.*lokal.*passiv sniffing/i,
  /Sistem çağırışlarının/i,
];

let updated = 0;
for (const q of data) {
  if (q.categoryId === 2) {
    const isAttack = attackPatterns.some(p => p.test(q.question));
    if (isAttack) {
      q.categoryId = 8;
      updated++;
    }
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ ${updated} sual categoryId 8-ə köçürüldü.`);
console.log(`✅ Fayl UTF-8 olaraq saxlandı.`);
