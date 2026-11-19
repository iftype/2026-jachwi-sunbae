import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { expect, it, vi } from 'vitest';

import type { MapCanvasProps } from '@/features/map/model/MapCanvas';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import { MapCanvasMode, SharedMapCanvasProvider } from '@/features/map/ui/map-canvas/SharedMapCanvas';

const lifetime = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock('@/features/map/ui/map-canvas/MapCanvasSurface', () => ({
  default: ({ center, level, onCenterChange }: MapCanvasProps) => {
    useEffect(() => {
      lifetime.mounts += 1;
      return () => {
        lifetime.unmounts += 1;
      };
    }, []);
    return (
      <>
        <button onClick={() => onCenterChange?.(37.75, 127.75)}>지도 직접 이동</button>
        <output aria-label="실제 지도">{center.latitude}</output>
        <output aria-label="실제 확대 단계">{level}</output>
      </>
    );
  },
}));

it('모드와 반응형 지도 슬롯이 바뀌어도 실제 지도와 포털 DOM을 유지한다', () => {
  const Harness = () => {
    const [finding, setFinding] = useState(false);
    const [mobile, setMobile] = useState(false);
    return (
      <SharedMapCanvasProvider>
        <button onClick={() => setFinding(!finding)}>모드 전환</button>
        <button onClick={() => setMobile(!mobile)}>화면 폭 전환</button>
        <MapCanvasMode active={!finding}>
          <MapCanvas shared center={{ latitude: 37, longitude: 127 }} />
        </MapCanvasMode>
        <MapCanvasMode active={finding}>
          {mobile ? (
            <section>
              <MapCanvas shared center={{ latitude: 38, longitude: 128 }} />
            </section>
          ) : (
            <aside>
              <MapCanvas shared center={{ latitude: 38, longitude: 128 }} />
            </aside>
          )}
        </MapCanvasMode>
      </SharedMapCanvasProvider>
    );
  };
  const { unmount } = render(<Harness />);
  const original = screen.getByLabelText('실제 지도');
  expect(original).toHaveTextContent('37');
  fireEvent.click(screen.getByText('모드 전환'));
  expect(screen.getByLabelText('실제 지도')).toBe(original);
  expect(original).toHaveTextContent('38');
  fireEvent.click(screen.getByText('화면 폭 전환'));
  expect(screen.getByLabelText('실제 지도')).toBe(original);
  fireEvent.click(screen.getByText('모드 전환'));
  expect(original).toHaveTextContent('37');
  expect(lifetime.mounts).toBe(1);
  expect(lifetime.unmounts).toBe(0);
  unmount();
  expect(lifetime.unmounts).toBe(1);
});

it('모드 전환은 사용자가 옮긴 위치와 확대 단계를 유지하고 새 검색의 지도 이동은 반영한다', () => {
  const Harness = () => {
    const [finding, setFinding] = useState(false);
    const [recordsLevel, setRecordsLevel] = useState(2);
    const [findingLevel, setFindingLevel] = useState(9);
    return (
      <SharedMapCanvasProvider preserveZoomOnModeChange>
        <button onClick={() => setFinding((current) => !current)}>모드 전환</button>
        <button onClick={() => setFindingLevel(6)}>새 검색 결과</button>
        <MapCanvasMode active={!finding}>
          <MapCanvas
            shared
            center={{ latitude: 37, longitude: 127 }}
            level={recordsLevel}
            onLevelChange={setRecordsLevel}
          />
        </MapCanvasMode>
        <MapCanvasMode active={finding}>
          <MapCanvas
            shared
            center={{ latitude: 38, longitude: 128 }}
            level={findingLevel}
            onLevelChange={setFindingLevel}
          />
        </MapCanvasMode>
      </SharedMapCanvasProvider>
    );
  };
  render(<Harness />);
  expect(screen.getByLabelText('실제 확대 단계')).toHaveTextContent('2');
  fireEvent.click(screen.getByText('지도 직접 이동'));
  fireEvent.click(screen.getByText('모드 전환'));
  expect(screen.getByLabelText('실제 지도')).toHaveTextContent('37.75');
  expect(screen.getByLabelText('실제 확대 단계')).toHaveTextContent('2');
  fireEvent.click(screen.getByText('새 검색 결과'));
  expect(screen.getByLabelText('실제 확대 단계')).toHaveTextContent('6');
  fireEvent.click(screen.getByText('모드 전환'));
  expect(screen.getByLabelText('실제 확대 단계')).toHaveTextContent('6');
  expect(screen.getByLabelText('실제 지도')).toHaveTextContent('37.75');
});

it('매물 카드로 화면이 지도를 옮긴 자리(중심과 확대 단계)도 동네 찾기로 전환할 때 유지한다', () => {
  const Harness = () => {
    const [finding, setFinding] = useState(false);
    const [records, setRecords] = useState({ center: { latitude: 37, longitude: 127 }, level: 5 });
    const [finder, setFinder] = useState({ center: { latitude: 38, longitude: 128 }, level: 9 });
    return (
      <SharedMapCanvasProvider preserveZoomOnModeChange>
        <button onClick={() => setFinding((current) => !current)}>모드 전환</button>
        <button onClick={() => setRecords({ center: { latitude: 36.5, longitude: 126.5 }, level: 2 })}>
          매물 카드 선택
        </button>
        <MapCanvasMode active={!finding}>
          <MapCanvas shared {...records} />
        </MapCanvasMode>
        <MapCanvasMode active={finding}>
          <MapCanvas
            shared
            {...finder}
            onCenterChange={(latitude, longitude) => setFinder((c) => ({ ...c, center: { latitude, longitude } }))}
            onLevelChange={(level) => setFinder((c) => ({ ...c, level }))}
          />
        </MapCanvasMode>
      </SharedMapCanvasProvider>
    );
  };
  render(<Harness />);
  fireEvent.click(screen.getByText('매물 카드 선택'));
  fireEvent.click(screen.getByText('모드 전환'));
  expect(screen.getByLabelText('실제 지도')).toHaveTextContent('36.5');
  expect(screen.getByLabelText('실제 확대 단계')).toHaveTextContent('2');
});
