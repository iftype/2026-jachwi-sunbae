-- 적용된 V3를 수정하지 않고 완료 여부 중심의 조회로 전환한다.
ALTER TABLE weather_collection_publications
    DROP CHECK chk_weather_publication_completion,
    DROP COLUMN started_at;

-- RAW 숫자·결측 검증과 요청 시각 검증은 각각 파서·수집 계획에서 한 번 수행한다.
-- 격자 범위, 시간 순서, 일별 출처 조합, PK는 유지한다.
ALTER TABLE weather_forecasts
    DROP CHECK chk_weather_forecasts_hours,
    DROP CHECK chk_weather_forecasts_tmp,
    DROP CHECK chk_weather_forecasts_sky,
    DROP CHECK chk_weather_forecasts_pty,
    DROP CHECK chk_weather_forecasts_pop,
    DROP CHECK chk_weather_forecasts_pcp,
    DROP CHECK chk_weather_forecasts_sno,
    DROP CHECK chk_weather_forecasts_reh,
    DROP CHECK chk_weather_forecasts_wsd;

ALTER TABLE weather_daily_forecasts
    DROP CHECK chk_weather_daily_forecasts_tmn_date,
    DROP CHECK chk_weather_daily_forecasts_tmx_date,
    DROP CHECK chk_weather_daily_forecasts_tmn_hour,
    DROP CHECK chk_weather_daily_forecasts_tmx_hour,
    DROP CHECK chk_weather_daily_forecasts_tmn,
    DROP CHECK chk_weather_daily_forecasts_tmx;
