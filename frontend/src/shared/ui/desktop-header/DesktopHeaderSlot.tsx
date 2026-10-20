import { createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

type SlotContextValue = {
  slot: HTMLElement | null;
  setSlot: (element: HTMLElement | null) => void;
};

const SlotContext = createContext<SlotContextValue>({ slot: null, setSlot: () => undefined });

/** 데스크탑 헤더와 그 아래 화면을 감싸, 화면이 헤더 가운데 자리에 검색창 같은 요소를 넣을 수 있게 한다. */
export const DesktopHeaderSlotProvider = ({ children }: { children: ReactNode }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ slot, setSlot }}>{children}</SlotContext.Provider>;
};

/** 지금 데스크탑 헤더 가운데 자리가 있는지. 있으면 그 자리에 맞는 모양으로 그린다. */
export const useHasDesktopHeaderSlot = () => useContext(SlotContext).slot !== null;

/** 데스크탑 헤더가 가운데 자리 요소를 등록할 때 쓴다. */
export const useRegisterDesktopHeaderSlot = () => useContext(SlotContext).setSlot;

type DesktopHeaderSlotProps = {
  children: ReactNode;
};

/**
 * 데스크탑 헤더가 있으면 그 가운데 자리로 옮겨 그리고, 없으면(휴대폰·태블릿 등) 제자리에 그린다.
 */
const DesktopHeaderSlot = ({ children }: DesktopHeaderSlotProps) => {
  const { slot } = useContext(SlotContext);
  return slot === null ? children : createPortal(children, slot);
};

export default DesktopHeaderSlot;
