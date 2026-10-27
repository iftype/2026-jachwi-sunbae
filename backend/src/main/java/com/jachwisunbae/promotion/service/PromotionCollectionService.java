package com.jachwisunbae.promotion.service;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.provider.PromotionFetcher;
import com.jachwisunbae.promotion.repository.JdbcPromotionProductRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

// 이마트24 행사상품을 전체 수집하고 중복을 제거한 뒤 기존 목록을 교체한다.
@Service
public class PromotionCollectionService {

    private static final Logger LOG = LoggerFactory.getLogger(PromotionCollectionService.class);
    private static final ConvenienceBrand BRAND = ConvenienceBrand.EMART24;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final PromotionFetcher fetcher;
    private final JdbcPromotionProductRepository repository;
    private final Clock clock;

    public PromotionCollectionService(final PromotionFetcher fetcher, final JdbcPromotionProductRepository repository,
                                      final Clock clock) {
        this.fetcher = fetcher;
        this.repository = repository;
        this.clock = clock;
    }

    // HTTP 수집은 트랜잭션 밖에서 하고, 저장만 Repository의 트랜잭션으로 교체한다.
    //fetcher.fetch()                      // HTTP 수집, 트랜잭션 밖
    // → 결과가 비었으면 UpstreamServiceException  // 기존 데이터 유지
    // → new LinkedHashSet<>(raw)          // record 6개 필드가 모두 같을 때만 제거, 처음 수집한 순서 유지
    // → repository.replaceByBrand(...)    // 3단계에서 정한 트랜잭션: DELETE + Batch Insert
    // → 성공 로그: rawCount · duplicateCount · storedCount · collectedAt · elapsedMillis
    // (실패하면 경고 로그에 exceptionType만 남기고 예외를 다시 던짐)
    public void collect() {
        long startedAt = System.nanoTime();
        LOG.info("promotion-collection-start brand={}", BRAND);
        try {
            List<PromotionProduct> raw = fetcher.fetch();
            if (raw.isEmpty()) {
                throw new UpstreamServiceException(ErrorCode.PROMOTION_RESPONSE_INVALID,
                        "이마트24 전체 수집 결과가 비어 있어 기존 데이터를 유지합니다.");
            }
            // record의 모든 필드가 같은 항목만 제거하고 처음 수집한 순서를 유지한다.
            List<PromotionProduct> unique = List.copyOf(new LinkedHashSet<>(raw));
            LocalDateTime collectedAt = LocalDateTime.ofInstant(clock.instant(), KST);
            repository.replaceByBrand(BRAND, unique, collectedAt);
            LOG.info("promotion-collection-end brand={} success=true rawCount={} duplicateCount={} storedCount={} "
                            + "collectedAt={} elapsedMillis={}",
                    BRAND, raw.size(), raw.size() - unique.size(), unique.size(), collectedAt, elapsedMillis(startedAt));
        } catch (RuntimeException exception) {
            LOG.warn("promotion-collection-end brand={} success=false exceptionType={} elapsedMillis={}",
                    BRAND, exception.getClass().getSimpleName(), elapsedMillis(startedAt));
            throw exception;
        }
    }

    // 최초 배포처럼 저장된 목록이 없을 때만 수집해, 재배포마다 전체 수집하지 않는다.
    public void collectIfEmpty() {
        if (repository.findLastCollectedAt(BRAND).isPresent()) {
            LOG.info("promotion-initial-collection-skipped brand={} reason=already-collected", BRAND);
            return;
        }
        collect();
    }

    private long elapsedMillis(final long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
