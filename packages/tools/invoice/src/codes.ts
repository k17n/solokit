/** Date this short list was last checked. It is not an official register. */
export const SAC_AS_OF = '2026-10-14';

export interface ServiceCode {
  code: string;
  description: string;
}

/** Common service accounting codes for freelancers and consultants. Verify against the official SAC list. */
export const COMMON_SERVICE_CODES: readonly ServiceCode[] = [
  { code: '998311', description: 'Management consulting and management services' },
  { code: '998312', description: 'Business consulting services' },
  { code: '998313', description: 'Information technology (IT) consulting and support services' },
  { code: '998314', description: 'Information technology (IT) design and development services' },
  { code: '998315', description: 'Hosting and information technology (IT) infrastructure provisioning services' },
  { code: '998319', description: 'Other information technology services' },
  { code: '998361', description: 'Advertising services' },
  { code: '998391', description: 'Specialty design services, including interior, fashion and industrial design' },
  { code: '998399', description: 'Other professional, technical and business services' },
  { code: '999293', description: 'Commercial training and coaching services' },
];

/** Matches the start of a code, or every word of the query against the description. */
export function searchServiceCodes(query: string, limit = 8): ServiceCode[] {
  const text = query.trim().toLowerCase();
  if (text === '') return [];
  const words = text.split(/\s+/);
  const matches = COMMON_SERVICE_CODES.filter((entry) => {
    if (/^\d+$/.test(text)) return entry.code.startsWith(text);
    const description = entry.description.toLowerCase();
    return words.every((word) => description.includes(word));
  });
  return matches.slice(0, limit).map((entry) => ({ ...entry }));
}
