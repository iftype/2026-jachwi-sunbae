package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.collection.AdminDongLocator;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

// 좌표가 속한 행정동 코드를 찾는다. 행정동 경계는 처음 찾을 때 한 번 DB에서 읽어 메모리에 둔다.
// 다시 적재한 경계는 서버를 재시작해야 반영된다. 경계가 아직 없으면 담아 두지 않고 다음 요청에서 다시 읽는다.
@Component
public class AdminDongFinder {

    private final AdminDongRepository adminDongRepository;
    private volatile AdminDongLocator locator;

    public AdminDongFinder(final AdminDongRepository adminDongRepository) {
        this.adminDongRepository = adminDongRepository;
    }

    public Optional<String> findCode(final BigDecimal latitude, final BigDecimal longitude) {
        AdminDongLocator loaded = locator();
        if (loaded == null) {
            return Optional.empty();
        }
        return loaded.locate(new Coordinate(latitude.doubleValue(), longitude.doubleValue()))
                .map(AdminDong::code);
    }

    // 북마크처럼 코드만 받는 요청은 메모리의 경계 대신 DB에서 지금 적재된 행정동인지 확인한다.
    public boolean exists(final String code) {
        return adminDongRepository.existsByCode(code);
    }

    private AdminDongLocator locator() {
        AdminDongLocator loaded = locator;
        if (loaded != null) {
            return loaded;
        }
        synchronized (this) {
            if (locator == null) {
                List<AdminDong> adminDongs = adminDongRepository.findAll();
                if (!adminDongs.isEmpty()) {
                    locator = new AdminDongLocator(adminDongs);
                }
            }
            return locator;
        }
    }
}
