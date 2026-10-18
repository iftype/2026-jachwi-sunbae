package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.repository.AdminDongRepository;
import java.util.List;

public class InMemoryAdminDongRepository implements AdminDongRepository {

    private List<AdminDong> adminDongs;

    public InMemoryAdminDongRepository(final List<AdminDong> adminDongs) {
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
}
