/** 결과 글을 카드 이미지(PNG)로 그린다 → docs/10-social.md */

const SIZE = 1080;
const MARGIN = 90;
const FONT = `'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif`;
const BLOCK_COLORS = ['#3b7cad', '#d3a02a', '#c9553c', '#4a9768'];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 너무 긴 줄은 폭에 맞게 글씨를 줄인다 */
function fitFont(ctx: CanvasRenderingContext2D, text: string, size: number, weight: number, maxWidth: number) {
  let current = size;
  ctx.font = `${weight} ${current}px ${FONT}`;
  while (current > 20 && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = `${weight} ${current}px ${FONT}`;
  }
  return current;
}

const ROW_GAP = 30;
const TITLE_GAP = 26;
const INK = '#2b2620';

/** 제목, 판 결과 네모·부적 줄(크게), 코드(빨강), 나머지 */
function rowStyle(line: string, title: boolean): { size: number; weight: number; color: string } {
  if (title) return { size: 54, weight: 800, color: INK };
  if (line.startsWith('코드 ')) return { size: 48, weight: 800, color: '#b5452f' };
  if (/^[🟩🟨🟥⬜]/u.test(line) || /^[\p{Extended_Pictographic}\u200d\ufe0f\s]+$/u.test(line)) {
    return { size: 64, weight: 400, color: INK };
  }
  return { size: 44, weight: 600, color: INK };
}

export async function renderResultImage(text: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#f4ecdc';
  ctx.fillRect(0, 0, SIZE, SIZE);
  roundRect(ctx, 50, 50, SIZE - 100, SIZE - 100, 48);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();
  ctx.strokeStyle = '#e9dcc3';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 오른쪽 위에 블록 무늬 (앱 아이콘과 같은 색)
  BLOCK_COLORS.forEach((color, i) => {
    roundRect(ctx, SIZE - MARGIN - 150 + (i % 2) * 78, MARGIN + Math.floor(i / 2) * 78, 70, 70, 14);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // 줄마다 글씨 크기를 먼저 정하고, 전체를 세로 가운데에 놓는다
  const maxWidth = SIZE - MARGIN * 2;
  const rows = text.split('\n').map((line, i) => {
    const row = rowStyle(line, i === 0);
    return { ...row, line, size: fitFont(ctx, line, row.size, row.weight, maxWidth) };
  });
  const height = rows.reduce((sum, row) => sum + row.size, 0) + ROW_GAP * (rows.length - 1) + TITLE_GAP;
  let y = Math.max(MARGIN + 170, (SIZE - height) / 2 + 30);
  ctx.textBaseline = 'top';
  rows.forEach((row, i) => {
    ctx.font = `${row.weight} ${row.size}px ${FONT}`;
    ctx.fillStyle = row.color;
    ctx.fillText(row.line, MARGIN, y);
    y += row.size + ROW_GAP + (i === 0 ? TITLE_GAP : 0);
  });

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
