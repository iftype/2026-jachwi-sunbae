package com.jachwisunbae.transit.importer;

import com.jachwisunbae.JachwiSunbaeBackendApplication;
import com.jachwisunbae.transit.service.AdminDongImportService;
import com.jachwisunbae.transit.service.GtfsImportService;
import com.jachwisunbae.transit.service.dto.result.GtfsImportResult;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

// 행정동 경계와 GTFS 노선망을 순서대로 적재하는 일회성 도구다.
public class TransitImportCommand {

    private static final Logger LOG = LoggerFactory.getLogger(TransitImportCommand.class);
    private static final Set<String> OPTIONS = Set.of("transit.admin-dong.file", "transit.gtfs.directory");

    public static void main(final String[] arguments) {
        validateArguments(arguments);
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(JachwiSunbaeBackendApplication.class)
                .web(WebApplicationType.NONE)
                .run(arguments)) {
            importTransitData(context.getBean(AdminDongImportService.class), context.getBean(GtfsImportService.class));
        }
    }

    static void importTransitData(final AdminDongImportService adminDongImportService,
                                  final GtfsImportService gtfsImportService) {
        int adminDongCount = adminDongImportService.importBoundaries();
        LOG.info("행정동 경계를 적재했습니다. adminDongs={}", adminDongCount);

        GtfsImportResult gtfsResult = gtfsImportService.importFeed();
        LOG.info("GTFS 노선망을 적재했습니다. routes={}, stops={}, edges={}, transfers={}, matchedStops={}",
                gtfsResult.routeCount(), gtfsResult.stopCount(), gtfsResult.edgeCount(), gtfsResult.transferCount(),
                gtfsResult.matchedStopCount());
    }

    private static void validateArguments(final String[] arguments) {
        DefaultApplicationArguments args = new DefaultApplicationArguments(arguments);
        if (!OPTIONS.equals(args.getOptionNames()) || !args.getNonOptionArgs().isEmpty()) {
            throw new IllegalArgumentException("--transit.admin-dong.file과 --transit.gtfs.directory가 필요합니다.");
        }
        OPTIONS.forEach(option -> required(args, option));
    }

    private static String required(final DefaultApplicationArguments args, final String option) {
        var values = args.getOptionValues(option);
        if (values == null || values.size() != 1 || values.getFirst().isBlank()) {
            throw new IllegalArgumentException("필수 옵션 값이 필요합니다: --" + option);
        }
        return values.getFirst();
    }
}
