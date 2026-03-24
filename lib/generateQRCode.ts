import QRCode from 'qrcode'

export async function generateQRCode(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  })
}
