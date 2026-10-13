import { Image, Text, View } from '@react-pdf/renderer';
import { contrastRatio, type InvoiceDocument, type InvoiceTheme } from '@solokit/tool-invoice';
import { mixHex, readableOn } from './colors';
import type { LayoutSpec } from './layouts';

export interface Palette {
  text: string;
  muted: string;
  accent: string;
  /** The accent for small text: the accent itself when legible on the page and the table header tint, else the text colour. */
  accentSmall: string;
  onAccent: string;
  tint: string;
  line: string;
  bg: string;
}

const MIN_TEXT_CONTRAST = 4.5;

/** Secondary text: the text colour mixed towards the background, as little as needed to stay legible on the page and zebra rows. */
function mutedFor(theme: InvoiceTheme): string {
  const zebra = mixHex(theme.accent, theme.background, 0.1);
  let weight = 0.62;
  let muted = mixHex(theme.text, theme.background, weight);
  while (
    weight < 1 &&
    (contrastRatio(muted, theme.background) < MIN_TEXT_CONTRAST || contrastRatio(muted, zebra) < MIN_TEXT_CONTRAST)
  ) {
    weight = Math.min(1, weight + 0.04);
    muted = mixHex(theme.text, theme.background, weight);
  }
  return muted;
}

export function paletteFor(theme: InvoiceTheme): Palette {
  const legibleAccent =
    contrastRatio(theme.accent, theme.background) >= MIN_TEXT_CONTRAST &&
    contrastRatio(theme.accent, mixHex(theme.accent, theme.background, 0.14)) >= MIN_TEXT_CONTRAST;
  return {
    text: theme.text,
    bg: theme.background,
    accent: theme.accent,
    accentSmall: legibleAccent ? theme.accent : theme.text,
    onAccent: readableOn(theme.accent),
    muted: mutedFor(theme),
    tint: mixHex(theme.accent, theme.background, 0.1),
    line: mixHex(theme.text, theme.background, 0.2),
  };
}

export interface SectionProps {
  doc: InvoiceDocument;
  spec: LayoutSpec;
  palette: Palette;
}

const SMALL = 8;
const LABEL = 7;
const PAGE_MARGIN = 36;
/** Rows with longer descriptions may break across pages; react-pdf clips an unbreakable row taller than a page. */
const MAX_UNBROKEN_DESCRIPTION = 600;

function Label({ children, palette }: { children: string; palette: Palette }) {
  return <Text style={{ fontSize: LABEL, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>{children}</Text>;
}

function PartyLines({ party, palette }: { party: InvoiceDocument['seller']; palette: Palette }) {
  return (
    <>
      {party.lines.map((line, index) => (
        <Text key={index} style={{ fontSize: SMALL, color: palette.muted }}>
          {line}
        </Text>
      ))}
      {party.gstin ? <Text style={{ fontSize: SMALL }}>GSTIN: {party.gstin}</Text> : null}
      {party.pan ? <Text style={{ fontSize: SMALL }}>PAN: {party.pan}</Text> : null}
      {party.email ? <Text style={{ fontSize: SMALL }}>{party.email}</Text> : null}
      {party.phone ? <Text style={{ fontSize: SMALL }}>{party.phone}</Text> : null}
    </>
  );
}

function SellerBlock({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  return (
    <View style={{ flexGrow: 1, maxWidth: '58%' }}>
      {doc.logoDataUrl ? (
        <Image src={doc.logoDataUrl} style={{ width: 120, height: 44, objectFit: 'contain', objectPosition: 'left center', marginBottom: 6 }} />
      ) : null}
      <Text style={{ fontSize: 13, fontWeight: 700 }}>{doc.seller.name}</Text>
      <PartyLines party={doc.seller} palette={palette} />
    </View>
  );
}

function MetaRows({ doc, color, labelColor, align }: { doc: InvoiceDocument; color: string; labelColor: string; align: 'flex-start' | 'flex-end' }) {
  const rows: [string, string][] = [
    ['No.', doc.number],
    ['Date', doc.issueDate],
  ];
  if (doc.dueDate) rows.push(['Due', doc.dueDate]);
  return (
    <View style={{ alignItems: align }}>
      {rows.map(([label, value]) => (
        <Text key={label} style={{ fontSize: 9, color }}>
          <Text style={{ color: labelColor }}>{label}  </Text>
          {value}
        </Text>
      ))}
    </View>
  );
}

function Rule({ spec, palette }: Pick<SectionProps, 'spec' | 'palette'>) {
  if (spec.rules === 'none') return null;
  const line = { borderBottomWidth: 0.9, borderBottomColor: palette.accent, borderBottomStyle: 'solid' as const };
  if (spec.rules === 'double') {
    return (
      <View style={{ marginVertical: 10 }}>
        <View style={line} />
        <View style={{ ...line, marginTop: 2 }} />
      </View>
    );
  }
  return <View style={{ ...line, marginVertical: 10 }} />;
}

export function Header({ doc, spec, palette }: SectionProps) {
  const title = spec.uppercaseTitle ? doc.title.toUpperCase() : doc.title;
  const titleStyle = { fontSize: spec.titleSize, fontWeight: 700 as const, letterSpacing: spec.uppercaseTitle ? 1.5 : 0 };

  if (spec.header === 'band') {
    return (
      <View>
        <View
          style={{
            backgroundColor: palette.accent,
            marginTop: -PAGE_MARGIN,
            marginLeft: -PAGE_MARGIN,
            marginRight: -PAGE_MARGIN,
            marginBottom: 16,
            paddingVertical: 16,
            paddingHorizontal: PAGE_MARGIN,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <Text style={{ ...titleStyle, color: palette.onAccent }}>{title}</Text>
          <MetaRows doc={doc} color={palette.onAccent} labelColor={palette.onAccent} align="flex-end" />
        </View>
        <View style={{ marginBottom: 14 }}>
          <SellerBlock doc={doc} palette={palette} />
        </View>
      </View>
    );
  }

  if (spec.header === 'centered') {
    return (
      <View>
        <Text style={{ ...titleStyle, color: palette.accent, textAlign: 'center' }}>{title}</Text>
        <Rule spec={spec} palette={palette} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <SellerBlock doc={doc} palette={palette} />
          <MetaRows doc={doc} color={palette.text} labelColor={palette.muted} align="flex-end" />
        </View>
      </View>
    );
  }

  // plain and sidebar share the same arrangement; the sidebar strip is drawn by InvoicePdf.
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SellerBlock doc={doc} palette={palette} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...titleStyle, color: palette.accent, marginBottom: 6 }}>{title}</Text>
          <MetaRows doc={doc} color={palette.text} labelColor={palette.muted} align="flex-end" />
        </View>
      </View>
      <Rule spec={spec} palette={palette} />
      <View style={{ marginBottom: spec.rules === 'none' ? 14 : 4 }} />
    </View>
  );
}

export function PartiesBlock({ doc, spec, palette }: SectionProps) {
  const details: [string, string][] = [];
  if (doc.placeOfSupply) details.push(['Place of supply', doc.placeOfSupply]);
  if (doc.currency !== 'INR') details.push(['Currency', doc.currency]);
  const box = spec.partiesBox ? { borderWidth: 0.75, borderColor: palette.line, borderStyle: 'solid' as const, padding: 8 } : {};
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
      <View style={{ width: '56%', ...box }}>
        <Label palette={palette}>Bill to</Label>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>{doc.client.name}</Text>
        <PartyLines party={doc.client} palette={palette} />
      </View>
      {details.length > 0 ? (
        <View style={{ width: '38%' }}>
          <Label palette={palette}>Supply details</Label>
          {details.map(([label, value]) => (
            <Text key={label} style={{ fontSize: SMALL }}>
              <Text style={{ color: palette.muted }}>{label}  </Text>
              {value}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface Column {
  key: 'no' | 'description' | 'quantity' | 'rate' | 'discount' | 'taxRate' | 'taxAmount' | 'amount';
  label: string;
  width: number;
  align: 'left' | 'right';
}

function columnsFor(doc: InvoiceDocument): Column[] {
  const fixed: Column[] = [
    { key: 'no', label: '#', width: 5, align: 'left' },
    { key: 'quantity', label: 'Qty', width: 12, align: 'right' },
    { key: 'rate', label: 'Rate', width: 14, align: 'right' },
  ];
  if (doc.showDiscount) fixed.push({ key: 'discount', label: 'Discount', width: 12, align: 'right' });
  if (doc.showTax) {
    fixed.push({ key: 'taxRate', label: 'GST', width: 7, align: 'right' });
    fixed.push({ key: 'taxAmount', label: 'Tax', width: 13, align: 'right' });
  }
  fixed.push({ key: 'amount', label: 'Amount', width: 15, align: 'right' });
  const used = fixed.reduce((total, column) => total + column.width, 0);
  const description: Column = { key: 'description', label: 'Description', width: 100 - used, align: 'left' };
  return [fixed[0] as Column, description, ...fixed.slice(1)];
}

export function LinesTable({ doc, spec, palette }: SectionProps) {
  const columns = columnsFor(doc);
  const header =
    spec.tableHeader === 'fill'
      ? { backgroundColor: palette.accent, color: palette.onAccent }
      : spec.tableHeader === 'tint'
        ? { backgroundColor: mixHex(palette.accent, palette.bg, 0.14), color: palette.accentSmall }
        : { color: palette.accentSmall, borderBottomWidth: 1.2, borderBottomColor: palette.accent, borderBottomStyle: 'solid' as const };
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 5, ...header }}>
        {columns.map((column) => (
          <Text key={column.key} style={{ width: `${column.width}%`, fontSize: SMALL, fontWeight: 700, textAlign: column.align }}>
            {column.label}
          </Text>
        ))}
      </View>
      {doc.lines.map((line, index) => (
        <View
          key={line.number}
          wrap={line.description.length > MAX_UNBROKEN_DESCRIPTION}
          style={{
            flexDirection: 'row',
            paddingVertical: 5,
            paddingHorizontal: 5,
            borderBottomWidth: 0.5,
            borderBottomColor: palette.line,
            borderBottomStyle: 'solid',
            ...(spec.zebra && index % 2 === 1 ? { backgroundColor: palette.tint } : {}),
          }}
        >
          {columns.map((column) =>
            column.key === 'description' ? (
              <View key={column.key} style={{ width: `${column.width}%`, paddingRight: 6 }}>
                <Text style={{ fontSize: 9 }}>{line.description}</Text>
                {doc.showCode && line.code ? <Text style={{ fontSize: LABEL, color: palette.muted }}>HSN/SAC {line.code}</Text> : null}
              </View>
            ) : (
              <Text key={column.key} style={{ width: `${column.width}%`, fontSize: 9, textAlign: column.align }}>
                {column.key === 'no' ? String(line.number) : line[column.key]}
              </Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

export function SummaryBlock({ doc, spec, palette }: SectionProps) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      <View style={{ width: '42%' }}>
        <Label palette={palette}>Amount in words</Label>
        <Text style={{ fontSize: 9 }}>{doc.amountInWords}</Text>
      </View>
      <View style={{ width: '50%' }}>
        {doc.totals.map((row) => {
          const isTotal = row.emphasis === 'total';
          const isNet = row.emphasis === 'net';
          const boxed = isTotal && spec.totalsBox;
          return (
            <View
              key={`${row.label}-${row.amount}`}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: isTotal || isNet ? 5 : 3,
                paddingHorizontal: boxed ? 6 : 0,
                ...(boxed ? { backgroundColor: mixHex(palette.accent, palette.bg, 0.12) } : {}),
                ...(isTotal && !boxed ? { borderTopWidth: 1, borderTopColor: palette.accent, borderTopStyle: 'solid' as const } : {}),
              }}
            >
              <Text style={{ fontSize: isTotal ? 11 : 9, fontWeight: isTotal || isNet ? 700 : 400, color: row.emphasis === 'muted' ? palette.muted : isNet ? palette.accentSmall : palette.text }}>
                {row.label}
              </Text>
              <Text style={{ fontSize: isTotal ? 11 : 9, fontWeight: isTotal || isNet ? 700 : 400, color: row.emphasis === 'muted' ? palette.muted : isNet ? palette.accentSmall : palette.text }}>
                {row.amount}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function PaymentBlock({ doc, palette, qrDataUrl }: Pick<SectionProps, 'doc' | 'palette'> & { qrDataUrl?: string | undefined }) {
  const { bank, upi } = doc.payment;
  if (!bank && !upi) return null;
  return (
    <View wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      {bank ? (
        <View style={{ width: '56%' }}>
          <Label palette={palette}>Bank details</Label>
          {bank.map((row) => (
            <Text key={row.label} style={{ fontSize: SMALL }}>
              <Text style={{ color: palette.muted }}>{row.label}  </Text>
              {row.value}
            </Text>
          ))}
        </View>
      ) : null}
      {upi ? (
        <View style={{ alignItems: 'center', width: 96 }}>
          {qrDataUrl ? <Image src={qrDataUrl} style={{ width: 72, height: 72 }} /> : null}
          <Text style={{ fontSize: LABEL, color: palette.muted, marginTop: 3, textAlign: 'center' }}>Scan to pay (UPI)</Text>
          <Text style={{ fontSize: LABEL, textAlign: 'center' }}>{upi.id}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function NotesBlock({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  if (doc.declarations.length === 0 && !doc.notes && !doc.terms) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      {doc.declarations.map((line) => (
        <Text key={line} style={{ fontSize: SMALL, marginBottom: 2 }}>
          {line}
        </Text>
      ))}
      {doc.notes ? (
        <View style={{ marginTop: 6 }}>
          <Label palette={palette}>Notes</Label>
          <Text style={{ fontSize: SMALL }}>{doc.notes}</Text>
        </View>
      ) : null}
      {doc.terms ? (
        <View style={{ marginTop: 6 }}>
          <Label palette={palette}>Terms</Label>
          <Text style={{ fontSize: SMALL }}>{doc.terms}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SignatoryBlock({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  return (
    <View wrap={false} style={{ alignItems: 'flex-end', marginTop: 6 }}>
      <Text style={{ fontSize: SMALL }}>For {doc.signatory.forName}</Text>
      <View style={{ height: 28 }} />
      <View style={{ width: 150, borderTopWidth: 0.75, borderTopColor: palette.text, borderTopStyle: 'solid' }} />
      <Text style={{ fontSize: LABEL, color: palette.muted, marginTop: 2 }}>{doc.signatory.label}</Text>
    </View>
  );
}

export function PageFooter({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 18, left: PAGE_MARGIN, right: PAGE_MARGIN, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: LABEL, color: palette.muted }}>
        {doc.title} {doc.number}
      </Text>
      <Text style={{ fontSize: LABEL, color: palette.muted }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export function Watermark({ doc }: Pick<SectionProps, 'doc'>) {
  if (doc.status === 'issued') return null;
  return (
    <Text
      fixed
      style={{
        position: 'absolute',
        top: 330,
        left: 70,
        fontSize: 90,
        fontWeight: 700,
        color: '#6B7280',
        opacity: 0.12,
        transform: 'rotate(-30deg)',
      }}
    >
      {doc.status.toUpperCase()}
    </Text>
  );
}
