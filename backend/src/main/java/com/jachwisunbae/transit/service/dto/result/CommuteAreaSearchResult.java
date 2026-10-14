package com.jachwisunbae.transit.service.dto.result;

import com.jachwisunbae.transit.domain.CommuteArea;
import java.util.List;

public record CommuteAreaSearchResult(int maxMinutes, List<CommuteArea> areas) {
}
