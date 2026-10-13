import { Document, Page, View } from '@react-pdf/renderer';
import type { InvoiceDocument, InvoiceTheme } from '@solokit/tool-invoice';
import { LAYOUTS } from './layouts';
import {
  Header,
  LinesTable,
  NotesBlock,
  PageFooter,
  PartiesBlock,
  PaymentBlock,
  SignatoryBlock,
  SummaryBlock,
  Watermark,
  paletteFor,
} from './sections';

export interface InvoicePdfProps {
  doc: InvoiceDocument;
  theme: InvoiceTheme;
  /** PNG data URL of the UPI QR code. */
  qrDataUrl?: string;
}

export function InvoicePdf({ doc, theme, qrDataUrl }: InvoicePdfProps) {
  const spec = LAYOUTS[theme.layout];
  const palette = paletteFor(theme);
  const common = { doc, spec, palette };
  return (
    <Document title={`${doc.title} ${doc.number}`} author={doc.seller.name} subject={`${doc.title} for ${doc.client.name}`} creator="SoloKit">
      <Page
        size="A4"
        style={{
          fontFamily: theme.fontId,
          fontSize: 9,
          color: palette.text,
          backgroundColor: palette.bg,
          padding: 36,
          paddingBottom: 48,
        }}
      >
        <Watermark doc={doc} palette={palette} />
        {spec.header === 'sidebar' ? (
          <View fixed style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 10, backgroundColor: palette.accent }} />
        ) : null}
        <Header {...common} />
        <PartiesBlock {...common} />
        <LinesTable {...common} />
        <SummaryBlock {...common} />
        <PaymentBlock doc={doc} palette={palette} qrDataUrl={qrDataUrl} />
        <NotesBlock doc={doc} palette={palette} />
        <SignatoryBlock doc={doc} palette={palette} />
        <PageFooter doc={doc} palette={palette} />
      </Page>
    </Document>
  );
}
