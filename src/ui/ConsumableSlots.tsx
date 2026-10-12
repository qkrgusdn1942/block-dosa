import { consumableInfo, type Consumable } from '../content/consumables';

interface Props {
  items: readonly Consumable[];
  /** 소모품 칸 수 (수련 "소매"로 늘어남) */
  slots: number;
  /** 망치·부채를 고르고 대상을 기다리는 중인 칸 */
  activeIndex: number | null;
  onTap: (index: number) => void;
}

export function ConsumableSlots({ items, slots, activeIndex, onTap }: Props) {
  return (
    <div className="consumables">
      {Array.from({ length: slots }, (_, i) => {
        const item = items[i];
        if (!item) return <div key={i} className="item empty" aria-hidden="true" />;
        const info = consumableInfo(item);
        return (
          <button key={i} className={activeIndex === i ? 'item active' : 'item'} onClick={() => onTap(i)} aria-label={info.name}>
            {info.emoji}
          </button>
        );
      })}
    </div>
  );
}
