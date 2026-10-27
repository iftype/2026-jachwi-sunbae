package com.jachwisunbae.property.repository;

import com.jachwisunbae.property.repository.query.PropertyListItemQuery;
import com.jachwisunbae.property.repository.query.PropertyLocationQuery;
import java.util.List;
import java.util.Optional;
import com.jachwisunbae.property.entity.Property;
import java.time.LocalDateTime;

public interface PropertyRepository {
    List<PropertyListItemQuery> findListByMemberId(long memberId);

    List<PropertyLocationQuery> findLocationsByMemberId(long memberId);

    int countByMemberId(long memberId);

    Property save(Property property);
    Optional<Property> findByIdAndMemberId(long propertyId, long memberId);

    boolean existsByIdAndMemberId(long propertyId, long memberId);

    Optional<Property> findByIdAndMemberIdForUpdate(long propertyId, long memberId);

    Property update(Property property);

    void updateMemo(Property property);

    void deleteById(long propertyId);

}
