/** Saves a blob as a file by clicking a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start the download after the click returns, so the address must outlive it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
