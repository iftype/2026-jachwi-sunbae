package com.jachwisunbae.property.repository;

import com.jachwisunbae.property.repository.query.PropertyProgressSummary;
import java.util.List;
import com.jachwisunbae.property.repository.query.PropertyChecklistProgressQuery;

public interface PropertyProgressRepository {
    PropertyProgressSummary findByPropertyId(long propertyId);

    List<PropertyChecklistProgressQuery> findByPropertyIdAndStage(long propertyId);

    List<PropertyChecklistProgressQuery> findByMemberIdAndStage(long memberId);
}
