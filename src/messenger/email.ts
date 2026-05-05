import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../logger.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!config.smtp.host || !config.smtp.user) {
    logger.warn("SMTP not configured, skipping email");
    return;
  }

  logger.info({ to, subject }, "Sending email");
  await getTransporter().sendMail({
    from: config.smtp.from,
    to,
    subject,
    text: body,
  });
  logger.info({ to }, "Email sent");
}
