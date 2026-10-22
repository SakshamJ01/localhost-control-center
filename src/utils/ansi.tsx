import React from 'react';

// Regex matching ANSI escape sequences (e.g. \x1b[32m or \u001b[1m)
const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

interface TextSegment {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

const COLOR_MAP: Record<number, string> = {
  30: '#64748b', // black / dark gray
  31: '#f87171', // red
  32: '#34d399', // green
  33: '#fbbf24', // yellow
  34: '#60a5fa', // blue
  35: '#c084fc', // magenta
  36: '#38bdf8', // cyan
  37: '#f8fafc', // white
  90: '#94a3b8', // bright black / gray
  91: '#fda4af', // bright red
  92: '#a7f3d0', // bright green
  93: '#fde047', // bright yellow
  94: '#93c5fd', // bright blue
  95: '#e9d5ff', // bright magenta
  96: '#7dd3fc', // bright cyan
  97: '#ffffff', // bright white
};

export function parseAnsiText(input: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentColor: string | undefined = undefined;
  let currentBold = false;
  let currentDim = false;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ANSI_REGEX.exec(input)) !== null) {
    // Add text preceding the escape code
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text) {
        segments.push({
          text,
          color: currentColor,
          bold: currentBold,
          dim: currentDim
        });
      }
    }

    // Process ANSI codes
    const codeString = match[1] || '0';
    const codes = codeString.split(';').map(c => parseInt(c, 10));

    for (const code of codes) {
      if (code === 0) {
        // Reset all
        currentColor = undefined;
        currentBold = false;
        currentDim = false;
      } else if (code === 1) {
        currentBold = true;
      } else if (code === 2) {
        currentDim = true;
      } else if (code === 22) {
        currentBold = false;
        currentDim = false;
      } else if (code === 39) {
        currentColor = undefined;
      } else if (COLOR_MAP[code]) {
        currentColor = COLOR_MAP[code];
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text
  if (lastIndex < input.length) {
    segments.push({
      text: input.slice(lastIndex),
      color: currentColor,
      bold: currentBold,
      dim: currentDim
    });
  }

  return segments;
}

export const AnsiRenderer: React.FC<{ text: string }> = ({ text }) => {
  const segments = parseAnsiText(text);

  if (segments.length === 0) {
    return null;
  }

  return (
    <>
      {segments.map((seg, idx) => {
        const style: React.CSSProperties = {};
        if (seg.color) style.color = seg.color;
        if (seg.bold) style.fontWeight = 700;
        if (seg.dim) style.opacity = 0.65;

        return (
          <span key={idx} style={style}>
            {seg.text}
          </span>
        );
      })}
    </>
  );
};
