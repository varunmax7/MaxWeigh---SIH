/**
 * The verification QR embedded in a report/certificate (implementation.md
 * §8.4): `{APP_URL}/verify/{certNo or reportNo}?h={first 16 hex of a hash}`.
 *
 * §8.4 literally names `pdf_sha256`, but that hash cannot exist yet at the
 * point this QR is burned into the page — the signed PDF's bytes (and so
 * its hash) are only final *after* Playwright has captured a page that
 * already contains this QR, and after `@signpdf` has signed it. Using
 * `model_sha256` instead is what's actually knowable at render time, and it
 * identifies the exact same signed content the officers approved — see
 * docs/QUESTIONS.md for the human confirmation this still needs.
 */
import QRCode from 'qrcode';

export function buildVerifyUrl(
  appUrl: string,
  certNoOrReportNo: string,
  modelSha256: string,
): string {
  return `${appUrl}/verify/${encodeURIComponent(certNoOrReportNo)}?h=${modelSha256.slice(0, 16)}`;
}

export async function buildVerifyQrDataUrl(
  appUrl: string,
  certNoOrReportNo: string,
  modelSha256: string,
): Promise<string> {
  return QRCode.toDataURL(buildVerifyUrl(appUrl, certNoOrReportNo, modelSha256), {
    margin: 1,
    width: 240,
  });
}
