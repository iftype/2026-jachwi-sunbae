package com.jachwisunbae.guest.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.checklist.controller.dto.response.UserChecklistListResponse;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyListResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GuestControllerTest {

    private final GuestController guestController = new GuestController();

    @Test
    @DisplayName("게스트에게 샘플 매물 목록을 반환한다")
    void findProperties() {
        ApiResponse<PropertyListResponse> response = guestController.findProperties();

        assertThat(response.code()).isEqualTo("SUCCESS");
        assertThat(response.data().totalCount()).isEqualTo(2);
        assertThat(response.data().items()).hasSize(2);
    }

    @Test
    @DisplayName("게스트에게 샘플 사용자 체크리스트 목록을 반환한다")
    void findChecklists() {
        ApiResponse<UserChecklistListResponse> response = guestController.findChecklists();

        assertThat(response.code()).isEqualTo("SUCCESS");
        assertThat(response.data().totalCount()).isEqualTo(2);
        assertThat(response.data().items()).hasSize(2);
    }
}
