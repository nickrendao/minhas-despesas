import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface MailMessage { to: string; subject: string; text: string }
export abstract class Mailer { abstract send(m: MailMessage): Promise<void> }

/** Dev/teste: não envia nada, guarda em memória (os testes leem `sent`). */
@Injectable()
export class ConsoleMailer extends Mailer {
  readonly sent: MailMessage[] = [];
  private readonly log = new Logger('Mailer');
  async send(m: MailMessage) { this.sent.push(m); this.log.log(`(console) para ${m.to}: ${m.subject}`); }
}

/** Produção: qualquer provedor SMTP (ex.: plano gratuito de Brevo, Resend, Gmail com senha de app). */
@Injectable()
export class SmtpMailer extends Mailer {
  private readonly transport = nodemailer.createTransport(env().SMTP_URL!);
  async send(m: MailMessage) { await this.transport.sendMail({ from: env().MAIL_FROM, to: m.to, subject: m.subject, text: m.text }); }
}
