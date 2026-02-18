import { resend } from '@/lib/resend';
import { formatCurrency } from '@/lib/utils';

interface CancellationEmailData {
  to: string;
  attendeeName: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  city: string;
  tierName: string;
  reason: string;
  refundAmount: number;
  currency: string;
}

export async function sendTicketCancellationEmail(data: CancellationEmailData) {
  const html = buildCancellationHtml(data);

  const { error } = await resend.emails.send({
    from: 'Empiria <tickets@empiriaindia.com>',
    to: data.to,
    subject: `Ticket cancelled — ${data.eventTitle}`,
    html,
  });

  if (error) {
    throw new Error(`Resend API error: ${JSON.stringify(error)}`);
  }
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildCancellationHtml(data: CancellationEmailData): string {
  const venue = [data.venueName, data.city].filter(Boolean).join(', ');
  const eventDate = formatEventDate(data.eventDate);
  const refundFormatted = formatCurrency(data.refundAmount, data.currency);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket Cancelled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: #111827; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">Empiria</h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding: 32px 32px 16px;">
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #111827;">Ticket Cancelled</h2>
              <p style="margin: 0; font-size: 15px; color: #6b7280; line-height: 1.5;">
                Hi ${data.attendeeName || 'there'}, one of your tickets has been cancelled by the event organizer.
              </p>
            </td>
          </tr>

          <!-- Event Details -->
          <tr>
            <td style="padding: 16px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 8px; font-size: 17px; font-weight: 700; color: #991b1b;">${data.eventTitle}</h3>
                    <p style="margin: 0 0 4px; font-size: 14px; color: #b91c1c;">${eventDate}</p>
                    ${venue ? `<p style="margin: 0 0 4px; font-size: 14px; color: #b91c1c;">${venue}</p>` : ''}
                    <p style="margin: 0; font-size: 14px; color: #b91c1c;">Tier: ${data.tierName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reason -->
          <tr>
            <td style="padding: 16px 32px;">
              <h3 style="margin: 0 0 8px; font-size: 15px; font-weight: 600; color: #111827;">Reason for Cancellation</h3>
              <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6; background: #f9fafb; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                ${data.reason}
              </p>
            </td>
          </tr>

          <!-- Refund Info -->
          <tr>
            <td style="padding: 16px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #166534;">Refund: ${refundFormatted}</h3>
                    <p style="margin: 0; font-size: 13px; color: #15803d; line-height: 1.5;">
                      This amount will be refunded to your original payment method. It may take 5–10 business days to appear on your statement.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Browse Events CTA -->
          <tr>
            <td style="padding: 16px 32px 24px;" align="center">
              <a href="https://shop.empiriaindia.com" style="display: inline-block; padding: 10px 24px; background: #111827; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px;">
                Browse Other Events
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
                This email was sent by Empiria. If you have questions, please contact the event organizer.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
