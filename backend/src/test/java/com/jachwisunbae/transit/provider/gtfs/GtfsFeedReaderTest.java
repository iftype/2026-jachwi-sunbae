package com.jachwisunbae.transit.provider.gtfs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GtfsFeedReaderTest {

    @TempDir
    Path directory;

    private final GtfsFeedReader reader = new GtfsFeedReader();

    @Test
    @DisplayName("버스·지하철 노선의 구간 이동 시간 중앙값과 운행 간격 기반 대기 시간을 만든다")
    void readsMedianEdgesAndHeadwayWaits() throws IOException {
        write("routes.txt", """
                route_id,agency_id,route_short_name,route_long_name,route_type
                Q1,A,1호선,서울 1호선,1
                Q2,A,경의선,경의선,2
                """);
        write("trips.txt", """
                route_id,service_id,trip_id
                Q1,W,T1
                Q1,W,T2
                Q1,W,T3
                Q2,W,T4
                """);
        write("stop_times.txt", """
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                T1,08:00:00,08:00:00,P0,1
                T1,08:02:00,08:02:00,P1,2
                T2,08:20:00,08:20:00,P0,1
                T2,08:21:00,08:21:00,P1,2
                T3,08:40:00,08:40:00,P0,1
                T3,08:45:00,08:45:00,P1,2
                T4,09:00:00,09:00:00,P9,1
                """);
        write("stops.txt", "﻿" + """
                stop_id,stop_name,stop_lat,stop_lon
                P0,서울역,37.55,126.97
                P1,시청,37.56,126.97
                P9,수색,37.58,126.89
                """);
        write("transfers.txt", """
                from_stop_id,to_stop_id,transfer_type,min_transfer_time
                P0,P1,2,180
                P0,P9,2,60
                """);

        GtfsFeed feed = reader.read(directory);

        assertThat(feed.routes()).containsExactly(new GtfsRoute("Q1", "1호선", "서울 1호선", 1, new Seconds(600)));
        assertThat(feed.stops()).containsExactly(
                new GtfsStop("P0", "서울역", new Coordinate(37.55, 126.97)),
                new GtfsStop("P1", "시청", new Coordinate(37.56, 126.97)));
        assertThat(feed.edges()).containsExactly(new GtfsEdge("Q1", "P0", "P1", new Seconds(120)));
        assertThat(feed.transfers()).containsExactly(new GtfsTransfer("P0", "P1", new Seconds(180)));
    }

    @Test
    @DisplayName("24시를 넘는 막차 시각과 같은 정류장 반복 정차를 처리한다")
    void handlesLateNightTimesAndRepeatedStops() throws IOException {
        write("routes.txt", """
                route_id,route_short_name,route_long_name,route_type
                B1,472,간선 472,0
                """);
        write("trips.txt", """
                route_id,service_id,trip_id
                B1,W,T1
                """);
        write("stop_times.txt", """
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                T1,24:59:50,25:00:00,S1,1
                T1,25:00:00,25:00:10,S1,2
                T1,25:00:10,25:00:10,S2,3
                """);
        write("stops.txt", """
                stop_id,stop_name,stop_lat,stop_lon
                S1,강남역,37.49,127.02
                S2,역삼역,37.50,127.03
                """);
        write("transfers.txt", "from_stop_id,to_stop_id,transfer_type,min_transfer_time\n");

        GtfsFeed feed = reader.read(directory);

        assertThat(feed.routes()).extracting(GtfsRoute::waitTime).containsExactly(new Seconds(300));
        assertThat(feed.edges()).containsExactly(new GtfsEdge("B1", "S1", "S2", new Seconds(30)));
    }

    @Test
    @DisplayName("환승 불가 유형과 최소 환승 시간이 없는 환승은 적재하지 않는다")
    void skipsTransfersWithoutUsableTime() throws IOException {
        writeSingleTripFeed("""
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                T1,08:00:00,08:00:00,S1,1
                T1,08:02:00,08:02:00,S2,2
                """);
        write("transfers.txt", """
                from_stop_id,to_stop_id,transfer_type,min_transfer_time
                S1,S2,2,180
                S2,S1,3,60
                S1,S1,0,
                """);

        GtfsFeed feed = reader.read(directory);

        assertThat(feed.transfers()).containsExactly(new GtfsTransfer("S1", "S2", new Seconds(180)));
    }

    @Test
    @DisplayName("같은 정류장 쌍의 환승이 여러 번 나오면 가장 짧은 환승 시간만 남긴다")
    void keepsShortestDuplicateTransfer() throws IOException {
        writeSingleTripFeed("""
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                T1,08:00:00,08:00:00,S1,1
                T1,08:02:00,08:02:00,S2,2
                """);
        write("transfers.txt", """
                from_stop_id,to_stop_id,transfer_type,min_transfer_time
                S1,S2,2,300
                S1,S2,2,120
                S2,S1,2,60
                S1,S2,2,240
                """);

        GtfsFeed feed = reader.read(directory);

        assertThat(feed.transfers()).containsExactly(
                new GtfsTransfer("S1", "S2", new Seconds(120)),
                new GtfsTransfer("S2", "S1", new Seconds(60)));
    }

    @Test
    @DisplayName("한 운행편의 정차 기록이 흩어져 있으면 틀린 구간을 만들지 않고 적재를 멈춘다")
    void failsWhenTripRowsAreNotContiguous() throws IOException {
        writeSingleTripFeed("""
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                T1,08:00:00,08:00:00,S1,1
                T2,08:10:00,08:10:00,S1,1
                T1,08:02:00,08:02:00,S2,2
                """);
        write("transfers.txt", "from_stop_id,to_stop_id,transfer_type,min_transfer_time\n");

        assertThatThrownBy(() -> reader.read(directory))
                .isInstanceOf(InternalSystemException.class)
                .hasMessageContaining("trip_id=T1");
    }

    @Test
    @DisplayName("정차 순서가 증가하지 않으면 적재를 멈춘다")
    void failsWhenStopSequenceDoesNotIncrease() throws IOException {
        writeSingleTripFeed("""
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                T1,08:02:00,08:02:00,S2,2
                T1,08:00:00,08:00:00,S1,1
                """);
        write("transfers.txt", "from_stop_id,to_stop_id,transfer_type,min_transfer_time\n");

        assertThatThrownBy(() -> reader.read(directory))
                .isInstanceOf(InternalSystemException.class)
                .hasMessageContaining("stop_sequence");
    }

    @Test
    @DisplayName("좌표가 범위를 벗어난 정류장이 있으면 파일과 줄 번호를 알리고 적재를 멈춘다")
    void failsWhenStopCoordinateIsInvalid() throws IOException {
        writeSingleTripFeed("""
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                T1,08:00:00,08:00:00,S1,1
                T1,08:02:00,08:02:00,S2,2
                """);
        write("stops.txt", """
                stop_id,stop_name,stop_lat,stop_lon
                S1,강남역,37.49,127.02
                S2,역삼역,127.03,37.50
                """);
        write("transfers.txt", "from_stop_id,to_stop_id,transfer_type,min_transfer_time\n");

        assertThatThrownBy(() -> reader.read(directory))
                .isInstanceOf(InternalSystemException.class)
                .hasMessageContaining("stops.txt 3번째 줄");
    }

    @Test
    @DisplayName("GTFS 파일이 없으면 서버 내부 오류로 알린다")
    void failsWhenFeedFileIsMissing() {
        assertThatThrownBy(() -> reader.read(directory))
                .isInstanceOf(InternalSystemException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TRANSIT_FEED_READ_FAILURE);
    }

    private void writeSingleTripFeed(final String stopTimes) throws IOException {
        write("routes.txt", """
                route_id,route_short_name,route_long_name,route_type
                B1,472,간선 472,3
                """);
        write("trips.txt", """
                route_id,service_id,trip_id
                B1,W,T1
                B1,W,T2
                """);
        write("stop_times.txt", stopTimes);
        write("stops.txt", """
                stop_id,stop_name,stop_lat,stop_lon
                S1,강남역,37.49,127.02
                S2,역삼역,37.50,127.03
                """);
    }

    private void write(final String fileName, final String content) throws IOException {
        Files.writeString(directory.resolve(fileName), content);
    }
}
