package com.jachwisunbae.transit.runner;

import com.jachwisunbae.transit.service.GtfsImportService;
import com.jachwisunbae.transit.service.dto.result.GtfsImportResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

// transit.gtfs.import-on-startup=true로 애플리케이션을 띄울 때만 동작한다. 실행 예:
// java -jar app.jar --spring.main.web-application-type=none \
//     --transit.gtfs.import-on-startup=true --transit.gtfs.directory=<GTFS 디렉터리>
// 노선망을 한 번 적재하고, 성공하면 0, 실패하면 1을 종료 코드로 남기고 프로세스를 끝낸다.
@Component
@ConditionalOnProperty(name = "transit.gtfs.import-on-startup", havingValue = "true")
public class GtfsImportRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(GtfsImportRunner.class);
    private static final int SUCCESS = 0;
    private static final int FAILURE = 1;

    private final GtfsImportService importService;
    private final ConfigurableApplicationContext context;

    public GtfsImportRunner(final GtfsImportService importService, final ConfigurableApplicationContext context) {
        this.importService = importService;
        this.context = context;
    }

    @Override
    public void run(final ApplicationArguments arguments) {
        int exitCode = importFeed();
        System.exit(SpringApplication.exit(context, () -> exitCode));
    }

    int importFeed() {
        try {
            GtfsImportResult result = importService.importFeed();
            LOG.info("GTFS 노선망을 적재했습니다. routes={}, stops={}, edges={}, transfers={}",
                    result.routeCount(), result.stopCount(), result.edgeCount(), result.transferCount());
            return SUCCESS;
        } catch (RuntimeException exception) {
            LOG.error("GTFS 노선망 적재에 실패했습니다. 기존 노선망은 그대로 남습니다.", exception);
            return FAILURE;
        }
    }
}
