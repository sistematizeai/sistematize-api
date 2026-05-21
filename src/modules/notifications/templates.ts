interface TemplateData {
  clientName: string;
  businessName: string;
  businessLogo?: string | null;
  serviceName: string;
  collaboratorName: string;
  date: string;
  time: string;
  duration: string;
  primaryColor?: string;
  customMessage?: string;
  cancelReason?: string;
  publicUrl?: string;
}

function baseLayout(content: string, data: { businessName: string; primaryColor?: string }) {
  const color = data.primaryColor || '#4F5AE5';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7}
.container{max-width:560px;margin:0 auto;padding:32px 16px}
.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
.header{background:${color};padding:28px 32px;text-align:center}
.header h1{color:#fff;font-size:18px;font-weight:700;margin:0}
.body{padding:32px}
.detail{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0}
.detail:last-child{border-bottom:none}
.detail-icon{width:36px;height:36px;border-radius:10px;background:${color}10;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.detail-label{font-size:12px;color:#8c8c8c;margin:0}
.detail-value{font-size:14px;color:#1a1a1a;font-weight:600;margin:2px 0 0}
.footer{padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center}
.footer p{font-size:11px;color:#8c8c8c;margin:0}
.btn{display:inline-block;padding:12px 28px;background:${color};color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;margin-top:16px}
.msg{background:#fafafa;border-radius:10px;padding:14px 18px;margin:16px 0 0;font-size:13px;color:#555;line-height:1.5;font-style:italic}
</style></head><body>
<div class="container"><div class="card">
${content}
<div class="footer"><p>${data.businessName} — Agendamento Online</p></div>
</div></div></body></html>`;
}

function detailRow(icon: string, label: string, value: string) {
  return `<div class="detail">
<div class="detail-icon">${icon}</div>
<div><p class="detail-label">${label}</p><p class="detail-value">${value}</p></div>
</div>`;
}

const icons = {
  calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F5AE5" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F5AE5" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  scissors: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F5AE5" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F5AE5" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

export function confirmationTemplate(data: TemplateData): string {
  const content = `
<div class="header"><h1>Agendamento Confirmado!</h1></div>
<div class="body">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 20px">Ola <strong>${data.clientName}</strong>, seu agendamento foi confirmado com sucesso.</p>
${detailRow(icons.scissors, 'Servico', data.serviceName)}
${detailRow(icons.user, 'Profissional', data.collaboratorName)}
${detailRow(icons.calendar, 'Data', data.date)}
${detailRow(icons.clock, 'Horario', `${data.time} (${data.duration})`)}
${data.customMessage ? `<div class="msg">${data.customMessage}</div>` : ''}
${data.publicUrl ? `<div style="text-align:center"><a href="${data.publicUrl}" class="btn">Ver Agendamento</a></div>` : ''}
</div>`;
  return baseLayout(content, data);
}

export function reminderTemplate(data: TemplateData): string {
  const content = `
<div class="header"><h1>Lembrete de Agendamento</h1></div>
<div class="body">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 20px">Ola <strong>${data.clientName}</strong>, este e um lembrete do seu agendamento.</p>
${detailRow(icons.scissors, 'Servico', data.serviceName)}
${detailRow(icons.user, 'Profissional', data.collaboratorName)}
${detailRow(icons.calendar, 'Data', data.date)}
${detailRow(icons.clock, 'Horario', `${data.time} (${data.duration})`)}
${data.customMessage ? `<div class="msg">${data.customMessage}</div>` : ''}
</div>`;
  return baseLayout(content, data);
}

export function cancellationTemplate(data: TemplateData): string {
  const content = `
<div class="header" style="background:#EF4444"><h1>Agendamento Cancelado</h1></div>
<div class="body">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 20px">Ola <strong>${data.clientName}</strong>, informamos que seu agendamento foi cancelado.</p>
${detailRow(icons.scissors, 'Servico', data.serviceName)}
${detailRow(icons.calendar, 'Data', data.date)}
${detailRow(icons.clock, 'Horario', data.time)}
${data.cancelReason ? `<div class="msg"><strong>Motivo:</strong> ${data.cancelReason}</div>` : ''}
${data.publicUrl ? `<div style="text-align:center"><a href="${data.publicUrl}" class="btn" style="background:#4F5AE5">Reagendar</a></div>` : ''}
</div>`;
  return baseLayout(content, data);
}

export function trialExpiringTemplate(data: { businessName: string; ownerName: string; daysLeft: number; dashboardUrl: string }) {
  const content = `
<div class="header" style="background:#F59E0B"><h1>Seu trial esta acabando!</h1></div>
<div class="body">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px">Ola <strong>${data.ownerName}</strong>,</p>
<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px">
Seu periodo de teste do <strong>${data.businessName}</strong> no Sistematize expira em <strong>${data.daysLeft} dia${data.daysLeft > 1 ? 's' : ''}</strong>.
Para continuar usando todos os recursos, assine um plano.
</p>
<div style="text-align:center"><a href="${data.dashboardUrl}/dashboard/subscription" class="btn">Ver Planos</a></div>
</div>`;
  return baseLayout(content, { businessName: data.businessName, primaryColor: '#F59E0B' });
}

export function emailConfirmationTemplate(data: { userName: string; confirmUrl: string }) {
  const content = `
<div class="header"><h1>Confirme seu email</h1></div>
<div class="body">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px">Ola <strong>${data.userName}</strong>,</p>
<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px">
Obrigado por se cadastrar no Sistematize! Para ativar sua conta e comecar a usar o sistema, confirme seu email clicando no botao abaixo.</p>
<div style="text-align:center"><a href="${data.confirmUrl}" class="btn">Confirmar Email</a></div>
<div style="background:#fafafa;border-radius:10px;padding:14px 18px;margin:24px 0 0;font-size:12px;color:#555;line-height:1.6">
Este email foi enviado pela Sistematize. Enquanto configuramos um dominio proprio, o remetente tecnico pode aparecer como <strong>onboarding@resend.dev</strong>.
Para suporte, responda este email ou fale com <strong>sistematizeai@gmail.com</strong>.
</div>
<p style="font-size:12px;color:#8c8c8c;margin:24px 0 0;line-height:1.5">
Se voce nao criou esta conta, ignore este email. O link expira em 24 horas.</p>
</div>`;
  return baseLayout(content, { businessName: 'Sistematize' });
}

export function trialExpiredTemplate(data: { businessName: string; ownerName: string; dashboardUrl: string }) {
  const content = `
<div class="header" style="background:#EF4444"><h1>Seu trial expirou</h1></div>
<div class="body">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px">Ola <strong>${data.ownerName}</strong>,</p>
<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px">
O periodo de teste do <strong>${data.businessName}</strong> no Sistematize expirou.
Seus dados estao seguros, mas o acesso ao sistema esta bloqueado ate que um plano seja ativado.
</p>
<div style="text-align:center"><a href="${data.dashboardUrl}/dashboard/subscription" class="btn" style="background:#4F5AE5">Assinar Agora</a></div>
</div>`;
  return baseLayout(content, { businessName: data.businessName, primaryColor: '#EF4444' });
}
