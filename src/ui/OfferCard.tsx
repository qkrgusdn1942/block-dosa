import type { ReactNode } from 'react';

interface Props {
  emoji: ReactNode;
  name: string;
  tag?: string;
  text: string;
  /** 버튼 글자: "$6", "받기", "판매 완료" 등 */
  action: string;
  disabled?: boolean;
  /** 전설 부적처럼 눈에 띄게 */
  highlight?: boolean;
  /** 저주받은 부적 */
  cursed?: boolean;
  onAction: () => void;
}

/** 장터 진열, 요괴 유품에 쓰는 카드 */
export function OfferCard({ emoji, name, tag, text, action, disabled, highlight, cursed, onAction }: Props) {
  const classes = [
    'offer',
    ...(disabled ? ['disabled'] : []),
    ...(highlight ? ['highlight'] : []),
    ...(cursed ? ['cursed'] : []),
  ];
  return (
    <div className={classes.join(' ')}>
      <div className="offer-emoji">{emoji}</div>
      <div className="offer-body">
        <div className="offer-name">
          {name}
          {tag && <span className="tag">{tag}</span>}
        </div>
        <p className="offer-text">{text}</p>
      </div>
      <button className="offer-action" disabled={disabled} onClick={onAction}>
        {action}
      </button>
    </div>
  );
}
