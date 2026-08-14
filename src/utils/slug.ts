export function generateJobSlug(company: string, role: string): string {
  const clean = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const companySlug = clean(company) || 'company';
  const roleSlug = clean(role) || 'role';
  return `${companySlug}-${roleSlug}`;
}
