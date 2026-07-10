function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function field(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

export function generatePixPayload(
  pixKey: string,
  name: string,
  city: string,
  amount?: number,
  txId?: string
): string {
  const safeName = name.normalize('NFD').replace(/[^ -~]/g, '').substring(0, 25).trim() || 'Nome';
  const safeCity = city.normalize('NFD').replace(/[^ -~]/g, '').substring(0, 15).trim() || 'Cidade';
  const safeTxId = (txId || '***').replace(/[^A-Za-z0-9]/g, '').substring(0, 25) || '***';

  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', pixKey);

  let payload =
    field('00', '01') +
    field('26', merchantAccount) +
    field('52', '0000') +
    field('53', '986') +
    (amount ? field('54', amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', safeName) +
    field('60', safeCity) +
    field('62', field('05', safeTxId)) +
    '6304';

  return payload + crc16(payload);
}

export async function generatePixQrCode(pixKey: string, name: string, city: string, amount?: number): Promise<string> {
  const QRCode = require('qrcode');
  const payload = generatePixPayload(pixKey, name, city, amount);
  return QRCode.toDataURL(payload, { width: 250, margin: 1 });
}
