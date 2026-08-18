import { db } from '@/config/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getN8nWebhookUrl, isN8nConfigured } from '@/config/n8n';

export interface CenroWelcomeEmailParams {
  toEmail: string;
  temporaryPassword: string;
  adminName?: string;
  department?: string;
  designation?: string;
}

/**
 * Builds an executive-tier, professional HTML email for newly provisioned CENRO Admin accounts.
 */
export function buildCenroWelcomeEmailHtml(params: CenroWelcomeEmailParams): string {
  const { toEmail, temporaryPassword, adminName = 'CENRO Administrator', department = 'City Environment & Natural Resources Office' } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official CENRO Administrator Credentials</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 12px; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
    <!-- Header Banner -->
    <tr>
      <td style="background-color: #1B4D3E; padding: 32px 24px; text-align: center; color: #ffffff;">
        <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #A7F3D0; margin-bottom: 8px;">
          REPUBLIC OF THE PHILIPPINES • DANAO CITY
        </div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
          TrashTrack Danao City
        </h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #E2E8F0; font-weight: 500;">
          Department of Information and Communications Technology Oversight
        </p>
        <div style="display: inline-block; background-color: #D1FAE5; color: #065F46; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-top: 14px;">
          OFFICIAL MUNICIPAL CLEARANCE
        </div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px 28px; line-height: 1.6;">
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 12px; color: #0f172a;">
          Welcome, ${adminName}
        </h2>
        <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">
          Your official administrative clearance for the <strong>TrashTrack Danao City Municipal Waste Operations System</strong> has been provisioned under DICT Regional Oversight.
        </p>

        <!-- Official DICT Verification Clearance Banner -->
        <div style="background-color: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td width="36" valign="top" style="padding-top: 2px;">
                <div style="width: 28px; height: 28px; border-radius: 14px; background-color: #059669; color: #ffffff; text-align: center; line-height: 28px; font-weight: 800; font-size: 16px;">
                  ✓
                </div>
              </td>
              <td>
                <strong style="color: #065f46; font-size: 14px; display: block; margin-bottom: 3px;">
                  DICT Official Government Verification & Clearance
                </strong>
                <span style="color: #047857; font-size: 12.5px; line-height: 1.5; display: block;">
                  This account has been officially verified and granted municipal administrative authority by the Department of Information and Communications Technology (DICT). No separate verification link is needed.
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Credentials Box -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 16px 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="6">
                <tr>
                  <td width="40%" style="font-size: 13px; color: #64748b; font-weight: 600;">Access Portal:</td>
                  <td width="60%" style="font-size: 13px; font-weight: 700; color: #0f172a;">
                    <a href="http://localhost:8081/cenro" style="color: #1B4D3E; text-decoration: none;">/cenro</a> (CENRO Admin Portal)
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-weight: 600;">Official Login Email:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #0f172a;">${toEmail}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-weight: 600;">Temporary Password:</td>
                  <td style="font-size: 14px; font-weight: 800; font-family: 'Courier New', Courier, monospace; color: #0369a1; background-color: #e0f2fe; padding: 4px 8px; border-radius: 6px; display: inline-block;">
                    ${temporaryPassword}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-weight: 600;">Department:</td>
                  <td style="font-size: 13px; font-weight: 600; color: #334155;">${department}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Next Steps Protocol -->
        <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px 20px; border-radius: 0 10px 10px 0; margin-bottom: 24px;">
          <strong style="color: #065f46; font-size: 13px;">Security & Onboarding Protocol:</strong>
          <ol style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #047857; line-height: 1.5;">
            <li>Click the <strong>Verify & Enter CENRO Portal</strong> button below to go directly to <strong>/cenro</strong>.</li>
            <li>Sign in using your official email and temporary credentials above.</li>
            <li>For security governance, update your password under Profile Settings upon first sign-in.</li>
          </ol>
        </div>

        <!-- CTA Button -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 10px;">
          <tr>
            <td align="center">
              <a href="http://localhost:8081/cenro" style="background-color: #1B4D3E; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 4px 10px rgba(27, 77, 62, 0.25);">
                Verify & Enter CENRO Admin Portal →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p style="margin: 0 0 6px; font-weight: 700; color: #334155;">
          City Environment and Natural Resources Office (CENRO) • Danao City
        </p>
        <p style="margin: 0; color: #64748b;">
          Supervised by Department of Information and Communications Technology (DICT) Region VII
        </p>
        <p style="font-size: 11px; margin-top: 12px; color: #94a3b8;">
          This automated security dispatch contains confidential administrative credentials. Do not forward.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Dispatches the professional CENRO welcome email to the newly provisioned administrator.
 */
export async function sendCenroWelcomeEmail(params: CenroWelcomeEmailParams): Promise<boolean> {
  const htmlContent = buildCenroWelcomeEmailHtml(params);
  const subject = 'Official CENRO Administrator Credentials — TrashTrack Danao City';

  console.log(`📧 Dispatching professional welcome email to: ${params.toEmail}`);

  let dispatched = false;

  // 1. Dispatch via Free Webhook (Google Apps Script / n8n / Custom Endpoint)
  const webhookUrl =
    process.env.EXPO_PUBLIC_EMAIL_WEBHOOK_URL ||
    (isN8nConfigured() ? getN8nWebhookUrl() : '');

  if (webhookUrl && !webhookUrl.includes('localhost:5678')) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'send_admin_welcome_email',
          from: 'Trash Track <noreply@trashtrack.gov.ph>',
          to: params.toEmail,
          subject,
          html: htmlContent,
          credentials: {
            email: params.toEmail,
            password: params.temporaryPassword,
            portal: '/cenro',
          },
        }),
      });

      console.log('✅ Welcome email dispatched successfully via email webhook');
      dispatched = true;
    } catch (webhookError) {
      console.warn('Email webhook dispatch warning:', webhookError);
    }
  }

  // 2. Record to Firestore 'mail' collection (Firebase Trigger Email extension standard)
  if (db) {
    try {
      await addDoc(collection(db, 'mail'), {
        to: params.toEmail,
        from: 'Trash Track <noreply@trashtrack.gov.ph>',
        replyTo: 'support@trashtrack.gov.ph',
        message: {
          subject,
          html: htmlContent,
        },
        metadata: {
          type: 'cenro_admin_welcome',
          createdAt: serverTimestamp(),
        },
      });
      console.log('✅ Queued welcome email in Firestore mail queue');
      dispatched = true;
    } catch (firestoreMailError) {
      console.warn('Firestore mail queue write note:', firestoreMailError);
    }
  }

  return dispatched;
}
