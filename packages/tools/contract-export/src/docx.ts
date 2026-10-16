import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  type ISectionOptions,
} from 'docx';
import { TEMPLATE_NOTICE, buildReviewPack, cleanDeep, resolveContractDocument, type Contract, type ContractDocument, type ReviewSummary } from '@solokit/tool-contract';
import type { InvoiceTheme } from '@solokit/tool-invoice';

type Child = ISectionOptions['children'][number];

const NUMBERING = 'clauses';
const FONT = 'Calibri';
const TEMPLATE_FOOTER = 'Prepared from a SoloKit template. Not legal advice.';

export interface DocxOptions {
  /** Uses the theme's accent colour for headings. Default: a dark blue. */
  theme?: Pick<InvoiceTheme, 'accent' | 'text'>;
  /** Print "Prepared from a SoloKit template. Not legal advice." in the footer, and the longer template notice before the signatures. Default true. */
  showTemplateNotice?: boolean;
}

const hex = (colour: string | undefined, fallback: string): string => (colour && /^#[0-9a-fA-F]{6}$/.test(colour) ? colour.slice(1) : fallback);

function styles(accent: string, text: string) {
  const heading = (size: number, before: number, after: number) => ({
    run: { font: FONT, size, bold: true, color: accent },
    paragraph: { spacing: { before, after }, keepNext: true },
  });
  return {
    default: {
      document: { run: { font: FONT, size: 22, color: text }, paragraph: { spacing: { after: 100, line: 276 } } },
      heading1: heading(36, 0, 160),
      heading2: heading(24, 280, 100),
      heading3: heading(22, 160, 60),
    },
  };
}

function numbering() {
  const hanging = 567;
  return {
    config: [
      {
        reference: NUMBERING,
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: hanging, hanging } } } },
          { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: hanging, hanging } } } },
          { level: 2, format: LevelFormat.LOWER_LETTER, text: '(%3)', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: hanging * 2, hanging } } } },
        ],
      },
    ],
  };
}

const para = (text: string, extra: ConstructorParameters<typeof Paragraph>[0] = {}) => new Paragraph({ children: [new TextRun(text)], ...(extra as object) });
const labelled = (label: string, text: string) => new Paragraph({ children: [new TextRun({ text: `${label} `, bold: true }), new TextRun(text)] });

function agreementChildren(doc: ContractDocument, notice: string | undefined): Child[] {
  const children: Child[] = [
    new Paragraph({ text: doc.heading, heading: HeadingLevel.HEADING_1 }),
    para(doc.introduction),
    ...doc.parties.map((party) => new Paragraph({ children: [new TextRun(`${party.label}\t${party.text}`)], tabStops: [{ type: TabStopType.LEFT, position: 567 }], indent: { left: 567, hanging: 567 } })),
    para(doc.closing),
  ];

  for (const clause of doc.clauses) {
    children.push(new Paragraph({ text: clause.title, heading: HeadingLevel.HEADING_2, numbering: { reference: NUMBERING, level: 0 } }));
    for (const paragraph of clause.paragraphs) {
      children.push(new Paragraph({ children: [new TextRun(paragraph.text)], numbering: { reference: NUMBERING, level: 1 } }));
      for (const item of paragraph.items) children.push(new Paragraph({ children: [new TextRun(item.text)], numbering: { reference: NUMBERING, level: 2 } }));
    }
  }

  for (const schedule of doc.schedules) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ text: schedule.title, heading: HeadingLevel.HEADING_1 }));
    for (const section of schedule.sections) {
      children.push(new Paragraph({ children: [new TextRun({ text: section.heading, bold: true })], keepNext: true }));
      for (const line of section.lines) children.push(new Paragraph({ children: [new TextRun(line)], bullet: { level: 0 } }));
    }
  }

  if (notice) children.push(new Paragraph({ children: [new TextRun({ text: notice, italics: true, size: 18, color: '666666' })], spacing: { before: 360 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: doc.signatureIntro, bold: true })], spacing: { before: 240 }, keepNext: true }));
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: none, bottom: none, left: none, right: none };
  const line = (label: string) => new Paragraph({ children: [new TextRun(`${label}: ______________________________`)], spacing: { before: 240 } });
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
      rows: [
        new TableRow({
          cantSplit: true,
          children: doc.signatures.map(
            (signature) =>
              new TableCell({
                borders: noBorders,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: signature.heading, size: 20 })] }),
                  line('Signature'),
                  new Paragraph({ children: [new TextRun(`Name: ${signature.signatoryName}`)] }),
                  new Paragraph({ children: [new TextRun(`Title: ${signature.signatoryTitle}`)] }),
                  line('Date'),
                  signature.place ? new Paragraph({ children: [new TextRun(`Place: ${signature.place}`)], spacing: { before: 240 } }) : line('Place'),
                ],
              }),
          ),
        }),
      ],
    }),
  );
  return children;
}

function summaryChildren(summary: ReviewSummary): Child[] {
  const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
  const bullet = (text: string) => new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });
  const children: Child[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ text: 'Review summary', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: summary.notice, bold: true })], border: { left: { style: BorderStyle.SINGLE, size: 24, color: '999999', space: 6 } }, spacing: { after: 160 } }),
    para(`${summary.heading}: ${summary.contractTitle}. Template wording version ${summary.libraryVersion}.`),
    ...(summary.frozenNote ? [labelled('Note:', summary.frozenNote)] : []),
    ...summary.warnings.map((warning) => labelled('Note:', warning)),
    heading('The agreement at a glance'),
    ...summary.parties.map((party) => labelled(`${party.role}:`, party.name)),
    labelled('Effective date:', summary.effectiveDate),
    labelled('Courts or arbitration seat chosen:', summary.jurisdiction),
    heading('Key dates'),
    ...summary.keyDates.map((date) => labelled(`${date.label}:`, `${date.value}${date.note ? ` (${date.note})` : ''}`)),
    heading('Choices made'),
    ...summary.choices.map((choice) =>
      labelled(`${choice.label}:`, `${choice.value}${choice.clauseNumber ? ` (clause ${choice.clauseNumber})` : ''}${choice.isDefault ? ' [left at the template default]' : ''}`),
    ),
    heading('Left at the template default'),
    para('These settings still have the value the template starts with. They may not have been considered, so look at them first.'),
    ...(summary.defaultsUnchanged.length === 0 ? [para('Every setting was changed from its default.')] : summary.defaultsUnchanged.map((choice) => labelled(`${choice.label}:`, choice.value))),
    heading('Optional clauses'),
    ...summary.optionalClauses.map((optional) =>
      labelled(`${optional.title}:`, optional.included ? `Included${optional.clauseNumber ? ` (clause ${optional.clauseNumber})` : ''}` : 'Left out'),
    ),
    heading('Assumptions this document makes'),
    ...summary.assumptions.map(bullet),
    heading('Clause by clause, in plain English'),
  ];
  for (const clause of summary.clauses) {
    children.push(new Paragraph({ text: `${clause.number}. ${clause.title}`, heading: HeadingLevel.HEADING_3 }));
    children.push(labelled('What this means:', clause.explanation), labelled('Why it is here:', clause.rationale), para(clause.risk));
  }
  children.push(heading('Questions for your lawyer'));
  summary.questions.forEach((question, index) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${question.topic}`, bold: true }), new TextRun(`${question.clauseNumber ? ` (clause ${question.clauseNumber})` : ''}. ${question.text}`)] }));
  });
  children.push(heading('Stamp duty'), para(summary.stampDuty.text), heading('Notes'));
  for (const note of summary.notes) children.push(labelled(`${note.title}.`, note.body));
  return children;
}

function build(rawDoc: ContractDocument, rawSummary: ReviewSummary | undefined, options: DocxOptions): Document {
  // A control character such as a vertical tab is not allowed in a Word file's XML, so none may get through.
  const doc = cleanDeep(rawDoc);
  const summary = rawSummary ? cleanDeep(rawSummary) : undefined;
  const accent = hex(options.theme?.accent, '1F3A5F');
  const text = hex(options.theme?.text, '1A1A1A');
  const notice = options.showTemplateNotice === false ? '' : ` ${TEMPLATE_FOOTER}`;
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
        children: [
          new TextRun({ text: `${doc.heading}.${notice}`, size: 16, color: '666666' }),
          new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: '666666' }),
        ],
      }),
    ],
  });
  return new Document({
    creator: 'SoloKit',
    title: summary ? `${doc.heading} - Review pack` : doc.heading,
    description: 'Prepared from a SoloKit template. Not legal advice.',
    styles: styles(accent, text),
    numbering: numbering(),
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: { default: footer },
        children: [...agreementChildren(doc, options.showTemplateNotice === false ? undefined : doc.notice || TEMPLATE_NOTICE), ...(summary ? summaryChildren(summary) : [])],
      },
    ],
  });
}

/**
 * The agreement as an editable Word document for a lawyer to mark up. Clause headings and paragraphs use Word's own
 * multilevel numbering (1., 1.1, (a)); cross-references inside the text are typed numbers, so check them after any edit
 * that adds or removes a clause. Built in the browser; no network, no Node-only APIs.
 */
export async function renderContractDocx(contract: Contract, options: DocxOptions = {}): Promise<Blob> {
  return Packer.toBlob(build(resolveContractDocument(contract), undefined, options));
}

/** The Review pack as a Word document: the agreement followed by the review summary. */
export async function renderReviewPackDocx(contract: Contract, options: DocxOptions = {}): Promise<Blob> {
  const { document, summary } = buildReviewPack(contract);
  return Packer.toBlob(build(document, summary, options));
}
