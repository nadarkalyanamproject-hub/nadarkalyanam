// A minimal, dependency-free PDF writer for the admin summary report: one A4
// page of text (the PDF standard Helvetica fonts) and hairline rules. Content
// is written uncompressed, so figures stay readable by any PDF text tool.
// Only printable ASCII is drawn; anything else becomes '?' rather than
// producing a broken string.

export const A4 = { width: 595, height: 842 } as const;

export type PdfOp =
  | { kind: 'text'; x: number; y: number; size: number; text: string; bold?: boolean; gray?: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number };

function pdfString(text: string): string {
  const ascii = text.replace(/[^\x20-\x7e]/g, '?');
  return `(${ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

function contentStream(ops: PdfOp[]): string {
  return ops
    .map((op) => {
      if (op.kind === 'line') {
        return `0.8 0.8 0.8 RG 0.5 w ${num(op.x1)} ${num(op.y1)} m ${num(op.x2)} ${num(op.y2)} l S`;
      }
      const color = op.gray ? '0.35 0.35 0.35 rg' : '0 0 0 rg';
      return `BT ${color} /${op.bold ? 'F2' : 'F1'} ${num(op.size)} Tf ${num(op.x)} ${num(op.y)} Td ${pdfString(op.text)} Tj ET`;
    })
    .join('\n');
}

// PDF date string, e.g. D:20261003132000Z.
function pdfDate(date: Date): string {
  return `D:${date.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`;
}

export function buildPdf(ops: PdfOp[], meta: { title: string; createdAt: Date }): Buffer {
  const content = contentStream(ops);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    `<< /Title ${pdfString(meta.title)} /Producer (Nadar Kalyanam Admin) /CreationDate (${pdfDate(meta.createdAt)}) >>`,
  ];

  let body = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

// The text drawn on the page, in drawing order — used by tests to read the
// figures back out of a generated PDF.
export function extractPdfText(pdf: Buffer): string[] {
  const raw = pdf.toString('latin1');
  return [...raw.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)].map((m) =>
    m[0].slice(1, -4).replace(/\\([\\()])/g, '$1'),
  );
}
