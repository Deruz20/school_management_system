/**
 * Utility to convert numeric / decimal amounts to formal English currency words.
 * Standardized for Ugandan / East African school fee receipts.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function convertChunk(num: number): string {
  let result = '';
  if (num >= 100) {
    result += ONES[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    result += TENS[Math.floor(num / 10)] + ' ';
    num %= 10;
  }
  if (num > 0) {
    result += ONES[num] + ' ';
  }
  return result.trim();
}

export function amountToWords(
  amount: number | string,
  currency: string = 'Uganda Shillings'
): string {
  const numStr = typeof amount === 'number' ? amount.toString() : amount;
  const parts = numStr.split('.');
  const wholePart = parseInt(parts[0], 10);
  const decimalPart = parts[1] ? parseInt(parts[1].slice(0, 2), 10) : 0;

  if (isNaN(wholePart) || wholePart === 0) {
    return `Zero ${currency} Only`;
  }

  let words = '';
  let scaleIndex = 0;
  let remaining = wholePart;

  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk !== 0) {
      const chunkWords = convertChunk(chunk);
      const scale = SCALES[scaleIndex];
      words = `${chunkWords}${scale ? ' ' + scale : ''} ${words}`.trim();
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }

  let finalWords = words.trim() + ` ${currency}`;
  if (decimalPart > 0) {
    finalWords += ` and ${decimalPart}/100 Cents`;
  }
  finalWords += ' Only';

  return finalWords;
}
