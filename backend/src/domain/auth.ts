export function isAllowedDomain(
  hd: string | undefined,
  email: string | undefined,
  allowedDomains: string[],
): boolean {
  if (!email) return false;
  if (hd && allowedDomains.includes(hd)) return true;
  const domain = email.split("@")[1];
  if (!domain) return false;
  return allowedDomains.includes(domain);
}
