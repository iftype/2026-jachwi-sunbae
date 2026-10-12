package com.jachwisunbae.transit.provider.gtfs;

import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import org.apache.commons.csv.CSVRecord;

// GTFS 파일의 한 행이다. 값을 읽어 도메인 객체로 바꾸기만 하고, 적재 대상인지는 GtfsFeedReader가 판단한다.
public class GtfsRecord {

    private final CSVRecord row;

    public GtfsRecord(final CSVRecord row) {
        this.row = row;
    }

    public String text(final String column) {
        return row.get(column);
    }

    // 파일에 컬럼이 없어도 되는 값은 빈 문자열로 읽는다.
    public String optionalText(final String column) {
        if (!row.isMapped(column)) {
            return "";
        }
        return row.get(column);
    }

    public int integer(final String column) {
        return Integer.parseInt(text(column));
    }

    // GTFS 시각은 막차를 표현하려고 24시를 넘길 수 있어(예: 25:10:00) LocalTime으로 파싱하지 않는다.
    public int seconds(final String column) {
        String[] parts = text(column).split(":");
        return Integer.parseInt(parts[0]) * 3600
                + Integer.parseInt(parts[1]) * 60
                + Integer.parseInt(parts[2]);
    }

    // 탑승 대기 시간은 stop_times.txt를 읽은 뒤 운행 간격으로 다시 채운다.
    public GtfsRoute toRoute() {
        return new GtfsRoute(text("route_id"), text("route_short_name"), text("route_long_name"),
                integer("route_type"), GtfsRoute.DEFAULT_WAIT_TIME);
    }

    public GtfsStop toStop() {
        Coordinate coordinate = new Coordinate(Double.parseDouble(text("stop_lat")),
                Double.parseDouble(text("stop_lon")));
        return new GtfsStop(text("stop_id"), text("stop_name"), coordinate);
    }

    public GtfsTransfer toTransfer() {
        return new GtfsTransfer(text("from_stop_id"), text("to_stop_id"), new Seconds(integer("min_transfer_time")));
    }
}
