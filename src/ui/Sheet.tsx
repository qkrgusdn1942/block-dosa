import { useId, type ReactNode } from 'react';

interface Props {
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  /** 바깥을 누르면 닫힘. 없으면 꼭 버튼으로 선택해야 하는 시트 */
  onClose?: () => void;
  /** 마지막 클리어 연출을 볼 수 있게 조금 늦게 뜬다 */
  delayed?: boolean;
}

/** 아래에서 올라오는 시트 */
export function Sheet({ title, sub, children, onClose, delayed }: Props) {
  const titleId = useId();
  return (
    <div className={delayed ? 'sheet-backdrop delayed' : 'sheet-backdrop'} onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {sub && <p className="sheet-sub">{sub}</p>}
        {children}
      </section>
    </div>
  );
}
