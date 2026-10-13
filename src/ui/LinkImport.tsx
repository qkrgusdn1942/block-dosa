import { useEffect, useState } from 'react';
import type { Profile } from '../core/profile';
import { importCodeOf } from '../save/move';
import { saveStore, type RawStorage } from '../save/storage';
import { decodeSave } from '../save/transfer';
import { Sheet } from './Sheet';

type State = { kind: 'ready'; data: RawStorage } | { kind: 'failed' } | null;

/** 넘어온 기록을 한 줄로: 공덕 120 · 최고 고개 4 · 진행 중인 런 있음 */
function summary(data: RawStorage): string {
  const parts: string[] = [];
  try {
    const profile = data.profile ? (JSON.parse(data.profile) as Partial<Profile>) : null;
    if (profile) parts.push(`공덕 ${profile.merit ?? 0}`, `최고 고개 ${profile.bestAnte ?? 0}`, `런 ${profile.runs ?? 0}번`);
  } catch {
    // 요약만 못 보여줄 뿐, 가져오기는 그대로 된다
  }
  if (data.run) parts.push('진행 중인 런 있음');
  return parts.join(' · ');
}

/** 예전 주소에서 넘어온 기록 받기 (주소의 #import=세이브 코드) → docs/11-ui-ux.md */
export function LinkImport({ onImported }: { onImported: () => void }) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const code = importCodeOf(window.location.hash);
    if (!code) return;
    // 새로고침해도 다시 묻지 않게 주소창에서 코드를 지운다
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    decodeSave(code).then((data) => setState(data ? { kind: 'ready', data } : { kind: 'failed' }));
  }, []);

  if (!state) return null;
  const close = () => setState(null);

  if (state.kind === 'failed') {
    return (
      <Sheet title="기록을 읽지 못했어요" sub="예전 주소에서 다시 시도하거나, 설정의 세이브 코드로 옮겨 주세요." onClose={close}>
        <div className="sheet-actions">
          <button className="primary" onClick={close}>
            확인
          </button>
        </div>
      </Sheet>
    );
  }

  const current = saveStore.exportRaw();
  const overwrite = current.profile !== null || current.run !== null;
  const apply = () => {
    if (saveStore.importRaw(state.data)) onImported();
    close();
  };

  return (
    <Sheet title="예전 주소의 기록을 가져올까요?" sub={summary(state.data)}>
      {overwrite && <p className="status-line">이 주소에 있던 공덕·기록·진행 중인 런은 덮어써요.</p>}
      <div className="sheet-actions">
        <button className="primary" onClick={apply}>
          가져오기
        </button>
        <button onClick={close}>가져오지 않기</button>
      </div>
    </Sheet>
  );
}
