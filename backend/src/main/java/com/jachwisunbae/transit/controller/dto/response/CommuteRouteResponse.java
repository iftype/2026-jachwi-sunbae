package com.jachwisunbae.transit.controller.dto.response;

import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.RouteLeg;
import com.jachwisunbae.transit.domain.RoutePoint;
import java.util.List;

public record CommuteRouteResponse(int totalMinutes, int transferCount, List<Leg> legs) {

    public static CommuteRouteResponse from(final CommuteRoute route) {
        return new CommuteRouteResponse(route.totalMinutes(), route.transferCount(),
                route.legs().stream().map(Leg::from).toList());
    }

    public record Leg(String type, String routeName, int minutes, int waitMinutes, List<Point> points) {

        static Leg from(final RouteLeg leg) {
            return new Leg(leg.type().name(), leg.routeName(), leg.rideMinutes(), leg.waitMinutes(),
                    leg.points().stream().map(Point::from).toList());
        }
    }

    public record Point(String stopId, String name, double latitude, double longitude) {

        static Point from(final RoutePoint point) {
            return new Point(point.stopId(), point.name(), point.coordinate().latitude(),
                    point.coordinate().longitude());
        }
    }
}
