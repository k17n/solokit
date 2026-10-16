import type { InvoiceDocument } from '@solokit/tool-invoice';

export interface TotalsPanelProps {
  document: InvoiceDocument | null;
}

export function TotalsPanel({ document }: TotalsPanelProps) {
  return (
    <section aria-labelledby="totals-heading" style={{ display: 'grid', gap: '0.75rem' }}>
      <h3 id="totals-heading" style={{ fontSize: '1.25rem' }}>
        Totals
      </h3>
      {document === null ? (
        <p style={{ color: 'var(--text-muted)' }}>Fill in the details above to see the totals.</p>
      ) : (
        <>
          <ul aria-label="Totals" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }} role="list">
            {document.totals.map((row) => (
              <li
                key={`${row.label}-${row.amount}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  fontWeight: row.emphasis === 'total' || row.emphasis === 'net' ? 700 : 400,
                  color: row.emphasis === 'muted' ? 'var(--text-muted)' : undefined,
                  borderTop: row.emphasis === 'total' ? '1.5px solid var(--edge)' : undefined,
                  paddingTop: row.emphasis === 'total' ? '0.4rem' : undefined,
                }}
              >
                <span>{row.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.amount}</span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{document.amountInWords}</p>
          {document.declarations.map((line) => (
            <p key={line} style={{ fontSize: '0.9rem' }}>
              {line}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
