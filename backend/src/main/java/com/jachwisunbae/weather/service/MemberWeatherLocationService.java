package com.jachwisunbae.weather.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import com.jachwisunbae.weather.provider.kma.KmaGridConverter;
import com.jachwisunbae.weather.repository.MemberWeatherLocationRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class MemberWeatherLocationService {
    private static final Duration MAX_SYNC_AGE = Duration.ofMinutes(5);
    private static final Duration MAX_FUTURE_SKEW = Duration.ofMinutes(1);
    private final MemberService members;
    private final MemberWeatherLocationRepository repository;
    private final KmaGridConverter converter;
    private final Clock clock;

    public MemberWeatherLocationService(final MemberService members, final MemberWeatherLocationRepository repository,
                                        final KmaGridConverter converter, final Clock clock) {
        this.members = members;
        this.repository = repository;
        this.converter = converter;
        this.clock = clock;
    }

    public MemberWeatherLocation find(final long memberId) {
        members.findProfileById(memberId);
        return repository.find(memberId).orElse(new MemberWeatherLocation(null, null, null));
    }

    @Transactional
    public MemberWeatherLocation sync(final long memberId, final double latitude, final double longitude,
                                      final Instant observedAt) {
        members.findProfileById(memberId);
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        if (observedAt == null || observedAt.isBefore(now.minus(MAX_SYNC_AGE))
                || observedAt.isAfter(now.plus(MAX_FUTURE_SKEW))) {
            throw new InvalidInputException(ErrorCode.WEATHER_LOCATION_TIME_INVALID, "위치 확인시각이 동기화 허용 범위 밖입니다.");
        }
        GridPoint grid = converter.convert(latitude, longitude);
        repository.sync(memberId, grid, observedAt.truncatedTo(ChronoUnit.MICROS), now);
        return repository.find(memberId).orElseThrow();
    }

    @Transactional
    public void invalidate(final long memberId) {
        members.findProfileById(memberId);
        repository.invalidate(memberId, clock.instant().truncatedTo(ChronoUnit.MICROS));
    }
}
