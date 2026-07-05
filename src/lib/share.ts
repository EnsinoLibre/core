/**
 * Generates a shareable link for a worksheet.
 *
 * TODO: this currently just builds a local URL. The real version will
 * need a backend endpoint that registers the worksheet (or a snapshot
 * of it) and returns a short, stable link, since worksheet ids alone
 * aren't a great fit for something a teacher hands out to students.
 * Worth looking at simple link-shortening approaches once that backend
 * exists, rather than exposing raw worksheet ids in the URL.
 */
export function generateShareLink(worksheetId: string): string {
  return `${window.location.origin}/w/${worksheetId}`
}
