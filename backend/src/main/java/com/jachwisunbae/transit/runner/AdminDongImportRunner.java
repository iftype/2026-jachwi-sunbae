package com.jachwisunbae.transit.runner;

import com.jachwisunbae.transit.service.AdminDongImportService;
import com.jachwisunbae.transit.service.dto.result.AdminDongImportResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

// transit.admin-dong.import-on-startup=true로 애플리케이션을 띄울 때만 동작한다. 실행 예:
// java -jar app.jar --spring.main.web-application-type=none \
//     --transit.admin-dong.import-on-startup=true --transit.admin-dong.file=<행정동 GeoJSON 파일>
// 행정동 경계를 한 번 적재하고, 성공하면 0, 실패하면 1을 종료 코드로 남기고 프로세스를 끝낸다.
@Component
@ConditionalOnProperty(name = "transit.admin-dong.import-on-startup", havingValue = "true")
public class AdminDongImportRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(AdminDongImportRunner.class);
    private static final int SUCCESS = 0;
    private static final int FAILURE = 1;

    private final AdminDongImportService importService;
    private final ConfigurableApplicationContext context;

    public AdminDongImportRunner(final AdminDongImportService importService,
                                 final ConfigurableApplicationContext context) {
        this.importService = importService;
        this.context = context;
    }

    @Override
    public void run(final ApplicationArguments arguments) {
        int exitCode = importBoundaries();
        System.exit(SpringApplication.exit(context, () -> exitCode));
    }

    int importBoundaries() {
        try {
            AdminDongImportResult result = importService.importBoundaries();
            LOG.info("행정동 경계를 적재했습니다. adminDongs={}, stops={}, matchedStops={}",
                    result.adminDongCount(), result.stopCount(), result.matchedStopCount());
            return SUCCESS;
        } catch (RuntimeException exception) {
            LOG.error("행정동 경계 적재에 실패했습니다. 기존 행정동 경계는 그대로 남습니다.", exception);
            return FAILURE;
        }
    }
}
