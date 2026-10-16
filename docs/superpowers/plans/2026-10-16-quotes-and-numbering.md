# Quotes, separate number series and Convert to invoice

**Goal:** Add a Quotation (estimate) document to the invoice tool, give proformas and quotations their own number series, and let an issued quotation or proforma be converted into a new draft tax invoice.

## How it is modelled today

- `InvoiceRecord.kind` is `'invoice' | 'proforma'` and is stored on every record. The editor has a "Document" select; `buildDeclarations` adds a proforma note; `titleFor` gives "Proforma Invoice".
- `storage.invoices.nextNumber(issueDate)` counts every stored number of the financial year, whatever the kind, so a proforma uses up a tax-invoice number.
- `saveInvoice` rejects a number already used by any other record.

## Decisions

1. **Kind.** `InvoiceKind` gains `'quote'`. New optional fields: `validUntil` (quote only), `convertedFromId` (on the new invoice), `convertedToId` (on the quote or proforma). No new status value: a converted quote stays `issued` and read-only; the UI shows a "Converted" badge from `convertedToId`. Old backups have none of these fields and stay valid.
2. **Quote content.** Title "Quotation". No tax-invoice declarations (no LUT, reverse charge, TDS, composition or unregistered wording); one note: "This is an estimate, not a tax invoice." Tax rows and the total say "(estimated)" / "Estimated total". No due date, no payment block, no UPI QR. TDS, advance and reverse charge are ignored for a quote everywhere (engine input, validation, editor).
3. **Numbers.** Tax invoice: unchanged (`<seller prefix>2026-27/0001`). Proforma `PF/2026-27/0001` and quotation `QT/2026-27/0001` are 15 characters, inside the 16-character GST limit (`MAX_INVOICE_NUMBER_LENGTH`), so no compact form is needed. They use fixed prefixes, not the seller's prefix (4 + 3 + 12 would exceed 16).
4. **Series.** The series is the stored `kind`. `nextNumber(issueDate, kind = 'invoice')` counts only records of that kind. The duplicate-number check compares only within the same kind. Stored proformas that hold tax-series numbers are not rewritten; they just stop counting towards the tax series.
5. **Convert.** `storage.invoices.convert(id, newId)`: source must be an issued, unconverted quote or proforma; builds a draft tax invoice (fresh number from the tax series, current profile, same client, lines, notes, terms, supply options; no due date, advance, validity), saves it with `convertedFromId`, then marks the source with `convertedToId`. Deleting that draft clears the link so the source can be converted again.
6. **Editor.** "Document type" select; quote shows "Valid until" (default issue date + 30 days) and hides due date, TDS, advance, reverse charge. A new draft renumbers when the type or financial year changes (until the number is typed). The type is locked once a draft has been saved.
7. **PDF.** Meta row "Valid until"; title, footer, file name (`Quotation-QT-2026-27-0001.pdf`) follow the document title.

## Tasks (test first, small commits)

1. Model, series prefixes, kind-aware `nextNumber`, per-series duplicate check, draft kind.
2. Validation (`validUntil`), quote document view-model and declarations.
3. Convert (domain function + storage method + delete clears link).
4. Backup validation for the new fields.
5. PDF: validity line, filenames, text tests with pdfjs.
6. Web: editor model and editor, details section.
7. Web: list (badge, filter), viewer (Convert), app wiring.
8. e2e: quote to invoice.
9. Registry copy and README.
