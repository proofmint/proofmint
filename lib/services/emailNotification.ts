import nodemailer from "nodemailer";
import {
  EMAIL_FROM,
  EMAIL_SERVER_HOST,
  EMAIL_SERVER_PASSWORD,
  EMAIL_SERVER_PORT,
  EMAIL_SERVER_USER,
  APPLICATION_HOST,
} from "../const";

const transporter = nodemailer.createTransport({
  host: EMAIL_SERVER_HOST,
  port: EMAIL_SERVER_PORT,
  secure: true,
  auth: {
    user: EMAIL_SERVER_USER,
    pass: EMAIL_SERVER_PASSWORD,
  },
});

/**
 * Email Notification Service
 * 
 * Handles sending certificate issuance notifications to recipients.
 * Email failures are handled gracefully and do not fail the certificate issuance.
 * 
 * Requirements: 1.8, 9.1, 9.2, 9.3, 9.4
 */

export interface CertificateEmailData {
  recipientEmail: string;
  recipientName: string;
  certificateName: string;
  assetId: string;
  imageUrl: string;
}

/**
 * Send certificate issuance notification email to recipient
 * 
 * @param data - Certificate email data including recipient info and certificate details
 * @returns Promise that resolves when email is sent (or fails gracefully)
 * 
 * Requirements:
 * - 1.8: Send email notification when certificate is minted
 * - 9.1: Prepare email notification with certificate details
 * - 9.2: Include recipient name, certificate details, and asset ID
 * - 9.3: Send email to recipient's email address
 * - 9.4: Log error but don't fail issuance if email fails
 */
export async function sendCertificateEmail(
  data: CertificateEmailData
): Promise<void> {
  const {
    recipientEmail,
    recipientName,
    certificateName,
    assetId,
    imageUrl,
  } = data;

  console.log(`[EmailNotification] Attempting to send certificate email to ${recipientEmail} for asset ${assetId}`);

  try {
    // Construct certificate view URL
    const certificateUrl = `${APPLICATION_HOST}/certificates/${assetId}`;

    // Prepare email content
    const subject = `You've received a certificate: ${certificateName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Congratulations, ${recipientName}!</h2>
        
        <p style="font-size: 16px; color: #555;">
          You have been awarded a certificate: <strong>${certificateName}</strong>
        </p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <img src="${imageUrl}" alt="${certificateName}" style="max-width: 100%; height: auto; border-radius: 4px;" />
        </div>
        
        <div style="background-color: #e8f4f8; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #333;">
            <strong>Asset ID:</strong> ${assetId}
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
            This certificate is minted as an NFT on the Algorand blockchain, providing permanent verification of your achievement.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${certificateUrl}" style="background-color: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Certificate
          </a>
        </div>
        
        <p style="font-size: 14px; color: #777; margin-top: 30px;">
          If you have any questions, please contact the certificate issuer.
        </p>
      </div>
    `;

    // Send email
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject,
      html,
    });

    console.log(`[EmailNotification] Certificate email sent successfully to ${recipientEmail} for asset ${assetId}`);
  } catch (error) {
    // Requirement 9.4: Log error but don't fail certificate issuance
    console.error(
      `[EmailNotification] Failed to send certificate email to ${recipientEmail} for asset ${assetId}:`,
      error instanceof Error ? error.message : String(error)
    );
    // Don't throw - email failure should not fail the certificate issuance
  }
}
