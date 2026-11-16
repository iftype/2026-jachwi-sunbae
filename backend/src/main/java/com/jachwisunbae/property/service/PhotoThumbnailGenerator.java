package com.jachwisunbae.property.service;

import com.twelvemonkeys.imageio.metadata.Entry;
import com.twelvemonkeys.imageio.metadata.jpeg.JPEG;
import com.twelvemonkeys.imageio.metadata.jpeg.JPEGSegment;
import com.twelvemonkeys.imageio.metadata.jpeg.JPEGSegmentUtil;
import com.twelvemonkeys.imageio.metadata.tiff.TIFF;
import com.twelvemonkeys.imageio.metadata.tiff.TIFFReader;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

// 목록 카드(107×136px)와 지도 마커(45×45px)에 쓰는 썸네일을 만든다. 화면 배율 3에서도 흐리지 않도록 긴 변 480px JPEG로 만든다.
// 썸네일은 없으면 원본으로 대신할 수 있으므로, 만들지 못한 사진은 빈 값을 돌려주고 업로드는 그대로 진행한다.
@Component
public class PhotoThumbnailGenerator {

    public static final String CONTENT_TYPE = "image/jpeg";
    static final int MAX_EDGE = 480;

    private static final Logger LOG = LoggerFactory.getLogger(PhotoThumbnailGenerator.class);
    // 4032×3024 사진을 그대로 디코딩하면 약 49MB다. 긴 변이 썸네일의 두 배 이상 남는 만큼만 건너뛰며 읽어 메모리를 줄인다.
    private static final int MIN_DECODED_EDGE = MAX_EDGE * 2;
    private static final float JPEG_QUALITY = 0.8f;
    private static final int NORMAL_ORIENTATION = 1;

    public Optional<byte[]> generate(final byte[] source) {
        Optional<BufferedImage> decoded = decode(source);
        if (decoded.isEmpty()) {
            return Optional.empty();
        }
        try {
            BufferedImage thumbnail = orient(resize(decoded.get()), readOrientation(source));
            return Optional.of(encodeJpeg(thumbnail));
        } catch (IOException | RuntimeException exception) {
            LOG.warn("썸네일을 JPEG로 만들지 못해 원본으로 대신합니다.", exception);
            return Optional.empty();
        }
    }

    // 사용자가 올린 이미지는 깨져 있을 수 있고, ImageIO는 깨진 이미지에서 IOException 외의 런타임 예외도 던진다.
    // 그래서 이미지를 해석하는 이 부분에 한정해 RuntimeException까지 잡아 썸네일만 포기한다.
    private Optional<BufferedImage> decode(final byte[] source) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            Iterator<ImageReader> readers = input == null ? Collections.emptyIterator()
                    : ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                // HEIC·HEIF는 ImageIO가 읽지 못한다. 이런 사진은 원본으로 대신한다.
                LOG.info("썸네일을 만들 수 없는 사진 형식이라 원본으로 대신합니다.");
                return Optional.empty();
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int longEdge = Math.max(reader.getWidth(0), reader.getHeight(0));
                int subsampling = Math.max(1, longEdge / MIN_DECODED_EDGE);
                ImageReadParam parameter = reader.getDefaultReadParam();
                parameter.setSourceSubsampling(subsampling, subsampling, 0, 0);
                return Optional.of(reader.read(0, parameter));
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException exception) {
            LOG.warn("썸네일을 만들 사진을 해석하지 못해 원본으로 대신합니다.", exception);
            return Optional.empty();
        }
    }

    // 투명 배경(PNG)은 JPEG에 담을 수 없으므로 흰 배경 위에 그린다.
    private BufferedImage resize(final BufferedImage source) {
        double scale = Math.min(1d, MAX_EDGE / (double) Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage target = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    // 휴대폰 사진은 픽셀을 눕힌 채 저장하고 EXIF 회전값으로 바로 세우는 경우가 많다.
    // 브라우저는 원본을 그릴 때 이 값을 적용하지만 ImageIO는 적용하지 않으므로, 썸네일에 직접 반영한다.
    private int readOrientation(final byte[] source) {
        if (!isJpeg(source)) {
            return NORMAL_ORIENTATION;
        }
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            List<JPEGSegment> segments = JPEGSegmentUtil.readSegments(input, JPEG.APP1, "Exif");
            if (segments.isEmpty()) {
                return NORMAL_ORIENTATION;
            }
            InputStream exifData = segments.getFirst().data();
            // "Exif" 식별자 뒤에 붙은 0 바이트를 건너뛴다.
            exifData.read();
            try (ImageInputStream exif = ImageIO.createImageInputStream(exifData)) {
                Entry orientation = new TIFFReader().read(exif).getEntryById(TIFF.TAG_ORIENTATION);
                return orientation != null && orientation.getValue() instanceof Number value
                        ? value.intValue() : NORMAL_ORIENTATION;
            }
        } catch (IOException | RuntimeException exception) {
            // 회전값을 읽지 못해도 썸네일은 만든다. 방향만 원본 픽셀 그대로다.
            LOG.info("사진의 EXIF 회전값을 읽지 못해 회전하지 않고 썸네일을 만듭니다.", exception);
            return NORMAL_ORIENTATION;
        }
    }

    private static boolean isJpeg(final byte[] source) {
        return source.length > 2 && (source[0] & 0xFF) == 0xFF && (source[1] & 0xFF) == 0xD8;
    }

    // EXIF 회전값 1~8을 픽셀 변환으로 바꾼다. 5~8은 가로·세로가 바뀐다.
    static BufferedImage orient(final BufferedImage source, final int orientation) {
        int width = source.getWidth();
        int height = source.getHeight();
        AffineTransform transform = switch (orientation) {
            case 2 -> new AffineTransform(-1, 0, 0, 1, width, 0);
            case 3 -> new AffineTransform(-1, 0, 0, -1, width, height);
            case 4 -> new AffineTransform(1, 0, 0, -1, 0, height);
            case 5 -> new AffineTransform(0, 1, 1, 0, 0, 0);
            case 6 -> new AffineTransform(0, 1, -1, 0, height, 0);
            case 7 -> new AffineTransform(0, -1, -1, 0, height, width);
            case 8 -> new AffineTransform(0, -1, 1, 0, 0, width);
            default -> null;
        };
        if (transform == null) {
            return source;
        }
        boolean swapsEdges = orientation >= 5;
        BufferedImage target = new BufferedImage(swapsEdges ? height : width, swapsEdges ? width : height,
                BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.drawImage(source, transform, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private byte[] encodeJpeg(final BufferedImage image) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            ImageWriteParam parameter = writer.getDefaultWriteParam();
            parameter.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parameter.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(image, null, null), parameter);
            imageOutput.flush();
            return output.toByteArray();
        } finally {
            writer.dispose();
        }
    }
}
