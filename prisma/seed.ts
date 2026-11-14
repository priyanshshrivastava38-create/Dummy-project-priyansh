import "dotenv/config";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "OpsLedger123!";
const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || "storage");
const ORG_SLUG = "northwind-industrial";
const DEFAULT_WEIGHTS = { price: 35, delivery: 20, quality: 20, reliability: 15, payment: 10 };

type RoleKey = "ADMIN" | "PROCUREMENT_MANAGER" | "APPROVER";
type StatusKey =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SOURCING"
  | "COMPLETED"
  | "CANCELLED";
type PriorityKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type QuoteStatusKey = "RECEIVED" | "UNDER_REVIEW" | "SHORTLISTED" | "SELECTED" | "NOT_SELECTED";
type StepStatusKey = "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "CLARIFICATION_REQUESTED" | "SKIPPED";
type ActionKey = "APPROVE" | "REJECT" | "REQUEST_CLARIFICATION" | "COMMENT" | "RESUBMIT" | "CANCEL";
type ContractStatusKey = "DRAFT" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWED" | "TERMINATED";
type ComplianceKey = "COMPLIANT" | "PENDING" | "NON_COMPLIANT";
type ExtractionKey = "AI" | "MANUAL" | "AI_CORRECTED";

// ---------------------------------------------------------------------------
// Date helpers. The dataset is anchored to "today" so renewal dates and
// analytics remain meaningful whenever the demo is opened.
// ---------------------------------------------------------------------------

const now = new Date();

function ago(days: number, hour = 10, minute = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dateOffset(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ---------------------------------------------------------------------------
// PDF generation. Quotation PDFs are real files on disk so the extraction
// flow, document viewer and download routes can be exercised end to end.
// ---------------------------------------------------------------------------

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
    while (line.length > maxChars) {
      lines.push(line.slice(0, maxChars));
      line = line.slice(maxChars);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function renderPdf(title: string, body: string[]): Promise<{ bytes: Buffer; text: string }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 780;

  const ensure = (needed: number) => {
    if (y - needed < 60) {
      page = doc.addPage([595, 842]);
      y = 780;
    }
  };

  const draw = (text: string, size: number, bold: boolean, color = rgb(0.12, 0.13, 0.16)) => {
    for (const chunk of wrapText(text, Math.floor(94 * (10.5 / size)))) {
      ensure(size + 6);
      page.drawText(chunk, {
        x: 50,
        y,
        size,
        font: bold ? boldFont : font,
        color,
      });
      y -= size + 5;
    }
  };

  draw(title, 17, true);
  y -= 8;
  for (const raw of body) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      y -= 6;
      continue;
    }
    const isHeading = /:$/.test(line) && line.length < 60;
    draw(line, isHeading ? 11 : 10.5, isHeading);
  }

  const bytes = Buffer.from(await doc.save());
  return { bytes, text: [title, ...body].join("\n") };
}

/** A page with no selectable text — used to demonstrate the failed-extraction path. */
async function renderScannedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawRectangle({
    x: 110,
    y: 330,
    width: 375,
    height: 250,
    color: rgb(0.95, 0.95, 0.97),
    borderColor: rgb(0.78, 0.79, 0.84),
    borderWidth: 1,
  });
  return Buffer.from(await doc.save());
}

function storageKey(orgId: string, kind: "quotations" | "requests" | "contracts", id: string, fileName: string) {
  const safe = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${orgId}/${kind}/${id}/${randomUUID()}-${safe}`;
}

async function storeFile(key: string, bytes: Buffer): Promise<number> {
  const target = path.resolve(STORAGE_ROOT, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return bytes.length;
}

// ---------------------------------------------------------------------------
// Static demo configuration
// ---------------------------------------------------------------------------

const departmentsSeed = [
  { key: "ops", name: "Operations", code: "OPS", budget: 900000 },
  { key: "it", name: "Information Technology", code: "IT", budget: 650000 },
  { key: "fac", name: "Facilities", code: "FAC", budget: 480000 },
  { key: "mkt", name: "Marketing", code: "MKT", budget: 300000 },
  { key: "fin", name: "Finance", code: "FIN", budget: 250000 },
] as const;

const profilesSeed: {
  key: string;
  email: string;
  fullName: string;
  title: string;
  role: RoleKey;
  department: (typeof departmentsSeed)[number]["key"];
}[] = [
  {
    key: "olivia",
    email: "admin@opsledger.app",
    fullName: "Olivia Grant",
    title: "Chief Operating Officer",
    role: "ADMIN",
    department: "fin",
  },
  {
    key: "ethan",
    email: "admin2@opsledger.app",
    fullName: "Ethan Cole",
    title: "Finance Director",
    role: "ADMIN",
    department: "fin",
  },
  {
    key: "priya",
    email: "procurement@opsledger.app",
    fullName: "Priya Nair",
    title: "Head of Procurement",
    role: "PROCUREMENT_MANAGER",
    department: "fin",
  },
  {
    key: "hana",
    email: "buyer@opsledger.app",
    fullName: "Hana Kim",
    title: "Senior Buyer",
    role: "PROCUREMENT_MANAGER",
    department: "fin",
  },
  {
    key: "daniel",
    email: "manager.ops@opsledger.app",
    fullName: "Daniel Okafor",
    title: "Operations Manager",
    role: "APPROVER",
    department: "ops",
  },
  {
    key: "maya",
    email: "manager.it@opsledger.app",
    fullName: "Maya Chen",
    title: "IT Manager",
    role: "APPROVER",
    department: "it",
  },
  {
    key: "laura",
    email: "manager.facilities@opsledger.app",
    fullName: "Laura Simmons",
    title: "Facilities Manager",
    role: "APPROVER",
    department: "fac",
  },
  {
    key: "owen",
    email: "manager.marketing@opsledger.app",
    fullName: "Owen Brooks",
    title: "Marketing Manager",
    role: "APPROVER",
    department: "mkt",
  },
  {
    key: "sofia",
    email: "manager.finance@opsledger.app",
    fullName: "Sofia Reyes",
    title: "Finance Manager",
    role: "APPROVER",
    department: "fin",
  },
  {
    key: "rina",
    email: "approver.ops@opsledger.app",
    fullName: "Rina Patel",
    title: "Senior Operations Lead",
    role: "APPROVER",
    department: "ops",
  },
  {
    key: "marcus",
    email: "approver.it@opsledger.app",
    fullName: "Marcus Lee",
    title: "Infrastructure Lead",
    role: "APPROVER",
    department: "it",
  },
];

const headsSeed: Record<string, string> = {
  ops: "daniel",
  it: "maya",
  fac: "laura",
  mkt: "owen",
  fin: "sofia",
};

const vendorsSeed: {
  key: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  taxId: string;
  status: "ACTIVE" | "INACTIVE";
  rating: number;
  reliability: number;
  compliance: ComplianceKey;
  notes?: string;
}[] = [
  {
    key: "meridian",
    name: "Meridian Industrial Supply",
    contactName: "Elena Vasquez",
    email: "elena@meridiansupply.com",
    phone: "+1 (216) 555-0142",
    category: "Heavy Equipment",
    taxId: "US-EIN-84-2910337",
    status: "ACTIVE",
    rating: 88,
    reliability: 92,
    compliance: "COMPLIANT",
    notes: "Preferred partner for press and fabrication equipment. 24-month parts and labour warranty as standard.",
  },
  {
    key: "apex",
    name: "Apex Machinery Group",
    contactName: "Grant Holloway",
    email: "sales@apexmachinery.com",
    phone: "+1 (412) 555-0188",
    category: "Heavy Equipment",
    taxId: "US-EIN-27-4410921",
    status: "ACTIVE",
    rating: 81,
    reliability: 78,
    compliance: "COMPLIANT",
  },
  {
    key: "northstar",
    name: "Northstar Fabrication",
    contactName: "Ingrid Solberg",
    email: "ingrid@northstarfab.com",
    phone: "+1 (612) 555-0119",
    category: "Heavy Equipment",
    taxId: "US-EIN-41-3028876",
    status: "ACTIVE",
    rating: 74,
    reliability: 69,
    compliance: "PENDING",
    notes: "Insurance certificate renewal in progress. Competitive pricing but limited emergency support.",
  },
  {
    key: "lumen",
    name: "Lumen IT Solutions",
    contactName: "Daniel Cho",
    email: "daniel.cho@lumenit.com",
    phone: "+1 (408) 555-0173",
    category: "IT Hardware",
    taxId: "US-EIN-77-1029384",
    status: "ACTIVE",
    rating: 91,
    reliability: 94,
    compliance: "COMPLIANT",
    notes: "Authorised hardware reseller with imaging and asset-tagging included.",
  },
  {
    key: "cortex",
    name: "Cortex Systems",
    contactName: "Amara Bello",
    email: "amara@cortexsystems.io",
    phone: "+1 (512) 555-0164",
    category: "IT Hardware",
    taxId: "US-EIN-74-5589012",
    status: "ACTIVE",
    rating: 84,
    reliability: 80,
    compliance: "COMPLIANT",
  },
  {
    key: "bluepeak",
    name: "BluePeak Networks",
    contactName: "Tomás Herrera",
    email: "tomas@bluepeaknet.com",
    phone: "+1 (303) 555-0155",
    category: "IT Services",
    taxId: "US-EIN-46-8812045",
    status: "ACTIVE",
    rating: 79,
    reliability: 83,
    compliance: "COMPLIANT",
  },
  {
    key: "horizon",
    name: "Horizon Facilities Co.",
    contactName: "Ruth Adeyemi",
    email: "ruth@horizonfacilities.com",
    phone: "+1 (614) 555-0126",
    category: "Facilities",
    taxId: "US-EIN-31-4409822",
    status: "ACTIVE",
    rating: 86,
    reliability: 88,
    compliance: "COMPLIANT",
    notes: "Covers all three Northwind sites. 4-hour emergency response SLA.",
  },
  {
    key: "vertex",
    name: "Vertex Building Services",
    contactName: "Marek Nowak",
    email: "marek@vertexbuilding.com",
    phone: "+1 (216) 555-0137",
    category: "Facilities",
    taxId: "US-EIN-34-7719032",
    status: "ACTIVE",
    rating: 72,
    reliability: 65,
    compliance: "PENDING",
    notes: "Two late service visits in the last contract year. Compliance pack outstanding.",
  },
  {
    key: "atlas",
    name: "Atlas Office Group",
    contactName: "Jenny Park",
    email: "jenny@atlasoffice.com",
    phone: "+1 (847) 555-0148",
    category: "Office Supplies",
    taxId: "US-EIN-36-2201447",
    status: "ACTIVE",
    rating: 77,
    reliability: 90,
    compliance: "COMPLIANT",
  },
  {
    key: "beacon",
    name: "Beacon Marketing Studio",
    contactName: "Ana Duarte",
    email: "ana@beaconstudio.co",
    phone: "+1 (312) 555-0191",
    category: "Marketing Services",
    taxId: "US-EIN-82-6641288",
    status: "ACTIVE",
    rating: 83,
    reliability: 76,
    compliance: "COMPLIANT",
  },
  {
    key: "ironclad",
    name: "Ironclad Safety Co.",
    contactName: "Bill Turner",
    email: "bill@ironcladsafety.com",
    phone: "+1 (330) 555-0102",
    category: "Industrial Supplies",
    taxId: "US-EIN-26-4489007",
    status: "ACTIVE",
    rating: 68,
    reliability: 71,
    compliance: "NON_COMPLIANT",
    notes: "Liability insurance certificate expired 30 Sep 2026. Do not issue new purchase orders until renewed.",
  },
  {
    key: "pinnacle",
    name: "Pinnacle Logistics",
    contactName: "Sam Osei",
    email: "sam@pinnaclelogistics.com",
    phone: "+1 (614) 555-0177",
    category: "Logistics",
    taxId: "US-EIN-55-9023118",
    status: "ACTIVE",
    rating: 80,
    reliability: 85,
    compliance: "COMPLIANT",
  },
  {
    key: "quantum",
    name: "Quantum Software Labs",
    contactName: "Nadia Rahman",
    email: "nadia@quantumlabs.io",
    phone: "+1 (415) 555-0124",
    category: "Software",
    taxId: "US-EIN-88-3017745",
    status: "ACTIVE",
    rating: 87,
    reliability: 89,
    compliance: "COMPLIANT",
    notes: "SOC 2 Type II report available on request. Annual price uplift capped at 4%.",
  },
  {
    key: "somerville",
    name: "Somerville HVAC",
    contactName: "Peter Lang",
    email: "peter@somervillehvac.com",
    phone: "+1 (781) 555-0166",
    category: "Facilities",
    taxId: "US-EIN-22-6640193",
    status: "INACTIVE",
    rating: 64,
    reliability: 60,
    compliance: "PENDING",
    notes: "Deactivated after repeated missed SLAs. Retained for historical reporting only.",
  },
];

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

type StepSeed = {
  level: number;
  approver: string;
  status: StepStatusKey;
  activatedAt?: Date | null;
  decidedAt?: Date | null;
};

type ActionSeed = {
  level?: number;
  actor: string;
  action: ActionKey;
  comment?: string;
  at: Date;
  summary?: string;
};

type RequestSeed = {
  reference: string;
  title: string;
  description: string;
  category: string;
  department: string;
  requester: string;
  budget: number;
  priority: PriorityKey;
  requiredIn: number;
  createdDaysAgo: number;
  submittedDaysAgo?: number;
  approvedDaysAgo?: number;
  completedDaysAgo?: number;
  status: StatusKey;
  rejectionReason?: string;
  cancellationReason?: string;
  weights?: typeof DEFAULT_WEIGHTS;
  items: { description: string; quantity: number; unit: string; unitPrice: number }[];
  steps?: StepSeed[];
  actions?: ActionSeed[];
  documents?: { fileName: string; title: string; lines: string[] }[];
};

const requestsSeed: RequestSeed[] = [
  {
    reference: "PR-2026-0001",
    title: "Hydraulic press refurbishment",
    description:
      "The 400-ton hydraulic press on Line 3 has exceeded its service interval and is losing pressure under load. Refurbishment covers the hydraulic power unit, press-frame inspection and a CNC controller retrofit to restore full tonnage without replacing the asset.",
    category: "Manufacturing Equipment",
    department: "ops",
    requester: "daniel",
    budget: 200000,
    priority: "HIGH",
    requiredIn: -38,
    createdDaysAgo: 116,
    submittedDaysAgo: 114,
    approvedDaysAgo: 108,
    completedDaysAgo: 38,
    status: "COMPLETED",
    items: [
      {
        description: "Hydraulic press refurbishment — 400-ton frame, power unit and seals",
        quantity: 1,
        unit: "lot",
        unitPrice: 180000,
      },
      { description: "CNC controller retrofit and calibration", quantity: 1, unit: "lot", unitPrice: 20500 },
    ],
    steps: [
      {
        level: 1,
        approver: "rina",
        status: "APPROVED",
        activatedAt: ago(114, 11),
        decidedAt: ago(109, 15),
      },
      {
        level: 2,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(109, 15, 10),
        decidedAt: ago(108, 10),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "rina",
        action: "APPROVE",
        comment: "Refurbishment is materially cheaper than replacement and fits the maintenance window.",
        at: ago(109, 15),
      },
      {
        level: 2,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved against the FY26 capital plan.",
        at: ago(108, 10),
      },
    ],
    documents: [
      {
        fileName: "press-refurbishment-scope.pdf",
        title: "Hydraulic press refurbishment — scope of work",
        lines: [
          "Line 3 · 400-ton hydraulic press",
          "Prepared by: Daniel Okafor, Operations Manager",
          "",
          "Scope:",
          "1. Inspect and repair the hydraulic power unit, seals and valves.",
          "2. Non-destructive inspection of the press frame and columns.",
          "3. Retrofit a modern CNC controller with guarded tooling interface.",
          "4. Commission, calibrate and load-test to 400 tons.",
          "",
          "Constraints:",
          "Work must be completed during the two-week plant shutdown window.",
          "Vendor must provide a 24-month warranty on parts and labour.",
        ],
      },
    ],
  },
  {
    reference: "PR-2026-0002",
    title: "Laptop refresh for engineering team",
    description:
      "Forty engineering laptops are beyond their supported lifecycle and cannot run the current CAD toolchain. This request replaces them with specified business laptops, docking stations and a three-year support plan.",
    category: "IT Hardware",
    department: "it",
    requester: "maya",
    budget: 85000,
    priority: "HIGH",
    requiredIn: -21,
    createdDaysAgo: 96,
    submittedDaysAgo: 94,
    approvedDaysAgo: 88,
    completedDaysAgo: 21,
    status: "COMPLETED",
    items: [
      { description: "Engineering laptop — Ultra 7, 32GB RAM, 1TB SSD", quantity: 40, unit: "unit", unitPrice: 1850 },
      { description: "USB-C docking station", quantity: 40, unit: "unit", unitPrice: 210 },
    ],
    steps: [
      { level: 1, approver: "marcus", status: "APPROVED", activatedAt: ago(94, 11), decidedAt: ago(89, 14) },
      {
        level: 2,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(89, 14, 10),
        decidedAt: ago(88, 9),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "marcus",
        action: "APPROVE",
        comment: "Specification matches the CAD reference build agreed with engineering.",
        at: ago(89, 14),
      },
      {
        level: 2,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved — refresh was already in the IT roadmap.",
        at: ago(88, 9),
      },
      {
        actor: "priya",
        action: "COMMENT",
        comment: "Three quotations requested; Lumen includes imaging and asset tagging at no extra cost.",
        at: ago(90, 11),
      },
    ],
  },
  {
    reference: "PR-2026-0003",
    title: "Annual HVAC maintenance contract",
    description:
      "Renew the planned preventive maintenance contract for heating, ventilation and air-conditioning across the Cleveland and Columbus sites. Includes quarterly servicing and a guaranteed emergency response.",
    category: "Facilities Services",
    department: "fac",
    requester: "laura",
    budget: 46000,
    priority: "MEDIUM",
    requiredIn: -11,
    createdDaysAgo: 72,
    submittedDaysAgo: 70,
    approvedDaysAgo: 64,
    completedDaysAgo: 11,
    status: "COMPLETED",
    items: [
      { description: "Quarterly HVAC servicing — 12 scheduled visits", quantity: 12, unit: "visit", unitPrice: 3000 },
      { description: "Emergency call-out allowance", quantity: 1, unit: "lot", unitPrice: 6000 },
      { description: "Consumables and filter replacement", quantity: 1, unit: "lot", unitPrice: 4000 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(70, 9),
        decidedAt: ago(65, 16),
      },
      {
        level: 2,
        approver: "ethan",
        status: "APPROVED",
        activatedAt: ago(65, 16, 10),
        decidedAt: ago(64, 11),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "olivia",
        action: "APPROVE",
        comment: "Continuity matters more than chasing a marginal saving here. Proceed.",
        at: ago(65, 16),
      },
      {
        level: 2,
        actor: "ethan",
        action: "APPROVE",
        comment: "Within the facilities opex envelope.",
        at: ago(64, 11),
      },
      {
        actor: "laura",
        action: "COMMENT",
        comment: "Included emergency call-out cover after last winter's boiler failure.",
        at: ago(66, 10),
      },
    ],
  },
  {
    reference: "PR-2026-0004",
    title: "Warehouse racking expansion",
    description:
      "Add 48 pallet-racking bays to the north warehouse to absorb inbound volume from the new distribution contract. Includes supply, seismic anchoring and installation over two weekends.",
    category: "Warehouse Equipment",
    department: "ops",
    requester: "daniel",
    budget: 62000,
    priority: "MEDIUM",
    requiredIn: 35,
    createdDaysAgo: 32,
    submittedDaysAgo: 30,
    approvedDaysAgo: 23,
    status: "SOURCING",
    weights: { price: 40, delivery: 15, quality: 20, reliability: 15, payment: 10 },
    items: [
      { description: "Pallet racking bays — 3300mm uprights", quantity: 48, unit: "bay", unitPrice: 820 },
      { description: "Beam sets", quantity: 96, unit: "set", unitPrice: 170 },
      { description: "Installation and seismic anchoring", quantity: 1, unit: "lot", unitPrice: 7000 },
    ],
    steps: [
      {
        level: 1,
        approver: "rina",
        status: "APPROVED",
        activatedAt: ago(30, 11),
        decidedAt: ago(24, 15),
      },
      {
        level: 2,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(24, 15, 10),
        decidedAt: ago(23, 9),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "rina",
        action: "APPROVE",
        comment: "Installation must be phased across two weekends to avoid disrupting outbound despatch.",
        at: ago(24, 15),
      },
      {
        level: 2,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved. Weighted scoring is set to price-heavy because the layout is fixed by engineering.",
        at: ago(23, 9),
      },
      {
        actor: "priya",
        action: "COMMENT",
        comment: "Three quotations received. Apex's PDF was a scan and was entered manually — original retained.",
        at: ago(22, 10),
      },
    ],
    documents: [
      {
        fileName: "racking-layout-plan.pdf",
        title: "North warehouse — racking layout plan",
        lines: [
          "Site: North warehouse, Cleveland",
          "Prepared by: Operations engineering",
          "",
          "48 bays arranged in 12 runs of 4, 3300mm uprights.",
          "Seismic anchoring required to zone 2 specification.",
          "Installation windows: two consecutive weekends, night shift preferred.",
          "Maximum aisle width 3.4m for reach trucks.",
        ],
      },
    ],
  },
  {
    reference: "PR-2026-0005",
    title: "ERP implementation partner",
    description:
      "Select an implementation partner for the finance and procurement ERP rollout. Scope covers discovery, configuration, data migration, training and 90 days of post-go-live support.",
    category: "Software & Professional Services",
    department: "fin",
    requester: "sofia",
    budget: 120000,
    priority: "CRITICAL",
    requiredIn: 90,
    createdDaysAgo: 48,
    submittedDaysAgo: 46,
    approvedDaysAgo: 36,
    status: "SOURCING",
    items: [
      { description: "ERP implementation — discovery, configuration and migration", quantity: 1, unit: "lot", unitPrice: 112000 },
      { description: "Training and change management", quantity: 1, unit: "lot", unitPrice: 8000 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(46, 10),
        decidedAt: ago(37, 14),
      },
      {
        level: 2,
        approver: "ethan",
        status: "APPROVED",
        activatedAt: ago(37, 14, 10),
        decidedAt: ago(36, 10),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "olivia",
        action: "APPROVE",
        comment: "The current workaround is costing us more than this implementation. Proceed.",
        at: ago(37, 14),
      },
      {
        level: 2,
        actor: "ethan",
        action: "APPROVE",
        comment: "Capitalised across two financial years as discussed.",
        at: ago(36, 10),
      },
      {
        actor: "priya",
        action: "COMMENT",
        comment: "Two partners shortlisted. Both proposals include the migration checklist required by finance.",
        at: ago(35, 9),
      },
    ],
  },
  {
    reference: "PR-2026-0006",
    title: "Marketing automation platform",
    description:
      "Replace the current email tool with a marketing automation platform covering lead scoring, lifecycle campaigns and CRM sync. Includes onboarding and integration with the existing CRM.",
    category: "Software",
    department: "mkt",
    requester: "owen",
    budget: 38000,
    priority: "HIGH",
    requiredIn: 25,
    createdDaysAgo: 27,
    submittedDaysAgo: 25,
    approvedDaysAgo: 18,
    status: "SOURCING",
    items: [
      { description: "Marketing automation platform — annual subscription", quantity: 1, unit: "year", unitPrice: 28000 },
      { description: "Onboarding and strategy workshop", quantity: 1, unit: "lot", unitPrice: 6000 },
      { description: "CRM integration", quantity: 1, unit: "lot", unitPrice: 4000 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(25, 11),
        decidedAt: ago(19, 15),
      },
      {
        level: 2,
        approver: "ethan",
        status: "APPROVED",
        activatedAt: ago(19, 15, 10),
        decidedAt: ago(18, 10),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved on the basis that the legacy email tool is decommissioned at renewal.",
        at: ago(19, 15),
      },
      {
        level: 2,
        actor: "ethan",
        action: "APPROVE",
        comment: "Net neutral against the existing tooling budget.",
        at: ago(18, 10),
      },
    ],
  },
  {
    reference: "PR-2026-0007",
    title: "Forklift fleet lease renewal",
    description:
      "Renew the lease on six counterbalance forklifts serving the Cleveland warehouse. Existing units are at end of term and maintenance costs are rising.",
    category: "Logistics Equipment",
    department: "ops",
    requester: "rina",
    budget: 54000,
    priority: "MEDIUM",
    requiredIn: 20,
    createdDaysAgo: 21,
    submittedDaysAgo: 19,
    approvedDaysAgo: 14,
    status: "APPROVED",
    items: [{ description: "Forklift lease — 6 units, 36 months, full maintenance", quantity: 6, unit: "unit", unitPrice: 8900 }],
    steps: [
      {
        level: 1,
        approver: "daniel",
        status: "APPROVED",
        activatedAt: ago(19, 9),
        decidedAt: ago(15, 14),
      },
      {
        level: 2,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(15, 14, 10),
        decidedAt: ago(14, 9),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "daniel",
        action: "APPROVE",
        comment: "Equivalent replacement cost is lower than extending the current units.",
        at: ago(15, 14),
      },
      {
        level: 2,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved for 36 months.",
        at: ago(14, 9),
      },
    ],
  },
  {
    reference: "PR-2026-0008",
    title: "Data centre cooling upgrade",
    description:
      "Replace two end-of-life CRAC units with four in-row cooling units and add environmental monitoring to the primary data centre. Required before the server refresh in Q1.",
    category: "IT Infrastructure",
    department: "it",
    requester: "marcus",
    budget: 76500,
    priority: "HIGH",
    requiredIn: 45,
    createdDaysAgo: 17,
    submittedDaysAgo: 15,
    approvedDaysAgo: 10,
    status: "APPROVED",
    items: [
      { description: "In-row cooling units — 12kW", quantity: 4, unit: "unit", unitPrice: 15000 },
      { description: "Installation and commissioning", quantity: 1, unit: "lot", unitPrice: 9000 },
      { description: "Environmental monitoring sensors and dashboard", quantity: 1, unit: "lot", unitPrice: 6000 },
    ],
    steps: [
      {
        level: 1,
        approver: "maya",
        status: "APPROVED",
        activatedAt: ago(15, 11),
        decidedAt: ago(11, 16),
      },
      {
        level: 2,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(11, 16, 10),
        decidedAt: ago(10, 9),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "maya",
        action: "APPROVE",
        comment: "Two units failed redundancy checks in the last quarter. This is now a resilience issue.",
        at: ago(11, 16),
      },
      {
        level: 2,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved as operational risk mitigation.",
        at: ago(10, 9),
      },
    ],
  },
  {
    reference: "PR-2026-0009",
    title: "Trade show booth fabrication",
    description:
      "Design and fabricate a reusable 6m × 3m booth for the spring trade show circuit. Includes modular walls, lighting, storage and graphics for two product lines.",
    category: "Marketing Services",
    department: "mkt",
    requester: "owen",
    budget: 22000,
    priority: "MEDIUM",
    requiredIn: 30,
    createdDaysAgo: 14,
    submittedDaysAgo: 12,
    approvedDaysAgo: 8,
    status: "APPROVED",
    items: [
      { description: "Modular booth structure and fabrication", quantity: 1, unit: "lot", unitPrice: 18500 },
      { description: "Printed graphics for two product lines", quantity: 1, unit: "lot", unitPrice: 3000 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(12, 10),
        decidedAt: ago(8, 15),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved — reusable structure pays back after two shows.",
        at: ago(8, 15),
      },
    ],
  },
  {
    reference: "PR-2026-0010",
    title: "Safety equipment restock",
    description:
      "Restock personal protective equipment for warehouse and fabrication teams ahead of the winter shift rotation. Current stock covers fewer than three weeks.",
    category: "Safety Supplies",
    department: "ops",
    requester: "daniel",
    budget: 18400,
    priority: "HIGH",
    requiredIn: 10,
    createdDaysAgo: 9,
    submittedDaysAgo: 8,
    status: "UNDER_REVIEW",
    items: [
      { description: "Safety helmets with chin straps", quantity: 120, unit: "unit", unitPrice: 65 },
      { description: "High-visibility vests", quantity: 200, unit: "unit", unitPrice: 28 },
      { description: "Cut-resistant gloves", quantity: 400, unit: "pair", unitPrice: 12 },
    ],
    steps: [
      {
        level: 1,
        approver: "rina",
        status: "CLARIFICATION_REQUESTED",
        activatedAt: ago(8, 10),
        decidedAt: ago(3, 11),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "rina",
        action: "REQUEST_CLARIFICATION",
        comment:
          "Attach the latest safety audit and confirm whether the 120 helmets replace existing stock or add capacity. Also confirm Ironclad's insurance status before ordering.",
        at: ago(3, 11),
      },
    ],
  },
  {
    reference: "PR-2026-0011",
    title: "Contractor management software",
    description:
      "Introduce a contractor management platform for site inductions, insurance verification and permit-to-work tracking across facilities and operations.",
    category: "Software",
    department: "fac",
    requester: "laura",
    budget: 32000,
    priority: "MEDIUM",
    requiredIn: 40,
    createdDaysAgo: 11,
    submittedDaysAgo: 10,
    status: "UNDER_REVIEW",
    items: [
      { description: "Contractor management platform — annual licence", quantity: 1, unit: "year", unitPrice: 26000 },
      { description: "Implementation and data migration", quantity: 1, unit: "lot", unitPrice: 6000 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(10, 9),
        decidedAt: ago(5, 14),
      },
      {
        level: 2,
        approver: "ethan",
        status: "PENDING",
        activatedAt: ago(5, 14, 10),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved — consolidates checklists currently kept in spreadsheets.",
        at: ago(5, 14),
      },
      {
        actor: "laura",
        action: "COMMENT",
        comment: "Confirmed the platform integrates with our existing contractor register and badge system.",
        at: ago(7, 10),
      },
    ],
  },
  {
    reference: "PR-2026-0012",
    title: "Office furniture refresh",
    description:
      "Replace worn task chairs and desks in the finance and marketing areas. Twenty-four ergonomic chairs and eight height-adjustable desks.",
    category: "Office Supplies",
    department: "fac",
    requester: "laura",
    budget: 14800,
    priority: "LOW",
    requiredIn: 60,
    createdDaysAgo: 6,
    submittedDaysAgo: 4,
    status: "SUBMITTED",
    items: [
      { description: "Ergonomic task chairs", quantity: 24, unit: "unit", unitPrice: 420 },
      { description: "Height-adjustable desks", quantity: 8, unit: "unit", unitPrice: 590 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "PENDING",
        activatedAt: ago(4, 9),
      },
    ],
  },
  {
    reference: "PR-2026-0013",
    title: "Cybersecurity penetration test",
    description:
      "Commission an external penetration test of the customer portal and internal network, followed by a remediation review. Required for the annual cyber insurance renewal.",
    category: "Professional Services",
    department: "it",
    requester: "maya",
    budget: 26000,
    priority: "HIGH",
    requiredIn: 21,
    createdDaysAgo: 5,
    submittedDaysAgo: 3,
    status: "SUBMITTED",
    items: [
      { description: "External penetration test — portal and network", quantity: 1, unit: "lot", unitPrice: 18000 },
      { description: "Remediation review and retest", quantity: 1, unit: "lot", unitPrice: 8000 },
    ],
    steps: [
      {
        level: 1,
        approver: "marcus",
        status: "PENDING",
        activatedAt: ago(3, 11),
      },
      {
        level: 2,
        approver: "olivia",
        status: "WAITING",
      },
    ],
  },
  {
    reference: "PR-2026-0014",
    title: "Packaging redesign project",
    description:
      "Refresh primary and secondary packaging across the flagship product range to reduce material use and align with the new brand system.",
    category: "Marketing Services",
    department: "mkt",
    requester: "owen",
    budget: 29500,
    priority: "MEDIUM",
    requiredIn: 50,
    createdDaysAgo: 13,
    submittedDaysAgo: 12,
    status: "REJECTED",
    rejectionReason:
      "Budget is already committed for Q4. Revisit in January with a scoped-down option that covers the top three SKUs only.",
    items: [
      { description: "Packaging design and brand application", quantity: 1, unit: "lot", unitPrice: 16500 },
      { description: "Prototype production", quantity: 1, unit: "lot", unitPrice: 9800 },
      { description: "Product photography", quantity: 1, unit: "lot", unitPrice: 3200 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "REJECTED",
        activatedAt: ago(12, 9),
        decidedAt: ago(7, 15),
      },
      {
        level: 2,
        approver: "ethan",
        status: "SKIPPED",
      },
    ],
    actions: [
      {
        level: 1,
        actor: "olivia",
        action: "REJECT",
        comment:
          "Budget is already committed for Q4. Revisit in January with a scoped-down option that covers the top three SKUs only.",
        at: ago(7, 15),
      },
    ],
  },
  {
    reference: "PR-2026-0015",
    title: "Warehouse Wi-Fi upgrade",
    description:
      "Upgrade wireless coverage across the warehouse floor to support handheld scanners and new inventory devices. Fourteen access points plus cabling.",
    category: "IT Infrastructure",
    department: "it",
    requester: "maya",
    budget: 19750,
    priority: "MEDIUM",
    requiredIn: 45,
    createdDaysAgo: 16,
    submittedDaysAgo: 14,
    status: "CANCELLED",
    cancellationReason: "Project deferred to the next fiscal year; the capital budget was reallocated to the data centre cooling upgrade.",
    items: [
      { description: "Warehouse access points — Wi-Fi 6E", quantity: 14, unit: "unit", unitPrice: 850 },
      { description: "Cabling and containment", quantity: 1, unit: "lot", unitPrice: 5600 },
      { description: "Installation and survey", quantity: 1, unit: "lot", unitPrice: 2250 },
    ],
    steps: [
      {
        level: 1,
        approver: "marcus",
        status: "SKIPPED",
        activatedAt: ago(14, 11),
      },
    ],
    actions: [
      {
        actor: "maya",
        action: "CANCEL",
        comment: "Project deferred to the next fiscal year; the capital budget was reallocated to the data centre cooling upgrade.",
        at: ago(9, 10),
      },
    ],
  },
  {
    reference: "PR-2026-0016",
    title: "Executive travel management platform",
    description:
      "Evaluate a managed travel platform for booking, policy enforcement and expense reconciliation for the executive team and frequent travellers.",
    category: "Software",
    department: "fin",
    requester: "sofia",
    budget: 21000,
    priority: "LOW",
    requiredIn: 120,
    createdDaysAgo: 4,
    status: "DRAFT",
    items: [{ description: "Travel management platform — annual subscription", quantity: 1, unit: "year", unitPrice: 21000 }],
  },
  {
    reference: "PR-2026-0017",
    title: "Spare parts inventory replenishment",
    description:
      "Replenish critical spares for the fabrication line to reduce unplanned downtime. Order quantities are based on the last twelve months of consumption.",
    category: "Industrial Supplies",
    department: "ops",
    requester: "daniel",
    budget: 47300,
    priority: "HIGH",
    requiredIn: 18,
    createdDaysAgo: 2,
    status: "DRAFT",
    items: [
      { description: "Spindle bearings", quantity: 60, unit: "unit", unitPrice: 320 },
      { description: "Seal kits", quantity: 40, unit: "unit", unitPrice: 410 },
      { description: "Servo motors", quantity: 6, unit: "unit", unitPrice: 1950 },
    ],
  },
  {
    reference: "PR-2026-0018",
    title: "Sales team CRM licence renewal",
    description:
      "Renew CRM licences for the sales team and extend the implementation support agreement for another year.",
    category: "Software",
    department: "mkt",
    requester: "owen",
    budget: 41000,
    priority: "HIGH",
    requiredIn: -80,
    createdDaysAgo: 150,
    submittedDaysAgo: 148,
    approvedDaysAgo: 142,
    completedDaysAgo: 80,
    status: "COMPLETED",
    items: [
      { description: "CRM licences — 45 seats, annual", quantity: 45, unit: "seat", unitPrice: 700 },
      { description: "Implementation support agreement", quantity: 1, unit: "year", unitPrice: 6500 },
    ],
    steps: [
      {
        level: 1,
        approver: "olivia",
        status: "APPROVED",
        activatedAt: ago(148, 10),
        decidedAt: ago(143, 15),
      },
      {
        level: 2,
        approver: "ethan",
        status: "APPROVED",
        activatedAt: ago(143, 15, 10),
        decidedAt: ago(142, 9),
      },
    ],
    actions: [
      {
        level: 1,
        actor: "olivia",
        action: "APPROVE",
        comment: "Approved on the multi-year pricing held by the incumbent.",
        at: ago(143, 15),
      },
      {
        level: 2,
        actor: "ethan",
        action: "APPROVE",
        comment: "Within the sales opex line.",
        at: ago(142, 9),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

type QuoteSeed = {
  requestRef: string;
  vendor: string;
  quoteNumber: string;
  status: QuoteStatusKey;
  items: { description: string; quantity: number; unitPrice: number }[];
  tax: number;
  charges: number;
  deliveryDays: number | null;
  paymentTerms: string | null;
  warrantyMonths: number | null;
  createdDaysAgo: number;
  validityIn: number;
  source: ExtractionKey;
  notes?: string;
  selectedDaysAgo?: number;
  ai?: {
    fileName: string;
    status: "EXTRACTED" | "FAILED";
    confidence?: number;
    missing?: string[];
    error?: string;
    scanned?: boolean;
  };
};

const quotationsSeed: QuoteSeed[] = [
  // PR-2026-0001 — hydraulic press
  {
    requestRef: "PR-2026-0001",
    vendor: "meridian",
    quoteNumber: "MIS-2026-0417",
    status: "SELECTED",
    items: [
      { description: "Hydraulic press refurbishment — 400 ton (labour and parts)", quantity: 1, unitPrice: 168000 },
      { description: "CNC controller retrofit", quantity: 1, unitPrice: 12500 },
    ],
    tax: 9025,
    charges: 2400,
    deliveryDays: 42,
    paymentTerms: "Net 30",
    warrantyMonths: 24,
    createdDaysAgo: 60,
    validityIn: 30,
    source: "AI",
    selectedDaysAgo: 55,
    notes: "Includes rigging, commissioning and operator training.",
    ai: { fileName: "meridian-quotation-MIS-2026-0417.pdf", status: "EXTRACTED", confidence: 92, missing: [] },
  },
  {
    requestRef: "PR-2026-0001",
    vendor: "apex",
    quoteNumber: "APX-Q-8821",
    status: "NOT_SELECTED",
    items: [
      { description: "Press refurbishment package — 400 ton", quantity: 1, unitPrice: 176000 },
      { description: "Installation and commissioning", quantity: 1, unitPrice: 6800 },
    ],
    tax: 9140,
    charges: 3200,
    deliveryDays: 35,
    paymentTerms: "Net 15",
    warrantyMonths: null,
    createdDaysAgo: 59,
    validityIn: 30,
    source: "AI",
    notes: "Warranty not stated in the quotation — confirm before award.",
    ai: {
      fileName: "apex-quotation-APX-Q-8821.pdf",
      status: "EXTRACTED",
      confidence: 84,
      missing: ["Warranty"],
    },
  },
  {
    requestRef: "PR-2026-0001",
    vendor: "northstar",
    quoteNumber: "NSF-1140",
    status: "NOT_SELECTED",
    items: [{ description: "Hydraulic press overhaul — full strip and rebuild", quantity: 1, unitPrice: 189000 }],
    tax: 0,
    charges: 0,
    deliveryDays: 28,
    paymentTerms: "50% prepaid, 50% on delivery",
    warrantyMonths: 12,
    createdDaysAgo: 58,
    validityIn: 21,
    source: "MANUAL",
    notes: "Verbal quotation confirmed by email; no itemised tax.",
  },

  // PR-2026-0002 — laptop refresh
  {
    requestRef: "PR-2026-0002",
    vendor: "lumen",
    quoteNumber: "LIT-2026-2291",
    status: "SELECTED",
    items: [
      { description: "ThinkPad T14 Gen 5 — Ultra 7, 32GB, 1TB", quantity: 40, unitPrice: 1720 },
      { description: "USB-C docking station", quantity: 40, unitPrice: 180 },
    ],
    tax: 6080,
    charges: 600,
    deliveryDays: 21,
    paymentTerms: "Net 30",
    warrantyMonths: 36,
    createdDaysAgo: 62,
    validityIn: 30,
    source: "AI",
    selectedDaysAgo: 40,
    notes: "Includes imaging, asset tagging and delivery to two sites.",
    ai: {
      fileName: "lumen-quotation-LIT-2026-2291.pdf",
      status: "EXTRACTED",
      confidence: 94,
      missing: [],
    },
  },
  {
    requestRef: "PR-2026-0002",
    vendor: "cortex",
    quoteNumber: "CS-LAP-7712",
    status: "NOT_SELECTED",
    items: [
      { description: "Latitude 5450 — Ultra 7, 32GB, 1TB", quantity: 40, unitPrice: 1795 },
      { description: "USB-C dock", quantity: 40, unitPrice: 195 },
    ],
    tax: 6368,
    charges: 0,
    deliveryDays: 18,
    paymentTerms: "Net 45",
    warrantyMonths: 36,
    createdDaysAgo: 61,
    validityIn: 30,
    source: "AI",
    notes: "Fastest delivery, but imaging is billed separately.",
    ai: {
      fileName: "cortex-quotation-CS-LAP-7712.pdf",
      status: "EXTRACTED",
      confidence: 87,
      missing: [],
    },
  },
  {
    requestRef: "PR-2026-0002",
    vendor: "bluepeak",
    quoteNumber: "BPN-4482",
    status: "NOT_SELECTED",
    items: [
      { description: "Managed laptop bundle with imaging and 3-year support", quantity: 40, unitPrice: 2010 },
    ],
    tax: 6432,
    charges: 0,
    deliveryDays: 30,
    paymentTerms: "Net 30",
    warrantyMonths: 36,
    createdDaysAgo: 60,
    validityIn: 30,
    source: "MANUAL",
    notes: "Includes managed support but no docking stations in the quoted price.",
  },

  // PR-2026-0003 — HVAC
  {
    requestRef: "PR-2026-0003",
    vendor: "horizon",
    quoteNumber: "HFC-2026-0912",
    status: "SELECTED",
    items: [
      { description: "Quarterly HVAC maintenance — 12 visits", quantity: 12, unitPrice: 2850 },
      { description: "Emergency call-out allowance", quantity: 1, unitPrice: 4800 },
    ],
    tax: 3120,
    charges: 0,
    deliveryDays: 7,
    paymentTerms: "Net 30",
    warrantyMonths: 12,
    createdDaysAgo: 68,
    validityIn: 45,
    source: "MANUAL",
    selectedDaysAgo: 30,
    notes: "Four-hour emergency response SLA included.",
  },
  {
    requestRef: "PR-2026-0003",
    vendor: "vertex",
    quoteNumber: "VBS-HVAC-331",
    status: "NOT_SELECTED",
    items: [{ description: "HVAC service plan — annual, two sites", quantity: 1, unitPrice: 44500 }],
    tax: 3560,
    charges: 0,
    deliveryDays: 14,
    paymentTerms: "Net 30",
    warrantyMonths: 6,
    createdDaysAgo: 67,
    validityIn: 30,
    source: "MANUAL",
    notes: "No emergency response commitment in the proposal.",
  },

  // PR-2026-0004 — warehouse racking (live sourcing)
  {
    requestRef: "PR-2026-0004",
    vendor: "meridian",
    quoteNumber: "MIS-2026-0488",
    status: "UNDER_REVIEW",
    items: [
      { description: "Pallet racking bays — 3300mm uprights", quantity: 48, unitPrice: 780 },
      { description: "Beam sets", quantity: 96, unitPrice: 165 },
      { description: "Installation crew — two weekends", quantity: 1, unitPrice: 6400 },
    ],
    tax: 4774.4,
    charges: 0,
    deliveryDays: 35,
    paymentTerms: "Net 30",
    warrantyMonths: 24,
    createdDaysAgo: 19,
    validityIn: 45,
    source: "AI",
    ai: {
      fileName: "meridian-quotation-MIS-2026-0488.pdf",
      status: "EXTRACTED",
      confidence: 88,
      missing: [],
    },
  },
  {
    requestRef: "PR-2026-0004",
    vendor: "apex",
    quoteNumber: "APX-Q-8904",
    status: "RECEIVED",
    items: [
      { description: "Racking supply and installation", quantity: 1, unitPrice: 67200 },
    ],
    tax: 5376,
    charges: 0,
    deliveryDays: 28,
    paymentTerms: "Net 15",
    warrantyMonths: 12,
    createdDaysAgo: 18,
    validityIn: 30,
    source: "MANUAL",
    notes:
      "The source PDF is a scan without selectable text. Values were entered manually and the original document was kept.",
    ai: {
      fileName: "apex-racking-quotation-scan.pdf",
      status: "FAILED",
      scanned: true,
      error:
        "No selectable text found. This looks like a scanned PDF — enter the quotation manually and keep the original document attached.",
    },
  },
  {
    requestRef: "PR-2026-0004",
    vendor: "northstar",
    quoteNumber: "NSF-1188",
    status: "RECEIVED",
    items: [{ description: "Warehouse racking package — supply and install", quantity: 1, unitPrice: 61900 }],
    tax: 4952,
    charges: 0,
    deliveryDays: 45,
    paymentTerms: "Net 45",
    warrantyMonths: 18,
    createdDaysAgo: 17,
    validityIn: 30,
    source: "MANUAL",
  },

  // PR-2026-0005 — ERP
  {
    requestRef: "PR-2026-0005",
    vendor: "quantum",
    quoteNumber: "QSL-ERP-2210",
    status: "UNDER_REVIEW",
    items: [
      { description: "ERP implementation — discovery, configuration and migration", quantity: 1, unitPrice: 96000 },
      { description: "Training and change management", quantity: 1, unitPrice: 14500 },
    ],
    tax: 8840,
    charges: 0,
    deliveryDays: 120,
    paymentTerms: "Net 30",
    warrantyMonths: 12,
    createdDaysAgo: 34,
    validityIn: 60,
    source: "MANUAL",
    notes: "Fixed-fee implementation with 90 days of post-go-live support.",
  },
  {
    requestRef: "PR-2026-0005",
    vendor: "cortex",
    quoteNumber: "CS-ERP-1180",
    status: "UNDER_REVIEW",
    items: [
      { description: "ERP rollout — finance and procurement modules", quantity: 1, unitPrice: 108000 },
    ],
    tax: 8640,
    charges: 0,
    deliveryDays: 150,
    paymentTerms: "Net 45",
    warrantyMonths: 24,
    createdDaysAgo: 33,
    validityIn: 60,
    source: "MANUAL",
    notes: "Longer timeline but includes 24 months of support.",
  },

  // PR-2026-0006 — marketing automation
  {
    requestRef: "PR-2026-0006",
    vendor: "quantum",
    quoteNumber: "QSL-MKT-0917",
    status: "RECEIVED",
    items: [
      { description: "Marketing automation platform — annual subscription", quantity: 1, unitPrice: 27600 },
      { description: "Onboarding and CRM integration", quantity: 1, unitPrice: 4900 },
    ],
    tax: 2600,
    charges: 0,
    deliveryDays: 10,
    paymentTerms: "Net 30",
    warrantyMonths: null,
    createdDaysAgo: 16,
    validityIn: 30,
    source: "MANUAL",
  },
  {
    requestRef: "PR-2026-0006",
    vendor: "beacon",
    quoteNumber: "BMS-AUTO-771",
    status: "RECEIVED",
    items: [
      { description: "Campaign studio retainer including automation tooling", quantity: 1, unitPrice: 36000 },
    ],
    tax: 2880,
    charges: 0,
    deliveryDays: 15,
    paymentTerms: "Net 30",
    warrantyMonths: 6,
    createdDaysAgo: 15,
    validityIn: 30,
    source: "MANUAL",
  },

  // PR-2026-0007 — forklift lease
  {
    requestRef: "PR-2026-0007",
    vendor: "pinnacle",
    quoteNumber: "PL-FL-6620",
    status: "RECEIVED",
    items: [
      { description: "Forklift fleet lease — 6 units, 36 months, full maintenance", quantity: 6, unitPrice: 8300 },
    ],
    tax: 3984,
    charges: 0,
    deliveryDays: 20,
    paymentTerms: "Quarterly in advance",
    warrantyMonths: 36,
    createdDaysAgo: 12,
    validityIn: 30,
    source: "MANUAL",
  },

  // PR-2026-0008 — cooling
  {
    requestRef: "PR-2026-0008",
    vendor: "cortex",
    quoteNumber: "CS-COOL-5521",
    status: "UNDER_REVIEW",
    items: [
      { description: "In-row cooling units — 12kW", quantity: 4, unitPrice: 14200 },
      { description: "Installation and commissioning", quantity: 1, unitPrice: 7400 },
    ],
    tax: 5136,
    charges: 0,
    deliveryDays: 40,
    paymentTerms: "Net 30",
    warrantyMonths: 24,
    createdDaysAgo: 9,
    validityIn: 30,
    source: "MANUAL",
  },
  {
    requestRef: "PR-2026-0008",
    vendor: "bluepeak",
    quoteNumber: "BPN-COOL-9032",
    status: "UNDER_REVIEW",
    items: [
      { description: "Cooling upgrade including environmental monitoring", quantity: 1, unitPrice: 73500 },
    ],
    tax: 5880,
    charges: 0,
    deliveryDays: 30,
    paymentTerms: "Net 45",
    warrantyMonths: 24,
    createdDaysAgo: 8,
    validityIn: 30,
    source: "MANUAL",
  },

  // PR-2026-0009 — booth
  {
    requestRef: "PR-2026-0009",
    vendor: "beacon",
    quoteNumber: "BMS-BOOTH-412",
    status: "RECEIVED",
    items: [
      { description: "Booth design and fabrication — 6m × 3m", quantity: 1, unitPrice: 20400 },
    ],
    tax: 1632,
    charges: 0,
    deliveryDays: 25,
    paymentTerms: "Net 30",
    warrantyMonths: null,
    createdDaysAgo: 7,
    validityIn: 30,
    source: "MANUAL",
  },

  // PR-2026-0018 — CRM renewal
  {
    requestRef: "PR-2026-0018",
    vendor: "quantum",
    quoteNumber: "QSL-CRM-0418",
    status: "SELECTED",
    items: [
      { description: "CRM licences — 45 seats, annual", quantity: 45, unitPrice: 590 },
      { description: "Implementation support", quantity: 1, unitPrice: 4200 },
    ],
    tax: 2460,
    charges: 0,
    deliveryDays: 5,
    paymentTerms: "Net 30",
    warrantyMonths: 12,
    createdDaysAgo: 120,
    validityIn: 30,
    source: "MANUAL",
    selectedDaysAgo: 95,
  },
  {
    requestRef: "PR-2026-0018",
    vendor: "cortex",
    quoteNumber: "CS-CRM-2214",
    status: "NOT_SELECTED",
    items: [{ description: "CRM platform — 45 seats, annual", quantity: 45, unitPrice: 720 }],
    tax: 2592,
    charges: 0,
    deliveryDays: 7,
    paymentTerms: "Net 45",
    warrantyMonths: 12,
    createdDaysAgo: 119,
    validityIn: 30,
    source: "MANUAL",
  },
];

// ---------------------------------------------------------------------------
// Contracts and evaluations
// ---------------------------------------------------------------------------

const contractsSeed: {
  vendor: string;
  title: string;
  value: number;
  startDays: number;
  endDays: number;
  renewalDays: number | null;
  status: ContractStatusKey;
  notes?: string;
  document?: { fileName: string; title: string; lines: string[] };
}[] = [
  {
    vendor: "horizon",
    title: "HVAC maintenance service agreement",
    value: 42120,
    startDays: -305,
    endDays: 12,
    renewalDays: 12,
    status: "ACTIVE",
    notes: "Auto-renews unless notice is given 30 days before expiry. Four-hour emergency response SLA.",
    document: {
      fileName: "horizon-hvac-services-agreement.pdf",
      title: "HVAC maintenance service agreement",
      lines: [
        "Parties: Northwind Industrial and Horizon Facilities Co.",
        "Term: 12 months, auto-renewing with 30 days' written notice.",
        "Sites: Cleveland, Columbus and Dayton.",
        "",
        "Services:",
        "Quarterly preventive maintenance across 12 scheduled visits.",
        "Emergency call-out response within four hours.",
        "Filter and consumable replacement included.",
        "",
        "Fees: $42,120 per contract year, invoiced quarterly in arrears.",
        "Warranty: 12 months on workmanship.",
        "Renewal: 12 months unless either party gives notice.",
      ],
    },
  },
  {
    vendor: "lumen",
    title: "Managed laptop lifecycle agreement",
    value: 82680,
    startDays: -330,
    endDays: 48,
    renewalDays: 18,
    status: "ACTIVE",
    notes: "Covers 40 engineering laptops with imaging and 3-year support. Renewal quote requested.",
  },
  {
    vendor: "meridian",
    title: "Hydraulic press service retainer",
    value: 24000,
    startDays: -280,
    endDays: 85,
    renewalDays: 55,
    status: "ACTIVE",
    notes: "Preventive maintenance and priority breakdown support for the fabrication line.",
  },
  {
    vendor: "quantum",
    title: "CRM and sales platform licence",
    value: 33210,
    startDays: -150,
    endDays: 215,
    renewalDays: 185,
    status: "ACTIVE",
    notes: "Annual licence for 45 seats with implementation support.",
  },
  {
    vendor: "pinnacle",
    title: "Regional freight services MSA",
    value: 120000,
    startDays: -750,
    endDays: -20,
    renewalDays: null,
    status: "ACTIVE",
    notes: "Expired without renewal. Operations currently on spot rates — renewal under review with procurement.",
  },
  {
    vendor: "beacon",
    title: "Brand campaign retainer",
    value: 30000,
    startDays: -420,
    endDays: 120,
    renewalDays: 90,
    status: "RENEWED",
    notes: "Renewed for a further 12 months at the same retainer.",
  },
  {
    vendor: "vertex",
    title: "Facilities cleaning services",
    value: 58000,
    startDays: -400,
    endDays: -120,
    renewalDays: null,
    status: "TERMINATED",
    notes: "Terminated for repeated missed SLAs; replaced by Horizon Facilities Co.",
  },
  {
    vendor: "atlas",
    title: "Office supplies framework agreement",
    value: 35000,
    startDays: 30,
    endDays: 395,
    renewalDays: 365,
    status: "DRAFT",
    notes: "Pending legal review. Pricing locked for 12 months from signature.",
  },
];

const evaluationsSeed: {
  vendor: string;
  requestRef?: string;
  quality: number;
  delivery: number;
  compliance: number;
  comment: string;
  daysAgo: number;
}[] = [
  {
    vendor: "meridian",
    requestRef: "PR-2026-0001",
    quality: 92,
    delivery: 94,
    compliance: 95,
    comment: "Refurbishment completed ahead of the shutdown window. Documentation was thorough.",
    daysAgo: 36,
  },
  {
    vendor: "meridian",
    quality: 90,
    delivery: 90,
    compliance: 94,
    comment: "Annual review: responsive account team and consistent priority support.",
    daysAgo: 150,
  },
  {
    vendor: "lumen",
    requestRef: "PR-2026-0002",
    quality: 93,
    delivery: 95,
    compliance: 96,
    comment: "Delivered all 40 devices early with imaging and asset tags verified.",
    daysAgo: 20,
  },
  {
    vendor: "horizon",
    requestRef: "PR-2026-0003",
    quality: 88,
    delivery: 90,
    compliance: 92,
    comment: "SLA met on both emergency call-outs this year.",
    daysAgo: 10,
  },
  {
    vendor: "quantum",
    requestRef: "PR-2026-0018",
    quality: 90,
    delivery: 92,
    compliance: 94,
    comment: "Renewal handled without downtime; support response times improved.",
    daysAgo: 78,
  },
  {
    vendor: "quantum",
    quality: 88,
    delivery: 90,
    compliance: 93,
    comment: "Annual review: solid delivery, pricing uplift within the capped allowance.",
    daysAgo: 200,
  },
  {
    vendor: "apex",
    quality: 78,
    delivery: 74,
    compliance: 85,
    comment: "Annual review: pricing competitive but documentation and warranty terms are inconsistent.",
    daysAgo: 190,
  },
  {
    vendor: "cortex",
    quality: 84,
    delivery: 80,
    compliance: 88,
    comment: "Annual review: reliable hardware supply; implementation timelines slipped twice.",
    daysAgo: 175,
  },
  {
    vendor: "beacon",
    quality: 83,
    delivery: 76,
    compliance: 90,
    comment: "Annual review: strong creative quality, occasional late delivery on print runs.",
    daysAgo: 160,
  },
  {
    vendor: "pinnacle",
    quality: 80,
    delivery: 85,
    compliance: 87,
    comment: "Annual review: dependable freight coverage; contract renewal still unresolved.",
    daysAgo: 140,
  },
];

// ---------------------------------------------------------------------------
// Cross-record logs, collected while seeding and inserted at the end
// ---------------------------------------------------------------------------

type ActivityInsert = Prisma.ActivityCreateManyInput;
type AuditInsert = Prisma.AuditLogCreateManyInput;

let orgId = "";
const activities: ActivityInsert[] = [];
const audits: AuditInsert[] = [];

function logActivity(input: {
  actor: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  action: string;
  summary: string;
  at: Date;
  metadata?: Prisma.InputJsonValue;
}) {
  activities.push({
    orgId,
    actorId: profiles[input.actor].id,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.requestId ?? null,
    action: input.action,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: input.at,
  });
}

function logAudit(input: {
  actor?: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  at: Date;
}) {
  audits.push({
    orgId,
    actorId: input.actor ? profiles[input.actor].id : null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: input.before,
    after: input.after,
    createdAt: input.at,
  });
}

const profiles: Record<string, { id: string; fullName: string; email: string; role: RoleKey }> = {};
const departments: Record<string, { id: string; name: string; code: string }> = {};
const vendors: Record<string, { id: string; name: string }> = {};
const requests: Record<string, { id: string; title: string; reference: string; requesterId: string }> = {};
const stepIds = new Map<string, string>();

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("Resetting demo database…");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, activities, contracts, approval_actions, approval_steps,
      vendor_evaluations, quotation_documents, quotation_items, quotations,
      purchase_request_documents, purchase_request_items, purchase_requests,
      vendors, approval_workflows, departments, sessions, profiles, organisations
    RESTART IDENTITY CASCADE
  `);
  await rm(STORAGE_ROOT, { recursive: true, force: true });
  await mkdir(STORAGE_ROOT, { recursive: true });

  const org = await prisma.organisation.create({
    data: {
      name: "Northwind Industrial",
      slug: ORG_SLUG,
      currency: "USD",
      demoMode: true,
      defaultWeights: DEFAULT_WEIGHTS,
    },
  });
  orgId = org.id;

  for (const dept of departmentsSeed) {
    const created = await prisma.department.create({
      data: { orgId, name: dept.name, code: dept.code, annualBudget: dept.budget },
    });
    departments[dept.key] = { id: created.id, name: created.name, code: created.code };
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const [index, profile] of profilesSeed.entries()) {
    const created = await prisma.profile.create({
      data: {
        orgId,
        email: profile.email,
        passwordHash,
        fullName: profile.fullName,
        title: profile.title,
        role: profile.role,
        departmentId: departments[profile.department].id,
        isActive: true,
        lastLoginAt: ago(index % 4, 8 + index, 15),
      },
    });
    profiles[profile.key] = {
      id: created.id,
      fullName: created.fullName,
      email: created.email,
      role: created.role,
    };
  }

  for (const [deptKey, profileKey] of Object.entries(headsSeed)) {
    await prisma.department.update({
      where: { id: departments[deptKey].id },
      data: { headId: profiles[profileKey].id },
    });
  }

  await prisma.approvalWorkflow.createMany({
    data: [
      {
        orgId,
        name: "Standard purchase",
        minAmount: 0,
        maxAmount: 24999.99,
        levels: 1,
        secondLevelRole: "ADMIN",
        isActive: true,
      },
      {
        orgId,
        name: "Elevated purchase",
        minAmount: 25000,
        maxAmount: 49999.99,
        levels: 2,
        secondLevelRole: "ADMIN",
        isActive: true,
      },
      {
        orgId,
        name: "Major procurement",
        minAmount: 50000,
        maxAmount: null,
        levels: 2,
        secondLevelRole: "ADMIN",
        isActive: true,
      },
    ],
  });

  for (const vendor of vendorsSeed) {
    const created = await prisma.vendor.create({
      data: {
        orgId,
        name: vendor.name,
        contactName: vendor.contactName,
        email: vendor.email,
        phone: vendor.phone,
        category: vendor.category,
        taxId: vendor.taxId,
        status: vendor.status,
        performanceRating: vendor.rating,
        deliveryReliability: vendor.reliability,
        complianceStatus: vendor.compliance,
        notes: vendor.notes,
      },
    });
    vendors[vendor.key] = { id: created.id, name: created.name };
  }

  for (const seed of requestsSeed) {
    const department = departments[seed.department];
    const requester = profiles[seed.requester];

    const created = await prisma.purchaseRequest.create({
      data: {
        reference: seed.reference,
        orgId,
        title: seed.title,
        description: seed.description,
        category: seed.category,
        departmentId: department.id,
        requesterId: requester.id,
        estimatedBudget: seed.budget,
        priority: seed.priority,
        requiredBy: dateOffset(seed.requiredIn),
        status: seed.status,
        rejectionReason: seed.rejectionReason ?? null,
        cancellationReason: seed.cancellationReason ?? null,
        scoringWeights: seed.weights ?? undefined,
        submittedAt: seed.submittedDaysAgo !== undefined ? ago(seed.submittedDaysAgo, 9) : null,
        approvedAt: seed.approvedDaysAgo !== undefined ? ago(seed.approvedDaysAgo, 10) : null,
        completedAt: seed.completedDaysAgo !== undefined ? ago(seed.completedDaysAgo, 16) : null,
        createdAt: ago(seed.createdDaysAgo, 8, 45),
        items: {
          create: seed.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            estimatedUnitPrice: item.unitPrice,
          })),
        },
      },
    });
    requests[seed.reference] = {
      id: created.id,
      title: created.title,
      reference: created.reference,
      requesterId: created.requesterId,
    };

    logActivity({
      actor: seed.requester,
      entityType: "purchase_request",
      entityId: created.id,
      requestId: created.id,
      action: "created",
      summary: `Created purchase request ${seed.reference} in ${department.name}`,
      at: ago(seed.createdDaysAgo, 8, 45),
    });
    logAudit({
      actor: seed.requester,
      entityType: "purchase_request",
      entityId: created.id,
      action: "create",
      after: { title: seed.title, estimatedBudget: seed.budget, status: "DRAFT" },
      at: ago(seed.createdDaysAgo, 8, 45),
    });

    if (seed.submittedDaysAgo !== undefined) {
      const submittedAt = ago(seed.submittedDaysAgo, 9);
      logActivity({
        actor: seed.requester,
        entityType: "purchase_request",
        entityId: created.id,
        requestId: created.id,
        action: "submitted",
        summary: `Submitted ${seed.reference} for approval`,
        at: submittedAt,
      });
      logAudit({
        actor: seed.requester,
        entityType: "purchase_request",
        entityId: created.id,
        action: "submit",
        before: { status: "DRAFT" },
        after: { status: "SUBMITTED" },
        at: submittedAt,
      });
    }

    if (seed.steps) {
      for (const step of seed.steps) {
        const row = await prisma.approvalStep.create({
          data: {
            requestId: created.id,
            level: step.level,
            approverId: profiles[step.approver].id,
            status: step.status,
            activatedAt: step.activatedAt ?? null,
            decidedAt: step.decidedAt ?? null,
          },
        });
        stepIds.set(`${seed.reference}:${step.level}`, row.id);
      }
    }

    if (seed.actions) {
      for (const action of seed.actions) {
        await prisma.approvalAction.create({
          data: {
            requestId: created.id,
            stepId: action.level ? (stepIds.get(`${seed.reference}:${action.level}`) ?? null) : null,
            actorId: profiles[action.actor].id,
            action: action.action,
            comment: action.comment ?? null,
            createdAt: action.at,
          },
        });

        const actionVerb =
          action.action === "APPROVE"
            ? "approved"
            : action.action === "REJECT"
              ? "rejected"
              : action.action === "REQUEST_CLARIFICATION"
                ? "requested clarification on"
                : action.action === "CANCEL"
                  ? "cancelled"
                  : action.action === "RESUBMIT"
                    ? "resubmitted"
                    : "commented on";
        logActivity({
          actor: action.actor,
          entityType: "purchase_request",
          entityId: created.id,
          requestId: created.id,
          action: action.action.toLowerCase(),
          summary:
            action.summary ??
            `${profiles[action.actor].fullName} ${actionVerb} ${seed.reference}${action.level ? ` (level ${action.level})` : ""}`,
          at: action.at,
        });
        if (action.action !== "COMMENT") {
          logAudit({
            actor: action.actor,
            entityType: "purchase_request",
            entityId: created.id,
            action: action.action.toLowerCase(),
            after: { level: action.level ?? null, comment: action.comment ?? null },
            at: action.at,
          });
        }
      }
    }

    if (seed.status === "SOURCING" || seed.status === "COMPLETED") {
      const sourcingAt = seed.approvedDaysAgo !== undefined ? ago(seed.approvedDaysAgo, 16) : ago(20, 16);
      logActivity({
        actor: "priya",
        entityType: "purchase_request",
        entityId: created.id,
        requestId: created.id,
        action: "sourcing",
        summary: `Started sourcing for ${seed.reference}`,
        at: sourcingAt,
      });
    }

    if (seed.status === "COMPLETED" && seed.completedDaysAgo !== undefined) {
      logActivity({
        actor: "priya",
        entityType: "purchase_request",
        entityId: created.id,
        requestId: created.id,
        action: "completed",
        summary: `Completed ${seed.reference}`,
        at: ago(seed.completedDaysAgo, 16),
      });
      logAudit({
        actor: "priya",
        entityType: "purchase_request",
        entityId: created.id,
        action: "complete",
        before: { status: "SOURCING" },
        after: { status: "COMPLETED" },
        at: ago(seed.completedDaysAgo, 16),
      });
    }

    if (seed.documents) {
      for (const doc of seed.documents) {
        const { bytes } = await renderPdf(doc.title, doc.lines);
        const key = storageKey(orgId, "requests", created.id, doc.fileName);
        const size = await storeFile(key, bytes);
        await prisma.requestDocument.create({
          data: {
            requestId: created.id,
            fileName: doc.fileName,
            storageKey: key,
            mimeType: "application/pdf",
            sizeBytes: size,
            uploadedById: profiles[seed.requester].id,
            createdAt: ago(seed.createdDaysAgo, 9, 20),
          },
        });
      }
    }
  }

  // Quotations -------------------------------------------------------------
  for (const seed of quotationsSeed) {
    const request = requests[seed.requestRef];
    const vendor = vendors[seed.vendor];
    if (!request || !vendor) throw new Error(`Missing request/vendor for ${seed.requestRef}/${seed.vendor}`);

    const subtotal = Math.round(seed.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100;
    const totalAmount = Math.round((subtotal + seed.tax + seed.charges) * 100) / 100;
    const createdAt = ago(seed.createdDaysAgo, 12, 10);

    let extractedData: Prisma.InputJsonValue | undefined;
    if (seed.ai?.status === "EXTRACTED") {
      const confidence = seed.ai.confidence ?? 88;
      extractedData = {
        provider: "demo-seed",
        extractedAt: createdAt.toISOString(),
        documentName: seed.ai.fileName,
        vendorName: vendor.name,
        productDescription: seed.notes ?? seed.items[0].description,
        deliveryTimeline: seed.deliveryDays ? `${seed.deliveryDays} days from purchase order` : null,
        notes: null,
        currency: "USD",
        items: seed.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
        confidence: {
          vendor_name: 0.97,
          product_description: 0.93,
          unit_price: confidence / 100,
          quantity: 0.96,
          total_amount: Math.max(0.7, (confidence - 3) / 100),
          tax_amount: 0.9,
          delivery_days: seed.deliveryDays ? 0.92 : 0,
          payment_terms: seed.paymentTerms ? 0.94 : 0,
          warranty_months: seed.warrantyMonths !== null ? 0.88 : 0,
          validity_date: 0.91,
          additional_charges: seed.charges > 0 ? 0.9 : 0,
        },
        missingFields: seed.ai.missing ?? [],
        warnings: [
          "Pre-extracted for the demo dataset. Re-run extraction with a configured AI provider to test live extraction.",
        ],
      };
    }

    const quotation = await prisma.quotation.create({
      data: {
        orgId,
        requestId: request.id,
        vendorId: vendor.id,
        status: seed.status,
        currency: "USD",
        subtotal,
        taxAmount: seed.tax,
        additionalCharges: seed.charges,
        totalAmount,
        deliveryDays: seed.deliveryDays,
        paymentTerms: seed.paymentTerms,
        warrantyMonths: seed.warrantyMonths,
        validityDate: dateOffset(seed.validityIn),
        notes: seed.notes ?? null,
        extractionSource: seed.source,
        extractionConfidence: seed.ai?.status === "EXTRACTED" ? (seed.ai.confidence ?? 88) : null,
        extractionModel: seed.ai?.status === "EXTRACTED" ? "Demo seed · pre-extracted" : null,
        extractedData,
        createdAt,
        items: {
          create: seed.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    logActivity({
      actor: "priya",
      entityType: "quotation",
      entityId: quotation.id,
      requestId: request.id,
      action: "quotation_added",
      summary: `Recorded ${seed.source === "MANUAL" ? "a manual" : "an AI-extracted"} quotation from ${vendor.name} for ${seed.requestRef}`,
      at: createdAt,
    });

    if (seed.ai) {
      let bytes: Buffer;
      let text: string | null = null;
      if (seed.ai.scanned) {
        bytes = await renderScannedPdf();
      } else {
        const doc = await renderPdf("QUOTATION", [
          vendor.name,
          `${seed.quoteNumber} · ${isoDay(createdAt)}`,
          "Prepared for: Northwind Industrial",
          "",
          "Items:",
          ...seed.items.map(
            (item, index) =>
              `${index + 1}. ${item.description} — ${item.quantity} × ${money(item.unitPrice)} = ${money(item.quantity * item.unitPrice)}`,
          ),
          "",
          `Subtotal: ${money(subtotal)}`,
          `Sales tax: ${money(seed.tax)}`,
          `Additional charges: ${money(seed.charges)}`,
          `Total: ${money(totalAmount)}`,
          "",
          `Delivery: ${seed.deliveryDays ?? "Not stated"}${seed.deliveryDays ? " days from purchase order" : ""}`,
          `Payment terms: ${seed.paymentTerms ?? "Not stated"}`,
          `Warranty: ${seed.warrantyMonths !== null ? `${seed.warrantyMonths} months parts and labour` : "Not stated"}`,
          "Validity: 30 days from issue date",
          "",
          seed.notes ?? "",
        ]);
        bytes = doc.bytes;
        text = doc.text;
      }

      const key = storageKey(orgId, "quotations", quotation.id, seed.ai.fileName);
      const size = await storeFile(key, bytes);
      const failed = seed.ai.status === "FAILED";
      const document = await prisma.quotationDocument.create({
        data: {
          quotationId: quotation.id,
          fileName: seed.ai.fileName,
          storageKey: key,
          mimeType: "application/pdf",
          sizeBytes: size,
          uploadedById: profiles.priya.id,
          extractedText: failed ? null : text?.slice(0, 300_000) ?? null,
          extractionStatus: seed.ai.status,
          extractionError: failed ? (seed.ai.error ?? "Extraction failed.") : null,
          createdAt: ago(seed.createdDaysAgo, 12, 20),
        },
      });

      logActivity({
        actor: "priya",
        entityType: "quotation",
        entityId: quotation.id,
        requestId: request.id,
        action: failed ? "extraction_failed" : "quotation_extracted",
        summary: failed
          ? `Extraction failed for ${seed.ai.fileName}. The original document was kept and values were entered manually.`
          : `Extracted ${seed.ai.fileName} for ${vendor.name} (${seed.ai.confidence ?? 88}% confidence)`,
        at: ago(seed.createdDaysAgo, 12, 25),
        metadata: failed ? undefined : { confidence: seed.ai.confidence ?? 88, missing: seed.ai.missing ?? [] },
      });
      logAudit({
        actor: "priya",
        entityType: "quotation_document",
        entityId: document.id,
        action: failed ? "extract_failed" : "extract",
        after: failed
          ? { fileName: seed.ai.fileName, status: "FAILED" }
          : {
              fileName: seed.ai.fileName,
              status: "EXTRACTED",
              confidence: seed.ai.confidence ?? 88,
              missingFields: seed.ai.missing ?? [],
            },
        at: ago(seed.createdDaysAgo, 12, 25),
      });
    }

    if (seed.status === "SELECTED") {
      await prisma.purchaseRequest.update({
        where: { id: request.id },
        data: { recommendedVendorId: vendor.id },
      });
      const selectedAt = ago(seed.selectedDaysAgo ?? Math.max(1, seed.createdDaysAgo - 5), 15);
      logActivity({
        actor: "priya",
        entityType: "quotation",
        entityId: quotation.id,
        requestId: request.id,
        action: "vendor_selected",
        summary: `Selected ${vendor.name} for ${seed.requestRef}`,
        at: selectedAt,
      });
      logAudit({
        actor: "priya",
        entityType: "quotation",
        entityId: quotation.id,
        action: "select",
        after: { vendor: vendor.name, requestReference: seed.requestRef },
        at: selectedAt,
      });
    }
  }

  // Evaluations ------------------------------------------------------------
  for (const [index, evaluation] of evaluationsSeed.entries()) {
    const vendor = vendors[evaluation.vendor];
    await prisma.vendorEvaluation.create({
      data: {
        orgId,
        vendorId: vendor.id,
        requestId: evaluation.requestRef ? requests[evaluation.requestRef].id : null,
        evaluatorId: profiles[index % 2 === 0 ? "priya" : "hana"].id,
        qualityScore: evaluation.quality,
        deliveryScore: evaluation.delivery,
        complianceScore: evaluation.compliance,
        comment: evaluation.comment,
        createdAt: ago(evaluation.daysAgo, 14, 30),
      },
    });
  }

  const grouped = await prisma.vendorEvaluation.groupBy({
    by: ["vendorId"],
    _avg: { qualityScore: true, deliveryScore: true },
  });
  for (const row of grouped) {
    await prisma.vendor.update({
      where: { id: row.vendorId },
      data: {
        performanceRating: row._avg.qualityScore !== null ? Math.round(row._avg.qualityScore) : null,
        deliveryReliability: row._avg.deliveryScore !== null ? Math.round(row._avg.deliveryScore) : null,
      },
    });
  }

  // Contracts --------------------------------------------------------------
  for (const seed of contractsSeed) {
    const contract = await prisma.contract.create({
      data: {
        orgId,
        vendorId: vendors[seed.vendor].id,
        ownerId: profiles.priya.id,
        title: seed.title,
        value: seed.value,
        startDate: dateOffset(seed.startDays),
        endDate: dateOffset(seed.endDays),
        renewalDate: seed.renewalDays !== null ? dateOffset(seed.renewalDays) : null,
        status: seed.status,
        notes: seed.notes ?? null,
        createdAt: ago(Math.max(1, Math.abs(seed.startDays) - 5), 11),
      },
    });

    if (seed.document) {
      const { bytes } = await renderPdf(seed.document.title, seed.document.lines);
      const key = storageKey(orgId, "contracts", contract.id, seed.document.fileName);
      const size = await storeFile(key, bytes);
      await prisma.contract.update({
        where: { id: contract.id },
        data: { documentKey: key, documentName: seed.document.fileName },
      });
      audits.push({
        orgId,
        actorId: profiles.priya.id,
        entityType: "contract",
        entityId: contract.id,
        action: "attach_document",
        after: { fileName: seed.document.fileName, sizeBytes: size },
        createdAt: ago(15, 10),
      });
    }

    logActivity({
      actor: "priya",
      entityType: "contract",
      entityId: contract.id,
      action: "created",
      summary: `Registered contract "${seed.title}" with ${vendors[seed.vendor].name}`,
      at: ago(Math.max(1, Math.abs(seed.startDays) - 5), 11),
    });
    logAudit({
      actor: "priya",
      entityType: "contract",
      entityId: contract.id,
      action: "create",
      after: {
        title: seed.title,
        value: seed.value,
        vendor: vendors[seed.vendor].name,
        endDate: isoDay(dateOffset(seed.endDays)),
      },
      at: ago(Math.max(1, Math.abs(seed.startDays) - 5), 11),
    });
  }

  // Administrative audit entries ------------------------------------------
  const adminAudits: AuditInsert[] = [
    {
      orgId,
      actorId: profiles.olivia.id,
      entityType: "approval_workflow",
      entityId: "seed-policy-update",
      action: "update",
      before: { elevated: 30000 },
      after: { elevated: 25000 },
      createdAt: ago(180, 11),
    },
    {
      orgId,
      actorId: profiles.priya.id,
      entityType: "organisation",
      entityId: orgId,
      action: "update_weights",
      before: { price: 40, delivery: 20, quality: 20, reliability: 10, payment: 10 },
      after: DEFAULT_WEIGHTS,
      createdAt: ago(165, 9),
    },
    {
      orgId,
      actorId: profiles.olivia.id,
      entityType: "profile",
      entityId: profiles.marcus.id,
      action: "create",
      after: { email: profiles.marcus.email, role: "APPROVER", department: "Information Technology" },
      createdAt: ago(140, 10),
    },
    {
      orgId,
      actorId: profiles.olivia.id,
      entityType: "profile",
      entityId: profiles.hana.id,
      action: "update",
      before: { role: "APPROVER" },
      after: { role: "PROCUREMENT_MANAGER" },
      createdAt: ago(120, 14),
    },
    {
      orgId,
      actorId: profiles.priya.id,
      entityType: "vendor",
      entityId: vendors.ironclad.id,
      action: "compliance_flag",
      before: { complianceStatus: "COMPLIANT" },
      after: { complianceStatus: "NON_COMPLIANT", reason: "Liability insurance expired" },
      createdAt: ago(45, 8),
    },
    {
      orgId,
      actorId: profiles.priya.id,
      entityType: "vendor",
      entityId: vendors.somerville.id,
      action: "deactivate",
      before: { status: "ACTIVE" },
      after: { status: "INACTIVE", reason: "Repeated SLA failures" },
      createdAt: ago(210, 16),
    },
  ];
  audits.push(...adminAudits);

  await prisma.activity.createMany({ data: activities });
  await prisma.auditLog.createMany({ data: audits });

  const [requestCount, quoteCount, vendorCount, contractCount, docCount, activityCount, auditCount] =
    await Promise.all([
      prisma.purchaseRequest.count(),
      prisma.quotation.count(),
      prisma.vendor.count(),
      prisma.contract.count(),
      prisma.quotationDocument.count(),
      prisma.activity.count(),
      prisma.auditLog.count(),
    ]);

  console.log("\nOpsLedger demo dataset ready");
  console.log("──────────────────────────────────────────");
  console.log(`  Organisation      Northwind Industrial (${ORG_SLUG})`);
  console.log(`  Departments       ${departmentsSeed.length}`);
  console.log(`  Users             ${profilesSeed.length}`);
  console.log(`  Vendors           ${vendorCount}`);
  console.log(`  Purchase requests ${requestCount}`);
  console.log(`  Quotations        ${quoteCount}`);
  console.log(`  Quote documents   ${docCount}`);
  console.log(`  Contracts         ${contractCount}`);
  console.log(`  Activity entries  ${activityCount}`);
  console.log(`  Audit entries     ${auditCount}`);
  console.log("──────────────────────────────────────────");
  console.log("  Sign in:  admin@opsledger.app");
  console.log("            procurement@opsledger.app");
  console.log("            manager.ops@opsledger.app");
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
