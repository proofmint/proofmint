import nodemailer from "nodemailer";
import {
  EMAIL_FROM,
  EMAIL_SERVER_HOST,
  EMAIL_SERVER_PASSWORD,
  EMAIL_SERVER_PORT,
  EMAIL_SERVER_USER,
  APPLICATION_HOST,
  ALGORAND_NETWORK,
} from "../const";
import prisma from "../prisma";

const transporter = nodemailer.createTransport({
  host: EMAIL_SERVER_HOST,
  port: EMAIL_SERVER_PORT,
  secure: true,
  auth: {
    user: EMAIL_SERVER_USER,
    pass: EMAIL_SERVER_PASSWORD,
  },
});

export interface CertificateEmailData {
  recipientEmail: string;
  /** Fallback name used if recipient is not found in the users table */
  recipientName: string;
  issuerName: string;
  certificateName: string;
  certificateId: string;
  assetId: string;
  imageUrl: string;
}

export async function sendCertificateEmail(
  data: CertificateEmailData
): Promise<void> {
  const {
    recipientEmail,
    recipientName,
    issuerName,
    certificateName,
    certificateId,
    assetId,
    imageUrl,
  } = data;

  console.log(`[EmailNotification] Attempting to send certificate email to ${recipientEmail} for asset ${assetId}`);

  try {
    // Look up recipient's name from the users table; fall back to passed name
    const recipientUser = await prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { fullName: true },
    });
    const displayName = recipientUser?.fullName || recipientName;

    const network = ALGORAND_NETWORK.toLowerCase();
    const assetExplorerUrl = `https://lora.algokit.io/${network}/asset/${assetId}`;
    const sharePageUrl = `${APPLICATION_HOST}/share/certificate/${certificateId}`;
    const claimPageUrl = `${APPLICATION_HOST}/receiver/certificates`;

    const subject = `You've received a certificate: ${certificateName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #9681FA;">Congratulations, ${displayName}!</h2>

        <p style="font-size: 16px; color: #555;">
          <strong>${issuerName}</strong> has awarded you a certificate:
          <strong>${certificateName}</strong>
        </p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <img src="${imageUrl}" alt="${certificateName}" style="max-width: 100%; height: auto; border-radius: 4px;" />
        </div>

        <div style="background-color: #f0edff; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0; font-size: 14px; color: #555;">
            <strong>Issued by:</strong> ${issuerName}
          </p>
          <p style="margin: 0 0 6px 0; font-size: 14px; color: #555;">
            <strong>Asset ID:</strong>
            <a href="${assetExplorerUrl}" style="color: #9681FA; text-decoration: none;">${assetId}</a>
          </p>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #888;">
            This certificate is minted as an NFT on the Algorand blockchain using ProofMint Platform.
          </p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 12px;">
                    <a href="${claimPageUrl}" style="background-color: #9681FA; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-family: Arial, sans-serif;">
                      Claim Certificate
                    </a>
                  </td>
                  <td>
                    <a href="${sharePageUrl}" style="background-color: #ffffff; color: #9681FA; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; border: 2px solid #9681FA; font-family: Arial, sans-serif;">
                      View &amp; Share
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #999; margin-top: 30px; text-align: center;">
          If you have questions, please contact ${issuerName}.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject,
      html,
    });

    console.log(`[EmailNotification] Certificate email sent successfully to ${recipientEmail} for asset ${assetId}`);
  } catch (error) {
    console.error(
      `[EmailNotification] Failed to send certificate email to ${recipientEmail}:`,
      error instanceof Error ? error.message : String(error)
    );
    // Don't throw — email failure must not fail certificate issuance
  }
}
