package com.jachwisunbae.bookmark.repository;

import java.time.LocalDateTime;
import java.util.List;

public interface AdminDongBookmarkRepository {

    void add(long memberId, String adminDongCode, LocalDateTime createdAt);

    int remove(long memberId, String adminDongCode, LocalDateTime deletedAt);

    List<String> findCodesByMemberId(long memberId);
}
