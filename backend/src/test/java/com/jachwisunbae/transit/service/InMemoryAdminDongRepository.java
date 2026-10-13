package com.jachwisunbae.transit.service;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import java.util.Collection;
import java.util.List;

class InMemoryAdminDongRepository implements AdminDongRepository {

    private List<AdminDong> adminDongs;

    InMemoryAdminDongRepository(final List<AdminDong> adminDongs) {
        this.adminDongs = adminDongs;
    }

    @Override
    public void replace(final List<AdminDong> newAdminDongs) {
        adminDongs = newAdminDongs;
    }

    @Override
    public List<AdminDong> findAll() {
        return adminDongs;
    }

    @Override
    public List<AdminDong> findByCodes(final Collection<String> codes) {
        return adminDongs.stream().filter(adminDong -> codes.contains(adminDong.code())).toList();
    }
}
