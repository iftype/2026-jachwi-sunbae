/**
 * 매물과 지도 화면에서만 쓰는 이미지 상수. 첫 화면 묶음(main)에 이미지 주소가 따라 들어가지 않게 `imageAssets.ts`와 나눠 둔다.
 */
import menuProperty from './illustrations/icon-home.webp';
import menuMemo from './illustrations/menu-memo.webp';
import menuNeighborhood from './illustrations/menu-neighborhood.webp';
import type { ImageAsset } from './imageAssets';
import propertyPlaceholder from './property-placeholder-house.webp';
import propertyPlaceholder2x from './property-placeholder-house@2x.webp';

/** 사진이 없는 매물을 채우는 기본 이미지(집 그림). 목록, 홈, 상세, 방 비교가 모두 이것을 쓴다. */
export const PROPERTY_PLACEHOLDER: ImageAsset = { src: propertyPlaceholder, src2x: propertyPlaceholder2x };

/**
 * 지도를 찍었을 때 뜨는 말풍선 메뉴의 아이콘. 이모지 대신 쓴다.
 * 홈 화면과 같은 클레이 톤의 메모장(`illustrations/menu-memo.webp`)과 집(`illustrations/icon-home.webp`)을 쓴다. 같은 파일 이름으로 새 그림을 덮어쓰면 바뀐다.
 */
export const MENU_MEMO_ICON: string = menuMemo;
export const MENU_PROPERTY_ICON: string = menuProperty;

/** 기존 동네 찾기 카드에서 사용하던 추천 그림. */
export const MENU_NEIGHBORHOOD_ICON: string = menuNeighborhood;
