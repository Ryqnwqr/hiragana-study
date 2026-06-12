type AppMarkProps = {
  size?: number;
  className?: string;
};

export function AppMark({ size = 28, className }: AppMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 180 180"
      aria-hidden="true"
    >
      <rect width="180" height="180" rx="40" fill="#0c0e14" />
      <rect
        x="8"
        y="8"
        width="164"
        height="164"
        rx="34"
        fill="none"
        stroke="#e06b8b"
        strokeWidth="2"
        opacity="0.35"
      />
      <text
        x="90"
        y="122"
        textAnchor="middle"
        fontFamily="var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif"
        fontSize="92"
        fontWeight="300"
        fill="#e06b8b"
      >
        あ
      </text>
    </svg>
  );
}
