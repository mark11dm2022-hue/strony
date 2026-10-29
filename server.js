const path = require('path');
const express = require('express');
const { loadEnv } = require('./lib/env');
loadEnv();

const db = require('./lib/db');
const auth = require('./lib/auth');
const mailer = require('./lib/mailer');
mailer.init();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser);

const PORT = Number(process.env.PORT) || 3000;
const SECRET = process.env.SESSION_SECRET || 'change-me-secret';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || '';
const PUBLIC_URL = process.env.PUBLIC_URL || ('http://localhost:' + PORT);

// ---- Minimalny parser ciasteczek ----
function cookieParser(req, res, next) {
  req.cookies = {};
  const raw = req.headers.cookie;
  if (raw) raw.split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > -1) req.cookies[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  next();
}

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
function clean(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max || 200);
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ================= REZERWACJE =================
const WORK_HOURS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];

app.get('/api/slots', (req, res) => {
  const date = clean(req.query.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Nieprawidlowa data' });
  const d = new Date(date + 'T00:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return res.json({ date, slots: [] }); // weekend
  const taken = db.readAll('bookings')
    .filter((b) => b.date === date && b.status !== 'cancelled' && b.status !== 'rejected')
    .map((b) => b.time);
  const slots = WORK_HOURS.filter((h) => taken.indexOf(h) === -1);
  res.json({ date, slots });
});

app.post('/api/bookings', async (req, res) => {
  const firstName = clean(req.body.firstName, 60);
  const lastName = clean(req.body.lastName, 60);
  const email = clean(req.body.email, 120).toLowerCase();
  const date = clean(req.body.date, 10);
  const time = clean(req.body.time, 5);
  const topic = clean(req.body.topic, 80);
  const message = clean(req.body.message, 1000);

  if (!firstName || !lastName) return res.status(400).json({ error: 'Podaj imie i nazwisko.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Podaj poprawny adres e-mail.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || WORK_HOURS.indexOf(time) === -1)
    return res.status(400).json({ error: 'Wybierz poprawny termin.' });

  const dup = db.find('bookings', (b) => b.date === date && b.time === time && b.status !== 'cancelled' && b.status !== 'rejected');
  if (dup) return res.status(409).json({ error: 'Ten termin zostal wlasnie zajety. Wybierz inny.' });

  const token = auth.randomToken();
  const booking = {
    id: uid(), firstName, lastName, email, date, time, topic, message,
    status: 'pending_email', confirmToken: token, createdAt: new Date().toISOString(),
  };
  db.insert('bookings', booking);

  const link = PUBLIC_URL + '/api/confirm?token=' + token;
  try {
    await mailer.send({
      to: email,
      subject: 'Potwierdz rezerwacje rozmowy — MiniStrony',
      text: 'Czesc ' + firstName + ',\n\nAby potwierdzic rezerwacje rozmowy na ' + date + ' o ' + time +
            ', kliknij w link:\n' + link + '\n\nJesli to nie Ty, zignoruj ta wiadomosc.',
      html: '<p>Cześć ' + firstName + ',</p><p>Aby <b>potwierdzić rezerwację</b> rozmowy na <b>' + date +
            '</b> o <b>' + time + '</b>, kliknij przycisk:</p>' +
            '<p><a href="' + link + '" style="background:#5b8cff;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none">Potwierdzam rezerwację</a></p>' +
            '<p>lub otwórz link: <br>' + link + '</p><p style="color:#888">Jeśli to nie Ty, zignoruj tę wiadomość.</p>',
    });
  } catch (e) { console.error('Blad wysylki maila potwierdzajacego:', e.message); }

  res.json({ ok: true, needConfirm: true, message: 'Wyslalismy link potwierdzajacy na Twój e-mail.' });
});

app.get('/api/confirm', async (req, res) => {
  const token = clean(req.query.token, 80);
  const booking = db.find('bookings', (b) => b.confirmToken === token);
  if (!booking) return res.redirect('/rezerwacja.html?confirm=invalid');
  if (booking.status === 'pending_email') {
    db.update('bookings', booking.id, { status: 'confirmed', confirmToken: null, confirmedAt: new Date().toISOString() });
    // Powiadomienie dla wlasciciela
    try {
      await mailer.send({
        to: OWNER_EMAIL,
        subject: 'NOWA rezerwacja rozmowy: ' + booking.firstName + ' ' + booking.lastName,
        text: 'Nowa potwierdzona rezerwacja:\n\nImie: ' + booking.firstName + ' ' + booking.lastName +
              '\nE-mail: ' + booking.email + '\nTermin: ' + booking.date + ' ' + booking.time +
              '\nTemat: ' + (booking.topic || '-') + '\nWiadomosc: ' + (booking.message || '-') +
              '\n\nZobacz w panelu: ' + PUBLIC_URL + '/admin.html',
      });
    } catch (e) { console.error('Blad powiadomienia wlasciciela:', e.message); }
  }
  res.redirect('/rezerwacja.html?confirm=ok');
});

// ================= OPINIE =================
app.get('/api/reviews', (req, res) => {
  const list = db.readAll('reviews').filter((r) => r.approved)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map((r) => ({ name: r.name, rating: r.rating, text: r.text, company: r.company, createdAt: r.createdAt }));
  res.json({ reviews: list });
});

app.post('/api/reviews', (req, res) => {
  const name = clean(req.body.name, 60);
  const company = clean(req.body.company, 80);
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 5));
  const text = clean(req.body.text, 600);
  if (!name || !text) return res.status(400).json({ error: 'Podaj imie i tresc opinii.' });
  db.insert('reviews', { id: uid(), name, company, rating, text, approved: false, createdAt: new Date().toISOString() });
  res.json({ ok: true, message: 'Dziekujemy! Opinia zostanie opublikowana po akceptacji.' });
});

// ================= ADMIN =================
function requireAdmin(req, res, next) {
  const payload = auth.verify(req.cookies.session, SECRET);
  if (!payload || payload.role !== 'admin') return res.status(401).json({ error: 'Brak autoryzacji.' });
  req.admin = payload;
  next();
}

app.post('/api/admin/login', (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const password = clean(req.body.password, 200);
  const emailOk = ADMIN_EMAIL && auth.safeEqualStr(email, ADMIN_EMAIL);
  const passOk = ADMIN_PASSWORD && auth.verifyPassword(password, ADMIN_PASSWORD);
  if (!emailOk || !passOk) return res.status(401).json({ error: 'Nieprawidlowy e-mail lub haslo.' });
  const token = auth.sign({ role: 'admin', email, exp: Date.now() + 1000 * 60 * 60 * 8 }, SECRET);
  res.setHeader('Set-Cookie', 'session=' + encodeURIComponent(token) + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  const payload = auth.verify(req.cookies.session, SECRET);
  res.json({ authenticated: !!(payload && payload.role === 'admin'), email: payload ? payload.email : null });
});

app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  const rows = db.readAll('bookings').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json({ bookings: rows });
});

app.post('/api/admin/bookings/:id/status', requireAdmin, (req, res) => {
  const status = clean(req.body.status, 20);
  const allowed = ['confirmed', 'cancelled', 'done'];
  if (allowed.indexOf(status) === -1) return res.status(400).json({ error: 'Nieprawidlowy status.' });
  const row = db.update('bookings', req.params.id, { status });
  if (!row) return res.status(404).json({ error: 'Nie znaleziono.' });
  res.json({ ok: true, booking: row });
});

app.get('/api/admin/reviews', requireAdmin, (req, res) => {
  res.json({ reviews: db.readAll('reviews').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')) });
});

app.post('/api/admin/reviews/:id/approve', requireAdmin, (req, res) => {
  const row = db.update('reviews', req.params.id, { approved: true });
  if (!row) return res.status(404).json({ error: 'Nie znaleziono.' });
  res.json({ ok: true });
});

app.post('/api/admin/reviews/:id/delete', requireAdmin, (req, res) => {
  db.remove('reviews', req.params.id);
  res.json({ ok: true });
});

// ---- Pliki statyczne ----
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '127.0.0.1', () => {
  console.log('MiniStrony PRO dziala: ' + PUBLIC_URL);
  console.log('SMTP skonfigurowany: ' + (mailer.isReady() ? 'TAK' : 'NIE (tryb demo — maile w konsoli)'));
});
