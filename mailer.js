// Wysylka e-maili przez nodemailer. Gdy SMTP nie jest skonfigurowany,
// wiadomosci sa logowane do konsoli (tryb demo), wiec aplikacja dziala zawsze.
const nodemailer = require('nodemailer');

let transporter = null;
let ready = false;

function init() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    ready = true;
  }
}

async function send({ to, subject, text, html }) {
  if (!ready) {
    console.log('\n=== [TRYB DEMO] E-mail nie wyslany (brak konfiguracji SMTP) ===');
    console.log('Do:', to);
    console.log('Temat:', subject);
    console.log('Tresc:', text || html);
    console.log('=============================================================\n');
    return { demo: true };
  }
  const from = process.env.SMTP_USER;
  return transporter.sendMail({ from, to, subject, text, html });
}

module.exports = { init, send, isReady: () => ready };
