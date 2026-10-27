/**
 * 주변 버스정류장 API의 정류장 ID(`GGB206000683`처럼 관리 기관 코드 + 정류소 ID)를 대중교통 경로 API의 정류장 ID로 바꾼다.
 * 경로망은 국가 대중교통 정보(TAGO) 버스정류장을 `BS_TAGO_` 접두어로 적재한다. 경로망에 없는 정류장이면 경로 API가
 * `TRANSIT_STOP_NOT_FOUND`로 답하므로 화면은 그 경우를 안내한다.
 */
export const transitStopIdForBusStop = (nodeId: string) => `BS_TAGO_${nodeId}`;
