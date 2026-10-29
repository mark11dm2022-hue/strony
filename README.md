# MiniStrony PRO

W pełni funkcjonalna strona oferty tworzenia mini-stron dla firm:
rezerwacja rozmowy przez kalendarz (z potwierdzeniem e-mail i powiadomieniem
dla właściciela), opinie klientów oraz panel administratora.

Сайт-визитка с полной функциональностью: запись на разговор через календарь,
подтверждение e-mail, уведомления владельцу, отзывы и админ-панель.

## Wymagania
- Node.js 16+ (sprawdzone na Node 16).

## Instalacja / Установка
```bash
npm install
cp .env.example .env
# otwórz .env i uzupełnij dane (haslo admina, SMTP)
npm start
```
Otwórz w przeglądarce: http://localhost:3000

## Konfiguracja (.env)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — dane logowania do panelu `/admin.html`.
- `SESSION_SECRET` — długi losowy ciąg (podpisywanie sesji).
- `SMTP_HOST/PORT/USER/PASS` — dane serwera poczty. Dla Gmaila użyj
  **Hasła do aplikacji** (App Password), nie zwykłego hasła:
  https://support.google.com/accounts/answer/185833
- `OWNER_EMAIL` — adres, na który przychodzą powiadomienia o nowych rezerwacjach.
- `PUBLIC_URL` — publiczny adres strony (używany w linku potwierdzającym).

> Jeśli nie uzupełnisz SMTP, aplikacja nadal działa w **trybie demo** —
> treść e-maili pojawia się w konsoli serwera (dobre do testów).

## Jak działa rezerwacja
1. Klient wybiera termin w kalendarzu i podaje imię, nazwisko oraz e-mail.
2. System wysyła na jego e-mail link potwierdzający.
3. Po kliknięciu w link rezerwacja staje się **potwierdzona**, a Ty
   (właściciel) dostajesz powiadomienie e-mail i widzisz ją w panelu.

## Panel administratora
- Adres: `/admin.html`
- Logowanie e-mailem i hasłem z `.env`.
- Zakładki: **Rezerwacje** (zmiana statusu) i **Opinie** (akceptacja / usuwanie).

## Bezpieczeństwo
- Hasło możesz trzymać jako zahaszowane (scrypt) lub jawne w `.env`.
  Aby wygenerować hash: `node -e "console.log(require('./lib/auth').hashPassword('TWOJE_HASLO'))"`
  i wklej wynik do `ADMIN_PASSWORD`.
- Serwer domyślnie nasłuchuje na `127.0.0.1`. Do publicznego wdrożenia
  uruchom za reverse-proxy (np. Nginx) z HTTPS.

## Dane
Rezerwacje i opinie zapisywane są w plikach JSON w katalogu `data/`.
