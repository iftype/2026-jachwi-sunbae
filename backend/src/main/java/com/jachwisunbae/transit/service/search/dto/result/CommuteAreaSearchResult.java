package com.jachwisunbae.transit.service.search.dto.result;

import com.jachwisunbae.transit.domain.search.CommuteArea;
import java.util.List;

public record CommuteAreaSearchResult(int maxMinutes, List<CommuteArea> areas) {
}
