import nodemailer from 'nodemailer';

const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE,
} = process.env;

let transporter = null;

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (e) {
    console.error('Mailer error:', e.message);
    return false;
  }
}

export async function sendAlertCriticalTicket(ticket, adminEmails) {
  return sendMail({
    to: adminEmails.join(','),
    subject: `🔴 Ticket critique : ${ticket.equipmentName || 'Équipement'}`,
    html: `
      <h2 style="color:#dc2626">Ticket critique non résolu</h2>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Équipement</td><td style="padding:8px">${ticket.equipmentName}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Panne</td><td style="padding:8px">${ticket.failureDesc}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Technicien</td><td style="padding:8px">${ticket.technician || '—'}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Département</td><td style="padding:8px">${ticket.department}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Ouvert le</td><td style="padding:8px">${new Date(ticket.openedAt).toLocaleString('fr-FR')}</td></tr>
      </table>
      <p style="margin-top:16px;color:#6b7280;font-size:12px">Gestion Équipements IT — Alerte automatique</p>
    `,
  });
}

export async function sendAlertWarrantyExpiry(equipment, adminEmails) {
  return sendMail({
    to: adminEmails.join(','),
    subject: `⚠️ Garantie expirée : ${equipment.name}`,
    html: `
      <h2 style="color:#d97706">Garantie expirée</h2>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Équipement</td><td style="padding:8px">${equipment.name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Marque/Modèle</td><td style="padding:8px">${equipment.brand} ${equipment.model}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Localisation</td><td style="padding:8px">${equipment.location}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#6b7280">Fin de garantie</td><td style="padding:8px">${equipment.warranty}</td></tr>
      </table>
      <p style="margin-top:16px;color:#6b7280;font-size:12px">Gestion Équipements IT — Alerte automatique</p>
    `,
  });
}

export async function sendMonthlyReport(stats, adminEmails) {
  const month = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  return sendMail({
    to: adminEmails.join(','),
    subject: `📊 Rapport mensuel — ${month}`,
    html: `
      <h2 style="color:#1a6fa6">Rapport mensuel — ${month}</h2>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        <tr style="background:#f3f4f6"><td style="padding:10px;font-weight:bold">Total équipements</td><td style="padding:10px;font-weight:bold;font-size:18px">${stats.total}</td></tr>
        <tr><td style="padding:10px;color:#6b7280">Actifs</td><td style="padding:10px;color:#16a34a;font-weight:bold">${stats.actifs}</td></tr>
        <tr><td style="padding:10px;color:#6b7280">En maintenance/défaillants</td><td style="padding:10px;color:#dc2626;font-weight:bold">${stats.defaillants}</td></tr>
        <tr><td style="padding:10px;color:#6b7280">Tickets ouverts</td><td style="padding:10px;color:#d97706;font-weight:bold">${stats.ticketsOuverts}</td></tr>
        <tr><td style="padding:10px;color:#6b7280">Tickets critiques</td><td style="padding:10px;color:#dc2626;font-weight:bold">${stats.ticketsCritiques}</td></tr>
        <tr><td style="padding:10px;color:#6b7280">Garanties expirées</td><td style="padding:10px;color:#dc2626;font-weight:bold">${stats.garantiesExpirees}</td></tr>
        <tr><td style="padding:10px;color:#6b7280">Visites planifiées</td><td style="padding:10px;color:#2563eb;font-weight:bold">${stats.visitesPlannifiees}</td></tr>
      </table>
      <p style="margin-top:16px;color:#6b7280;font-size:12px">Gestion Équipements IT — Rapport automatique mensuel</p>
    `,
  });
}
