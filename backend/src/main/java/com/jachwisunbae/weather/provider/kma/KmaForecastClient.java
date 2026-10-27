package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class KmaForecastClient {

    private static final Logger LOG = LoggerFactory.getLogger(KmaForecastClient.class);
    private static final String BASE_URL = "https://apihub.kma.go.kr";
    private static final String FORECAST_PATH = "/api/typ01/cgi-bin/url/nph-dfs_shrt_grd";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(15);
    private static final ZoneOffset KST = ZoneOffset.ofHours(9);

    private final RestClient client;
    private final String apiKey;
    private final KmaGridParser parser = new KmaGridParser();

    @Autowired
    public KmaForecastClient(@Value("${weather.kma.api-key:}") final String apiKey) {
        this(createClient(), apiKey);
    }

    KmaForecastClient(final RestClient client, final String apiKey) {
        this.client = client;
        this.apiKey = apiKey;
    }

    public GridForecast fetch(final KmaForecastRequest request) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("기상청 예보 요청에는 KMA_API_KEY가 필요합니다.");
        }
        long startedAt = System.nanoTime();
        try {
            return client.get().uri(uri -> uri.path(FORECAST_PATH)
                    .queryParam("tmfc", request.tmfc()).queryParam("tmef", request.tmef())
                    .queryParam("vars", request.element().name()).queryParam("authKey", "{apiKey}").build(apiKey))
                    .accept(MediaType.TEXT_PLAIN)
                    .exchange((clientRequest, response) -> readForecast(response, request, startedAt));
        } catch (ResourceAccessException exception) {
            // 원래 예외의 URL·메시지·cause에 authKey가 포함될 수 있어 전달하지 않는다.
            logFailure(request, ErrorCode.WEATHER_PROVIDER_UNAVAILABLE, null, startedAt);
            throw new UpstreamServiceException(ErrorCode.WEATHER_PROVIDER_UNAVAILABLE,
                    "기상청 예보 요청 중 네트워크 오류 또는 시간 초과가 발생했습니다.");
        } catch (RestClientException exception) {
            logFailure(request, ErrorCode.WEATHER_PROVIDER_UNAVAILABLE, null, startedAt);
            throw new UpstreamServiceException(ErrorCode.WEATHER_PROVIDER_UNAVAILABLE, "기상청 예보 응답을 수신하지 못했습니다.");
        }
    }

    private GridForecast readForecast(final ClientHttpResponse response, final KmaForecastRequest request,
                                      final long startedAt) throws IOException {
        int httpStatus = response.getStatusCode().value();
        try {
            // exchange는 상태를 자동 검사하지 않으므로 리다이렉트를 포함해 200 외에는 거부한다.
            if (httpStatus != HttpStatus.OK.value()) {
                throw new UpstreamServiceException(ErrorCode.WEATHER_PROVIDER_UNAVAILABLE,
                        "기상청 예보 요청에 실패했습니다. HTTP status=" + httpStatus);
            }
            String body = StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
            return parser.parse(body, request.times(), request.element());
        } catch (UpstreamServiceException exception) {
            logFailure(request, exception.getErrorCode(), httpStatus, startedAt);
            throw exception;
        } catch (IOException exception) {
            // 헤더 수신 후 본문 읽기가 실패하면 이미 확인한 HTTP 상태를 보존한다.
            logFailure(request, ErrorCode.WEATHER_PROVIDER_UNAVAILABLE, httpStatus, startedAt);
            throw new UpstreamServiceException(ErrorCode.WEATHER_PROVIDER_UNAVAILABLE,
                    "기상청 예보 요청 중 네트워크 오류 또는 시간 초과가 발생했습니다.");
        }
    }

    private void logFailure(final KmaForecastRequest request, final ErrorCode errorCode,
                            final Integer httpStatus, final long startedAt) {
        // 허용한 메타데이터만 기록한다. URL·본문·원본 예외와 메시지는 로그에 전달하지 않는다.
        LOG.atWarn()
                .addKeyValue("publishedAt", request.times().publishedAt().atOffset(KST).toString())
                .addKeyValue("forecastAt", request.times().forecastAt().atOffset(KST).toString())
                .addKeyValue("element", request.element().name())
                .addKeyValue("errorCode", errorCode.name())
                .addKeyValue("httpStatus", httpStatus)
                .addKeyValue("durationMs", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt))
                .log("weather-kma-request-failed");
    }

    static RestClient createClient() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(READ_TIMEOUT);
        return RestClient.builder().baseUrl(BASE_URL).requestFactory(factory).build();
    }

}
