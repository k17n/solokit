import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { ContractDocument, ReviewSummary } from '@solokit/tool-contract';
import { FONT_OPTIONS, type InvoiceTheme } from '@solokit/tool-invoice';
import { paletteFor, type Palette } from '@solokit/tool-invoice-pdf';

const MARGIN = 54;
const BODY = 10;
const SMALL = 8.5;
// Not set on the page itself: a page-level line height makes react-pdf drop the fixed footer.
const LINE_HEIGHT = 1.45;
const NUMBER_WIDTH = 34;
const ITEM_INDENT = 26;

export interface ContractPdfProps {
  document: ContractDocument;
  /** When given, the review summary is printed after the agreement (the Review pack). */
  summary?: ReviewSummary;
  theme: InvoiceTheme;
  /** Print "prepared from a SoloKit template, not legal advice" in the page footer. Default true. */
  showTemplateNotice?: boolean;
}

function Footer({ title, palette, notice }: { title: string; palette: Palette; notice: string | undefined }) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 24, left: MARGIN, right: MARGIN }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: palette.line, borderTopStyle: 'solid', paddingTop: 5 }}>
        <Text style={{ fontSize: SMALL - 1, color: palette.muted, maxWidth: '78%' }}>{notice ? `${title}. ${notice}` : title}</Text>
        <Text style={{ fontSize: SMALL - 1, color: palette.muted }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </View>
  );
}

const FOOTER_NOTICE = 'Prepared from a SoloKit template. Not legal advice.';

function pageStyle(theme: InvoiceTheme, palette: Palette) {
  const fontFamily = FONT_OPTIONS.some((font) => font.id === theme.fontId) ? theme.fontId : 'inter';
  return { fontFamily, fontSize: BODY, color: palette.text, backgroundColor: palette.bg, paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 66 };
}

function ClauseHeading({ number, title, palette }: { number: string; title: string; palette: Palette }) {
  return (
    <View minPresenceAhead={64} style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
      <Text style={{ width: NUMBER_WIDTH, fontWeight: 700, color: palette.accentSmall }}>{number}.</Text>
      <Text style={{ flex: 1, fontWeight: 700, color: palette.accentSmall }}>{title}</Text>
    </View>
  );
}

function AgreementBody({ doc, palette }: { doc: ContractDocument; palette: Palette }) {
  return (
    <>
      <Text style={{ fontSize: 18, fontWeight: 700, color: palette.accentSmall, marginBottom: 6 }}>{doc.heading}</Text>
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.accent, borderBottomStyle: 'solid', marginBottom: 12 }} />
      <Text style={{ marginBottom: 6 }}>{doc.introduction}</Text>
      {doc.parties.map((party) => (
        <View key={party.label} style={{ flexDirection: 'row', marginBottom: 5 }}>
          <Text style={{ width: NUMBER_WIDTH }}>{party.label}</Text>
          <Text style={{ flex: 1 }}>{party.text}</Text>
        </View>
      ))}
      <Text style={{ marginTop: 4 }}>{doc.closing}</Text>

      {doc.clauses.map((clause) => (
        <View key={clause.id}>
          <ClauseHeading number={clause.number} title={clause.title} palette={palette} />
          {clause.paragraphs.map((paragraph) => (
            <View key={paragraph.number} style={{ marginBottom: 3 }}>
              <View wrap={false} style={{ flexDirection: 'row' }}>
                <Text style={{ width: NUMBER_WIDTH, color: palette.muted }}>{paragraph.number}</Text>
                <Text style={{ flex: 1 }}>{paragraph.text}</Text>
              </View>
              {paragraph.items.map((item) => (
                <View key={item.label} wrap={false} style={{ flexDirection: 'row', marginLeft: NUMBER_WIDTH }}>
                  <Text style={{ width: ITEM_INDENT, color: palette.muted }}>{item.label}</Text>
                  <Text style={{ flex: 1 }}>{item.text}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}

      {doc.schedules.map((schedule) => (
        <View key={schedule.title} break>
          <Text style={{ fontSize: 14, fontWeight: 700, color: palette.accentSmall, marginBottom: 8 }}>{schedule.title}</Text>
          {schedule.sections.map((section) => (
            <View key={section.heading} style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: 700, marginBottom: 3 }}>{section.heading}</Text>
              {section.lines.map((line, index) => (
                <View key={index} style={{ flexDirection: 'row', marginBottom: 2 }}>
                  <Text style={{ width: 14, color: palette.muted }}>-</Text>
                  <Text style={{ flex: 1 }}>{line}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}

      <View wrap={false} style={{ marginTop: 22 }}>
        <Text style={{ fontWeight: 700, marginBottom: 10 }}>{doc.signatureIntro}</Text>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          {doc.signatures.map((signature) => (
            <View key={signature.heading} style={{ flex: 1 }}>
              <Text style={{ fontSize: SMALL, marginBottom: 26 }}>{signature.heading}</Text>
              <SignatureLine label="Signature" palette={palette} />
              <Text style={{ fontSize: SMALL, marginTop: 4 }}>Name: {signature.signatoryName}</Text>
              <Text style={{ fontSize: SMALL }}>Title: {signature.signatoryTitle}</Text>
              <View style={{ marginTop: 14 }}>
                <SignatureLine label="Date" palette={palette} />
              </View>
              <View style={{ marginTop: 14 }}>
                <SignatureLine label={signature.place ? `Place: ${signature.place}` : 'Place'} palette={palette} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

function SignatureLine({ label, palette }: { label: string; palette: Palette }) {
  return (
    <View>
      <View style={{ borderBottomWidth: 0.7, borderBottomColor: palette.text, borderBottomStyle: 'solid', height: 14 }} />
      <Text style={{ fontSize: SMALL - 1, color: palette.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Heading({ children, palette }: { children: string; palette: Palette }) {
  return (
    <Text minPresenceAhead={60} style={{ fontSize: 12, fontWeight: 700, color: palette.accentSmall, marginTop: 14, marginBottom: 5 }}>
      {children}
    </Text>
  );
}

function Row({ label, value, note, palette }: { label: string; value: string; note?: string; palette: Palette }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text style={{ width: '38%', fontWeight: 700, paddingRight: 8 }}>{label}</Text>
      <View style={{ flex: 1 }}>
        <Text>{value}</Text>
        {note ? <Text style={{ fontSize: SMALL, color: palette.muted }}>{note}</Text> : null}
      </View>
    </View>
  );
}

function SummaryBody({ summary, palette }: { summary: ReviewSummary; palette: Palette }) {
  return (
    <>
      <Text style={{ fontSize: 18, fontWeight: 700, color: palette.accentSmall, marginBottom: 6 }}>Review summary</Text>
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.accent, borderBottomStyle: 'solid', marginBottom: 10 }} />
      <View style={{ backgroundColor: palette.tint, borderLeftWidth: 3, borderLeftColor: palette.accent, borderLeftStyle: 'solid', padding: 8, marginBottom: 8 }}>
        <Text>{summary.notice}</Text>
      </View>
      <Text style={{ color: palette.muted }}>
        {summary.heading}: {summary.contractTitle}. Template wording version {summary.libraryVersion}.
      </Text>

      <Heading palette={palette}>The agreement at a glance</Heading>
      {summary.parties.map((party) => (
        <Row key={party.role} label={party.role} value={party.name} palette={palette} />
      ))}
      <Row label="Effective date" value={summary.effectiveDate} palette={palette} />
      <Row label="Courts or arbitration seat chosen" value={summary.jurisdiction} palette={palette} />

      <Heading palette={palette}>Key dates</Heading>
      {summary.keyDates.map((date) => (
        <Row key={date.label} label={date.label} value={date.value} {...(date.note ? { note: date.note } : {})} palette={palette} />
      ))}

      <Heading palette={palette}>Choices made</Heading>
      {summary.choices.map((choice, index) => (
        <Row
          key={`${choice.label}-${index}`}
          label={choice.label}
          value={choice.value}
          note={[choice.clauseNumber ? `Clause ${choice.clauseNumber}` : '', choice.isDefault ? 'Left at the template default' : ''].filter(Boolean).join(' - ')}
          palette={palette}
        />
      ))}

      <Heading palette={palette}>Left at the template default</Heading>
      <Text style={{ marginBottom: 4, color: palette.muted }}>
        These settings still have the value the template starts with. They may not have been considered, so look at them first.
      </Text>
      {summary.defaultsUnchanged.length === 0 ? (
        <Text>Every setting was changed from its default.</Text>
      ) : (
        summary.defaultsUnchanged.map((choice, index) => <Row key={`${choice.label}-${index}`} label={choice.label} value={choice.value} palette={palette} />)
      )}

      <Heading palette={palette}>Optional clauses</Heading>
      {summary.optionalClauses.map((optional) => (
        <Row
          key={optional.title}
          label={optional.title}
          value={optional.included ? `Included${optional.clauseNumber ? ` (clause ${optional.clauseNumber})` : ''}` : 'Left out'}
          {...(optional.included !== optional.onByDefault ? { note: optional.included ? 'Switched on; the template leaves it out by default.' : 'Switched off; the template includes it by default.' } : {})}
          palette={palette}
        />
      ))}

      <Heading palette={palette}>Assumptions this document makes</Heading>
      {summary.assumptions.map((assumption, index) => (
        <View key={index} wrap={false} style={{ flexDirection: 'row', marginBottom: 2 }}>
          <Text style={{ width: 14 }}>-</Text>
          <Text style={{ flex: 1 }}>{assumption}</Text>
        </View>
      ))}

      <Heading palette={palette}>Clause by clause, in plain English</Heading>
      {summary.clauses.map((clause) => (
        <View key={clause.number} style={{ marginBottom: 8 }}>
          <Text minPresenceAhead={70} style={{ fontWeight: 700 }}>
            {clause.number}. {clause.title}
          </Text>
          <Text>
            <Text style={{ fontWeight: 700 }}>What this means: </Text>
            {clause.explanation}
          </Text>
          <Text>
            <Text style={{ fontWeight: 700 }}>Why it is here: </Text>
            {clause.rationale}
          </Text>
          <Text style={{ color: palette.muted }}>{clause.risk}</Text>
        </View>
      ))}

      <Heading palette={palette}>Questions for your lawyer</Heading>
      {summary.questions.map((question, index) => (
        <View key={index} wrap={false} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ width: 22 }}>{index + 1}.</Text>
          <Text style={{ flex: 1 }}>
            <Text style={{ fontWeight: 700 }}>{question.topic}</Text>
            {question.clauseNumber ? ` (clause ${question.clauseNumber})` : ''}
            {`. ${question.text}`}
          </Text>
        </View>
      ))}

      <Heading palette={palette}>Stamp duty</Heading>
      <Text>{summary.stampDuty.text}</Text>

      <Heading palette={palette}>Notes</Heading>
      {summary.notes.map((note) => (
        <View key={note.title} wrap={false} style={{ marginBottom: 5 }}>
          <Text style={{ fontWeight: 700 }}>{note.title}</Text>
          <Text>{note.body}</Text>
        </View>
      ))}
    </>
  );
}

/** The agreement, and with a summary the Review pack. Fonts must be registered first (see renderContractPdf). */
export function ContractPdf({ document: doc, summary, theme, showTemplateNotice = true }: ContractPdfProps) {
  const palette = paletteFor(theme);
  const style = pageStyle(theme, palette);
  const notice = showTemplateNotice ? FOOTER_NOTICE : undefined;
  return (
    <Document
      title={summary ? `${doc.heading} - Review pack` : doc.heading}
      author="SoloKit"
      subject={doc.heading}
      creator="SoloKit"
    >
      <Page size="A4" style={style}>
        <View style={{ lineHeight: LINE_HEIGHT }}>
          <AgreementBody doc={doc} palette={palette} />
        </View>
        <Footer title={doc.heading} palette={palette} notice={notice} />
      </Page>
      {summary ? (
        <Page size="A4" style={style}>
          <View style={{ lineHeight: LINE_HEIGHT }}>
            <SummaryBody summary={summary} palette={palette} />
          </View>
          <Footer title={`Review summary: ${doc.heading}`} palette={palette} notice="Template, not legal advice." />
        </Page>
      ) : null}
    </Document>
  );
}
