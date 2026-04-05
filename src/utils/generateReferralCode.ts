export function generateReferralCode(walletAddress: string): string {
  let hash = 0;
  for (let i = 0; i < walletAddress.length; i++) {
    hash = ((hash << 5) - hash + walletAddress.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
  return `NOC-${hex}`;
}
