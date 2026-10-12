package com.jachwisunbae.transit.domain;

import com.jachwisunbae.transit.domain.vo.Seconds;

public record GtfsTransfer(String fromStopId, String toStopId, Seconds transferTime) {
}
