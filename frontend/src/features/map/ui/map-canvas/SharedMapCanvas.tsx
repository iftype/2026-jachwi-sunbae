import { createContext, type ReactNode, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { MapCanvasProps } from '../../model/MapCanvas';
import InfrastructureMap from '../infrastructure-panel/InfrastructureMap';
import MapCanvasSurface from './MapCanvasSurface';

type MapHost = {
  attach: (element: HTMLDivElement, props: MapCanvasProps, modeKey: string) => void;
  /** 모드를 바꿀 때 붙잡아 둔 이전 모드의 가운데를 놓는다. 새 모드가 일부러 시점을 옮길 때만 부른다. */
  releaseHeldView: () => void;
};
const HostContext = createContext<MapHost | null>(null);
const ActiveContext = createContext({ active: true, modeKey: 'default' });

/** 지도 DOM의 부모만 바꾼다. 포털 대상과 SDK 인스턴스는 모드와 화면 폭이 바뀌어도 유지한다. */
export const SharedMapCanvasProvider = ({
  children,
  infrastructure,
  preserveZoomOnModeChange = false,
}: {
  children: ReactNode;
  preserveZoomOnModeChange?: boolean;
  infrastructure?: { open: boolean; onClose: () => void };
}) => {
  const [target] = useState(() => {
    const element = document.createElement('div');
    element.style.cssText = 'position:absolute;inset:0;';
    element.dataset.sharedMap = 'true';
    return element;
  });
  const current = useRef<{ modeKey: string; center: MapCanvasProps['center']; level: number | undefined } | null>(null);
  const heldCenter = useRef<{ requested: MapCanvasProps['center']; actual: MapCanvasProps['center'] } | null>(null);
  const [props, setProps] = useState<MapCanvasProps | null>(null);
  const host = useMemo<MapHost>(
    () => ({
      attach: (element, nextProps, modeKey) => {
        if (target.parentElement !== element) element.appendChild(target);
        const previous = current.current;
        const switching = preserveZoomOnModeChange && previous !== null && previous.modeKey !== modeKey;
        const level = switching ? previous.level : nextProps.level;
        if (switching) {
          heldCenter.current = { requested: nextProps.center, actual: previous.center };
          nextProps.onCenterChange?.(previous.center.latitude, previous.center.longitude);
          if (level !== undefined) nextProps.onLevelChange?.(level);
        }
        const held = heldCenter.current;
        if (
          held &&
          (held.requested.latitude !== nextProps.center.latitude ||
            held.requested.longitude !== nextProps.center.longitude)
        )
          heldCenter.current = null;
        const center = heldCenter.current?.actual ?? nextProps.center;
        current.current = { modeKey, center, level };
        setProps({
          ...nextProps,
          center,
          level,
          onCenterChange: (latitude, longitude) => {
            const point = { latitude, longitude };
            if (current.current) current.current.center = point;
            if (heldCenter.current) heldCenter.current.actual = point;
            nextProps.onCenterChange?.(latitude, longitude);
          },
          onLevelChange: (value) => {
            if (current.current) current.current.level = value;
            nextProps.onLevelChange?.(value);
          },
        });
      },
      releaseHeldView: () => {
        heldCenter.current = null;
      },
    }),
    [target, preserveZoomOnModeChange],
  );
  return (
    <HostContext.Provider value={host}>
      {children}
      {props &&
        createPortal(
          infrastructure ? (
            <InfrastructureMap mapProps={props} open={infrastructure.open} onClose={infrastructure.onClose} />
          ) : (
            <MapCanvasSurface {...props} />
          ),
          target,
        )}
    </HostContext.Provider>
  );
};

export const MapCanvasMode = ({ active, children }: { active: boolean; children: ReactNode }) => {
  const modeKey = useId();
  const value = useMemo(() => ({ active, modeKey }), [active, modeKey]);
  return <ActiveContext.Provider value={value}>{children}</ActiveContext.Provider>;
};

export const SharedMapCanvasSlot = ({ host, ...props }: MapCanvasProps & { host: MapHost }) => {
  const { active, modeKey } = useContext(ActiveContext);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (active && ref.current) host.attach(ref.current, props, modeKey);
  });
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }} />;
};

export const useMapCanvasHost = () => useContext(HostContext);
