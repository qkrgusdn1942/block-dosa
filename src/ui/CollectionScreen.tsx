import { useState, type ReactNode } from 'react';
import { RARITY_NAMES } from '../content/balance';
import { ALL_SHAPES, SHAPES, type ShapeId } from '../content/blocks';
import { BOSSES, type BossId } from '../content/bosses';
import { ENHANCEMENT_IDS, ENHANCEMENTS } from '../content/enhancements';
import { OBSTACLE_IDS, OBSTACLES } from '../content/obstacles';
import { TALISMAN_IDS, TALISMANS } from '../content/talismans';
import { extent, orientations } from '../core/pieces';
import type { Seen } from '../core/run';
import { PieceView } from './PieceView';
import { Sheet } from './Sheet';

/** 도감: 지금까지 만난 부적·요괴·방해 칸·블록·강화 → docs/06-incremental.md */

interface Entry {
  key: string;
  icon: ReactNode;
  name: string;
  text: string;
  seen: boolean;
}

const BOSS_IDS = Object.keys(BOSSES) as BossId[];

const shapeIcon = (shape: ShapeId) => {
  const cells = orientations(shape)[0];
  return <PieceView piece={{ uid: 0, bagId: -1, shape, cells, ...extent(cells) }} cell={8} />;
};

function sections(collection: Seen): Array<{ title: string; entries: Entry[] }> {
  const has = <T,>(list: readonly T[], id: T) => list.includes(id);
  return [
    {
      title: '부적',
      entries: TALISMAN_IDS.map((id) => {
        const def = TALISMANS[id];
        return { key: id, icon: def.emoji, name: def.name, text: `${RARITY_NAMES[def.rarity]} · ${def.text}`, seen: has(collection.talismans, id) };
      }),
    },
    {
      title: '요괴',
      entries: BOSS_IDS.map((id) => {
        const def = BOSSES[id];
        return { key: id, icon: def.emoji, name: def.name, text: def.rule, seen: has(collection.bosses, id) };
      }),
    },
    {
      title: '방해 칸',
      entries: OBSTACLE_IDS.map((id) => {
        const def = OBSTACLES[id];
        return { key: id, icon: def.emoji, name: def.name, text: def.rule, seen: has(collection.obstacles, id) };
      }),
    },
    {
      title: '블록',
      entries: ALL_SHAPES.map((id) => ({
        key: id,
        icon: shapeIcon(id),
        name: SHAPES[id].name,
        text: `${orientations(id)[0].length}칸 블록`,
        seen: has(collection.shapes, id),
      })),
    },
    {
      title: '강화',
      entries: ENHANCEMENT_IDS.map((id) => ({
        key: id,
        icon: <span className={`enh-chip enh enh-${id}`}>{ENHANCEMENTS[id].mark}</span>,
        name: ENHANCEMENTS[id].name,
        text: ENHANCEMENTS[id].text,
        seen: has(collection.enhancements, id),
      })),
    },
  ];
}

export function CollectionScreen({ collection, onBack }: { collection: Seen; onBack: () => void }) {
  const [open, setOpen] = useState<Entry | null>(null);
  const all = sections(collection);
  const total = all.reduce((sum, s) => sum + s.entries.length, 0);
  const seen = all.reduce((sum, s) => sum + s.entries.filter((e) => e.seen).length, 0);

  return (
    <div className="screen shop-screen">
      <header className="shop-head">
        <button className="back-button" onClick={onBack}>
          ← 처음 화면
        </button>
        <span className="merit big">{Math.floor((seen / total) * 100)}%</span>
      </header>
      <h1 className="screen-title">도감</h1>
      <p className="next-info">런이 끝나면 그 런에서 만난 것들이 채워져요. ({seen}/{total})</p>

      {all.map((section) => (
        <section key={section.title}>
          <h2 className="section-title">
            {section.title} {section.entries.filter((e) => e.seen).length}/{section.entries.length}
          </h2>
          <div className="collection-grid">
            {section.entries.map((entry) => (
              <button
                key={entry.key}
                className={entry.seen ? 'collection-item' : 'collection-item unseen'}
                onClick={() => setOpen(entry)}
                aria-label={entry.seen ? entry.name : '아직 못 만남'}
              >
                <span className="collection-icon">{entry.seen ? entry.icon : '❔'}</span>
                <span className="collection-name">{entry.seen ? entry.name : '???'}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {open && (
        <Sheet
          title={open.seen ? open.name : '???'}
          sub={open.seen ? open.text : '아직 못 만났어요. 런에서 만나면 채워져요.'}
          onClose={() => setOpen(null)}
        >
          <div className="sheet-actions">
            <button className="primary" onClick={() => setOpen(null)}>
              닫기
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
