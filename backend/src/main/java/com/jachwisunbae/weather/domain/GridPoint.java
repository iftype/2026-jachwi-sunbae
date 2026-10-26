package com.jachwisunbae.weather.domain;

public record GridPoint(int nx, int ny) {

    public static final int WIDTH = 149;
    public static final int HEIGHT = 253;
    public static final int CELL_COUNT = WIDTH * HEIGHT;

    public GridPoint {
        if (nx < 1 || nx > WIDTH || ny < 1 || ny > HEIGHT) {
            throw new IllegalArgumentException("기상청 격자 범위를 벗어났습니다.");
        }
    }

    public int toIndex() {
        return (ny - 1) * WIDTH + nx - 1;
    }

    public static GridPoint fromIndex(final int index) {
        if (index < 0 || index >= CELL_COUNT) {
            throw new IllegalArgumentException("기상청 격자 인덱스 범위를 벗어났습니다.");
        }
        // RAW 배열은 x가 먼저 증가하며, 기상청 격자 좌표는 1부터 시작한다.
        return new GridPoint(index % WIDTH + 1, index / WIDTH + 1);
    }
}
