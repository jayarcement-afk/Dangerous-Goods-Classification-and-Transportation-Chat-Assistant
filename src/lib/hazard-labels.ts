/**
 * Maps hazard class numbers (from DG responses) to the SVG label images in /public/hazard-labels/.
 */

const CLASS_TO_IMAGE: Record<string, string> = {
  "1": "/hazard-labels/class-1.svg",
  "1.1": "/hazard-labels/class-1.svg",
  "1.2": "/hazard-labels/class-1.svg",
  "1.3": "/hazard-labels/class-1.svg",
  "1.4": "/hazard-labels/class-1.svg",
  "1.5": "/hazard-labels/class-1.svg",
  "1.6": "/hazard-labels/class-1.svg",
  "2": "/hazard-labels/class-2-2.svg",
  "2.1": "/hazard-labels/class-2-1.svg",
  "2.2": "/hazard-labels/class-2-2.svg",
  "2.3": "/hazard-labels/class-2-3.svg",
  "3": "/hazard-labels/class-3.svg",
  "4": "/hazard-labels/class-4-1.svg",
  "4.1": "/hazard-labels/class-4-1.svg",
  "4.2": "/hazard-labels/class-4-2.svg",
  "4.3": "/hazard-labels/class-4-3.svg",
  "5": "/hazard-labels/class-5-1.svg",
  "5.1": "/hazard-labels/class-5-1.svg",
  "5.2": "/hazard-labels/class-5-2.svg",
  "6": "/hazard-labels/class-6.svg",
  "6.1": "/hazard-labels/class-6.svg",
  "6.2": "/hazard-labels/class-6-2.svg",
  "7": "/hazard-labels/class-7.svg",
  "8": "/hazard-labels/class-8.svg",
  "9": "/hazard-labels/class-9.svg",
};

const CLASS_TO_LABEL: Record<string, string> = {
  "1": "Explosives",
  "2": "Gases",
  "2.1": "Gases",
  "2.2": "Gases",
  "2.3": "Gases",
  "3": "Flammable Liquids",
  "4": "Flammable Solids, Spontaneously Combustible, and Dangerous When Wet",
  "4.1": "Flammable Solids, Spontaneously Combustible, and Dangerous When Wet",
  "4.2": "Flammable Solids, Spontaneously Combustible, and Dangerous When Wet",
  "4.3": "Flammable Solids, Spontaneously Combustible, and Dangerous When Wet",
  "5": "Oxidizers and Organic Peroxides",
  "5.1": "Oxidizers and Organic Peroxides",
  "5.2": "Oxidizers and Organic Peroxides",
  "6": "Toxic (Poisonous) and Infectious Substances",
  "6.1": "Toxic (Poisonous) and Infectious Substances",
  "6.2": "Toxic (Poisonous) and Infectious Substances",
  "7": "Radioactive Materials",
  "8": "Corrosive Materials",
  "9": "Miscellaneous Dangerous Goods",
};

function extractClassNumber(hazardClass: string): string | null {
  const cleaned = hazardClass.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/(\d+(?:\.\d)?)/);
  return m?.[1] ?? null;
}

export function getHazardClassNumber(hazardClass: string | undefined | null): string | null {
  if (!hazardClass) return null;
  return extractClassNumber(hazardClass);
}

export function getHazardLabelImage(hazardClass: string | undefined | null): string | null {
  if (!hazardClass) return null;
  const classNum = extractClassNumber(hazardClass);
  if (!classNum) return null;
  return CLASS_TO_IMAGE[classNum] ?? null;
}

export function getHazardClassName(hazardClass: string | undefined | null): string | null {
  if (!hazardClass) return null;
  const classNum = extractClassNumber(hazardClass);
  if (!classNum) return null;
  return CLASS_TO_LABEL[classNum] ?? `Class ${classNum}`;
}

export function extractHazardClassFromAssumptions(assumptions: string[] | undefined): string | null {
  if (!assumptions?.length) return null;
  for (const a of assumptions) {
    const match = a.match(/(?:hazard\s*class|^class)\s*:\s*(.+)/i);
    if (match) return match[1].trim();
  }
  return null;
}
