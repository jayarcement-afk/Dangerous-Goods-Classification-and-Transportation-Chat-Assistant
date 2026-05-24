/** Three-star sparkle cluster (large right, medium top-left, small bottom-left). */
export function SparkleIcon({ className = "h-5 w-6" }: { className?: string }) {
  const star =
    "M12 2.2 13.55 8.75 20.1 10.05 13.55 11.35 12 17.9 10.45 11.35 3.9 10.05 10.45 8.75 12 2.2Z";

  /** Scale about star center (12, 10) then place at cluster position */
  const placed = (x: number, y: number, scale: number) =>
    `translate(${x} ${y}) scale(${scale}) translate(-12 -10)`;

  return (
    <svg className={className} viewBox="0 0 26 22" fill="currentColor" aria-hidden>
      <path d={star} transform={placed(17, 11, 0.88)} />
      <path d={star} transform={placed(9, 7, 0.6)} />
      <path d={star} transform={placed(10, 15, 0.42)} />
    </svg>
  );
}
