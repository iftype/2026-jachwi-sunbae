package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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
import org.springframework.web.util.UriBuilder;

// 기상청 API허브의 단기예보 격자 API를 호출해, 요청 하나(발표·예보 시각, 요소)의 전국 격자 값을 받는다.
@Component
public class KmaForecastClient {

    private static final String BASE_URL = "https://apihub.kma.go.kr";
    private static final String FORECAST_PATH = "/api/typ01/cgi-bin/url/nph-dfs_shrt_grd";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(15);

    private final RestClient client;
    private final String apiKey;
    private final KmaGridParser parser = new KmaGridParser();

    @Autowired
    public KmaForecastClient(@Value("${weather.kma.api-key:}") final String apiKey) {
        this(createClient(), apiKey);
    }

    // 테스트에서 모의 서버용 RestClient를 주입한다.
    KmaForecastClient(final RestClient client, final String apiKey) {
        this.client = client;
        this.apiKey = apiKey;
    }

    public GridForecast fetch(final KmaForecastRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("요청할 발표·예보 시각과 기상 요소가 필요합니다.");
        }
        validateApiKey();
        String body = new String(download(request), StandardCharsets.UTF_8);
        return parser.parse(body, request.times(), request.element());
    }

    // 실패는 모두 UpstreamServiceException으로 바꾼다.
    private byte[] download(final KmaForecastRequest request) {
        try {
            return client.get()
                    .uri(uri -> forecastUri(uri, request))
                    .accept(MediaType.TEXT_PLAIN)
                    .exchange((clientRequest, response) -> readOkBody(response));
        } catch (ResourceAccessException exception) {
            // 원래 예외의 URL·메시지·cause에 authKey가 포함될 수 있어 전달하지 않는다.
            throw new UpstreamServiceException(ErrorCode.WEATHER_PROVIDER_UNAVAILABLE,
                    "기상청 예보 요청 중 네트워크 오류 또는 시간 초과가 발생했습니다.");
        } catch (RestClientException exception) {
            throw new UpstreamServiceException(ErrorCode.WEATHER_PROVIDER_UNAVAILABLE,
                    "기상청 예보 응답을 수신하지 못했습니다.");
        }
    }

    // authKey는 URI 템플릿 변수로 넣어 특수문자가 인코딩되게 한다.
    private URI forecastUri(final UriBuilder uri, final KmaForecastRequest request) {
        return uri.path(FORECAST_PATH)
                .queryParam("tmfc", request.tmfc())
                .queryParam("tmef", request.tmef())
                .queryParam("vars", request.element().name())
                .queryParam("authKey", "{apiKey}")
                .build(apiKey);
    }

    // exchange는 상태 코드를 자동 검사하지 않으므로 200 외의 응답(리다이렉트 포함)은 직접 실패 처리한다.
    private static byte[] readOkBody(final ClientHttpResponse response) throws IOException {
        int status = response.getStatusCode().value();
        if (status != HttpStatus.OK.value()) {
            throw new UpstreamServiceException(ErrorCode.WEATHER_PROVIDER_UNAVAILABLE,
                    "기상청 예보 요청에 실패했습니다. HTTP status=" + status);
        }
        return StreamUtils.copyToByteArray(response.getBody());
    }

    // 연결 3초·응답 15초 제한을 두고, 리다이렉트는 따라가지 않는다.
    static RestClient createClient() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(READ_TIMEOUT);
        return RestClient.builder().baseUrl(BASE_URL).requestFactory(factory).build();
    }

    private void validateApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("기상청 예보 요청에는 KMA_API_KEY가 필요합니다.");
        }
    }
}
