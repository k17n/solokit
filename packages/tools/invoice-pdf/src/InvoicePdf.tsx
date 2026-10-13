import { Document, Page, View } from '@react-pdf/renderer';
import { FONT_OPTIONS, type InvoiceDocument, type InvoiceTheme } from '@solokit/tool-invoice';
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
  // A stale or imported theme may name a layout or font this build does not have.
  const spec = LAYOUTS[theme.layout] ?? LAYOUTS.classic;
  const fontFamily = FONT_OPTIONS.some((font) => font.id === theme.fontId) ? theme.fontId : 'inter';
  const palette = paletteFor(theme);
  const common = { doc, spec, palette };
  return (
    <Document title={`${doc.title} ${doc.number}`} author={doc.seller.name} subject={`${doc.title} for ${doc.client.name}`} creator="SoloKit">
      <Page
        size="A4"
        style={{
          fontFamily,
          fontSize: 9,
          color: palette.text,
          backgroundColor: palette.bg,
          padding: 36,
          paddingBottom: 48,
        }}
      >
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
        {/* Last, so opaque fills above cannot cut through it. */}
        <Watermark doc={doc} />
      </Page>
    </Document>
  );
}
