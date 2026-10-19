export const rentalTowns = ['Victor', 'Driggs', 'Jackson'] as const;
export const rentalPlans = ['1x1', '2x2'] as const;
export const rentalGroups = ['communities', 'all-direct'] as const;
export type RentalPlan = typeof rentalPlans[number];
export type RentalGroup = typeof rentalGroups[number];
export interface RentalSummary {
  town: typeof rentalTowns[number];
  plan: RentalPlan;
  group: RentalGroup;
  records: number;
  properties: number;
  min: number;
  median: number;
  max: number;
  examples: { name: string; baseRent: number }[];
}
export interface RentalSnapshot {
  version: 1;
  status: 'draft';
  sourceFile: string;
  sourceSha256: string;
  observedAt: null;
  importedAt: string;
  sponsor: { plan: RentalPlan; records: number; medianBase: number; monthlyCam: number }[];
  comparisons: RentalSummary[];
}

// Aggregate imports remain drafts: dates and primary URLs are absent from the source CSV.
// A future unit-level collector must not promote these summaries to verified live offers.
export function validateRentalSnapshot(value: unknown): asserts value is RentalSnapshot {
  const fail = (message: string): never => { throw new Error(`Rental snapshot: ${message}`); };
  if (!value || typeof value !== 'object') fail('expected an object');
  const data = value as RentalSnapshot;
  if (data.version !== 1 || data.status !== 'draft' || data.observedAt !== null) fail('aggregate imports must stay undated drafts');
  if (!data.sourceFile || !/^[a-f0-9]{64}$/.test(data.sourceSha256) || !Number.isFinite(Date.parse(data.importedAt))) fail('missing import provenance');
  if (!Array.isArray(data.sponsor) || data.sponsor.length !== 2 || !Array.isArray(data.comparisons)) fail('missing plan data');
  const money = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100000;
  const count = (n: number) => Number.isInteger(n) && n > 0;
  const sponsorKeys = new Set<string>();
  for (const row of data.sponsor) {
    if (!rentalPlans.includes(row.plan) || sponsorKeys.has(row.plan) || !count(row.records) || !money(row.medianBase) || row.medianBase === 0 || !money(row.monthlyCam)) fail('invalid sponsor plan');
    sponsorKeys.add(row.plan);
  }
  const keys = new Set<string>();
  for (const row of data.comparisons) {
    const key = `${row.group}/${row.plan}/${row.town}`;
    if (!rentalTowns.includes(row.town) || !rentalPlans.includes(row.plan) || !rentalGroups.includes(row.group) || keys.has(key)) fail(`invalid or duplicate comparison ${key}`);
    if (!count(row.records) || !count(row.properties) || row.properties > row.records) fail(`invalid sample size ${key}`);
    if (![row.min, row.median, row.max].every(money) || row.min <= 0 || row.min > row.median || row.median > row.max) fail(`invalid rent range ${key}`);
    if (!Array.isArray(row.examples) || !row.examples.length || row.examples.some(item => !item.name || item.name.length > 200 || !money(item.baseRent) || item.baseRent < row.min || item.baseRent > row.max)) fail(`invalid examples ${key}`);
    keys.add(key);
  }
  if (!data.comparisons.length) fail('empty comparisons');
}

export const dollars = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
export const planLabel = (plan: RentalPlan) => plan === '1x1' ? '1 bed / 1 bath' : '2 beds / 2 baths';
export function rentDifference(sponsorBase: number, comparisonMedian: number) {
  const difference = comparisonMedian - sponsorBase;
  return difference === 0 ? 'Same median base rent' : `Teton Flats ${dollars(Math.abs(difference))} ${difference > 0 ? 'lower' : 'higher'}/mo`;
}
