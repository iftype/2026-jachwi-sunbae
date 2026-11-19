/**
 * 지도에 정보 카드를 띄울 동네를 고른다. 눌러 고정한 동네가 있으면 다른 동네에 마우스를 올려도 그 카드를 그대로 두고,
 * 고정한 동네가 없을 때만 마우스를 올린 동네의 카드를 보여 준다.
 */
export const regionCardCode = (pinnedCode: string | null, hoveredCode: string | null) => pinnedCode ?? hoveredCode;
