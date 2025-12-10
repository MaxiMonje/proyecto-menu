import axios from "axios";

const MAIL_ENDPOINT = "https://mail.flexitaim.com/api/mail/send";
const FROM_NAME = "Flexitaim Notifier";
const FROM_EMAIL = "info@flexitaim.com";

class EmailService {
  async sendPasswordInviteEmail(to: string, name: string, link: string): Promise<void> {
    const safeName = name?.trim() || "allí";

    await axios.post(
      MAIL_ENDPOINT,
      {
        to,
        subject: "Configura tu contraseña",
        html: `<h1>Hola ${safeName}!</h1><p>Un administrador creó una cuenta para vos. Hacé clic en el siguiente enlace para configurar tu contraseña:</p><p><a href="${link}">${link}</a></p>`,
        fromName: FROM_NAME,
        fromEmail: FROM_EMAIL,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10_000,
      }
    );
  }
}

export const emailService = new EmailService();
