package com.jachwisunbae.transit.domain;

import com.jachwisunbae.transit.domain.vo.Coordinate;

public record GtfsStop(String stopId, String stopName, Coordinate coordinate) {
}
