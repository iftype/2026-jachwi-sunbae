import { fitCoordinates } from '@/features/map/lib/mapCamera';
import { DEFAULT_MAP_CENTER } from '@/features/map/lib/mapLocation';

import { SAMPLE_PROPERTIES } from './sampleProperties';

/*
 * 첫 화면 번들(main)에 지도 계산을 싣지 않도록 미리보기 매물 목록과 파일을 나눈다. 지도 화면만 이 파일을 불러온다.
 */
/** 기록 지도를 처음 열 때의 확대 단계. 매물 하나와 그 주변 동네가 함께 보이는 정도다. */
export const FIRST_MAP_LEVEL = 8;

/**
 * 첫 화면 지도 시점. 기록이 없으면 보이는 미리보기 매물이 모두 들어오게 가운데와 확대 단계를 정한다.
 * 좌표는 미리보기 매물 데이터에서 읽으므로 매물을 바꾸면 시점도 따라간다.
 */
export const SAMPLE_PROPERTIES_VIEW = fitCoordinates(
  SAMPLE_PROPERTIES.flatMap(({ location: { latitude, longitude } }) =>
    latitude === null || longitude === null ? [] : [{ latitude, longitude }],
  ),
  FIRST_MAP_LEVEL,
  DEFAULT_MAP_CENTER,
);
