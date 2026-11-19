/**
 * 이 세션에서 방금 만든 매물 번호. 상세가 수정 모드(이름 입력 칸이 바로 열리고 포커스)로 열릴지 정하는 **명시적인 신호**다.
 * 이름이나 금액이 비어 있는지로 처음 등록을 추정하지 않는다(이미 등록해 둔 `새 매물`도 비어 있으니 수정 모드로 열려 버린다).
 * 메모리에만 두므로 새로고침하면 사라지고, 목록이나 지도에서 다시 연 상세는 보기 모드다.
 */
const justCreated = new Set<number>();

export const markJustCreated = (propertyId: number) => {
  justCreated.add(propertyId);
};

export const isJustCreated = (propertyId: number): boolean => justCreated.has(propertyId);

/** 상세를 닫거나 이름을 저장하면 더는 `방금 만든` 매물이 아니다. 다시 열면 보기 모드다. */
export const forgetJustCreated = (propertyId: number) => {
  justCreated.delete(propertyId);
};
