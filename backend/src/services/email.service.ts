import nodemailer from 'nodemailer';
import { config } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    });
  }
  return transporter;
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const mailOptions: nodemailer.SendMailOptions = {
    from: config.smtpFrom,
    to: email,
    subject: 'BornoOCR — Your Login Code',
    text: `Your BornoOCR login code is: ${code}\n\nThis code expires in ${config.otpExpiryMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #d4af37;">BornoOCR Login</h2>
        <p>Your login code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #d4af37; text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          ${code}
        </div>
        <p style="color: #666; font-size: 12px;">This code expires in ${config.otpExpiryMinutes} minutes. If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  if (config.nodeEnv === 'test') {
    return;
  }

  if (config.nodeEnv === 'development' && !config.smtpUser) {
    console.log(`\n[OTP] Login code for ${email}: ${code}\n`);
    return;
  }

  // Send real email via SMTP
  await getTransporter().sendMail(mailOptions);

  // Also log to console in dev mode for convenience
  if (config.nodeEnv === 'development') {
    console.log(`\n[OTP] Email sent to ${email}. Login code: ${code}\n`);
  }
}

export async function sendJobCompletionEmail(
  email: string,
  projectName: string,
  jobType: string,
  success: boolean,
  error?: string
): Promise<void> {
  const statusText = success ? 'completed successfully' : 'failed';
  const errorSection = error
    ? `<p style="color: #c00; font-size: 13px;">Error: ${error}</p>`
    : '';

  const mailOptions: nodemailer.SendMailOptions = {
    from: config.smtpFrom,
    to: email,
    subject: `BornoOCR — ${jobType} ${statusText}: ${projectName}`,
    text: `Your ${jobType} job for project "${projectName}" has ${statusText}.${error ? `\n\nError: ${error}` : ''}\n\nLog in to BornoOCR to view the results.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #d4af37;">BornoOCR Job Update</h2>
        <p>Your <strong>${jobType}</strong> job for project "<strong>${projectName}</strong>" has ${statusText}.</p>
        ${errorSection}
        <p style="margin-top: 20px;"><a href="${config.corsOrigin}" style="background: #d4af37; color: #000; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Open BornoOCR</a></p>
      </div>
    `,
  };

  if (config.nodeEnv === 'test') return;
  await getTransporter().sendMail(mailOptions);
}

export async function sendPaymentConfirmationEmail(
  email: string,
  planName: string,
  amount: number,
  currency: string,
  provider: string
): Promise<void> {
  const mailOptions: nodemailer.SendMailOptions = {
    from: config.smtpFrom,
    to: email,
    subject: `BornoOCR — Payment Confirmation: ${planName} plan`,
    text: `Your payment of ${amount} ${currency} via ${provider} for the ${planName} plan has been confirmed.\n\nThank you for your subscription!`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #d4af37;">Payment Confirmed</h2>
        <p>Your payment of <strong>${amount} ${currency}</strong> via <strong>${provider}</strong> for the <strong>${planName}</strong> plan has been confirmed.</p>
        <p style="color: #666; font-size: 13px; margin-top: 20px;">Thank you for your subscription!</p>
      </div>
    `,
  };

  if (config.nodeEnv === 'test') return;
  await getTransporter().sendMail(mailOptions);
}
