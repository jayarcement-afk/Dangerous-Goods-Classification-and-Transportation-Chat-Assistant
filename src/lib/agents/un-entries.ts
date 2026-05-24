/**
 * Common UN dangerous-goods list entries for preliminary identification.
 * Used to pre-fill substance profiles when the user supplies a UN number only.
 * Final regulatory answers still require Orange Book citations.
 */

export type UnEntryLookup = {
  label: string;
  properShippingNames: string[];
  chemicalName?: string;
  hazardClass: string;
  division?: string;
  typicalPackingGroup?: string;
  physicalState: string;
  hazardProperties: string[];
  /** Multiple distinct PSNs share this UN — user must narrow */
  ambiguous?: boolean;
  ambiguityNote?: string;
};

export const UN_ENTRY_LOOKUP: Record<string, UnEntryLookup> = {
  "1202": {
    label: "Diesel fuel / gas oil",
    properShippingNames: ["DIESEL FUEL", "GAS OIL", "HEATING OIL, LIGHT"],
    chemicalName: "Diesel fuel",
    hazardClass: "3",
    typicalPackingGroup: "III",
    physicalState: "Liquid",
    hazardProperties: ["Flammable liquid", "Flash point typically >60°C for diesel fuel"],
  },
  "1203": {
    label: "Gasoline / motor spirit",
    properShippingNames: ["GASOLINE", "MOTOR SPIRIT"],
    chemicalName: "Gasoline",
    hazardClass: "3",
    typicalPackingGroup: "II",
    physicalState: "Liquid",
    hazardProperties: ["Flammable liquid", "Typical flash point well below 23°C"],
  },
  "1170": {
    label: "Ethanol / ethyl alcohol",
    properShippingNames: ["ETHANOL", "ETHANOL SOLUTIONS", "ETHYL ALCOHOL"],
    chemicalName: "Ethanol",
    hazardClass: "3",
    typicalPackingGroup: "II or III depending on concentration",
    physicalState: "Liquid",
    hazardProperties: ["Flammable liquid", "Flash point varies with concentration"],
    ambiguous: true,
    ambiguityNote: "Packing group and PSN depend on concentration (e.g. UN 1170 vs denatured variants).",
  },
  "1090": {
    label: "Acetone",
    properShippingNames: ["ACETONE"],
    chemicalName: "Acetone",
    hazardClass: "3",
    typicalPackingGroup: "II",
    physicalState: "Liquid",
    hazardProperties: ["Flammable liquid", "Flash point approx. -20°C"],
  },
  "1789": {
    label: "Hydrochloric acid",
    properShippingNames: ["HYDROCHLORIC ACID"],
    chemicalName: "Hydrochloric acid",
    hazardClass: "8",
    typicalPackingGroup: "II or III depending on concentration",
    physicalState: "Liquid",
    hazardProperties: ["Corrosive", "pH < 2 typically"],
  },
  "1791": {
    label: "Hypochlorite solution (liquid bleach)",
    properShippingNames: ["HYPOCHLORITE SOLUTION"],
    chemicalName: "Sodium hypochlorite solution",
    hazardClass: "8",
    typicalPackingGroup: "II or III depending on available chlorine content",
    physicalState: "Liquid",
    hazardProperties: [
      "Corrosive",
      "Oxidizing properties",
      "Common trade product: liquid bleach / sodium hypochlorite solution",
    ],
    ambiguous: true,
    ambiguityNote:
      "Packing group II vs III depends on available chlorine content per the dangerous goods list. NOT acetic acid (that is UN 2789).",
  },
  "3212": {
    label: "Hypochlorites, inorganic, n.o.s.",
    properShippingNames: ["HYPOCHLORITES, INORGANIC, N.O.S."],
    chemicalName: "Inorganic hypochlorite (n.o.s.)",
    hazardClass: "5.1",
    typicalPackingGroup: "II or III depending on formulation",
    physicalState: "Solid or liquid",
    hazardProperties: [
      "Oxidizing substance",
      "May intensify fire",
      "Technical name required for n.o.s. entry",
    ],
    ambiguous: true,
    ambiguityNote:
      "n.o.s. entry — identify the specific inorganic hypochlorite (e.g. calcium hypochlorite) on transport documents. NOT hydrogen fluoride (UN 1052 / hydrofluoric acid UN 1790).",
  },
  "1093": {
    label: "Acrylonitrile, stabilized",
    properShippingNames: ["ACRYLONITRILE, STABILIZED"],
    chemicalName: "Acrylonitrile",
    hazardClass: "3",
    division: "6.1",
    typicalPackingGroup: "I",
    physicalState: "Liquid",
    hazardProperties: ["Flammable liquid", "Toxic subsidiary risk", "Classification code FT1"],
  },
  "1083": {
    label: "Trimethylamine, anhydrous",
    properShippingNames: ["TRIMETHYLAMINE, ANHYDROUS"],
    chemicalName: "Trimethylamine",
    hazardClass: "2",
    typicalPackingGroup: "N/A (Class 2 gas)",
    physicalState: "Liquefied gas",
    hazardProperties: ["Flammable gas", "NOT sulfuric acid (UN 1830)"],
  },
  "1052": {
    label: "Hydrogen fluoride, anhydrous",
    properShippingNames: ["HYDROGEN FLUORIDE, ANHYDROUS"],
    chemicalName: "Hydrogen fluoride",
    hazardClass: "8",
    division: "6.1",
    typicalPackingGroup: "N/A (Class 2/8 per entry)",
    physicalState: "Liquefied gas",
    hazardProperties: ["Toxic", "Corrosive", "NOT hypochlorite"],
  },
  "1790": {
    label: "Hydrofluoric acid",
    properShippingNames: ["HYDROFLUORIC ACID"],
    chemicalName: "Hydrofluoric acid",
    hazardClass: "8",
    division: "6.1",
    typicalPackingGroup: "II",
    physicalState: "Liquid",
    hazardProperties: ["Toxic", "Corrosive", "NOT hypochlorite"],
  },
  "2789": {
    label: "Acetic acid, glacial",
    properShippingNames: ["ACETIC ACID, GLACIAL"],
    chemicalName: "Acetic acid",
    hazardClass: "8",
    typicalPackingGroup: "II",
    physicalState: "Liquid",
    hazardProperties: ["Corrosive", "Flammable vapours may be present at elevated temperatures"],
  },
  "1824": {
    label: "Sodium hydroxide solution",
    properShippingNames: ["SODIUM HYDROXIDE SOLUTION"],
    chemicalName: "Sodium hydroxide solution",
    hazardClass: "8",
    typicalPackingGroup: "II or III depending on concentration",
    physicalState: "Liquid",
    hazardProperties: ["Corrosive to metals and tissue", "pH > 11.5 for qualifying solutions"],
  },
  "2794": {
    label: "Batteries, wet, filled with acid",
    properShippingNames: ["BATTERIES, WET, FILLED WITH ACID"],
    hazardClass: "8",
    typicalPackingGroup: "III",
    physicalState: "Solid article",
    hazardProperties: ["Corrosive (acid electrolyte)", "Electric energy hazard when charged"],
  },
  "2796": {
    label: "Batteries, wet, filled with alkali",
    properShippingNames: ["BATTERIES, WET, FILLED WITH ALKALI"],
    hazardClass: "8",
    typicalPackingGroup: "III",
    physicalState: "Solid article",
    hazardProperties: ["Corrosive (alkaline electrolyte)"],
  },
  "3480": {
    label: "Lithium ion batteries",
    properShippingNames: ["LITHIUM ION BATTERIES"],
    hazardClass: "9",
    typicalPackingGroup: "II",
    physicalState: "Solid article",
    hazardProperties: ["Class 9 miscellaneous", "Thermal runaway risk", "Subject to special provisions"],
  },
  "3481": {
    label: "Lithium ion batteries packed with equipment",
    properShippingNames: ["LITHIUM ION BATTERIES PACKED WITH EQUIPMENT"],
    hazardClass: "9",
    typicalPackingGroup: "II",
    physicalState: "Solid article",
    hazardProperties: ["Class 9 miscellaneous", "Packed with equipment configuration"],
  },
  "3090": {
    label: "Lithium metal batteries",
    properShippingNames: ["LITHIUM METAL BATTERIES"],
    hazardClass: "9",
    typicalPackingGroup: "II",
    physicalState: "Solid article",
    hazardProperties: ["Class 9 miscellaneous", "Lithium metal — water reactive hazard"],
  },
  "1072": {
    label: "Oxygen, compressed",
    properShippingNames: ["OXYGEN, COMPRESSED"],
    chemicalName: "Oxygen",
    hazardClass: "2",
    division: "2.2",
    typicalPackingGroup: "N/A (Class 2 gases)",
    physicalState: "Compressed gas",
    hazardProperties: ["Oxidizer", "Supports combustion"],
  },
  "1017": {
    label: "Chlorine",
    properShippingNames: ["CHLORINE"],
    chemicalName: "Chlorine",
    hazardClass: "2",
    division: "2.3",
    typicalPackingGroup: "N/A",
    physicalState: "Liquefied gas",
    hazardProperties: ["Toxic gas", "Oxidizer", "Corrosive"],
  },
  "1005": {
    label: "Ammonia, anhydrous",
    properShippingNames: ["AMMONIA, ANHYDROUS"],
    chemicalName: "Ammonia",
    hazardClass: "2",
    division: "2.3",
    typicalPackingGroup: "N/A",
    physicalState: "Liquefied gas",
    hazardProperties: ["Toxic gas", "Corrosive"],
  },
  "1993": {
    label: "Flammable liquid, n.o.s.",
    properShippingNames: ["FLAMMABLE LIQUID, N.O.S."],
    hazardClass: "3",
    typicalPackingGroup: "II or III depending on flash point",
    physicalState: "Liquid",
    hazardProperties: ["Flammable liquid", "Technical name required on shipping papers"],
    ambiguous: true,
    ambiguityNote:
      "UN 1993 is a generic n.o.s. entry — proper shipping name, technical name, and PG depend on the actual substance and flash point.",
  },
  "3077": {
    label: "Environmentally hazardous substance, solid, n.o.s.",
    properShippingNames: ["ENVIRONMENTALLY HAZARDOUS SUBSTANCE, SOLID, N.O.S."],
    hazardClass: "9",
    typicalPackingGroup: "III",
    physicalState: "Solid",
    hazardProperties: ["Marine pollutant / environmentally hazardous", "Technical name required"],
    ambiguous: true,
    ambiguityNote: "Specific substance identity determines applicability and packing provisions.",
  },
  "3082": {
    label: "Environmentally hazardous substance, liquid, n.o.s.",
    properShippingNames: ["ENVIRONMENTALLY HAZARDOUS SUBSTANCE, LIQUID, N.O.S."],
    hazardClass: "9",
    typicalPackingGroup: "III",
    physicalState: "Liquid",
    hazardProperties: ["Marine pollutant / environmentally hazardous", "Technical name required"],
    ambiguous: true,
    ambiguityNote: "Specific substance identity determines applicability and packing provisions.",
  },
  "2814": {
    label: "Infectious substance, affecting humans",
    properShippingNames: ["INFECTIOUS SUBSTANCE, AFFECTING HUMANS"],
    hazardClass: "6",
    division: "6.2",
    typicalPackingGroup: "N/A",
    physicalState: "Solid or liquid",
    hazardProperties: ["Category A or B infectious substance — category determines packaging"],
    ambiguous: true,
    ambiguityNote: "Category A vs B and substance identity determine packaging and transport requirements.",
  },
};

/**
 * PSN patterns that must NOT be assigned to a given UN (common LLM confusions).
 * UN 1791 is hypochlorite; UN 2789 is acetic acid glacial — models often swap these.
 */
export const INVALID_PSN_PATTERNS_FOR_UN: Record<string, RegExp[]> = {
  "1791": [/acetic\s+acid/i, /glacial/i, /hydrogen\s+fluoride/i, /hydrofluoric/i],
  "2789": [/hypochlorite/i, /\bbleach\b/i, /sodium\s+hypochlorite/i, /hydrogen\s+fluoride/i],
  "1789": [/hypochlorite/i, /acetic\s+acid/i, /hydrogen\s+fluoride/i],
  "3212": [
    /hydrogen\s+fluoride/i,
    /hydrofluoric/i,
    /acetic\s+acid/i,
    /gasoline/i,
    /motor\s+spirit/i,
  ],
  "1083": [/sulfuric\s+acid/i, /hydrofluoric/i, /hypochlorite/i],
  "1093": [/^ABILIZED$/i, /^STABILIZED$/i, /sulfuric\s+acid/i],
  "1830": [/trimethylamine/i, /acrylonitrile/i],
  "1052": [/hypochlorite/i, /\bbleach\b/i],
  "1790": [/hypochlorite/i, /\bbleach\b/i],
};

export function isInvalidPsnForUn(un: string, entry: UnEntryLookup): boolean {
  const patterns = INVALID_PSN_PATTERNS_FOR_UN[un];
  if (!patterns?.length) return false;
  const haystack = [
    entry.label,
    entry.chemicalName ?? "",
    ...entry.properShippingNames,
  ]
    .join(" ")
    .toLowerCase();
  return patterns.some((p) => p.test(haystack));
}

export function getCuratedUnEntry(un: string): UnEntryLookup | undefined {
  return UN_ENTRY_LOOKUP[un];
}

/** True when the user message is mainly a UN number lookup (not a named chemical discussion). */
export function isPrimarilyUnNumberQuery(message: string, _fullContext?: string): boolean {
  const unNumbers = extractUnNumbersFromMessage(message);
  if (unNumbers.length !== 1) return false;

  const withoutUn = message.replace(/\bUN\s*0*\d{4}\b/gi, "").replace(/\s+/g, " ").trim();
  if (withoutUn.length === 0) return true;

  return (
    withoutUn.length < 140 &&
    /\b(what|tell|about|properties|requirements|label|classify|transport|packaging|marking|packing|class|is|for)\b/i.test(
      withoutUn,
    )
  );
}

/** UN numbers in the latest user message only (ignores assistant-listed UNs in history). */
export function extractUnNumbersFromMessage(message: string): string[] {
  return extractUnNumbersFromText(message);
}

export function extractUnNumbersFromText(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bUN\s*0*(\d{4})\b/gi,
    /(?:^|[\s(,;])un\s*0*(\d{4})\b/gi,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) found.push(match[1]);
    }
  }
  return [...new Set(found)];
}
