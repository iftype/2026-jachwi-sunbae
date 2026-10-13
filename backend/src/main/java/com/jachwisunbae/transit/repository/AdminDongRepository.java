package com.jachwisunbae.transit.repository;

import com.jachwisunbae.transit.domain.AdminDong;
import java.util.Collection;
import java.util.List;

public interface AdminDongRepository {

    void replace(List<AdminDong> adminDongs);

    List<AdminDong> findAll();

    List<AdminDong> findByCodes(Collection<String> codes);
}
