set -ex

JAVA_HOME=$JAVA_HOME_17_X64 && chmod +x mvnw && ./mvnw org.springframework.boot:spring-boot-maven-plugin:3.0.4:build-image