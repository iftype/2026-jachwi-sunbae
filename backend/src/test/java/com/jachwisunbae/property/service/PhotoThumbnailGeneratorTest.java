package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PhotoThumbnailGeneratorTest {

    private final PhotoThumbnailGenerator generator = new PhotoThumbnailGenerator();

    @Test
    @DisplayName("큰 사진은 긴 변 480px JPEG로 줄인다")
    void shrinksLongEdgeTo480() throws IOException {
        // given
        byte[] source = encode(image(4032, 3024, Color.GRAY), "jpeg");

        // when
        BufferedImage thumbnail = decode(generator.generate(source).orElseThrow());

        // then
        assertThat(thumbnail.getWidth()).isEqualTo(480);
        assertThat(thumbnail.getHeight()).isEqualTo(360);
    }

    @Test
    @DisplayName("썸네일보다 작은 사진은 키우지 않고, 투명한 PNG도 JPEG로 만든다")
    void keepsSmallPhotoSize() throws IOException {
        // given
        BufferedImage transparent = new BufferedImage(100, 50, BufferedImage.TYPE_INT_ARGB);
        byte[] source = encode(transparent, "png");

        // when
        byte[] thumbnail = generator.generate(source).orElseThrow();

        // then
        assertThat(thumbnail[0] & 0xFF).isEqualTo(0xFF);
        assertThat(thumbnail[1] & 0xFF).isEqualTo(0xD8);
        assertThat(decode(thumbnail).getWidth()).isEqualTo(100);
        assertThat(decode(thumbnail).getHeight()).isEqualTo(50);
    }

    @Test
    @DisplayName("EXIF 회전값이 90도 회전(6)이면 가로·세로를 바꿔 세운다")
    void appliesExifOrientation() throws IOException {
        // given
        byte[] source = withExifOrientation(encode(image(1200, 600, Color.GRAY), "jpeg"), 6);

        // when
        BufferedImage thumbnail = decode(generator.generate(source).orElseThrow());

        // then
        assertThat(thumbnail.getWidth()).isEqualTo(240);
        assertThat(thumbnail.getHeight()).isEqualTo(480);
    }

    @Test
    @DisplayName("회전값에 따라 픽셀을 시계 방향(6)과 반시계 방향(8)으로 돌린다")
    void rotatesPixels() {
        // given: 왼쪽이 빨강, 오른쪽이 파랑인 2×1 이미지
        BufferedImage source = new BufferedImage(2, 1, BufferedImage.TYPE_INT_RGB);
        source.setRGB(0, 0, Color.RED.getRGB());
        source.setRGB(1, 0, Color.BLUE.getRGB());

        // when
        BufferedImage clockwise = PhotoThumbnailGenerator.orient(source, 6);
        BufferedImage counterClockwise = PhotoThumbnailGenerator.orient(source, 8);

        // then
        assertThat(clockwise.getRGB(0, 0)).isEqualTo(Color.RED.getRGB());
        assertThat(clockwise.getRGB(0, 1)).isEqualTo(Color.BLUE.getRGB());
        assertThat(counterClockwise.getRGB(0, 0)).isEqualTo(Color.BLUE.getRGB());
        assertThat(counterClockwise.getRGB(0, 1)).isEqualTo(Color.RED.getRGB());
    }

    @Test
    @DisplayName("해석할 수 없는 사진(HEIC 등)은 썸네일을 만들지 않는다")
    void skipsUnreadablePhoto() {
        // given
        byte[] heicLike = "....ftypheic....".getBytes(StandardCharsets.US_ASCII);

        // when & then
        assertThat(generator.generate(heicLike)).isEmpty();
    }

    private static BufferedImage image(int width, int height, Color color) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        graphics.setColor(color);
        graphics.fillRect(0, 0, width, height);
        graphics.dispose();
        return image;
    }

    private static byte[] encode(BufferedImage image, String format) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, format, output);
        return output.toByteArray();
    }

    private static BufferedImage decode(byte[] bytes) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(bytes));
    }

    // JPEG 시작(SOI) 바로 뒤에 회전값 하나만 담은 EXIF(APP1) 구간을 끼워 넣는다.
    private static byte[] withExifOrientation(byte[] jpeg, int orientation) {
        ByteBuffer tiff = ByteBuffer.allocate(26);
        tiff.put("MM".getBytes(StandardCharsets.US_ASCII)).putShort((short) 42).putInt(8);
        tiff.putShort((short) 1);
        tiff.putShort((short) 0x0112).putShort((short) 3).putInt(1).putShort((short) orientation).putShort((short) 0);
        tiff.putInt(0);
        byte[] exifHeader = "Exif\0\0".getBytes(StandardCharsets.US_ASCII);
        int segmentLength = 2 + exifHeader.length + tiff.capacity();

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(jpeg, 0, 2);
        output.write(0xFF);
        output.write(0xE1);
        output.write(segmentLength >> 8);
        output.write(segmentLength & 0xFF);
        output.writeBytes(exifHeader);
        output.writeBytes(tiff.array());
        output.write(jpeg, 2, jpeg.length - 2);
        return output.toByteArray();
    }
}
