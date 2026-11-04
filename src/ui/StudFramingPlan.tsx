import type { ReactElement } from 'react';
import { PLATE_THICKNESS, STUD_WIDTH } from '../model/wallFraming';

export interface StudMeasurement {
  readonly name: string;
  readonly ocIn: number;
  readonly widthIn: number;
}

interface Props {
  readonly wallLength: number; // metres
  readonly measurements: StudMeasurement[];
}

// Architectural slash tick at a point on a dimension line
function SlashTick({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <line
      x1={x - 3.5} y1={y + 3.5}
      x2={x + 3.5} y2={y - 3.5}
      stroke="#2a2a2a" strokeWidth={0.9}
    />
  );
}

// Stud-level spacings always stay in inches (never converts to feet).
// Uses fractional notation: 14 1/2", 6 1/2"
function fmtInches(inches: number): string {
  const totalEighths = Math.round(inches * 8);
  const whole = Math.floor(totalEighths / 8);
  const frac = totalEighths % 8;
  if (frac === 0) return `${whole}"`;
  const fracMap: Record<number, string> = {
    1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8',
  };
  return `${whole} ${fracMap[frac]}"`;
}

// Overall wall span uses feet-inches: 9'-10 1/2"
function fmtFtIn(inches: number): string {
  const totalEighths = Math.round(inches * 8);
  const ft = Math.floor(totalEighths / 96);  // 12" × 8 eighths = 96
  const remEighths = totalEighths % 96;
  const whole = Math.floor(remEighths / 8);
  const frac = remEighths % 8;
  const fracMap: Record<number, string> = {
    1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8',
  };
  const inPart = frac === 0 ? `${whole}"` : `${whole} ${fracMap[frac]}"`;
  if (ft === 0) return inPart;
  if (whole === 0 && frac === 0) return `${ft}'`;
  return `${ft}'-${inPart}`;
}

// Label fits horizontally when there is room; otherwise rotates upward.
function DimLabel({ x, lineY, gapPx, label }: {
  x: number; lineY: number; gapPx: number; label: string;
}): ReactElement {
  const minWidth = label.length * 5.5 + 4;
  if (gapPx >= minWidth) {
    return (
      <text
        x={x} y={lineY + 13}
        textAnchor="middle" dominantBaseline="auto"
        fontSize={8} fill="#2a2a2a" fontFamily="'Courier New', monospace"
      >
        {label}
      </text>
    );
  }
  // Rotate -90° so text reads upward from just above the dim line.
  // dominantBaseline="central" centres each glyph on the vertical axis.
  return (
    <text
      transform={`translate(${x}, ${lineY - 5}) rotate(-90)`}
      textAnchor="start" dominantBaseline="central"
      fontSize={8} fill="#2a2a2a" fontFamily="'Courier New', monospace"
    >
      {label}
    </text>
  );
}

export function StudFramingPlan({ wallLength, measurements }: Props): ReactElement {
  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  if (!first || !last || wallLength <= 0) {
    return <p className="panel__empty">Wall too short for framing.</p>;
  }

  // ── Layout constants ───────────────────────────────────────────────────────
  const SVG_W = 460;
  const PAD_L = 40;    // left margin for row labels
  const PAD_R = 12;
  const PAD_T = 26;
  const ELEV_H = 108;
  const DIM_GAP = 40;  // gap from wall bottom → first dim row (room for rotated labels)
  const DIM_ROW = 32;  // height of each dimension row
  const PAD_B = 20;

  const drawW = SVG_W - PAD_L - PAD_R;
  const scale = drawW / wallLength;

  const PLATE_H = Math.max(6, PLATE_THICKNESS * scale);

  const halfStud = STUD_WIDTH / 2 * scale;
  const cx = (ocIn: number): number => PAD_L + halfStud + ocIn * 0.0254 * scale;

  const wallTop = PAD_T;
  const wallBot = PAD_T + ELEV_H;
  const studTop = wallTop + PLATE_H;
  const studBot = wallBot - PLATE_H;

  const ocY      = wallBot + DIM_GAP;         // row 1: O.C.
  const clrY     = ocY + DIM_ROW;             // row 2: clear
  const overallY = clrY + DIM_ROW;            // row 3: total O.C.
  const SVG_H    = overallY + 22 + PAD_B;

  const firstX = cx(first.ocIn);
  const lastX  = cx(last.ocIn);

  const hatchId = 'plate-hatch';

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width: '100%', display: 'block' }}
      aria-label="Wall framing elevation with OC and clear dimensions"
    >
      <defs>
        <pattern
          id={hatchId} width="4" height="4"
          patternUnits="userSpaceOnUse" patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="4" stroke="#888" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* ── Paper background ─────────────────────────────────────────────── */}
      <rect width={SVG_W} height={SVG_H} fill="#f5f3ee" />

      {/* ── Title ────────────────────────────────────────────────────────── */}
      <text
        x={SVG_W - PAD_R} y={PAD_T - 9}
        textAnchor="end" fontSize={7.5} letterSpacing="0.1em"
        fill="#1a1a1a" fontFamily="'Courier New', monospace"
      >
        FRAMING ELEVATION
      </text>

      {/* ── Wall outline ─────────────────────────────────────────────────── */}
      <rect
        x={PAD_L} y={wallTop} width={drawW} height={ELEV_H}
        fill="white" stroke="#1a1a1a" strokeWidth={1}
      />

      {/* ── Top plate ───────────────────────────────────────────────────── */}
      <rect
        x={PAD_L} y={wallTop} width={drawW} height={PLATE_H}
        fill={`url(#${hatchId})`} stroke="#1a1a1a" strokeWidth={0.75}
      />
      <line
        x1={PAD_L} y1={wallTop + PLATE_H}
        x2={PAD_L + drawW} y2={wallTop + PLATE_H}
        stroke="#1a1a1a" strokeWidth={0.5}
      />

      {/* ── Bottom plate ────────────────────────────────────────────────── */}
      <rect
        x={PAD_L} y={wallBot - PLATE_H} width={drawW} height={PLATE_H}
        fill={`url(#${hatchId})`} stroke="#1a1a1a" strokeWidth={0.75}
      />
      <line
        x1={PAD_L} y1={wallBot - PLATE_H}
        x2={PAD_L + drawW} y2={wallBot - PLATE_H}
        stroke="#1a1a1a" strokeWidth={0.5}
      />

      {/* ── Studs ───────────────────────────────────────────────────────── */}
      {measurements.map((s) => (
        <rect
          key={s.name}
          x={cx(s.ocIn) - s.widthIn * 0.0254 * scale / 2} y={studTop}
          width={s.widthIn * 0.0254 * scale} height={studBot - studTop}
          fill="#c8c0b2" stroke="#1a1a1a" strokeWidth={0.5}
        />
      ))}

      {/* ── Member labels ────────────────────────────────────────────────── */}
      <text x={PAD_L - 3} y={wallTop + PLATE_H / 2 + 2.5}
        textAnchor="end" fontSize={6.5} fill="#1a1a1a"
        fontFamily="'Courier New', monospace">TP</text>
      <text x={PAD_L - 3} y={(studTop + studBot) / 2 + 2.5}
        textAnchor="end" fontSize={6.5} fill="#1a1a1a"
        fontFamily="'Courier New', monospace">STD</text>
      <text x={PAD_L - 3} y={wallBot - PLATE_H / 2 + 2.5}
        textAnchor="end" fontSize={6.5} fill="#1a1a1a"
        fontFamily="'Courier New', monospace">BP</text>

      {/* ── Extension lines from stud centres (shared by OC and CLR rows) ── */}
      {measurements.map((s) => (
        <line
          key={`ext-${s.name}`}
          x1={cx(s.ocIn)} y1={wallBot + 1}
          x2={cx(s.ocIn)} y2={clrY - 5}
          stroke="#555" strokeWidth={0.4} strokeDasharray="2 2"
        />
      ))}

      {/* ════════════════════════════════════════════════════════════════════
          ROW 1 — O.C. SPACING
          ════════════════════════════════════════════════════════════════════ */}

      <text x={PAD_L - 3} y={ocY + 13}
        textAnchor="end" fontSize={7} fill="#555"
        fontFamily="'Courier New', monospace">O.C.</text>

      <line x1={firstX} y1={ocY} x2={lastX} y2={ocY}
        stroke="#2a2a2a" strokeWidth={0.65} />

      {measurements.map((s) => (
        <SlashTick key={`oct-${s.name}`} x={cx(s.ocIn)} y={ocY} />
      ))}

      {measurements.slice(1).map((s, i) => {
        const prev = measurements[i];
        if (!prev) return null;
        const ax = cx(prev.ocIn);
        const bx = cx(s.ocIn);
        return (
          <DimLabel
            key={`ocl-${s.name}`}
            x={(ax + bx) / 2}
            lineY={ocY}
            gapPx={bx - ax}
            label={fmtInches(s.ocIn - prev.ocIn)}
          />
        );
      })}

      {/* ════════════════════════════════════════════════════════════════════
          ROW 2 — CLEAR (face-to-face)
          ════════════════════════════════════════════════════════════════════ */}

      <text x={PAD_L - 3} y={clrY + 13}
        textAnchor="end" fontSize={7} fill="#555"
        fontFamily="'Courier New', monospace">CLR</text>

      {measurements.slice(1).map((s, i) => {
        const prev = measurements[i];
        if (!prev) return null;
        const leftFaceX  = cx(prev.ocIn) + prev.widthIn * 0.0254 * scale / 2;
        const rightFaceX = cx(s.ocIn) - s.widthIn * 0.0254 * scale / 2;
        const segPx = rightFaceX - leftFaceX;
        if (segPx < 2) return null;

        const clearIn = (s.ocIn - prev.ocIn) - (prev.widthIn + s.widthIn) / 2;
        const midX = (leftFaceX + rightFaceX) / 2;

        return (
          <g key={`clr-${s.name}`}>
            <line x1={leftFaceX} y1={clrY} x2={rightFaceX} y2={clrY}
              stroke="#2a2a2a" strokeWidth={0.65} />
            <line x1={leftFaceX}  y1={clrY - 4} x2={leftFaceX}  y2={clrY + 4}
              stroke="#2a2a2a" strokeWidth={0.9} />
            <line x1={rightFaceX} y1={clrY - 4} x2={rightFaceX} y2={clrY + 4}
              stroke="#2a2a2a" strokeWidth={0.9} />
            <DimLabel x={midX} lineY={clrY} gapPx={segPx} label={fmtInches(clearIn)} />
          </g>
        );
      })}

      {/* ════════════════════════════════════════════════════════════════════
          ROW 3 — TOTAL O.C.
          ════════════════════════════════════════════════════════════════════ */}

      <line x1={firstX} y1={overallY} x2={lastX} y2={overallY}
        stroke="#2a2a2a" strokeWidth={0.65} />
      <SlashTick x={firstX} y={overallY} />
      <SlashTick x={lastX}  y={overallY} />
      <text
        x={(firstX + lastX) / 2} y={overallY + 13}
        textAnchor="middle" dominantBaseline="auto"
        fontSize={8} fill="#2a2a2a" fontFamily="'Courier New', monospace"
      >
        {fmtFtIn(last.ocIn - first.ocIn)} TOTAL O.C.
      </text>
    </svg>
  );
}

