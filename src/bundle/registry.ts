import fs from 'node:fs/promises';
import path from 'node:path';
import open from 'open';

export interface ApplicationRecord {
  id: string; // Job slug e.g. "stripe-staff-infrastructure-engineer"
  company: string;
  role: string;
  createdAt: string;
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
  template: string;
  targetPages: number;
  bundleDir: string;
  pdfPath: string;
  jsonPath: string;
  mdPath: string;
}

export interface RegistryData {
  schemaVersion: string;
  lastUpdated: string;
  applications: ApplicationRecord[];
}

export function getDefaultRegistryPath(baseDir?: string): string {
  const applicationsDir = baseDir || path.join(process.cwd(), 'applications');
  return path.join(applicationsDir, 'registry.json');
}

/**
 * Registers an application bundle into applications/registry.json.
 */
export async function registerApplication(
  record: ApplicationRecord,
  registryFilePath?: string
): Promise<void> {
  const regPath = registryFilePath || getDefaultRegistryPath();
  const dir = path.dirname(regPath);
  await fs.mkdir(dir, { recursive: true });

  let registry: RegistryData = {
    schemaVersion: '1.0.0',
    lastUpdated: new Date().toISOString(),
    applications: [],
  };

  try {
    const raw = await fs.readFile(regPath, 'utf8');
    registry = JSON.parse(raw);
  } catch {
    // initialize fresh
  }

  // Update existing entry or prepend new
  const existingIdx = registry.applications.findIndex((a) => a.id === record.id);
  if (existingIdx >= 0) {
    registry.applications[existingIdx] = record;
  } else {
    registry.applications.unshift(record);
  }

  registry.lastUpdated = new Date().toISOString();

  await fs.writeFile(regPath, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * Lists all registered applications, auto-discovering uncataloged application directories if any.
 */
export async function listApplications(baseDir?: string): Promise<ApplicationRecord[]> {
  const applicationsDir = baseDir || path.join(process.cwd(), 'applications');
  const regPath = path.join(applicationsDir, 'registry.json');

  let records: ApplicationRecord[] = [];

  try {
    const raw = await fs.readFile(regPath, 'utf8');
    const data: RegistryData = JSON.parse(raw);
    records = data.applications || [];
  } catch {
    // Registry not yet created
  }

  // Auto-discover any untracked folders in applications directory
  try {
    const entries = await fs.readdir(applicationsDir, { withFileTypes: true });
    const knownIds = new Set(records.map((r) => r.id));

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const slug = entry.name;
        if (!knownIds.has(slug)) {
          const bundleDir = path.join(applicationsDir, slug);
          const resumeJsonPath = path.join(bundleDir, 'resume.json');
          const pdfPath = path.join(bundleDir, 'resume.pdf');
          const mdPath = path.join(bundleDir, 'resume.md');

          try {
            const rawJson = await fs.readFile(resumeJsonPath, 'utf8');
            const data = JSON.parse(rawJson);
            const verifPath = path.join(bundleDir, 'verification.json');
            let status: ApplicationRecord['status'] = 'PASS';
            try {
              const rawVerif = await fs.readFile(verifPath, 'utf8');
              status = JSON.parse(rawVerif).status || 'PASS';
            } catch {}

            records.push({
              id: slug,
              company: data.targetCompany || slug.split('-')[0] || 'Unknown',
              role: data.targetRole || 'Software Engineer',
              createdAt: new Date().toISOString(),
              status,
              template: 'modern',
              targetPages: 1,
              bundleDir,
              pdfPath,
              jsonPath: resumeJsonPath,
              mdPath,
            });
          } catch {}
        }
      }
    }
  } catch {}

  return records;
}

/**
 * Finds an application by slug, company, or role prefix.
 */
export async function findApplication(
  query: string,
  baseDir?: string
): Promise<ApplicationRecord | null> {
  const applications = await listApplications(baseDir);
  const q = query.toLowerCase().trim();

  // 1. Exact slug match
  const exact = applications.find((a) => a.id.toLowerCase() === q);
  if (exact) return exact;

  // 2. Partial slug / company match
  const partial = applications.find(
    (a) =>
      a.id.toLowerCase().includes(q) ||
      a.company.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
  );

  return partial || null;
}

/**
 * Opens the application PDF using the operating system default viewer.
 */
export async function openApplicationPdf(
  slugOrPath: string,
  baseDir?: string
): Promise<{ success: boolean; openedPath: string }> {
  let targetPath = slugOrPath;

  // Check if direct file path exists
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      targetPath = path.join(targetPath, 'resume.pdf');
    }
  } catch {
    // If not direct file path, look up in registry
    const app = await findApplication(slugOrPath, baseDir);
    if (!app) {
      throw new Error(`Could not find application matching "${slugOrPath}". Run "imprintcv list" to see all applications.`);
    }
    targetPath = app.pdfPath;
  }

  // Ensure file exists
  await fs.access(targetPath);

  // Launch system default viewer
  await open(targetPath);

  return {
    success: true,
    openedPath: targetPath,
  };
}
