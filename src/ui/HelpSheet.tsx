import { PATTERNS, type PatternId, type PatternLevels } from '../content/balance';
import { ENHANCEMENT_IDS, ENHANCEMENTS } from '../content/enhancements';
import { Sheet } from './Sheet';

interface Props {
  seed: string;
  levels: PatternLevels;
  onClose: () => void;
  /** 런은 저장돼 있어서 처음 화면에서 이어할 수 있다 */
  onTitle: () => void;
}

export function HelpSheet({ seed, levels, onClose, onTitle }: Props) {
  return (
    <Sheet title="규칙" sub={`시드 ${seed}`} onClose={onClose}>
      <ol className="rules">
        <li>아래 블록 3개를 끌어다 판에 놓아요. 3개를 다 놓으면 다음 3개가 나와요.</li>
        <li>가로나 세로 한 줄을 꽉 채우면 지워지고 점수가 들어와요.</li>
        <li>판마다 정해진 핸드(보통 5번) 안에 목표 점수를 넘기면 클리어. 못 넘기면 런이 끝나요.</li>
        <li>고개마다 판 1 → 판 2 → 요괴 판. 여덟 고개를 넘으면 엔딩, 원하면 끝없는 모드로 계속 가요.</li>
        <li>판 사이 장터에서 부적과 소모품을 사요. 부적은 왼쪽부터 순서대로 발동해요.</li>
      </ol>

      <h3>점수 = 칩 × 배수</h3>
      <table className="patterns">
        <thead>
          <tr>
            <th>족보</th>
            <th className="num">레벨</th>
            <th className="num">칩</th>
            <th className="num">배수</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(PATTERNS) as PatternId[]).map((id) => {
            const p = PATTERNS[id];
            const level = levels[id];
            return (
              <tr key={id}>
                <td>{p.name}</td>
                <td className="num">{level}</td>
                <td className="num">{p.chips + p.chipsPerLevel * (level - 1)}</td>
                <td className="num">{p.mult + p.multPerLevel * (level - 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="rules">
        <li>지운 칸 1개당 칩 +1 (바위는 0)</li>
        <li>연속으로 지우면 배수가 1씩 더 붙어요. 한 핸드 동안 못 지우면 끊겨요.</li>
        <li>⭐ 별 칸 ×2, 지운 뒤 판이 텅 비면 대청소 ×3</li>
      </ul>

      <h3>강화 블록</h3>
      <p className="hint">장터의 도장·블록 팩으로 가방 블록을 강화해요. 칸 가운데 표시로 구분해요.</p>
      <ul className="enh-legend">
        {ENHANCEMENT_IDS.map((id) => (
          <li key={id}>
            <span className={`enh-chip enh enh-${id}`}>{ENHANCEMENTS[id].mark}</span>
            <b>{ENHANCEMENTS[id].name}</b> {ENHANCEMENTS[id].text}
          </li>
        ))}
      </ul>

      <div className="sheet-actions">
        <button className="primary" onClick={onClose}>
          닫기
        </button>
        <button onClick={onTitle}>처음 화면으로 (저장됨)</button>
      </div>
    </Sheet>
  );
}
