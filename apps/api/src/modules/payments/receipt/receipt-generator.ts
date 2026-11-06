import PDFDocument from 'pdfkit';

export interface ReceiptData {
  receiptNumber: string;
  memberName: string;
  planName: string;
  durationDays?: number;
  amountInPaise: number;
  paymentDate: Date;
  providerPaymentId?: string | null;
  gstin?: string | null;
}

/**
 * Format integer paise into Indian Rupee format with ₹ symbol.
 * Example: 249900 paise -> "₹2,499.00"
 */
export function formatRupees(amountInPaise: number): string {
  const rupees = amountInPaise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Generates an in-memory PDF receipt buffer using PDFKit.
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Receipt - ${data.receiptNumber}`,
          Author: 'Nadar Kalyanam',
          Subject: 'Membership Payment Receipt',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const brandMaroon = '#680A0E';
      const textPrimary = '#111827';
      const textSecondary = '#4B5563';
      const textMuted = '#6B7280';
      const borderLine = '#E5E7EB';

      // 1. Top Header Branding
      doc
        .fillColor(brandMaroon)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('NADAR KALYANAM', 50, 50);

      doc
        .fillColor(textMuted)
        .fontSize(9)
        .font('Helvetica')
        .text('Tamil Nadar Community Matrimony', 50, 76)
        .text('www.nadarkalyanam.com', 50, 89);

      // Receipt Title & Badge on Right
      doc
        .fillColor(brandMaroon)
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('PAYMENT RECEIPT', 300, 50, { align: 'right' });

      doc
        .fillColor(textSecondary)
        .fontSize(9)
        .font('Helvetica')
        .text(`Receipt No: ${data.receiptNumber}`, 300, 72, { align: 'right' })
        .text(`Date: ${formatDate(data.paymentDate)}`, 300, 85, { align: 'right' })
        .text('Status: PAID', 300, 98, { align: 'right' });

      // Horizontal Divider
      doc
        .strokeColor(borderLine)
        .lineWidth(1)
        .moveTo(50, 120)
        .lineTo(545, 120)
        .stroke();

      // 2. Bill To & Payment Info
      const infoTop = 135;

      // Bill To Column
      doc
        .fillColor(textMuted)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('BILLED TO', 50, infoTop);

      doc
        .fillColor(textPrimary)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(data.memberName, 50, infoTop + 15);

      doc
        .fillColor(textSecondary)
        .fontSize(9)
        .font('Helvetica')
        .text('Registered Member', 50, infoTop + 32);

      // Payment Details Column
      doc
        .fillColor(textMuted)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('PAYMENT METHOD', 330, infoTop);

      doc
        .fillColor(textPrimary)
        .fontSize(10)
        .font('Helvetica')
        .text('Online Payment Gateway', 330, infoTop + 15);

      if (data.providerPaymentId) {
        doc
          .fillColor(textSecondary)
          .fontSize(9)
          .font('Helvetica')
          .text(`Transaction ID: ${data.providerPaymentId}`, 330, infoTop + 30);
      }

      // Horizontal Divider
      doc
        .strokeColor(borderLine)
        .lineWidth(1)
        .moveTo(50, 200)
        .lineTo(545, 200)
        .stroke();

      // 3. Items Table Header
      const tableTop = 215;
      doc
        .rect(50, tableTop, 495, 24)
        .fill('#F9FAFB');

      doc
        .fillColor(textMuted)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('DESCRIPTION', 60, tableTop + 7)
        .text('DURATION', 340, tableTop + 7)
        .text('AMOUNT', 450, tableTop + 7, { width: 85, align: 'right' });

      // Item Row
      const rowTop = tableTop + 32;
      const durationText = data.durationDays ? `${data.durationDays} Days` : 'Standard';
      const formattedAmount = formatRupees(data.amountInPaise);

      doc
        .fillColor(textPrimary)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`${data.planName} Membership`, 60, rowTop);

      doc
        .fillColor(textSecondary)
        .fontSize(9)
        .font('Helvetica')
        .text('Access to contact unlocks and enhanced matchmaking', 60, rowTop + 15)
        .text(durationText, 340, rowTop)
        .text(formattedAmount, 450, rowTop, { width: 85, align: 'right' });

      // Table Bottom Border
      doc
        .strokeColor(borderLine)
        .lineWidth(1)
        .moveTo(50, rowTop + 38)
        .lineTo(545, rowTop + 38)
        .stroke();

      // 4. Totals and GST
      const totalsY = rowTop + 50;

      // GST Line if configured in env
      if (data.gstin && data.gstin.trim().length > 0) {
        doc
          .fillColor(textSecondary)
          .fontSize(9)
          .font('Helvetica')
          .text(`GSTIN: ${data.gstin.trim()} (18% GST inclusive)`, 50, totalsY);
      }

      // Total Paid Row
      doc
        .fillColor(textMuted)
        .fontSize(10)
        .font('Helvetica')
        .text('Total Amount Paid:', 320, totalsY, { width: 120, align: 'right' });

      doc
        .fillColor(brandMaroon)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(formattedAmount, 450, totalsY - 2, { width: 85, align: 'right' });

      // 5. Footer / Notes
      const footerY = 400;
      doc
        .strokeColor(borderLine)
        .lineWidth(0.5)
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .stroke();

      doc
        .fillColor(textMuted)
        .fontSize(8)
        .font('Helvetica')
        .text(
          'This is a system-generated electronic receipt issued by Nadar Kalyanam and requires no physical signature.',
          50,
          footerY + 15,
          { align: 'center', width: 495 },
        )
        .text(
          'For any queries regarding this receipt, please write to support@nadarkalyanam.com',
          50,
          footerY + 28,
          { align: 'center', width: 495 },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
