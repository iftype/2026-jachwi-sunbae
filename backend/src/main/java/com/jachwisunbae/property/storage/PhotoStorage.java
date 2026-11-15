package com.jachwisunbae.property.storage;

public interface PhotoStorage {

    void upload(String key, byte[] bytes, String contentType);

    byte[] download(String key);

    PhotoStream openStream(String key);

    void delete(String key);
}
