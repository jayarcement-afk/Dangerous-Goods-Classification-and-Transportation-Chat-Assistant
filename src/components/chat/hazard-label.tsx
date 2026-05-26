"use client";

import {
  extractHazardClassFromAssumptions,
  getHazardClassName,
  getHazardClassNumber,
  getHazardLabelImage,
} from "@/lib/hazard-labels";

type HazardLabelProps = {
  assumptions?: string[];
};

export function HazardLabel({ assumptions }: HazardLabelProps) {
  const hazardClass = extractHazardClassFromAssumptions(assumptions);
  const imagePath = getHazardLabelImage(hazardClass);
  const labelName = getHazardClassName(hazardClass);
  const classNum = getHazardClassNumber(hazardClass);

  if (!imagePath) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${imagePath}?v=3`}
        alt={`Hazard Class ${classNum} — ${labelName}`}
        width={64}
        height={64}
        className="h-14 w-14 sm:h-16 sm:w-16"
      />
      <span className="text-[10px] font-semibold leading-tight text-black">
        Class {classNum} - {labelName}
      </span>
    </div>
  );
}
