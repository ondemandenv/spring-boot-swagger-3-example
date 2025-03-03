package com.bezkoder.spring.swagger.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.bezkoder.spring.swagger.model.Tutorial;
import com.fasterxml.jackson.databind.ObjectMapper;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.sts.StsClient;
import software.amazon.awssdk.services.sts.model.GetCallerIdentityRequest;
import software.amazon.awssdk.services.sts.model.GetCallerIdentityResponse;

@Service
public class TutorialService {

    @Autowired
    private S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;


    private final ObjectMapper objectMapper;

    static List<Tutorial> tutorials = new ArrayList<Tutorial>();


    static long id = 0;

    public TutorialService(@Autowired
                           ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }


    public void printCallerIdentity() {
        StsClient stsClient = StsClient.create();
        GetCallerIdentityRequest request = GetCallerIdentityRequest.builder().build();
        GetCallerIdentityResponse callerIdentityResponse = stsClient.getCallerIdentity(request);
        System.out.println(callerIdentityResponse.toString());
    }

    // Enhanced deserialization with proper error handling
    private Tutorial deserializeTutorial(byte[] data) {
        try {
            return objectMapper.readValue(data, Tutorial.class);
        } catch (IOException e) {
            throw new RuntimeException("Failed to deserialize tutorial", e);
        }
    }

    // Robust serialization method
    private byte[] serializeTutorial(Tutorial tutorial) {
        try {
            return objectMapper.writeValueAsBytes(tutorial);
        } catch (IOException e) {
            throw new RuntimeException("Failed to serialize tutorial", e);
        }
    }

    public Tutorial findById(long id) {
        printCallerIdentity();


        try {
            String key = "tutorials/" + id + ".json";

            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            byte[] objectBytes = s3Client.getObjectAsBytes(getObjectRequest).asByteArray();
            return deserializeTutorial(objectBytes);
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to retrieve object from S3", e);
        }
    }

    public Tutorial save(Tutorial tutorial) {
        // Serialize the tutorial object
        byte[] tutorialData = serializeTutorial(tutorial);

        // Create a unique key for the S3 object
        String key = "tutorials/" + tutorial.getId() + ".json";

        // Put the object into the S3 bucket
        try {
            s3Client.putObject(builder -> builder.bucket(bucketName).key(key).build(),
                    RequestBody.fromBytes(tutorialData));
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to save tutorial to S3", e);
        }

        // Update or create new Tutorial in the local list
        if (tutorial.getId() != 0) {
            long _id = tutorial.getId();
            for (int idx = 0; idx < tutorials.size(); idx++) {
                if (_id == tutorials.get(idx).getId()) {
                    tutorials.set(idx, tutorial);
                    break;
                }
            }
            return tutorial;
        }

        // Create new Tutorial
        tutorial.setId(++id);
        tutorials.add(tutorial);
        return tutorial;
    }

    public void deleteById(long id) {
        String key = "tutorials/" + id + ".json";
        try {
            s3Client.deleteObject(builder -> builder.bucket(bucketName).key(key).build());
            tutorials.removeIf(tutorial -> tutorial.getId() == id);
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to delete tutorial from S3", e);
        }
    }

}
