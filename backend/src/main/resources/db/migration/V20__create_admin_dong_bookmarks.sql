-- 회원이 동네 찾기에서 북마크한 행정동이다. 회원과 행정동 한 쌍에 한 행만 두고, 해제는 deleted_at으로 남긴다.
-- admin_dongs는 다시 적재할 때 모두 비우고 채우므로 행정동 코드에는 외래 키를 두지 않는다.
CREATE TABLE admin_dong_bookmarks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    admin_dong_code VARCHAR(10) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    CONSTRAINT fk_admin_dong_bookmarks_member FOREIGN KEY (member_id) REFERENCES members (id),
    CONSTRAINT uk_admin_dong_bookmarks_member_code UNIQUE (member_id, admin_dong_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
