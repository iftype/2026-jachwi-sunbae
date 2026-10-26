package com.jachwisunbae.weather.service;

import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import com.jachwisunbae.weather.provider.kma.KmaGridConverter;
import com.jachwisunbae.weather.repository.MemberWeatherLocationRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class MemberWeatherLocationService {
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
        return repository.find(memberId).orElse(new MemberWeatherLocation(null, null));
    }

    @Transactional
    public MemberWeatherLocation sync(final long memberId, final double latitude, final double longitude) {
        members.findProfileById(memberId);
        GridPoint grid = converter.convert(latitude, longitude);
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        repository.sync(memberId, grid, now);
        return new MemberWeatherLocation(grid, now);
    }

    @Transactional
    public void delete(final long memberId) {
        members.findProfileById(memberId);
        repository.delete(memberId);
    }
}
