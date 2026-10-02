import type { RenderedEmail } from "../types";
import { EMAIL_BRAND, escapeHtml, renderLayout } from "./layout";

export interface AgendaEmailInput {
  firstName: string | null;
  title: string;
  /** Já no fuso do usuário, ex.: "Hoje às 14:30", "Amanhã (dia inteiro)", "sex., 10/10 às 09:00". */
  whenLabel: string;
  location: string | null;
  url: string;
}

function greeting(firstName: string | null): string {
  return firstName ? `Olá, ${firstName}.` : "Olá!";
}

function details(input: AgendaEmailInput): string {
  const location = input.location
    ? `<p style="margin:12px 0 0;color:${EMAIL_BRAND.muted}">Local:<br><span style="color:${EMAIL_BRAND.text}">${escapeHtml(input.location)}</span></p>`
    : "";
  return `<div style="background:${EMAIL_BRAND.primarySoft};border-radius:8px;padding:16px;margin:4px 0 8px">
<p style="margin:0;font-size:18px;font-weight:700">${escapeHtml(input.title)}</p>
<p style="margin:4px 0 0">${escapeHtml(input.whenLabel)}</p>${location}</div>`;
}

function textDetails(input: AgendaEmailInput): string {
  return `${input.title}\n${input.whenLabel}${input.location ? `\n\nLocal:\n${input.location}` : ""}`;
}

/** Lembrete: "Lembrete: Dentista hoje às 14:30". */
export function agendaReminderEmail(input: AgendaEmailInput): RenderedEmail {
  const when = input.whenLabel.charAt(0).toLowerCase() + input.whenLabel.slice(1);
  return {
    subject: `Lembrete: ${input.title} ${when}`.slice(0, 200),
    html: renderLayout({
      preheader: `${input.title} — ${input.whenLabel}`,
      heading: greeting(input.firstName),
      bodyHtml: `<p style="margin:0 0 12px">Você tem um compromisso:</p>${details(input)}`,
      button: { label: "Ver na agenda", url: input.url },
    }),
    text: `${greeting(input.firstName)}\n\nVocê tem um compromisso:\n\n${textDetails(input)}\n\nVer na agenda: ${input.url}\n\nAlilu\nwww.alilu.com.br`,
  };
}

export function agendaChangedEmail(input: AgendaEmailInput): RenderedEmail {
  return {
    subject: `Compromisso alterado: ${input.title}`.slice(0, 200),
    html: renderLayout({
      preheader: `Novo horário: ${input.whenLabel}`,
      heading: greeting(input.firstName),
      bodyHtml: `<p style="margin:0 0 12px">Seu compromisso foi alterado. Veja como ficou:</p>${details(input)}`,
      button: { label: "Ver na agenda", url: input.url },
    }),
    text: `${greeting(input.firstName)}\n\nSeu compromisso foi alterado:\n\n${textDetails(input)}\n\nVer na agenda: ${input.url}\n\nAlilu`,
  };
}

export function agendaCancelledEmail(input: AgendaEmailInput): RenderedEmail {
  return {
    subject: `Compromisso cancelado: ${input.title}`.slice(0, 200),
    html: renderLayout({
      preheader: `${input.title} foi cancelado`,
      heading: greeting(input.firstName),
      bodyHtml: `<p style="margin:0 0 12px">Este compromisso foi cancelado e os lembretes dele não serão mais enviados:</p>${details(input)}`,
      button: { label: "Abrir agenda", url: input.url },
    }),
    text: `${greeting(input.firstName)}\n\nEste compromisso foi cancelado:\n\n${textDetails(input)}\n\nAlilu`,
  };
}

export function adminTestEmail(): RenderedEmail {
  return {
    subject: "Teste de envio — Alilu",
    html: renderLayout({
      preheader: "O envio de e-mails do Alilu está funcionando.",
      heading: "Tudo certo!",
      bodyHtml: "<p style=\"margin:0\">Este é um e-mail de teste do painel administrativo. Se você recebeu, o envio pela Resend está funcionando.</p>",
      button: { label: "Abrir o Alilu", url: EMAIL_BRAND.siteUrl },
    }),
    text: "Tudo certo! Este é um e-mail de teste do painel administrativo do Alilu.",
  };
}
