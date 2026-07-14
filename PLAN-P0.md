# P0 — Foundation & Booking Spine · Implementation Plan (Spring Boot)

> # ⚠️ SUPERSEDED STACK — READ THIS FIRST
>
> **This plan is written in Java/Spring. The project is built in Go.** See ROADMAP §10,
> *"The language decision, revisited"*.
>
> **What is still true — and it is most of the document.** The architecture, the module
> boundaries, the aggregate ownership, the 13-state booking spine, the event catalog, the
> ordering of the tasks, the exit criteria, and above all the *reasoning* behind each
> decision. Read this plan for **what to build and why**.
>
> **What is wrong.** Every code block, every file path, every `pom.xml`, and the Tech Stack
> line below. Do **not** copy code out of this document. Translate the intent.
>
> | This plan says | The code does |
> |---|---|
> | Java 21 · Spring Boot 3.4 · Maven | **Go 1.26** |
> | Spring JDBC (`JdbcClient`) · Flyway | **pgx + sqlc · goose** |
> | Spring Modulith `verify()` for module walls | **Nested `internal/` packages** — compiler-enforced |
> | ArchUnit rule for state-machine purity | **`depguard`** in `.golangci.yml` |
> | Java `enum` (exhaustiveness free) | **`exhaustive` linter + DB `CHECK` + a `go/ast` drift test.** See ROADMAP §7a — this is Go's weakest point here and needs three guards, not one. |
> | Modulith `event_publication` (free) | **Hand-rolled transactional `outbox`** |
> | JUnit 5 + AssertJ + Testcontainers | **stdlib `testing` + testcontainers-go** |
>
> **Three schema decisions in this plan are also WRONG and were corrected** (see ROADMAP §9):
> 1. `technicians.skills TEXT[]` / `services.required_skills TEXT[]` → **`skills` + join tables with real FKs.** The array version has no referential integrity, so one typo silently yields zero eligible technicians and escalates every booking of that service, forever.
> 2. No `orders` table; money attached to the booking → **`orders` exists from day one.** A booking is one *visit*; an order is one *purchase*. One payment across two bookings has no honest home without it.
> 3. `otp_challenges` had no column distinguishing a Start OTP from a Completion OTP → **`purpose` added.** As written, a technician could replay the arrival OTP to mark the job complete.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Spring Modulith monolith whose booking state machine is provably correct — every legal transition works, every illegal transition is rejected — with no UI beyond a bare admin shell.

**Architecture:** One deployable Spring Boot app, one Postgres database. Each domain module is a top-level package under `com.sethu`; its **public types are its API** and everything in its `internal` sub-package is invisible to other modules — enforced by **Spring Modulith's `verify()` test**, which fails the build on violation. Modules communicate by calling another module's public service, or by publishing domain events. The booking state machine is a **pure static class** with no Spring, no JDBC, no I/O — guarded by an ArchUnit rule — so it can be exhaustively tested in milliseconds.

**Tech Stack:** Java 21 LTS · Spring Boot 3.4 · Spring Modulith 1.3 · PostgreSQL 16 + PostGIS · Flyway · Spring JDBC (`JdbcClient`) · Spring Security (JWT) · springdoc-openapi · Testcontainers · JUnit 5 + AssertJ + ArchUnit · Next.js 15 (admin shell) · Maven

## Why Spring Modulith earns its place

Three things in the ROADMAP design are *first-class features* here rather than things we hand-roll:

1. **The module walls** (ROADMAP §4.2) become `ApplicationModules.of(SethuApplication.class).verify()` — a **test**, not a lint rule. It cannot be silenced by an inline comment.
2. **The event bus** (ROADMAP §8) becomes `ApplicationEventPublisher` + `@ApplicationModuleListener`, which publishes **only if the transaction commits** — exactly the guarantee we need so a booking never emits `booking.completed` for a transition that rolled back.
3. **The event publication registry** persists every event and its listeners. If Notifications throws, the publication is recorded as *incomplete* and can be retried — instead of vanishing into a log line.

## Global Constraints

- **Java 21** (verified locally: 21.0.9 LTS). **Maven 3.9** (verified: 3.9.14). No Gradle.
- **Module walls:** a module may reference another module only through that module's **top-level public types**. Anything under `com.sethu.<module>.internal` is private. `ModularityTests` fails the build otherwise. **Never add a class to another module's package to get around this.**
- **The booking state machine is pure.** `com.sethu.booking.BookingStateMachine` must not reference Spring, JDBC, or any I/O. An ArchUnit rule enforces this. If it needs a dependency, the design is wrong.
- **`ledger_entries` and `booking_events` are append-only.** No `UPDATE`, no `DELETE`, ever. Corrections are new offsetting rows.
- **OTP codes are never stored in plaintext.** Store a BCrypt hash. Log the code only when `NODE_ENV`-equivalent (`spring.profiles.active`) is `dev`.
- **Money is `long` paise.** Never `double`, never `float`. `BigDecimal` only at the presentation edge.
- **Every state transition writes a `booking_events` row in the same transaction as the booking update.** If the event write fails, the transition fails.
- **JUnit 5 does not parallelise by default. Do not enable it.** Tests share one Testcontainers database and truncate between runs; parallelism would make them race.
- **Stop line (do not build in P0):** no mobile apps, no design system, no dispatch/offer engine, no real payment gateway, no notification *delivery*, no live GPS, no dual-OTP verification (that is P1).

**Reference spec:** `ROADMAP.md` — §4 (architecture), §5.1 (capacity model), §6 (money), §7 (state machine), §8 (event catalog), §9 (data model), §10 (stack).

---

## File Structure

```
sethu-care/
├── docker-compose.yml                    # postgres+postgis, redis (redis unused until P2)
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/sethu/
│   │   │   ├── SethuApplication.java
│   │   │   ├── shared/                   # OPEN module — everyone may use it
│   │   │   │   ├── Money.java
│   │   │   │   └── security/{JwtConfig,SecurityConfig,AuthedUser}.java
│   │   │   ├── events/                   # OPEN module — THE EVENT CATALOG (ROADMAP §8)
│   │   │   │   └── DomainEvent.java      # sealed interface + records
│   │   │   ├── identity/
│   │   │   │   ├── IdentityService.java      ← public API
│   │   │   │   ├── OtpService.java           ← public API
│   │   │   │   ├── Technician.java, User.java, Role.java   (public records)
│   │   │   │   └── internal/{AuthController,IdentityRepository,OtpRepository}.java
│   │   │   ├── catalog/
│   │   │   │   ├── CatalogService.java, Service.java, AssignmentMode.java
│   │   │   │   └── internal/CatalogRepository.java
│   │   │   ├── address/
│   │   │   │   ├── AddressService.java, Geocoder.java   (port)
│   │   │   │   └── internal/{AddressRepository,StubGeocoder}.java
│   │   │   ├── products/
│   │   │   │   ├── WarrantyService.java
│   │   │   │   └── internal/ProductRepository.java
│   │   │   ├── booking/
│   │   │   │   ├── BookingStateMachine.java  ← PURE. NO SPRING. NO JDBC.
│   │   │   │   ├── BookingState.java, BookingAction.java, IllegalTransitionException.java
│   │   │   │   ├── BookingService.java
│   │   │   │   └── internal/BookingRepository.java
│   │   │   ├── pricing/
│   │   │   │   ├── PricingService.java, DiscountProvider.java  ← THE SEAM (P4 plugs in here)
│   │   │   │   └── Quote.java
│   │   │   ├── ledger/
│   │   │   │   ├── LedgerService.java
│   │   │   │   └── internal/LedgerRepository.java
│   │   │   ├── notifications/
│   │   │   │   └── internal/NotificationListener.java   ← no public API at all
│   │   │   └── ops/
│   │   │       └── internal/OpsController.java          ← owns no aggregates
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/             # Flyway. V1__…, V2__… — NEVER edit an applied file.
│   └── test/java/com/sethu/
│       ├── ModularityTests.java          # THE WALLS
│       ├── ArchitectureTests.java        # the state-machine purity rule
│       └── … one test class per module
└── admin/                                # Next.js — bare shell, DO NOT STYLE
```

**Why `internal`:** Spring Modulith treats a module's top-level package as its public API and
any sub-package (conventionally `internal`) as hidden. Repositories, controllers, and
implementation classes go in `internal`. **If another module needs something, it goes in the
public package deliberately — never by accident.**

---

## Task 1: Project, Docker, and the Module Walls

**Files:**
- Create: `pom.xml`, `docker-compose.yml`, `.gitignore`, `src/main/java/com/sethu/SethuApplication.java`, `src/main/resources/application.yml`
- Test: `src/test/java/com/sethu/ModularityTests.java`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `mvn test` runs; `ModularityTests.verifyModules()` is the build-breaking wall check; Postgres+PostGIS on `localhost:5432`, Redis on `localhost:6379`.

- [ ] **Step 1: Initialise the repo**

```bash
cd /Users/BackendIntern/Documents/SETHU-CARE
git init
printf 'target/\n.env\nadmin/node_modules/\nadmin/.next/\n' > .gitignore
```

- [ ] **Step 2: Write `pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.4.1</version>
    <relativePath/>
  </parent>

  <groupId>com.sethu</groupId>
  <artifactId>sethu-care</artifactId>
  <version>0.1.0</version>

  <properties>
    <java.version>21</java.version>
    <spring-modulith.version>1.3.1</spring-modulith.version>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-bom</artifactId>
        <version>${spring-modulith.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- Module walls + transactional domain events + the event publication registry -->
    <dependency>
      <groupId>org.springframework.modulith</groupId>
      <artifactId>spring-modulith-starter-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.modulith</groupId>
      <artifactId>spring-modulith-starter-jdbc</artifactId>
    </dependency>

    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-database-postgresql</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>

    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>2.7.0</version>
    </dependency>

    <!-- Tests -->
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-testcontainers</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.security</groupId>
      <artifactId>spring-security-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.modulith</groupId>
      <artifactId>spring-modulith-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>postgresql</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>com.tngtech.archunit</groupId>
      <artifactId>archunit-junit5</artifactId>
      <version>1.3.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 3: Create Docker Compose**

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: sethu
      POSTGRES_PASSWORD: sethu
      POSTGRES_DB: sethu
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
  redis:
    # Provisioned so the infrastructure is right when P2 needs offer timers.
    # NOTHING in P0 talks to it. Do not invent a use for it.
    image: redis:7-alpine
    ports: ['6379:6379']
volumes:
  pgdata:
```

- [ ] **Step 4: Application + config**

`src/main/java/com/sethu/SethuApplication.java`:
```java
package com.sethu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

@Modulithic(systemName = "SETHU-CARE")
@SpringBootApplication
public class SethuApplication {
    public static void main(String[] args) {
        SpringApplication.run(SethuApplication.class, args);
    }
}
```

`src/main/resources/application.yml`:
```yaml
spring:
  application:
    name: sethu-care
  datasource:
    url: jdbc:postgresql://localhost:5432/sethu
    username: sethu
    password: sethu
  flyway:
    enabled: true
    locations: classpath:db/migration
  threads:
    virtual:
      enabled: true       # Java 21 virtual threads. Free concurrency; nothing to tune.

sethu:
  jwt:
    secret: dev-only-change-me-this-must-be-at-least-32-bytes-long
    ttl-days: 30          # a technician must not be logged out mid-job

logging:
  level:
    com.sethu: DEBUG
```

- [ ] **Step 5: Declare the modules**

Create a `package-info.java` in each module package. This is what Spring Modulith reads.

`src/main/java/com/sethu/shared/package-info.java`:
```java
@org.springframework.modulith.ApplicationModule(
    type = org.springframework.modulith.ApplicationModule.Type.OPEN,
    displayName = "Shared"
)
package com.sethu.shared;
```

`src/main/java/com/sethu/events/package-info.java`:
```java
// OPEN because every module publishes and consumes these. This is the event
// catalog (ROADMAP §8) — a shared vocabulary, not a domain module.
@org.springframework.modulith.ApplicationModule(
    type = org.springframework.modulith.ApplicationModule.Type.OPEN,
    displayName = "Event Catalog"
)
package com.sethu.events;
```

Then one per domain module — `identity`, `catalog`, `address`, `products`, `booking`,
`pricing`, `ledger`, `notifications`, `ops`. Each looks like this (substitute the name):

`src/main/java/com/sethu/booking/package-info.java`:
```java
@org.springframework.modulith.ApplicationModule(displayName = "Booking")
package com.sethu.booking;
```

> Create all nine now, with empty packages. An empty module is fine; a missing one makes the
> verification test silently skip it.

- [ ] **Step 6: Write the wall test — the most important test in the repo**

`src/test/java/com/sethu/ModularityTests.java`:
```java
package com.sethu;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

class ModularityTests {

    static final ApplicationModules MODULES = ApplicationModules.of(SethuApplication.class);

    /**
     * THE WALLS (ROADMAP §4.2).
     *
     * Fails the build if any module reaches into another module's `internal` package,
     * or if two modules form a dependency cycle.
     *
     * This is not a lint rule you can silence with a comment. If it is red, the
     * architecture is broken — fix the design, not the test.
     */
    @Test
    void modulesRespectTheirBoundaries() {
        MODULES.verify();
    }

    /** Generates PlantUML diagrams + a module canvas into target/spring-modulith-docs. */
    @Test
    void writeDocumentation() {
        new Documenter(MODULES).writeDocumentation();
    }
}
```

- [ ] **Step 7: Run it green, then PROVE the wall actually fires**

```bash
docker compose up -d
mvn test -Dtest=ModularityTests
```
Expected: PASS (nothing to violate yet).

Now break it deliberately. Create `src/main/java/com/sethu/catalog/Peek.java`:
```java
package com.sethu.catalog;

// Deliberate violation — reaching into another module's internals.
public class Peek {
    public void bad(com.sethu.identity.internal.IdentityRepository repo) { }
}
```
…and a throwaway `com.sethu.identity.internal.IdentityRepository` class. Re-run:
```bash
mvn test -Dtest=ModularityTests
```
Expected: **FAIL** — *"Module 'catalog' depends on non-exposed type … IdentityRepository"*.

**Now delete both throwaway files.** You have just proved the wall is real rather than
decorative — which is the only way to know it will protect you in month three.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: spring boot skeleton, docker infra, and Spring Modulith wall verification"
```

---

## Task 2: Flyway, PostGIS, Testcontainers, and Money

**Files:**
- Create: `src/main/java/com/sethu/shared/Money.java`, `src/main/resources/db/migration/V1__extensions.sql`, `src/test/java/com/sethu/TestcontainersConfig.java`, `src/test/java/com/sethu/AbstractDbTest.java`
- Test: `src/test/java/com/sethu/shared/MoneyTest.java`, `src/test/java/com/sethu/DatabaseTest.java`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `Money.ofRupees(String) : long` (paise), `Money.format(long) : String`
  - `AbstractDbTest` — the base class every DB-touching test extends. Starts a PostGIS Testcontainer, runs Flyway, truncates between tests.

- [ ] **Step 1: Write the failing money test — money bugs cost real money, so this goes first**

`src/test/java/com/sethu/shared/MoneyTest.java`:
```java
package com.sethu.shared;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MoneyTest {

    @Test
    void convertsRupeesToPaise() {
        assertThat(Money.ofRupees("500")).isEqualTo(50_000L);
        assertThat(Money.ofRupees("499.99")).isEqualTo(49_999L);
        assertThat(Money.ofRupees("0")).isEqualTo(0L);
    }

    @Test
    void rejectsSubPaisePrecisionRatherThanSilentlyRounding() {
        assertThatThrownBy(() -> Money.ofRupees("1.005"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("sub-paise");
    }

    @Test
    void formatsPaiseBackToRupees() {
        assertThat(Money.format(50_000L)).isEqualTo("500.00");
        assertThat(Money.format(0L)).isEqualTo("0.00");
        assertThat(Money.format(49_999L)).isEqualTo("499.99");
    }
}
```

- [ ] **Step 2: Run it, watch it fail**

```bash
mvn test -Dtest=MoneyTest
```
Expected: FAIL — `cannot find symbol: class Money`.

- [ ] **Step 3: Implement Money**

`src/main/java/com/sethu/shared/Money.java`:
```java
package com.sethu.shared;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * All money in this system is a `long` of paise. Never double. Never float.
 * BigDecimal appears only at the edges, where a human types or reads a number.
 */
public final class Money {

    private Money() { }

    public static long ofRupees(String rupees) {
        BigDecimal amount = new BigDecimal(rupees);
        BigDecimal paise = amount.movePointRight(2);
        if (paise.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("sub-paise precision not representable: " + rupees);
        }
        return paise.setScale(0, RoundingMode.UNNECESSARY).longValueExact();
    }

    public static String format(long paise) {
        return BigDecimal.valueOf(paise).movePointLeft(2).setScale(2, RoundingMode.UNNECESSARY).toPlainString();
    }
}
```

- [ ] **Step 4: Verify green**

```bash
mvn test -Dtest=MoneyTest
```
Expected: 3 passed.

- [ ] **Step 5: The first Flyway migration — enable PostGIS**

> **Flyway rule, stated once so it is never ambiguous:** migrations are **immutable**.
> Once `V1__extensions.sql` has been applied to any database, **never edit it** — Flyway
> checksums applied migrations and will refuse to start. New change ⇒ new `V<n>__` file.
> This is the single most common way to brick a Spring Boot startup.

`src/main/resources/db/migration/V1__extensions.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

- [ ] **Step 6: Write the Testcontainers harness**

`src/test/java/com/sethu/TestcontainersConfig.java`:
```java
package com.sethu;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    /**
     * A real PostGIS database, started once per JVM, torn down at the end.
     * Flyway runs against it automatically, so the schema under test is the
     * schema that will run in production. No H2, no mocks, no lies.
     */
    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgres() {
        return new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:16-3.4")
                .asCompatibleSubstituteFor("postgres")
        ).withReuse(true);
    }
}
```

`src/test/java/com/sethu/AbstractDbTest.java`:
```java
package com.sethu;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Base class for every test that touches the database.
 *
 * We truncate rather than roll back, because several tests assert on
 * @ApplicationModuleListener behaviour — and those listeners fire AFTER COMMIT.
 * A rollback-style test would never commit, so the listeners would never run and
 * the test would pass for entirely the wrong reason.
 *
 * JUnit 5 runs test classes sequentially by default. DO NOT enable parallelism —
 * these tests share one database.
 */
@SpringBootTest
@Import(TestcontainersConfig.class)
public abstract class AbstractDbTest {

    @Autowired
    protected JdbcClient db;

    @BeforeEach
    void truncateEverything() {
        db.sql("""
            TRUNCATE
              booking_events, bookings, addresses, ledger_entries,
              product_units, product_models, question_defs, service_variants,
              services, categories, otp_challenges, technicians, users,
              event_publication
            RESTART IDENTITY CASCADE
            """).update();
    }
}
```

> **Note:** `event_publication` is created by Spring Modulith's JDBC event registry. It is
> truncated too, or a failed publication from one test haunts the next.

- [ ] **Step 7: Write the failing PostGIS test**

`src/test/java/com/sethu/DatabaseTest.java`:
```java
package com.sethu;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class DatabaseTest extends AbstractDbTest {

    @Test
    void postgisIsEnabled() {
        String version = db.sql("SELECT postgis_version()").query(String.class).single();
        assertThat(version).isNotBlank();
    }

    @Test
    void canMeasureDistanceBetweenTwoPoints() {
        Double metres = db.sql("""
            SELECT ST_Distance(
              ST_MakePoint(77.5946, 12.9716)::geography,
              ST_MakePoint(77.6100, 12.9800)::geography)
            """).query(Double.class).single();

        assertThat(metres).isGreaterThan(1_000.0).isLessThan(3_000.0);
    }
}
```

This will fail on the TRUNCATE (the tables do not exist yet). **That is expected.** Comment
out the body of `truncateEverything()` temporarily, confirm the two PostGIS assertions pass,
then restore it — the tables arrive in Task 5 and it will go green permanently.

- [ ] **Step 8: Verify and commit**

```bash
mvn test -Dtest=DatabaseTest
git add -A
git commit -m "feat: flyway, PostGIS, Testcontainers harness, and paise money"
```

---

## Task 3: The Event Catalog

**Files:**
- Create: `src/main/java/com/sethu/events/DomainEvent.java`
- Test: `src/test/java/com/sethu/events/DomainEventTest.java`

**Interfaces:**
- Consumes: Task 1.
- Produces: `sealed interface DomainEvent` and one record per event in ROADMAP §8. Publishers use `ApplicationEventPublisher`; consumers use `@ApplicationModuleListener`.

- [ ] **Step 1: Write the catalog — ROADMAP §8, as code**

`src/main/java/com/sethu/events/DomainEvent.java`:
```java
package com.sethu.events;

import java.util.UUID;

/**
 * THE EVENT CATALOG — ROADMAP §8.
 *
 * The published contract between modules. Nothing reaches into another module to
 * find out what happened; it listens.
 *
 * Sealed, so `switch` over it is exhaustive and adding an event breaks every
 * incomplete consumer at COMPILE time rather than in someone's kitchen.
 *
 * Money crosses this boundary as `long paise` — the same representation as the
 * database. There is no serialisation gap to lose precision in.
 */
public sealed interface DomainEvent {

    UUID bookingId();

    record BookingCreated(UUID bookingId, UUID customerId) implements DomainEvent { }
    record BookingConfirmed(UUID bookingId, UUID serviceId) implements DomainEvent { }
    record BookingAssigned(UUID bookingId, UUID technicianId) implements DomainEvent { }
    record TechnicianEnRoute(UUID bookingId, UUID technicianId) implements DomainEvent { }
    record TechnicianArrived(UUID bookingId, UUID technicianId) implements DomainEvent { }
    record BookingStarted(UUID bookingId) implements DomainEvent { }
    record BookingCompleted(UUID bookingId, long amountPaise) implements DomainEvent { }
    record BookingEscalated(UUID bookingId, String reason) implements DomainEvent { }
    record BookingFailed(UUID bookingId, String reason) implements DomainEvent { }
    record BookingCancelled(UUID bookingId, String by) implements DomainEvent { }
    record BookingRescheduled(UUID bookingId, String newSlot) implements DomainEvent { }

    record PaymentCaptured(UUID bookingId, long amountPaise, String method) implements DomainEvent { }
    record CashCollected(UUID bookingId, UUID technicianId, long amountPaise) implements DomainEvent { }

    // P2 — declared now so the seam exists. Assignment publishes these.
    record OfferDeclined(UUID bookingId, UUID technicianId, String reason) implements DomainEvent { }
    record OfferIgnored(UUID bookingId, UUID technicianId) implements DomainEvent { }
}
```

- [ ] **Step 2: Write the test that keeps the catalog honest**

`src/test/java/com/sethu/events/DomainEventTest.java`:
```java
package com.sethu.events;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class DomainEventTest {

    @Test
    void everyEventCarriesTheBookingItRefersTo() {
        UUID booking = UUID.randomUUID();

        DomainEvent event = new DomainEvent.BookingCompleted(booking, 49_900L);

        assertThat(event.bookingId()).isEqualTo(booking);
    }

    @Test
    void eventsAreValueObjects() {
        UUID booking = UUID.randomUUID();

        assertThat(new DomainEvent.BookingStarted(booking))
            .isEqualTo(new DomainEvent.BookingStarted(booking));
    }

    @Test
    void moneyCrossesTheBoundaryAsPaise() {
        var event = new DomainEvent.PaymentCaptured(UUID.randomUUID(), 49_900L, "upi");

        assertThat(event.amountPaise()).isEqualTo(49_900L);
    }
}
```

- [ ] **Step 3: Verify and commit**

```bash
mvn test -Dtest=DomainEventTest    # Expected: 3 passed
git add -A
git commit -m "feat(events): the event catalog as a sealed interface (ROADMAP §8)"
```

---

## Task 4: The Booking State Machine

> **This is the centrepiece of P0.** A pure static class. No Spring, no JDBC, no clock.
> Everything else in the system is scaffolding around this file.

**Files:**
- Create: `src/main/java/com/sethu/booking/{BookingState,BookingAction,IllegalTransitionException,BookingStateMachine}.java`
- Test: `src/test/java/com/sethu/booking/BookingStateMachineTest.java`, `src/test/java/com/sethu/ArchitectureTests.java`

**Interfaces:**
- Consumes: **nothing.** ArchUnit enforces it.
- Produces:
  - `enum BookingState` (13), `enum BookingAction` (13)
  - `BookingStateMachine.transition(BookingState, BookingAction) : BookingState` — throws `IllegalTransitionException`
  - `BookingStateMachine.canTransition(...) : boolean`, `.isTerminal(BookingState) : boolean`

- [ ] **Step 1: Write the enums**

`src/main/java/com/sethu/booking/BookingState.java`:
```java
package com.sethu.booking;

/** ROADMAP §7. Thirteen states. Not eighteen — see the ROADMAP for why. */
public enum BookingState {
    DRAFT,
    CONFIRMED,
    SEARCHING,
    ASSIGNED,
    EN_ROUTE,
    ARRIVED,
    IN_PROGRESS,
    AWAITING_COMPLETION,
    COMPLETED,
    ESCALATED,
    RESCHEDULED,
    CANCELLED,
    FAILED
}
```

`src/main/java/com/sethu/booking/BookingAction.java`:
```java
package com.sethu.booking;

public enum BookingAction {
    CONFIRM,
    SEARCH,
    ASSIGN,
    DEPART,
    ARRIVE,
    VERIFY_START,
    REQUEST_COMPLETION,
    VERIFY_COMPLETION,
    RESUME,
    ESCALATE,
    RESCHEDULE,
    CANCEL,
    FAIL
}
```

`src/main/java/com/sethu/booking/IllegalTransitionException.java`:
```java
package com.sethu.booking;

public class IllegalTransitionException extends RuntimeException {

    private final BookingState from;
    private final BookingAction action;

    public IllegalTransitionException(BookingState from, BookingAction action) {
        super("cannot %s a booking in state %s".formatted(action.name().toLowerCase(), from));
        this.from = from;
        this.action = action;
    }

    public BookingState from() { return from; }
    public BookingAction action() { return action; }
}
```

- [ ] **Step 2: Write the failing test — start with the exhaustive illegal sweep, because that IS the exit criterion**

`src/test/java/com/sethu/booking/BookingStateMachineTest.java`:
```java
package com.sethu.booking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static com.sethu.booking.BookingAction.*;
import static com.sethu.booking.BookingState.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingStateMachineTest {

    /**
     * The legal moves, written out INDEPENDENTLY of the implementation.
     * If this table and the TRANSITIONS map ever disagree, one of them is wrong —
     * and the illegal sweep below will tell you which. That disagreement is the
     * bug this whole task exists to catch.
     */
    static Stream<Arguments> legalTransitions() {
        return Stream.of(
            Arguments.of(DRAFT,               CONFIRM,            CONFIRMED),
            Arguments.of(DRAFT,               CANCEL,             CANCELLED),
            Arguments.of(CONFIRMED,           SEARCH,             SEARCHING),
            Arguments.of(CONFIRMED,           CANCEL,             CANCELLED),
            Arguments.of(CONFIRMED,           RESCHEDULE,         RESCHEDULED),
            Arguments.of(SEARCHING,           ASSIGN,             ASSIGNED),
            Arguments.of(SEARCHING,           ESCALATE,           ESCALATED),
            Arguments.of(SEARCHING,           FAIL,               FAILED),
            Arguments.of(SEARCHING,           CANCEL,             CANCELLED),
            Arguments.of(ESCALATED,           ASSIGN,             ASSIGNED),
            Arguments.of(ESCALATED,           RESCHEDULE,         RESCHEDULED),
            Arguments.of(ESCALATED,           FAIL,               FAILED),
            Arguments.of(ESCALATED,           CANCEL,             CANCELLED),
            Arguments.of(ASSIGNED,            DEPART,             EN_ROUTE),
            Arguments.of(ASSIGNED,            ESCALATE,           ESCALATED),
            Arguments.of(ASSIGNED,            RESCHEDULE,         RESCHEDULED),
            Arguments.of(ASSIGNED,            CANCEL,             CANCELLED),
            Arguments.of(EN_ROUTE,            ARRIVE,             ARRIVED),
            Arguments.of(EN_ROUTE,            ESCALATE,           ESCALATED),
            Arguments.of(EN_ROUTE,            CANCEL,             CANCELLED),
            Arguments.of(ARRIVED,             VERIFY_START,       IN_PROGRESS),
            Arguments.of(ARRIVED,             ESCALATE,           ESCALATED),
            Arguments.of(ARRIVED,             CANCEL,             CANCELLED),
            Arguments.of(IN_PROGRESS,         REQUEST_COMPLETION, AWAITING_COMPLETION),
            Arguments.of(IN_PROGRESS,         ESCALATE,           ESCALATED),
            Arguments.of(AWAITING_COMPLETION, VERIFY_COMPLETION,  COMPLETED),
            Arguments.of(AWAITING_COMPLETION, RESUME,             IN_PROGRESS),
            Arguments.of(AWAITING_COMPLETION, ESCALATE,           ESCALATED),
            Arguments.of(RESCHEDULED,         CONFIRM,            CONFIRMED),
            Arguments.of(RESCHEDULED,         CANCEL,             CANCELLED)
        );
    }

    @ParameterizedTest(name = "{0} + {1} -> {2}")
    @MethodSource("legalTransitions")
    void legalTransitionsWork(BookingState from, BookingAction action, BookingState expected) {
        assertThat(BookingStateMachine.transition(from, action)).isEqualTo(expected);
        assertThat(BookingStateMachine.canTransition(from, action)).isTrue();
    }

    /** Every (state, action) pair NOT in the table above. 13 x 13 = 169; 30 legal; 139 illegal. */
    static Stream<Arguments> illegalTransitions() {
        Set<String> legal = legalTransitions()
            .map(a -> a.get()[0] + ":" + a.get()[1])
            .collect(java.util.stream.Collectors.toSet());

        List<Arguments> illegal = new ArrayList<>();
        for (BookingState state : BookingState.values()) {
            for (BookingAction action : BookingAction.values()) {
                if (!legal.contains(state + ":" + action)) {
                    illegal.add(Arguments.of(state, action));
                }
            }
        }
        return illegal.stream();
    }

    @ParameterizedTest(name = "rejects {0} + {1}")
    @MethodSource("illegalTransitions")
    @DisplayName("THE EXIT CRITERION: every illegal transition is rejected")
    void illegalTransitionsAreRejected(BookingState from, BookingAction action) {
        assertThatThrownBy(() -> BookingStateMachine.transition(from, action))
            .isInstanceOf(IllegalTransitionException.class);

        assertThat(BookingStateMachine.canTransition(from, action)).isFalse();
    }

    @Test
    void thereAreExactlyThirtyLegalAndOneHundredThirtyNineIllegalPairs() {
        assertThat(legalTransitions().count()).isEqualTo(30);
        assertThat(illegalTransitions().count()).isEqualTo(139);
        assertThat(BookingState.values().length * BookingAction.values().length).isEqualTo(169);
    }

    @Test
    void terminalStatesAreTerminal() {
        assertThat(BookingStateMachine.isTerminal(COMPLETED)).isTrue();
        assertThat(BookingStateMachine.isTerminal(CANCELLED)).isTrue();
        assertThat(BookingStateMachine.isTerminal(FAILED)).isTrue();
        assertThat(BookingStateMachine.isTerminal(SEARCHING)).isFalse();
    }

    @Test
    void noActionCanLeaveATerminalState() {
        for (BookingState state : BookingState.values()) {
            if (!BookingStateMachine.isTerminal(state)) continue;
            for (BookingAction action : BookingAction.values()) {
                assertThat(BookingStateMachine.canTransition(state, action)).isFalse();
            }
        }
    }

    @Test
    void theErrorMessageIsUsefulAtTwoInTheMorning() {
        assertThatThrownBy(() -> BookingStateMachine.transition(COMPLETED, CANCEL))
            .hasMessage("cannot cancel a booking in state COMPLETED");
    }
}
```

- [ ] **Step 3: Run it, watch it fail**

```bash
mvn test -Dtest=BookingStateMachineTest
```
Expected: FAIL — `cannot find symbol: class BookingStateMachine`.

- [ ] **Step 4: Implement the state machine**

`src/main/java/com/sethu/booking/BookingStateMachine.java`:
```java
package com.sethu.booking;

import java.util.EnumMap;
import java.util.Map;

import static com.sethu.booking.BookingAction.*;
import static com.sethu.booking.BookingState.*;

/**
 * The booking state machine. ROADMAP §7.
 *
 * This class depends on NOTHING but the JDK and its own enums, and it must stay
 * that way — ArchitectureTests fails the build if anything is added. Purity is
 * what lets us prove correctness exhaustively in milliseconds.
 */
public final class BookingStateMachine {

    private BookingStateMachine() { }

    private static final Map<BookingState, Map<BookingAction, BookingState>> TRANSITIONS =
        new EnumMap<>(BookingState.class);

    private static void allow(BookingState from, BookingAction action, BookingState to) {
        TRANSITIONS.computeIfAbsent(from, k -> new EnumMap<>(BookingAction.class)).put(action, to);
    }

    static {
        allow(DRAFT,               CONFIRM,            CONFIRMED);
        allow(DRAFT,               CANCEL,             CANCELLED);

        allow(CONFIRMED,           SEARCH,             SEARCHING);
        allow(CONFIRMED,           CANCEL,             CANCELLED);
        allow(CONFIRMED,           RESCHEDULE,         RESCHEDULED);

        allow(SEARCHING,           ASSIGN,             ASSIGNED);
        allow(SEARCHING,           ESCALATE,           ESCALATED);
        allow(SEARCHING,           FAIL,               FAILED);
        allow(SEARCHING,           CANCEL,             CANCELLED);

        // The human escape hatch. P1 runs the business on this; P2's offer engine
        // falls back to it. ROADMAP §4.4.
        allow(ESCALATED,           ASSIGN,             ASSIGNED);
        allow(ESCALATED,           RESCHEDULE,         RESCHEDULED);
        allow(ESCALATED,           FAIL,               FAILED);
        allow(ESCALATED,           CANCEL,             CANCELLED);

        allow(ASSIGNED,            DEPART,             EN_ROUTE);
        allow(ASSIGNED,            ESCALATE,           ESCALATED);
        allow(ASSIGNED,            RESCHEDULE,         RESCHEDULED);
        allow(ASSIGNED,            CANCEL,             CANCELLED);

        allow(EN_ROUTE,            ARRIVE,             ARRIVED);
        allow(EN_ROUTE,            ESCALATE,           ESCALATED);
        allow(EN_ROUTE,            CANCEL,             CANCELLED);

        // ARRIVED *is* "waiting for the start OTP". It is not a separate state.
        allow(ARRIVED,             VERIFY_START,       IN_PROGRESS);
        allow(ARRIVED,             ESCALATE,           ESCALATED);
        allow(ARRIVED,             CANCEL,             CANCELLED);

        allow(IN_PROGRESS,         REQUEST_COMPLETION, AWAITING_COMPLETION);
        allow(IN_PROGRESS,         ESCALATE,           ESCALATED);

        allow(AWAITING_COMPLETION, VERIFY_COMPLETION,  COMPLETED);
        allow(AWAITING_COMPLETION, RESUME,             IN_PROGRESS);   // OTP failed; keep working
        allow(AWAITING_COMPLETION, ESCALATE,           ESCALATED);

        allow(RESCHEDULED,         CONFIRM,            CONFIRMED);
        allow(RESCHEDULED,         CANCEL,             CANCELLED);

        // COMPLETED, CANCELLED and FAILED are terminal: no entry at all.
    }

    public static boolean canTransition(BookingState from, BookingAction action) {
        return TRANSITIONS.getOrDefault(from, Map.of()).containsKey(action);
    }

    public static BookingState transition(BookingState from, BookingAction action) {
        BookingState next = TRANSITIONS.getOrDefault(from, Map.of()).get(action);
        if (next == null) {
            throw new IllegalTransitionException(from, action);
        }
        return next;
    }

    public static boolean isTerminal(BookingState state) {
        return TRANSITIONS.getOrDefault(state, Map.of()).isEmpty();
    }
}
```

- [ ] **Step 5: Verify green — and read the count**

```bash
mvn test -Dtest=BookingStateMachineTest
```
Expected: **PASS, with 30 legal + 139 illegal parameterized cases.** If the counts differ,
the `legalTransitions()` table and the `TRANSITIONS` map disagree. **Reconcile them against
ROADMAP §7 before doing anything else — that disagreement is the bug this task exists to catch.**

- [ ] **Step 6: Write the purity rule and PROVE it fires**

`src/test/java/com/sethu/ArchitectureTests.java`:
```java
package com.sethu;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class ArchitectureTests {

    /**
     * The booking state machine must be PURE. No Spring, no JDBC, no I/O, no clock.
     *
     * If this ever needs relaxing, the design is wrong: whatever the state machine
     * wanted to reach for belongs in BookingService, on the other side of the call.
     */
    @Test
    void stateMachineIsPure() {
        ArchRule rule = noClasses()
            .that().haveFullyQualifiedName("com.sethu.booking.BookingStateMachine")
            .should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "javax.sql..", "java.sql..", "java.time..");

        rule.check(new ClassFileImporter().importPackages("com.sethu"));
    }
}
```

Prove it fires: temporarily add `import org.springframework.stereotype.Component;` and
`@Component` to `BookingStateMachine`, run `mvn test -Dtest=ArchitectureTests` — expected
**FAIL**. Then **remove it** and confirm green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(booking): pure state machine — 13 states, 169 pairs, exhaustively tested"
```

---

## Task 5: Identity — Users, Salaried Technicians, and the Capacity Model

**Files:**
- Create: `src/main/resources/db/migration/V2__identity.sql`, `src/main/java/com/sethu/identity/{Role,User,Technician,NewTechnician,IdentityService}.java`, `src/main/java/com/sethu/identity/internal/IdentityRepository.java`
- Test: `src/test/java/com/sethu/identity/IdentityServiceTest.java`

**Interfaces:**
- Consumes: `JdbcClient`.
- Produces (public, so other modules may use them):
  - `IdentityService.createCustomer(String phone, String name) : UUID`
  - `IdentityService.createAdmin(String phone, String name) : UUID`
  - `IdentityService.createTechnician(NewTechnician) : UUID`
  - `IdentityService.findByPhone(String) : Optional<User>`
  - `IdentityService.isAvailable(UUID technicianId, LocalDateTime at) : boolean` — **the capacity model, ROADMAP §5.1**
  - `record User(UUID id, String phone, String name, Role role)`
  - `enum Role { CUSTOMER, TECHNICIAN, ADMIN }`

- [ ] **Step 1: The migration**

`src/main/resources/db/migration/V2__identity.sql`:
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'TECHNICIAN', 'ADMIN')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee record. Technicians are SALARIED. There is no commission, no payout,
-- and no settlement. ROADMAP §1.
CREATE TABLE technicians (
  user_id                UUID PRIMARY KEY REFERENCES users(id),
  city                   TEXT NOT NULL,
  skills                 TEXT[] NOT NULL DEFAULT '{}',

  -- THE CAPACITY MODEL — ROADMAP §5.1. Distance alone is not availability.
  shift_start_minute     INT  NOT NULL DEFAULT 540,    -- 09:00
  shift_end_minute       INT  NOT NULL DEFAULT 1080,   -- 18:00
  on_leave               BOOLEAN NOT NULL DEFAULT false,
  service_radius_metres  INT  NOT NULL DEFAULT 10000,
  max_concurrent_jobs    INT  NOT NULL DEFAULT 1,
  is_online              BOOLEAN NOT NULL DEFAULT false,

  -- Populated by P2's offer engine. Declared now so the seam exists. ROADMAP §5.4.
  acceptance_rate        NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  rating                 NUMERIC(3,2) NOT NULL DEFAULT 5.00
);

CREATE TABLE otp_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,               -- NEVER the plaintext code
  attempts    INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write the failing capacity test — this is the gap the external review correctly caught**

`src/test/java/com/sethu/identity/IdentityServiceTest.java`:
```java
package com.sethu.identity;

import com.sethu.AbstractDbTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class IdentityServiceTest extends AbstractDbTest {

    @Autowired IdentityService identity;

    static final LocalDateTime NOON     = LocalDateTime.of(2026, 7, 14, 12, 0);
    static final LocalDateTime MIDNIGHT = LocalDateTime.of(2026, 7, 14, 23, 30);

    private UUID tech(boolean online, boolean onLeave) {
        return identity.createTechnician(new NewTechnician(
            "+9198" + (10_000_000 + (int) (Math.random() * 80_000_000)),
            "Test Tech", "Bengaluru", List.of("ac_repair"),
            online, onLeave, 540, 1080, 10_000, 1
        ));
    }

    @Test
    void anOnlineTechnicianInsideTheirShiftIsAvailable() {
        assertThat(identity.isAvailable(tech(true, false), NOON)).isTrue();
    }

    @Test
    void anOfflineTechnicianIsNotAvailable() {
        assertThat(identity.isAvailable(tech(false, false), NOON)).isFalse();
    }

    @Test
    void aTechnicianOutsideTheirShiftHoursIsNotAvailable() {
        assertThat(identity.isAvailable(tech(true, false), MIDNIGHT)).isFalse();
    }

    @Test
    void aTechnicianOnLeaveIsNotAvailableEvenIfOnline() {
        assertThat(identity.isAvailable(tech(true, true), NOON)).isFalse();
    }

    @Test
    void anUnknownTechnicianIsNotAvailable() {
        assertThat(identity.isAvailable(UUID.randomUUID(), NOON)).isFalse();
    }

    @Test
    void customersAndAdminsAreDistinctRoles() {
        identity.createCustomer("+919800000001", "Asha");
        identity.createAdmin("+919800000002", "Ops Lead");

        assertThat(identity.findByPhone("+919800000001")).get()
            .extracting(User::role).isEqualTo(Role.CUSTOMER);
        assertThat(identity.findByPhone("+919800000002")).get()
            .extracting(User::role).isEqualTo(Role.ADMIN);
    }
}
```

- [ ] **Step 3: Run it, watch it fail**

```bash
mvn test -Dtest=IdentityServiceTest
```
Expected: FAIL — `cannot find symbol: class IdentityService`.

- [ ] **Step 4: Implement the public types**

`src/main/java/com/sethu/identity/Role.java`:
```java
package com.sethu.identity;

public enum Role { CUSTOMER, TECHNICIAN, ADMIN }
```

`src/main/java/com/sethu/identity/User.java`:
```java
package com.sethu.identity;

import java.util.UUID;

public record User(UUID id, String phone, String name, Role role) { }
```

`src/main/java/com/sethu/identity/NewTechnician.java`:
```java
package com.sethu.identity;

import java.util.List;

/** ROADMAP §5.1 — every field here is a reason a technician might NOT be available. */
public record NewTechnician(
    String phone,
    String name,
    String city,
    List<String> skills,
    boolean isOnline,
    boolean onLeave,
    int shiftStartMinute,
    int shiftEndMinute,
    int serviceRadiusMetres,
    int maxConcurrentJobs
) {
    /** Sensible defaults: offline, not on leave, 09:00–18:00, 10km, one job at a time. */
    public static NewTechnician of(String phone, String name, String city, List<String> skills) {
        return new NewTechnician(phone, name, city, skills, false, false, 540, 1080, 10_000, 1);
    }
}
```

- [ ] **Step 5: Implement the repository (internal) and the service (public)**

`src/main/java/com/sethu/identity/internal/IdentityRepository.java`:
```java
package com.sethu.identity.internal;

import com.sethu.identity.NewTechnician;
import com.sethu.identity.Role;
import com.sethu.identity.User;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class IdentityRepository {

    private final JdbcClient db;

    public IdentityRepository(JdbcClient db) {
        this.db = db;
    }

    public UUID insertUser(String phone, String name, Role role) {
        return db.sql("INSERT INTO users (phone, name, role) VALUES (?, ?, ?) RETURNING id")
            .params(phone, name, role.name())
            .query(UUID.class)
            .single();
    }

    public void insertTechnician(UUID userId, NewTechnician t) {
        db.sql("""
            INSERT INTO technicians (
              user_id, city, skills, is_online, on_leave,
              shift_start_minute, shift_end_minute, service_radius_metres, max_concurrent_jobs)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """)
            .params(userId, t.city(), t.skills().toArray(new String[0]),
                    t.isOnline(), t.onLeave(),
                    t.shiftStartMinute(), t.shiftEndMinute(),
                    t.serviceRadiusMetres(), t.maxConcurrentJobs())
            .update();
    }

    public Optional<User> findByPhone(String phone) {
        return db.sql("SELECT id, phone, name, role FROM users WHERE phone = ?")
            .param(phone)
            .query((rs, n) -> new User(
                rs.getObject("id", UUID.class),
                rs.getString("phone"),
                rs.getString("name"),
                Role.valueOf(rs.getString("role"))))
            .optional();
    }

    public Optional<User> findById(UUID id) {
        return db.sql("SELECT id, phone, name, role FROM users WHERE id = ?")
            .param(id)
            .query((rs, n) -> new User(
                rs.getObject("id", UUID.class),
                rs.getString("phone"),
                rs.getString("name"),
                Role.valueOf(rs.getString("role"))))
            .optional();
    }

    /**
     * THE CAPACITY MODEL (ROADMAP §5.1), as one query.
     *
     * P2's offer engine will call this before offering a job to anyone. It is a
     * boolean today; in P2 it becomes the WHERE clause of the nearby-technician
     * search, alongside ST_DWithin.
     *
     * NOTE: max_concurrent_jobs is declared but not yet enforced — bookings do not
     * carry an assigned technician until Task 12. The check lands in P2.
     */
    public boolean isAvailable(UUID technicianId, LocalDateTime at) {
        int minuteOfDay = at.getHour() * 60 + at.getMinute();

        return Boolean.TRUE.equals(db.sql("""
            SELECT EXISTS (
              SELECT 1 FROM technicians
              WHERE user_id = ?
                AND is_online = true
                AND on_leave  = false
                AND ? >= shift_start_minute
                AND ? <  shift_end_minute
            )
            """)
            .params(technicianId, minuteOfDay, minuteOfDay)
            .query(Boolean.class)
            .single());
    }
}
```

`src/main/java/com/sethu/identity/IdentityService.java`:
```java
package com.sethu.identity;

import com.sethu.identity.internal.IdentityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class IdentityService {

    private final IdentityRepository repo;

    public IdentityService(IdentityRepository repo) {
        this.repo = repo;
    }

    public UUID createCustomer(String phone, String name) {
        return repo.insertUser(phone, name, Role.CUSTOMER);
    }

    /** There is no admin signup flow. Admins are created here, by hand, on purpose. */
    public UUID createAdmin(String phone, String name) {
        return repo.insertUser(phone, name, Role.ADMIN);
    }

    @Transactional
    public UUID createTechnician(NewTechnician t) {
        UUID userId = repo.insertUser(t.phone(), t.name(), Role.TECHNICIAN);
        repo.insertTechnician(userId, t);
        return userId;
    }

    public Optional<User> findByPhone(String phone) {
        return repo.findByPhone(phone);
    }

    public Optional<User> findById(UUID id) {
        return repo.findById(id);
    }

    /** ROADMAP §5.1. Distance is NOT availability. */
    public boolean isAvailable(UUID technicianId, LocalDateTime at) {
        return repo.isAvailable(technicianId, at);
    }
}
```

- [ ] **Step 6: Verify green — including the walls**

```bash
mvn test -Dtest=IdentityServiceTest
mvn test -Dtest=ModularityTests
```
Expected: 6 passed; walls clean. (`IdentityRepository` lives in `internal`, so no other
module can touch it — only `IdentityService` is public.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(identity): users, salaried technicians, and the capacity model"
```

---

## Task 6: OTP Authentication, JWT, and the Role Guards

**Files:**
- Create: `src/main/java/com/sethu/identity/OtpService.java`, `src/main/java/com/sethu/identity/internal/{OtpRepository,AuthController}.java`, `src/main/java/com/sethu/shared/security/{SecurityConfig,JwtConfig,AuthedUser}.java`
- Test: `src/test/java/com/sethu/identity/OtpServiceTest.java`, `src/test/java/com/sethu/identity/AuthControllerTest.java`

**Interfaces:**
- Consumes: `IdentityService` (Task 5).
- Produces:
  - `OtpService.request(String phone) : OtpChallenge` where `record OtpChallenge(UUID challengeId, String devCode)`
  - `OtpService.verify(UUID challengeId, String code) : UUID` (the user id) — throws on bad code, expiry, reuse, or too many attempts
  - `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /auth/me`
  - Security: everything is authenticated except `/auth/**`; `/ops/**` requires role `ADMIN`.

- [ ] **Step 1: Write the failing OTP test — the security properties are the point**

`src/test/java/com/sethu/identity/OtpServiceTest.java`:
```java
package com.sethu.identity;

import com.sethu.AbstractDbTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OtpServiceTest extends AbstractDbTest {

    @Autowired OtpService otp;
    @Autowired IdentityService identity;

    static final String PHONE = "+919812345678";

    @BeforeEach
    void createUser() {
        identity.createCustomer(PHONE, "Asha");
    }

    @Test
    void neverStoresTheCodeInPlaintext() {
        var challenge = otp.request(PHONE);

        String hash = db.sql("SELECT code_hash FROM otp_challenges WHERE id = ?")
            .param(challenge.challengeId()).query(String.class).single();

        assertThat(hash).isNotEqualTo(challenge.devCode());
        assertThat(hash).startsWith("$2");            // BCrypt
    }

    @Test
    void verifiesACorrectCodeAndReturnsTheUser() {
        var challenge = otp.request(PHONE);

        UUID userId = otp.verify(challenge.challengeId(), challenge.devCode());

        assertThat(identity.findById(userId)).get().extracting(User::phone).isEqualTo(PHONE);
    }

    @Test
    void rejectsAWrongCode() {
        var challenge = otp.request(PHONE);

        assertThatThrownBy(() -> otp.verify(challenge.challengeId(), "000000"))
            .hasMessageContaining("invalid code");
    }

    @Test
    void locksTheChallengeAfterTooManyAttempts() {
        var challenge = otp.request(PHONE);

        for (int i = 0; i < OtpService.MAX_ATTEMPTS; i++) {
            assertThatThrownBy(() -> otp.verify(challenge.challengeId(), "000000"))
                .hasMessageContaining("invalid code");
        }

        // The brute-force guard: even the RIGHT code is refused now.
        assertThatThrownBy(() -> otp.verify(challenge.challengeId(), challenge.devCode()))
            .hasMessageContaining("too many attempts");
    }

    @Test
    void rejectsAnExpiredCode() {
        var challenge = otp.request(PHONE);
        db.sql("UPDATE otp_challenges SET expires_at = now() - interval '1 minute' WHERE id = ?")
            .param(challenge.challengeId()).update();

        assertThatThrownBy(() -> otp.verify(challenge.challengeId(), challenge.devCode()))
            .hasMessageContaining("expired");
    }

    @Test
    void cannotReuseAConsumedCode() {
        var challenge = otp.request(PHONE);
        otp.verify(challenge.challengeId(), challenge.devCode());

        assertThatThrownBy(() -> otp.verify(challenge.challengeId(), challenge.devCode()))
            .hasMessageContaining("already used");
    }

    @Test
    void refusesToIssueACodeToAnUnknownPhone() {
        assertThatThrownBy(() -> otp.request("+910000000000"))
            .hasMessageContaining("no such user");
    }
}
```

- [ ] **Step 2: Run it, watch it fail**

```bash
mvn test -Dtest=OtpServiceTest
```
Expected: FAIL — `cannot find symbol: class OtpService`.

- [ ] **Step 3: Implement the OTP repository and service**

`src/main/java/com/sethu/identity/internal/OtpRepository.java`:
```java
package com.sethu.identity.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public class OtpRepository {

    public record Challenge(UUID id, String phone, String codeHash, int attempts,
                            Instant consumedAt, Instant expiresAt) { }

    private final JdbcClient db;

    public OtpRepository(JdbcClient db) {
        this.db = db;
    }

    public UUID insert(String phone, String codeHash, Instant expiresAt) {
        return db.sql("""
            INSERT INTO otp_challenges (phone, code_hash, expires_at)
            VALUES (?, ?, ?) RETURNING id
            """)
            .params(phone, codeHash, java.sql.Timestamp.from(expiresAt))
            .query(UUID.class)
            .single();
    }

    public Optional<Challenge> find(UUID id) {
        return db.sql("""
            SELECT id, phone, code_hash, attempts, consumed_at, expires_at
            FROM otp_challenges WHERE id = ?
            """)
            .param(id)
            .query((rs, n) -> new Challenge(
                rs.getObject("id", UUID.class),
                rs.getString("phone"),
                rs.getString("code_hash"),
                rs.getInt("attempts"),
                rs.getTimestamp("consumed_at") == null ? null : rs.getTimestamp("consumed_at").toInstant(),
                rs.getTimestamp("expires_at").toInstant()))
            .optional();
    }

    public void recordFailedAttempt(UUID id) {
        db.sql("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?").param(id).update();
    }

    public void consume(UUID id) {
        db.sql("UPDATE otp_challenges SET consumed_at = now() WHERE id = ?").param(id).update();
    }
}
```

`src/main/java/com/sethu/identity/OtpService.java`:
```java
package com.sethu.identity;

import com.sethu.identity.internal.OtpRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class OtpService {

    public static final int MAX_ATTEMPTS = 5;
    private static final Duration TTL = Duration.ofMinutes(5);

    /** `devCode` is populated ONLY outside production. In production it goes to MSG91 (P1). */
    public record OtpChallenge(UUID challengeId, String devCode) { }

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpRepository repo;
    private final IdentityService identity;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final boolean isProduction;

    public OtpService(OtpRepository repo, IdentityService identity, Environment env) {
        this.repo = repo;
        this.identity = identity;
        this.isProduction = env.matchesProfiles("prod");
    }

    public OtpChallenge request(String phone) {
        identity.findByPhone(phone)
            .orElseThrow(() -> new IllegalArgumentException("no such user"));

        String code = "%06d".formatted(RANDOM.nextInt(1_000_000));
        UUID id = repo.insert(phone, encoder.encode(code), Instant.now().plus(TTL));

        if (!isProduction) {
            log.warn("DEV OTP for {}: {}", phone, code);
            return new OtpChallenge(id, code);
        }
        return new OtpChallenge(id, null);
    }

    public UUID verify(UUID challengeId, String code) {
        var challenge = repo.find(challengeId)
            .orElseThrow(() -> new IllegalArgumentException("invalid code"));

        if (challenge.consumedAt() != null) throw new IllegalArgumentException("already used");
        if (challenge.attempts() >= MAX_ATTEMPTS) throw new IllegalArgumentException("too many attempts");
        if (challenge.expiresAt().isBefore(Instant.now())) throw new IllegalArgumentException("expired");

        if (!encoder.matches(code, challenge.codeHash())) {
            repo.recordFailedAttempt(challengeId);
            throw new IllegalArgumentException("invalid code");
        }

        repo.consume(challengeId);

        return identity.findByPhone(challenge.phone())
            .orElseThrow(() -> new IllegalStateException("user vanished mid-login"))
            .id();
    }
}
```

- [ ] **Step 4: Verify the OTP service is green**

```bash
mvn test -Dtest=OtpServiceTest
```
Expected: 7 passed.

- [ ] **Step 5: Write the failing auth-endpoint test**

`src/test/java/com/sethu/identity/AuthControllerTest.java`:
```java
package com.sethu.identity;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sethu.AbstractDbTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AuthControllerTest extends AbstractDbTest {

    @Autowired MockMvc mvc;
    @Autowired IdentityService identity;
    @Autowired ObjectMapper json;

    static final String PHONE = "+919400000001";

    @BeforeEach
    void createUser() {
        identity.createCustomer(PHONE, "Kiran");
    }

    private String loginAndGetToken() throws Exception {
        String requestBody = mvc.perform(post("/auth/otp/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("phone", PHONE))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Map<?, ?> challenge = json.readValue(requestBody, Map.class);

        String verifyBody = mvc.perform(post("/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "challengeId", challenge.get("challengeId"),
                    "code", challenge.get("devCode")))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        return (String) json.readValue(verifyBody, Map.class).get("accessToken");
    }

    @Test
    void requestsAnOtpAndExchangesItForAToken() throws Exception {
        assertThat(loginAndGetToken()).isNotBlank();
    }

    @Test
    void rejectsABadCodeWith401NotAServerError() throws Exception {
        String body = mvc.perform(post("/auth/otp/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("phone", PHONE))))
            .andReturn().getResponse().getContentAsString();

        Map<?, ?> challenge = json.readValue(body, Map.class);

        mvc.perform(post("/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "challengeId", challenge.get("challengeId"),
                    "code", "000000"))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void aProtectedRouteRefusesAnAnonymousCaller() throws Exception {
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void aProtectedRouteAcceptsAValidToken() throws Exception {
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + loginAndGetToken()))
            .andExpect(status().isOk());
    }

    @Test
    void anAdminOnlyRouteRefusesACustomerToken() throws Exception {
        mvc.perform(get("/ops/bookings").header("Authorization", "Bearer " + loginAndGetToken()))
            .andExpect(status().isForbidden());
    }
}
```

> The last test will not compile-fail, but it **cannot pass until Task 13 exists**. That is
> fine and intentional — it is the contract Task 13 must satisfy. Mark it `@Disabled("Task 13")`
> now and delete the annotation when the ops controller lands.

- [ ] **Step 6: Implement security — JWT config**

`src/main/java/com/sethu/shared/security/AuthedUser.java`:
```java
package com.sethu.shared.security;

import java.util.UUID;

public record AuthedUser(UUID userId, String role) { }
```

`src/main/java/com/sethu/shared/security/JwtConfig.java`:
```java
package com.sethu.shared.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.spec.SecretKeySpec;

@Configuration
public class JwtConfig {

    @Value("${sethu.jwt.secret}")
    private String secret;

    private SecretKeySpec key() {
        return new SecretKeySpec(secret.getBytes(), "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(key()));
    }

    @Bean
    JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withSecretKey(key()).build();
    }
}
```

`src/main/java/com/sethu/shared/security/SecurityConfig.java`:
```java
package com.sethu.shared.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthorityPrefix("ROLE_");
        authorities.setAuthoritiesClaimName("role");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);

        return http
            .csrf(csrf -> csrf.disable())                        // stateless bearer-token API
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**", "/v3/api-docs/**", "/swagger-ui/**").permitAll()
                .requestMatchers("/ops/**").hasRole("ADMIN")     // ROADMAP permission matrix
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)))
            .build();
    }
}
```

> **`setAuthorityPrefix("ROLE_")` + `hasRole("ADMIN")`:** Spring's `hasRole("X")` looks for the
> authority `ROLE_X`. We put a bare `"ADMIN"` in the `role` claim and let the converter add the
> prefix. Get this wrong and every admin gets a 403 with a completely unhelpful message. It is
> the single most common Spring Security time-sink.

- [ ] **Step 7: Implement the auth controller**

`src/main/java/com/sethu/identity/internal/AuthController.java`:
```java
package com.sethu.identity.internal;

import com.sethu.identity.IdentityService;
import com.sethu.identity.OtpService;
import com.sethu.identity.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class AuthController {

    public record OtpRequest(String phone) { }
    public record OtpVerify(UUID challengeId, String code) { }

    private final OtpService otp;
    private final IdentityService identity;
    private final JwtEncoder jwtEncoder;
    private final long ttlDays;

    public AuthController(OtpService otp, IdentityService identity, JwtEncoder jwtEncoder,
                          @org.springframework.beans.factory.annotation.Value("${sethu.jwt.ttl-days}") long ttlDays) {
        this.otp = otp;
        this.identity = identity;
        this.jwtEncoder = jwtEncoder;
        this.ttlDays = ttlDays;
    }

    @PostMapping("/otp/request")
    @ResponseStatus(HttpStatus.OK)
    public OtpService.OtpChallenge request(@RequestBody OtpRequest body) {
        try {
            return otp.request(body.phone());
        } catch (IllegalArgumentException e) {
            // Do NOT leak whether the phone exists.
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "could not send code");
        }
    }

    @PostMapping("/otp/verify")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> verify(@RequestBody OtpVerify body) {
        UUID userId;
        try {
            userId = otp.verify(body.challengeId(), body.code());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, e.getMessage());
        }

        User user = identity.findById(userId).orElseThrow();

        var claims = JwtClaimsSet.builder()
            .subject(user.id().toString())
            .claim("role", user.role().name())          // "ADMIN" — SecurityConfig adds ROLE_
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plus(ttlDays, ChronoUnit.DAYS))
            .build();

        String token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();

        return Map.of("accessToken", token, "role", user.role().name(), "name", user.name());
    }

    @GetMapping("/me")
    public Map<String, String> me(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("userId", jwt.getSubject(), "role", jwt.getClaimAsString("role"));
    }
}
```

Add the missing import to the controller: `org.springframework.security.core.annotation.AuthenticationPrincipal`.

- [ ] **Step 8: Verify green and commit**

```bash
mvn test -Dtest=AuthControllerTest
mvn test -Dtest=ModularityTests
```
Expected: 4 passed (+1 disabled until Task 13); walls clean.

```bash
git add -A
git commit -m "feat(identity): OTP auth — hashed, expiring, attempt-capped — plus JWT and role guards"
```

---

## Task 7: Catalog — the HSOS Service Tree

**Files:**
- Create: `src/main/resources/db/migration/V3__catalog.sql`, `src/main/java/com/sethu/catalog/{AssignmentMode,ServiceDef,ServiceVariant,CatalogService,CatalogSeeder}.java`, `src/main/java/com/sethu/catalog/internal/CatalogRepository.java`
- Test: `src/test/java/com/sethu/catalog/CatalogServiceTest.java`

**Interfaces:**
- Consumes: `JdbcClient`.
- Produces:
  - `CatalogService.findBySlug(String) : Optional<ServiceDef>`, `.findById(UUID) : Optional<ServiceDef>`, `.findVariant(UUID) : Optional<ServiceVariant>`
  - `record ServiceDef(UUID id, UUID categoryId, String name, String slug, AssignmentMode assignmentMode, List<String> requiredSkills, int estimatedMinutes)`
  - `record ServiceVariant(UUID id, UUID serviceId, String name, long basePricePaise)`
  - `enum AssignmentMode { AUTO, MANUAL }` — **ROADMAP §4.5**
  - `CatalogSeeder.seed()` — the five launch services

- [ ] **Step 1: The migration**

`src/main/resources/db/migration/V3__catalog.sql`:
```sql
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

-- ROADMAP §4.5 — assignment mode is a property of the SERVICE, not of the system.
-- Repairs are auto-dispatched. Delivery/installation is assigned by a human.
-- Changing it is an UPDATE, not a deploy.
CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       UUID NOT NULL REFERENCES categories(id),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT NOT NULL DEFAULT '',
  assignment_mode   TEXT NOT NULL DEFAULT 'AUTO' CHECK (assignment_mode IN ('AUTO','MANUAL')),
  required_skills   TEXT[] NOT NULL DEFAULT '{}',
  estimated_minutes INT  NOT NULL DEFAULT 60,
  is_active         BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE service_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id       UUID NOT NULL REFERENCES services(id),
  name             TEXT NOT NULL,
  base_price_paise BIGINT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true
);

-- Dynamic questions asked at booking time. Adding one is an INSERT, not a deploy.
CREATE TABLE question_defs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL REFERENCES services(id),
  prompt      TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('TEXT','SINGLE_CHOICE','PHOTO')),
  options     TEXT[] NOT NULL DEFAULT '{}',
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0
);
```

- [ ] **Step 2: Write the failing test**

`src/test/java/com/sethu/catalog/CatalogServiceTest.java`:
```java
package com.sethu.catalog;

import com.sethu.AbstractDbTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogServiceTest extends AbstractDbTest {

    @Autowired CatalogService catalog;
    @Autowired CatalogSeeder seeder;

    @BeforeEach
    void seed() {
        seeder.seed();
    }

    @Test
    void seedsTheFiveLaunchServices() {
        Integer count = db.sql("SELECT count(*) FROM services").query(Integer.class).single();
        assertThat(count).isEqualTo(5);
    }

    @Test
    void repairServicesAreAutoDispatched() {
        assertThat(catalog.findBySlug("ac-repair")).get()
            .extracting(ServiceDef::assignmentMode).isEqualTo(AssignmentMode.AUTO);
    }

    @Test
    void installationIsMANUALLYAssigned() {
        // ROADMAP §4.5 — delivering a refrigerator involves stock, a vehicle, and a
        // staircase. A human assigns it. This is why P3 needs zero new dispatch code.
        assertThat(catalog.findBySlug("appliance-installation")).get()
            .extracting(ServiceDef::assignmentMode).isEqualTo(AssignmentMode.MANUAL);
    }

    @Test
    void aServiceDeclaresTheSkillsATechnicianMustHold() {
        assertThat(catalog.findBySlug("ac-repair")).get()
            .extracting(ServiceDef::requiredSkills).asList().contains("ac_repair");
    }

    @Test
    void aNewServiceCanBeAddedWithoutACodeChange() {
        var categoryId = db.sql("SELECT id FROM categories LIMIT 1")
            .query(java.util.UUID.class).single();

        db.sql("""
            INSERT INTO services (category_id, name, slug, required_skills)
            VALUES (?, 'Chimney Cleaning', 'chimney-cleaning', ARRAY['chimney'])
            """).param(categoryId).update();

        assertThat(catalog.findBySlug("chimney-cleaning")).get()
            .satisfies(s -> {
                assertThat(s.name()).isEqualTo("Chimney Cleaning");
                assertThat(s.assignmentMode()).isEqualTo(AssignmentMode.AUTO);   // the default
            });
    }
}
```

- [ ] **Step 3: Run it, watch it fail**

```bash
mvn test -Dtest=CatalogServiceTest
```
Expected: FAIL — `cannot find symbol: class CatalogService`.

- [ ] **Step 4: Implement**

`src/main/java/com/sethu/catalog/AssignmentMode.java`:
```java
package com.sethu.catalog;

/**
 * ROADMAP §4.5. AUTO → P2's offer engine. MANUAL → the admin queue, permanently.
 * This is a column on the service. Ops changes it without a deploy.
 */
public enum AssignmentMode { AUTO, MANUAL }
```

`src/main/java/com/sethu/catalog/ServiceDef.java`:
```java
package com.sethu.catalog;

import java.util.List;
import java.util.UUID;

// Named ServiceDef, not Service — `Service` collides with Spring's @Service annotation
// and produces genuinely baffling compile errors.
public record ServiceDef(
    UUID id,
    UUID categoryId,
    String name,
    String slug,
    AssignmentMode assignmentMode,
    List<String> requiredSkills,
    int estimatedMinutes
) { }
```

`src/main/java/com/sethu/catalog/ServiceVariant.java`:
```java
package com.sethu.catalog;

import java.util.UUID;

public record ServiceVariant(UUID id, UUID serviceId, String name, long basePricePaise) { }
```

`src/main/java/com/sethu/catalog/internal/CatalogRepository.java`:
```java
package com.sethu.catalog.internal;

import com.sethu.catalog.AssignmentMode;
import com.sethu.catalog.ServiceDef;
import com.sethu.catalog.ServiceVariant;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;

@Repository
public class CatalogRepository {

    private final JdbcClient db;

    public CatalogRepository(JdbcClient db) {
        this.db = db;
    }

    private static final String SELECT_SERVICE = """
        SELECT id, category_id, name, slug, assignment_mode, required_skills, estimated_minutes
        FROM services WHERE %s = ?
        """;

    private ServiceDef mapService(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        String[] skills = (String[]) rs.getArray("required_skills").getArray();
        return new ServiceDef(
            rs.getObject("id", UUID.class),
            rs.getObject("category_id", UUID.class),
            rs.getString("name"),
            rs.getString("slug"),
            AssignmentMode.valueOf(rs.getString("assignment_mode")),
            Arrays.asList(skills),
            rs.getInt("estimated_minutes"));
    }

    public Optional<ServiceDef> findBySlug(String slug) {
        return db.sql(SELECT_SERVICE.formatted("slug")).param(slug)
            .query(this::mapService).optional();
    }

    public Optional<ServiceDef> findById(UUID id) {
        return db.sql(SELECT_SERVICE.formatted("id")).param(id)
            .query(this::mapService).optional();
    }

    public Optional<ServiceVariant> findVariant(UUID id) {
        return db.sql("""
            SELECT id, service_id, name, base_price_paise FROM service_variants WHERE id = ?
            """)
            .param(id)
            .query((rs, n) -> new ServiceVariant(
                rs.getObject("id", UUID.class),
                rs.getObject("service_id", UUID.class),
                rs.getString("name"),
                rs.getLong("base_price_paise")))
            .optional();
    }
}
```

`src/main/java/com/sethu/catalog/CatalogService.java`:
```java
package com.sethu.catalog;

import com.sethu.catalog.internal.CatalogRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class CatalogService {

    private final CatalogRepository repo;

    public CatalogService(CatalogRepository repo) {
        this.repo = repo;
    }

    public Optional<ServiceDef> findBySlug(String slug) { return repo.findBySlug(slug); }
    public Optional<ServiceDef> findById(UUID id)       { return repo.findById(id); }
    public Optional<ServiceVariant> findVariant(UUID id) { return repo.findVariant(id); }
}
```

`src/main/java/com/sethu/catalog/CatalogSeeder.java`:
```java
package com.sethu.catalog;

import com.sethu.shared.Money;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** The five services that seed the launch catalog. ROADMAP §15, open question 2. */
@Component
public class CatalogSeeder {

    private final JdbcClient db;

    public CatalogSeeder(JdbcClient db) {
        this.db = db;
    }

    @Transactional
    public void seed() {
        UUID appliance = category("Appliance Repair", "appliance-repair", 1);
        UUID home      = category("Home Maintenance", "home-maintenance", 2);

        UUID ac      = service(appliance, "AC Repair", "ac-repair", AssignmentMode.AUTO, "ac_repair", 90);
        UUID fridge  = service(appliance, "Refrigerator Repair", "refrigerator-repair", AssignmentMode.AUTO, "refrigerator_repair", 90);
        UUID washer  = service(appliance, "Washing Machine Repair", "washing-machine-repair", AssignmentMode.AUTO, "washing_machine_repair", 60);

        // Delivery + installation of appliances WE manufacture. A human assigns it.
        UUID install = service(appliance, "Appliance Installation", "appliance-installation", AssignmentMode.MANUAL, "installation", 120);

        UUID plumbing = service(home, "Plumbing", "plumbing", AssignmentMode.AUTO, "plumbing", 60);

        variant(ac,       "Diagnostic Visit",      Money.ofRupees("499"));
        variant(ac,       "Gas Refill",            Money.ofRupees("2499"));
        variant(fridge,   "Diagnostic Visit",      Money.ofRupees("499"));
        variant(washer,   "Diagnostic Visit",      Money.ofRupees("499"));
        variant(install,  "Standard Installation", Money.ofRupees("0"));
        variant(plumbing, "Standard Visit",        Money.ofRupees("399"));
    }

    private UUID category(String name, String slug, int sortOrder) {
        return db.sql("INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?) RETURNING id")
            .params(name, slug, sortOrder).query(UUID.class).single();
    }

    private UUID service(UUID categoryId, String name, String slug,
                         AssignmentMode mode, String skill, int minutes) {
        return db.sql("""
            INSERT INTO services (category_id, name, slug, assignment_mode, required_skills, estimated_minutes)
            VALUES (?, ?, ?, ?, ARRAY[?], ?) RETURNING id
            """)
            .params(categoryId, name, slug, mode.name(), skill, minutes)
            .query(UUID.class).single();
    }

    private void variant(UUID serviceId, String name, long pricePaise) {
        db.sql("INSERT INTO service_variants (service_id, name, base_price_paise) VALUES (?, ?, ?)")
            .params(serviceId, name, pricePaise).update();
    }
}
```

- [ ] **Step 5: Verify green and commit**

```bash
mvn test -Dtest=CatalogServiceTest    # Expected: 5 passed
mvn test -Dtest=ModularityTests
git add -A && git commit -m "feat(catalog): HSOS service tree with per-service assignment_mode"
```

---

## Task 8: Addresses with PostGIS

**Files:**
- Create: `src/main/resources/db/migration/V4__address.sql`, `src/main/java/com/sethu/address/{Address,NewAddress,Geocoder,LatLng,Nearby,AddressService}.java`, `src/main/java/com/sethu/address/internal/{AddressRepository,StubGeocoder}.java`
- Test: `src/test/java/com/sethu/address/AddressServiceTest.java`

**Interfaces:**
- Consumes: `JdbcClient`.
- Produces:
  - `AddressService.create(NewAddress) : UUID`
  - `AddressService.findNearby(double lat, double lng, int radiusMetres) : List<Nearby>` — **the `ST_DWithin` query P2's dispatch is built on**
  - `interface Geocoder { LatLng geocode(String line, String pincode); }` — **a port.** `StubGeocoder` in P0; Google Maps drops in at P1 with no other change.
  - `record LatLng(double lat, double lng)`, `record Nearby(UUID addressId, double metres)`

- [ ] **Step 1: The migration**

`src/main/resources/db/migration/V4__address.sql`:
```sql
CREATE TABLE addresses (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id),
  label    TEXT NOT NULL DEFAULT 'Home',
  line1    TEXT NOT NULL,
  city     TEXT NOT NULL,
  pincode  TEXT NOT NULL,
  -- SRID 4326 = WGS84 = what a phone's GPS gives you.
  -- geography (not geometry) so ST_Distance/ST_DWithin work in METRES, not degrees.
  location GEOGRAPHY(POINT, 4326) NOT NULL
);

-- Without this, ST_DWithin does a sequential scan. Invisible at 50 rows; the
-- difference between 2ms and 2s at 50,000. Add it now, not when it hurts.
CREATE INDEX addresses_location_gist ON addresses USING GIST (location);
```

- [ ] **Step 2: Write the failing test**

`src/test/java/com/sethu/address/AddressServiceTest.java`:
```java
package com.sethu.address;

import com.sethu.AbstractDbTest;
import com.sethu.identity.IdentityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AddressServiceTest extends AbstractDbTest {

    @Autowired AddressService addresses;
    @Autowired IdentityService identity;

    // Bengaluru landmarks. MG Road → Cubbon Park is ~1.5km. Mysore is ~140km.
    static final LatLng MG_ROAD     = new LatLng(12.9752, 77.6068);
    static final LatLng CUBBON_PARK = new LatLng(12.9763, 77.5929);
    static final LatLng MYSORE      = new LatLng(12.2958, 76.6394);

    UUID userId;

    @BeforeEach
    void createUser() {
        userId = identity.createCustomer("+919800000001", "Asha");
    }

    private UUID address(String line, LatLng at) {
        return addresses.create(new NewAddress(userId, "Home", line, "Bengaluru", "560001", at));
    }

    @Test
    void storesAPointAndFindsItWithinRadius() {
        UUID id = address("1 MG Road", MG_ROAD);

        var found = addresses.findNearby(CUBBON_PARK.lat(), CUBBON_PARK.lng(), 5_000);

        assertThat(found).extracting(Nearby::addressId).contains(id);
        assertThat(found.getFirst().metres()).isBetween(500.0, 3_000.0);
    }

    @Test
    void excludesPointsOutsideTheRadius() {
        // This is the query P2's dispatch lives on. If it over-selects, we offer
        // jobs to technicians 140km away.
        address("Mysore Palace", MYSORE);

        var found = addresses.findNearby(MG_ROAD.lat(), MG_ROAD.lng(), 5_000);

        assertThat(found).isEmpty();
    }

    @Test
    void returnsResultsNearestFirst() {
        address("Far", MYSORE);
        UUID near = address("Near", CUBBON_PARK);

        var found = addresses.findNearby(MG_ROAD.lat(), MG_ROAD.lng(), 200_000);

        assertThat(found.getFirst().addressId()).isEqualTo(near);
        assertThat(found).hasSize(2);
    }

    @Test
    void geocodesWhenNoCoordinatesAreSupplied() {
        UUID id = addresses.create(
            new NewAddress(userId, "Home", "somewhere", "Bengaluru", "560001", null));

        assertThat(addresses.findNearby(12.9716, 77.5946, 1_000))
            .extracting(Nearby::addressId).contains(id);
    }

    @Test
    void theSpatialIndexIsActuallyUsed() {
        // A GiST index the planner ignores is a GiST index you do not have.
        // On a tiny table the planner may still choose a seq scan — so we assert
        // the index EXISTS, and re-check the plan by hand at scale (see Step 5).
        Integer indexes = db.sql("""
            SELECT count(*) FROM pg_indexes
            WHERE tablename = 'addresses' AND indexname = 'addresses_location_gist'
            """).query(Integer.class).single();

        assertThat(indexes).isEqualTo(1);
    }
}
```

- [ ] **Step 3: Run it, watch it fail**

```bash
mvn test -Dtest=AddressServiceTest
```
Expected: FAIL — `cannot find symbol: class AddressService`.

- [ ] **Step 4: Implement**

`src/main/java/com/sethu/address/LatLng.java`:
```java
package com.sethu.address;

public record LatLng(double lat, double lng) { }
```

`src/main/java/com/sethu/address/Nearby.java`:
```java
package com.sethu.address;

import java.util.UUID;

public record Nearby(UUID addressId, double metres) { }
```

`src/main/java/com/sethu/address/NewAddress.java`:
```java
package com.sethu.address;

import java.util.UUID;

/** `at` may be null — the Geocoder fills it in. */
public record NewAddress(UUID userId, String label, String line1, String city,
                         String pincode, LatLng at) { }
```

`src/main/java/com/sethu/address/Geocoder.java`:
```java
package com.sethu.address;

/**
 * A PORT. P0 ships a stub; P1 drops in Google Maps behind this same interface.
 * Nothing else in the system knows or cares which implementation is wired.
 */
public interface Geocoder {
    LatLng geocode(String line1, String pincode);
}
```

`src/main/java/com/sethu/address/internal/StubGeocoder.java`:
```java
package com.sethu.address.internal;

import com.sethu.address.Geocoder;
import com.sethu.address.LatLng;
import org.springframework.stereotype.Component;

/** P0 only. Returns the centre of Bengaluru. NEVER ship this to production. */
@Component
public class StubGeocoder implements Geocoder {

    @Override
    public LatLng geocode(String line1, String pincode) {
        return new LatLng(12.9716, 77.5946);
    }
}
```

`src/main/java/com/sethu/address/internal/AddressRepository.java`:
```java
package com.sethu.address.internal;

import com.sethu.address.LatLng;
import com.sethu.address.Nearby;
import com.sethu.address.NewAddress;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public class AddressRepository {

    private final JdbcClient db;

    public AddressRepository(JdbcClient db) {
        this.db = db;
    }

    public UUID insert(NewAddress a, LatLng at) {
        // NOTE: ST_MakePoint takes (X, Y) = (LONGITUDE, LATITUDE). In that order.
        // Swapping them is the classic PostGIS bug: everything "works" and every
        // technician is dispatched to the wrong hemisphere.
        return db.sql("""
            INSERT INTO addresses (user_id, label, line1, city, pincode, location)
            VALUES (?, ?, ?, ?, ?, ST_MakePoint(?, ?)::geography)
            RETURNING id
            """)
            .params(a.userId(), a.label(), a.line1(), a.city(), a.pincode(),
                    at.lng(), at.lat())
            .query(UUID.class)
            .single();
    }

    /** The geospatial query P2's offer engine is built on. ROADMAP §9. */
    public List<Nearby> findNearby(double lat, double lng, int radiusMetres) {
        return db.sql("""
            SELECT id, ST_Distance(location, ST_MakePoint(?, ?)::geography) AS metres
            FROM addresses
            WHERE ST_DWithin(location, ST_MakePoint(?, ?)::geography, ?)
            ORDER BY metres ASC
            """)
            .params(lng, lat, lng, lat, radiusMetres)
            .query((rs, n) -> new Nearby(rs.getObject("id", UUID.class), rs.getDouble("metres")))
            .list();
    }
}
```

`src/main/java/com/sethu/address/AddressService.java`:
```java
package com.sethu.address;

import com.sethu.address.internal.AddressRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class AddressService {

    private final AddressRepository repo;
    private final Geocoder geocoder;

    public AddressService(AddressRepository repo, Geocoder geocoder) {
        this.repo = repo;
        this.geocoder = geocoder;
    }

    public UUID create(NewAddress a) {
        LatLng at = a.at() != null ? a.at() : geocoder.geocode(a.line1(), a.pincode());
        return repo.insert(a, at);
    }

    public List<Nearby> findNearby(double lat, double lng, int radiusMetres) {
        return repo.findNearby(lat, lng, radiusMetres);
    }
}
```

- [ ] **Step 5: Verify green, and check the query plan by hand**

```bash
mvn test -Dtest=AddressServiceTest    # Expected: 5 passed
```

```bash
docker compose exec postgres psql -U sethu -d sethu -c "
  EXPLAIN SELECT id FROM addresses
  WHERE ST_DWithin(location, ST_MakePoint(77.5946, 12.9716)::geography, 5000);"
```
Expect `Index Scan using addresses_location_gist`. On a nearly-empty table the planner may
still say `Seq Scan` — that is correct behaviour, not a broken index. **Do not "fix" it.**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(address): PostGIS geography points, geocoder port, ST_DWithin nearby query"
```

---

## Task 9: Products & Warranty

**Files:**
- Create: `src/main/resources/db/migration/V5__products.sql`, `src/main/java/com/sethu/products/{WarrantyService,RegisterProduct}.java`, `src/main/java/com/sethu/products/internal/ProductRepository.java`
- Test: `src/test/java/com/sethu/products/WarrantyServiceTest.java`

**Interfaces:**
- Consumes: `JdbcClient`.
- Produces:
  - `WarrantyService.registerModel(String name, String category, int warrantyMonths) : UUID`
  - `WarrantyService.register(RegisterProduct) : UUID` (the product unit id)
  - `WarrantyService.isUnderWarranty(UUID unitId, Instant at) : boolean` — **Pricing calls this to decide whether the job is free**

- [ ] **Step 1: The migration**

`src/main/resources/db/migration/V5__products.sql`:
```sql
CREATE TABLE product_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,              -- 'refrigerator', 'ac', ...
  warranty_months INT  NOT NULL DEFAULT 12
);

-- A physical appliance WE manufactured, identified by serial number.
CREATE TABLE product_units (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id            UUID NOT NULL REFERENCES product_models(id),
  serial              TEXT NOT NULL UNIQUE,   -- one appliance, one registration
  owner_id            UUID REFERENCES users(id),
  purchased_at        TIMESTAMPTZ,
  warranty_expires_at TIMESTAMPTZ
);
```

- [ ] **Step 2: Write the failing test**

`src/test/java/com/sethu/products/WarrantyServiceTest.java`:
```java
package com.sethu.products;

import com.sethu.AbstractDbTest;
import com.sethu.identity.IdentityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WarrantyServiceTest extends AbstractDbTest {

    @Autowired WarrantyService warranty;
    @Autowired IdentityService identity;

    static final Instant PURCHASE          = Instant.parse("2026-01-15T00:00:00Z");
    static final Instant SIX_MONTHS_LATER  = Instant.parse("2026-07-15T00:00:00Z");
    static final Instant TWO_YEARS_LATER   = Instant.parse("2028-01-15T00:00:00Z");

    UUID ownerId;
    UUID modelId;

    @BeforeEach
    void setUp() {
        ownerId = identity.createCustomer("+919800000002", "Ravi");
        modelId = warranty.registerModel("SETHU Frost 260L", "refrigerator", 12);
    }

    @Test
    void anApplianceSixMonthsOldIsUnderWarranty() {
        UUID unit = warranty.register(new RegisterProduct("SF260-0001", modelId, ownerId, PURCHASE));

        // ROADMAP §6 — the job is free.
        assertThat(warranty.isUnderWarranty(unit, SIX_MONTHS_LATER)).isTrue();
    }

    @Test
    void anApplianceTwoYearsOldIsOutOfWarranty() {
        UUID unit = warranty.register(new RegisterProduct("SF260-0002", modelId, ownerId, PURCHASE));

        assertThat(warranty.isUnderWarranty(unit, TWO_YEARS_LATER)).isFalse();
    }

    @Test
    void anUnknownUnitIsNotUnderWarranty() {
        assertThat(warranty.isUnderWarranty(UUID.randomUUID(), SIX_MONTHS_LATER)).isFalse();
    }

    @Test
    void theSameApplianceCannotBeRegisteredTwice() {
        warranty.register(new RegisterProduct("SF260-0003", modelId, ownerId, PURCHASE));

        assertThatThrownBy(() ->
            warranty.register(new RegisterProduct("SF260-0003", modelId, ownerId, PURCHASE)))
            .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
    }
}
```

- [ ] **Step 3: Run it, watch it fail**

```bash
mvn test -Dtest=WarrantyServiceTest
```
Expected: FAIL — `cannot find symbol: class WarrantyService`.

- [ ] **Step 4: Implement**

`src/main/java/com/sethu/products/RegisterProduct.java`:
```java
package com.sethu.products;

import java.time.Instant;
import java.util.UUID;

public record RegisterProduct(String serial, UUID modelId, UUID ownerId, Instant purchasedAt) { }
```

`src/main/java/com/sethu/products/internal/ProductRepository.java`:
```java
package com.sethu.products.internal;

import com.sethu.products.RegisterProduct;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ProductRepository {

    private final JdbcClient db;

    public ProductRepository(JdbcClient db) {
        this.db = db;
    }

    public UUID insertModel(String name, String category, int warrantyMonths) {
        return db.sql("""
            INSERT INTO product_models (name, category, warranty_months)
            VALUES (?, ?, ?) RETURNING id
            """)
            .params(name, category, warrantyMonths).query(UUID.class).single();
    }

    public Optional<Integer> warrantyMonths(UUID modelId) {
        return db.sql("SELECT warranty_months FROM product_models WHERE id = ?")
            .param(modelId).query(Integer.class).optional();
    }

    public UUID insertUnit(RegisterProduct p, Instant expiresAt) {
        return db.sql("""
            INSERT INTO product_units (model_id, serial, owner_id, purchased_at, warranty_expires_at)
            VALUES (?, ?, ?, ?, ?) RETURNING id
            """)
            .params(p.modelId(), p.serial(), p.ownerId(),
                    java.sql.Timestamp.from(p.purchasedAt()),
                    java.sql.Timestamp.from(expiresAt))
            .query(UUID.class).single();
    }

    public Optional<Instant> warrantyExpiry(UUID unitId) {
        return db.sql("SELECT warranty_expires_at FROM product_units WHERE id = ?")
            .param(unitId)
            .query((rs, n) -> {
                var ts = rs.getTimestamp("warranty_expires_at");
                return ts == null ? null : ts.toInstant();
            })
            .optional()
            .filter(java.util.Objects::nonNull);
    }
}
```

`src/main/java/com/sethu/products/WarrantyService.java`:
```java
package com.sethu.products;

import com.sethu.products.internal.ProductRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class WarrantyService {

    private final ProductRepository repo;

    public WarrantyService(ProductRepository repo) {
        this.repo = repo;
    }

    public UUID registerModel(String name, String category, int warrantyMonths) {
        return repo.insertModel(name, category, warrantyMonths);
    }

    public UUID register(RegisterProduct p) {
        int months = repo.warrantyMonths(p.modelId())
            .orElseThrow(() -> new IllegalArgumentException("no such product model"));

        Instant expires = p.purchasedAt()
            .atZone(ZoneOffset.UTC)
            .plusMonths(months)
            .toInstant();

        return repo.insertUnit(p, expires);
    }

    /**
     * Pricing calls this. If true, the quote is ZERO. ROADMAP §6.
     * This is the single line of code that makes owning our appliance worth something.
     */
    public boolean isUnderWarranty(UUID unitId, Instant at) {
        return repo.warrantyExpiry(unitId)
            .map(expiry -> expiry.isAfter(at))
            .orElse(false);
    }
}
```

- [ ] **Step 5: Verify green and commit**

```bash
mvn test -Dtest=WarrantyServiceTest    # Expected: 4 passed
git add -A && git commit -m "feat(products): serial-numbered units and warranty windows"
```

---

## Task 10: Pricing — and the Discount Seam

> **The whole point of this task is the seam.** P0 ships **zero** discount providers. P4's
> subscription membership will be a single new `@Component implements DiscountProvider`, and
> **nothing else in the system will change.** Spring injects `List<DiscountProvider>`
> automatically — the seam costs us one interface and one constructor parameter. ROADMAP §4.6.

**Files:**
- Create: `src/main/java/com/sethu/pricing/{Quote,QuoteRequest,DiscountProvider,PricingService}.java`
- Test: `src/test/java/com/sethu/pricing/PricingServiceTest.java`

**Interfaces:**
- Consumes: `CatalogService`, `WarrantyService` (their public APIs only).
- Produces:
  - `PricingService.quote(QuoteRequest) : Quote`
  - `record QuoteRequest(UUID variantId, UUID productUnitId, UUID customerId, Instant at)` — `productUnitId` may be null
  - `record Quote(long basePaise, long discountPaise, long totalPaise, boolean warranty)`
  - `interface DiscountProvider { long discountFor(QuoteRequest, long basePaise); }` — **THE SEAM**

- [ ] **Step 1: Write the failing test — the seam is what we are really testing**

`src/test/java/com/sethu/pricing/PricingServiceTest.java`:
```java
package com.sethu.pricing;

import com.sethu.AbstractDbTest;
import com.sethu.catalog.CatalogSeeder;
import com.sethu.catalog.CatalogService;
import com.sethu.identity.IdentityService;
import com.sethu.products.RegisterProduct;
import com.sethu.products.WarrantyService;
import com.sethu.shared.Money;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PricingServiceTest extends AbstractDbTest {

    @Autowired CatalogSeeder seeder;
    @Autowired CatalogService catalog;
    @Autowired WarrantyService warranty;
    @Autowired IdentityService identity;

    static final Instant NOW = Instant.parse("2026-07-14T10:00:00Z");

    UUID variantId;

    @BeforeEach
    void setUp() {
        seeder.seed();
        variantId = db.sql("""
            SELECT sv.id FROM service_variants sv
            JOIN services s ON s.id = sv.service_id
            WHERE s.slug = 'ac-repair' AND sv.name = 'Diagnostic Visit'
            """).query(UUID.class).single();
    }

    /** Build the service by hand so we control exactly which providers are present. */
    private PricingService pricingWith(DiscountProvider... providers) {
        return new PricingService(catalog, warranty, List.of(providers));
    }

    private UUID inWarrantyAppliance() {
        UUID owner = identity.createCustomer("+919800000003", "Meena");
        UUID model = warranty.registerModel("SETHU Cool 1.5T", "ac", 12);
        return warranty.register(new RegisterProduct(
            "SC15-" + UUID.randomUUID(), model, owner, Instant.parse("2026-03-01T00:00:00Z")));
    }

    @Test
    void quotesTheVariantBasePriceWhenThereAreNoDiscounts() {
        Quote q = pricingWith().quote(new QuoteRequest(variantId, null, null, NOW));

        assertThat(q.basePaise()).isEqualTo(Money.ofRupees("499"));
        assertThat(q.discountPaise()).isZero();
        assertThat(q.totalPaise()).isEqualTo(Money.ofRupees("499"));
        assertThat(q.warranty()).isFalse();
    }

    @Test
    void anInWarrantyApplianceMakesTheJobFree() {
        // ROADMAP §6. This is the reason to buy our fridge.
        Quote q = pricingWith().quote(
            new QuoteRequest(variantId, inWarrantyAppliance(), null, NOW));

        assertThat(q.warranty()).isTrue();
        assertThat(q.totalPaise()).isZero();
    }

    @Test
    void aDiscountProviderReducesTheTotal() {
        // THE SEAM. In P4, this provider is the subscription membership.
        DiscountProvider tenPercentOff = (request, base) -> base / 10;

        Quote q = pricingWith(tenPercentOff).quote(new QuoteRequest(variantId, null, null, NOW));

        assertThat(q.discountPaise()).isEqualTo(4_990L);
        assertThat(q.totalPaise()).isEqualTo(44_910L);
    }

    @Test
    void discountsStackAndTheTotalNeverGoesBelowZero() {
        DiscountProvider huge     = (r, base) -> base;
        DiscountProvider alsoHuge = (r, base) -> base;

        Quote q = pricingWith(huge, alsoHuge).quote(new QuoteRequest(variantId, null, null, NOW));

        assertThat(q.totalPaise()).isZero();
        assertThat(q.discountPaise()).isEqualTo(q.basePaise());   // capped, not doubled
    }

    @Test
    void warrantyShortCircuitsDiscounts() {
        // You cannot discount a free job. A provider that runs anyway is a provider
        // that will one day compute a NEGATIVE total.
        boolean[] called = { false };
        DiscountProvider spy = (r, base) -> { called[0] = true; return 0L; };

        pricingWith(spy).quote(new QuoteRequest(variantId, inWarrantyAppliance(), null, NOW));

        assertThat(called[0]).isFalse();
    }

    @Test
    void anUnknownVariantIsAnError() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            pricingWith().quote(new QuoteRequest(UUID.randomUUID(), null, null, NOW)))
            .hasMessageContaining("no such service variant");
    }
}
```

- [ ] **Step 2: Run it, watch it fail**

```bash
mvn test -Dtest=PricingServiceTest
```
Expected: FAIL — `cannot find symbol: class PricingService`.

- [ ] **Step 3: Implement**

`src/main/java/com/sethu/pricing/QuoteRequest.java`:
```java
package com.sethu.pricing;

import java.time.Instant;
import java.util.UUID;

/** `productUnitId` is null unless we are servicing an appliance WE made. */
public record QuoteRequest(UUID variantId, UUID productUnitId, UUID customerId, Instant at) { }
```

`src/main/java/com/sethu/pricing/Quote.java`:
```java
package com.sethu.pricing;

public record Quote(long basePaise, long discountPaise, long totalPaise, boolean warranty) { }
```

`src/main/java/com/sethu/pricing/DiscountProvider.java`:
```java
package com.sethu.pricing;

/**
 * THE SEAM — ROADMAP §4.6.
 *
 * P0 has ZERO implementations, on purpose. P4's subscription membership is a new
 * @Component implementing this interface, and nothing else in the system changes:
 * Spring collects every implementation into the List<DiscountProvider> that
 * PricingService already accepts.
 *
 * "Build the seam in the phase before you need it. Never the feature."
 */
@FunctionalInterface
public interface DiscountProvider {
    long discountFor(QuoteRequest request, long basePaise);
}
```

`src/main/java/com/sethu/pricing/PricingService.java`:
```java
package com.sethu.pricing;

import com.sethu.catalog.CatalogService;
import com.sethu.products.WarrantyService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PricingService {

    private final CatalogService catalog;
    private final WarrantyService warranty;
    private final List<DiscountProvider> providers;   // empty in P0. Spring fills it in P4.

    public PricingService(CatalogService catalog, WarrantyService warranty,
                          List<DiscountProvider> providers) {
        this.catalog = catalog;
        this.warranty = warranty;
        this.providers = providers;
    }

    public Quote quote(QuoteRequest request) {
        long basePaise = catalog.findVariant(request.variantId())
            .orElseThrow(() -> new IllegalArgumentException("no such service variant"))
            .basePricePaise();

        // Warranty short-circuits EVERYTHING. You cannot discount a free job.
        if (request.productUnitId() != null
            && warranty.isUnderWarranty(request.productUnitId(), request.at())) {
            return new Quote(basePaise, basePaise, 0L, true);
        }

        long discount = 0L;
        for (DiscountProvider provider : providers) {
            discount += provider.discountFor(request, basePaise);
        }
        discount = Math.min(discount, basePaise);      // never below zero

        return new Quote(basePaise, discount, basePaise - discount, false);
    }
}
```

- [ ] **Step 4: Verify green — and check the walls**

```bash
mvn test -Dtest=PricingServiceTest    # Expected: 6 passed
mvn test -Dtest=ModularityTests        # pricing touches only catalog/products PUBLIC types
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(pricing): quotes, warranty short-circuit, and the discount seam"
```

---

## Task 11: The Append-Only Ledger

**Files:**
- Create: `src/main/resources/db/migration/V6__ledger.sql`, `src/main/java/com/sethu/ledger/{LedgerService,PaymentMethod,RecordPayment}.java`, `src/main/java/com/sethu/ledger/internal/LedgerRepository.java`
- Test: `src/test/java/com/sethu/ledger/LedgerServiceTest.java`

**Interfaces:**
- Consumes: `JdbcClient`, `ApplicationEventPublisher`.
- Produces:
  - `LedgerService.recordPayment(RecordPayment) : void`
  - `LedgerService.recordCashDeposit(UUID technicianId, long amountPaise) : void`
  - `LedgerService.issueCredit(UUID customerId, long amountPaise, String reason) : void`
  - `LedgerService.cashOutstandingFor(UUID technicianId) : long` — **the number on the admin reconciliation screen, ROADMAP §6**
  - `enum PaymentMethod { UPI, CASH, ONLINE }`

- [ ] **Step 1: The migration**

`src/main/resources/db/migration/V6__ledger.sql`:
```sql
-- APPEND-ONLY. ROADMAP §6.
--
-- There is no UPDATE and no DELETE on this table, ever. Mistakes are corrected by
-- writing a new, offsetting row. A `balance` column that drifts from truth and can
-- never be reconciled is the classic startup catastrophe. This is how we refuse to
-- have one.
--
-- NOTE: this is ONE table, not the four (payments / cash_custody / credits) listed in
-- ROADMAP §9. Four tables each need their own reconciliation query and can drift apart
-- from one another. One append-only log with a `kind` column cannot.
CREATE TABLE ledger_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL CHECK (kind IN (
                  'REVENUE',         -- the customer paid us
                  'CASH_CUSTODY',    -- a technician is holding OUR cash (a debt to us)
                  'CASH_DEPOSIT',    -- the technician handed it in (offsets custody)
                  'CREDIT_ISSUED',   -- we owe the customer (refund / apology)
                  'CREDIT_REDEEMED'
                )),
  amount_paise  BIGINT NOT NULL,
  booking_id    UUID,
  customer_id   UUID REFERENCES users(id),
  technician_id UUID REFERENCES users(id),
  method        TEXT CHECK (method IN ('UPI','CASH','ONLINE')),
  memo          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ledger_entries_technician ON ledger_entries (technician_id, kind);
```

- [ ] **Step 2: Write the failing test — cash custody is what protects real money**

`src/test/java/com/sethu/ledger/LedgerServiceTest.java`:
```java
package com.sethu.ledger;

import com.sethu.AbstractDbTest;
import com.sethu.identity.IdentityService;
import com.sethu.identity.NewTechnician;
import com.sethu.shared.Money;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class LedgerServiceTest extends AbstractDbTest {

    @Autowired LedgerService ledger;
    @Autowired IdentityService identity;

    UUID techId;

    @BeforeEach
    void setUp() {
        techId = identity.createTechnician(
            NewTechnician.of("+919700000001", "Iqbal", "Bengaluru", List.of("ac_repair")));
    }

    private void pay(long paise, PaymentMethod method) {
        ledger.recordPayment(new RecordPayment(UUID.randomUUID(), paise, method, techId));
    }

    @Test
    void aUpiPaymentCreatesRevenueAndNoCustody() {
        // The money went STRAIGHT to the company account. The technician never touched it.
        pay(Money.ofRupees("499"), PaymentMethod.UPI);

        assertThat(ledger.cashOutstandingFor(techId)).isZero();
    }

    @Test
    void aCashPaymentPutsTheTechnicianInCustodyOfOurMoney() {
        // ROADMAP §6. They are now holding ₹499 that belongs to us.
        pay(Money.ofRupees("499"), PaymentMethod.CASH);

        assertThat(ledger.cashOutstandingFor(techId)).isEqualTo(Money.ofRupees("499"));
    }

    @Test
    void cashCustodyAccumulatesAcrossJobs() {
        pay(Money.ofRupees("499"), PaymentMethod.CASH);
        pay(Money.ofRupees("2499"), PaymentMethod.CASH);
        pay(Money.ofRupees("399"), PaymentMethod.CASH);

        assertThat(ledger.cashOutstandingFor(techId)).isEqualTo(Money.ofRupees("3397"));
    }

    @Test
    void aDepositClearsTheOutstandingBalance() {
        pay(Money.ofRupees("499"), PaymentMethod.CASH);

        ledger.recordCashDeposit(techId, Money.ofRupees("499"));

        assertThat(ledger.cashOutstandingFor(techId)).isZero();
    }

    @Test
    void aPartialDepositLeavesTheGapVisible() {
        // This gap is exactly what the admin reconciliation screen chases.
        pay(Money.ofRupees("1000"), PaymentMethod.CASH);

        ledger.recordCashDeposit(techId, Money.ofRupees("600"));

        assertThat(ledger.cashOutstandingFor(techId)).isEqualTo(Money.ofRupees("400"));
    }

    @Test
    void theLedgerIsAppendOnly() {
        // A correction is a NEW ROW, never an edit.
        UUID customer = identity.createCustomer("+919600000009", "Nita");
        pay(Money.ofRupees("499"), PaymentMethod.CASH);
        ledger.issueCredit(customer, Money.ofRupees("499"), "job failed — apology");

        Integer rows = db.sql("SELECT count(*) FROM ledger_entries").query(Integer.class).single();

        assertThat(rows).isEqualTo(3);   // REVENUE + CASH_CUSTODY + CREDIT_ISSUED
    }

    @Test
    void aTechnicianWithNoJobsOwesNothing() {
        assertThat(ledger.cashOutstandingFor(techId)).isZero();
    }
}
```

- [ ] **Step 3: Run it, watch it fail**

```bash
mvn test -Dtest=LedgerServiceTest
```
Expected: FAIL — `cannot find symbol: class LedgerService`.

- [ ] **Step 4: Implement**

`src/main/java/com/sethu/ledger/PaymentMethod.java`:
```java
package com.sethu.ledger;

public enum PaymentMethod { UPI, CASH, ONLINE }
```

`src/main/java/com/sethu/ledger/RecordPayment.java`:
```java
package com.sethu.ledger;

import java.util.UUID;

public record RecordPayment(UUID bookingId, long amountPaise,
                            PaymentMethod method, UUID technicianId) { }
```

`src/main/java/com/sethu/ledger/internal/LedgerRepository.java`:
```java
package com.sethu.ledger.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public class LedgerRepository {

    private final JdbcClient db;

    public LedgerRepository(JdbcClient db) {
        this.db = db;
    }

    public void append(String kind, long amountPaise, UUID bookingId, UUID customerId,
                       UUID technicianId, String method, String memo) {
        db.sql("""
            INSERT INTO ledger_entries
              (kind, amount_paise, booking_id, customer_id, technician_id, method, memo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """)
            .params(kind, amountPaise, bookingId, customerId, technicianId, method, memo)
            .update();
    }

    /** The number on the admin reconciliation screen. ROADMAP §6. */
    public long cashOutstandingFor(UUID technicianId) {
        Long outstanding = db.sql("""
            SELECT
                COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CASH_CUSTODY'), 0)
              - COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CASH_DEPOSIT'), 0)
            FROM ledger_entries
            WHERE technician_id = ?
            """)
            .param(technicianId)
            .query(Long.class)
            .single();

        return outstanding == null ? 0L : outstanding;
    }
}
```

`src/main/java/com/sethu/ledger/LedgerService.java`:
```java
package com.sethu.ledger;

import com.sethu.events.DomainEvent;
import com.sethu.ledger.internal.LedgerRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class LedgerService {

    private final LedgerRepository repo;
    private final ApplicationEventPublisher events;

    public LedgerService(LedgerRepository repo, ApplicationEventPublisher events) {
        this.repo = repo;
        this.events = events;
    }

    @Transactional
    public void recordPayment(RecordPayment p) {
        repo.append("REVENUE", p.amountPaise(), p.bookingId(), null,
                    p.technicianId(), p.method().name(),
                    "payment via " + p.method());

        // CASH means the technician is physically holding OUR money.
        // UPI and ONLINE land in the company account directly — no custody, no risk.
        if (p.method() == PaymentMethod.CASH && p.technicianId() != null) {
            repo.append("CASH_CUSTODY", p.amountPaise(), p.bookingId(), null,
                        p.technicianId(), null,
                        "cash collected by technician, pending deposit");

            events.publishEvent(new DomainEvent.CashCollected(
                p.bookingId(), p.technicianId(), p.amountPaise()));
        }

        events.publishEvent(new DomainEvent.PaymentCaptured(
            p.bookingId(), p.amountPaise(), p.method().name()));
    }

    @Transactional
    public void recordCashDeposit(UUID technicianId, long amountPaise) {
        repo.append("CASH_DEPOSIT", amountPaise, null, null, technicianId, null,
                    "cash deposited to company account");
    }

    @Transactional
    public void issueCredit(UUID customerId, long amountPaise, String reason) {
        repo.append("CREDIT_ISSUED", amountPaise, null, customerId, null, null, reason);
    }

    public long cashOutstandingFor(UUID technicianId) {
        return repo.cashOutstandingFor(technicianId);
    }
}
```

- [ ] **Step 5: Verify green and commit**

```bash
mvn test -Dtest=LedgerServiceTest    # Expected: 7 passed
git add -A && git commit -m "feat(ledger): append-only entries and technician cash custody"
```

---

## Task 12: Booking Service — the State Machine Meets the Database

**Files:**
- Create: `src/main/resources/db/migration/V7__booking.sql`, `src/main/java/com/sethu/booking/{Booking,BookingEvent,NewBooking,BookingService}.java`, `src/main/java/com/sethu/booking/internal/BookingRepository.java`
- Test: `src/test/java/com/sethu/booking/BookingServiceTest.java`

**Interfaces:**
- Consumes: `BookingStateMachine` (Task 4), `PricingService`, `ApplicationEventPublisher`.
- Produces:
  - `BookingService.create(NewBooking) : UUID` — lands in `DRAFT`
  - `BookingService.apply(UUID bookingId, BookingAction, Map<String,Object> meta) : BookingState` — **the ONLY way a booking ever changes state**
  - `BookingService.find(UUID) : Optional<Booking>`, `.history(UUID) : List<BookingEvent>`, `.listAll() : List<Booking>`

- [ ] **Step 1: The migration**

`src/main/resources/db/migration/V7__booking.sql`:
```sql
CREATE TABLE bookings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES users(id),
  service_id         UUID NOT NULL REFERENCES services(id),
  variant_id         UUID NOT NULL REFERENCES service_variants(id),
  address_id         UUID NOT NULL REFERENCES addresses(id),
  product_unit_id    UUID REFERENCES product_units(id),     -- set when servicing OUR appliance
  technician_id      UUID REFERENCES users(id),             -- null until assigned
  state              TEXT NOT NULL DEFAULT 'DRAFT',
  scheduled_for      TIMESTAMPTZ,
  quoted_total_paise BIGINT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bookings_state ON bookings (state, created_at DESC);

-- APPEND-ONLY. Every state transition writes exactly one row, in the SAME
-- TRANSACTION as the booking update. This log is our debugger, our dispute
-- evidence, and P5's analytics source. ROADMAP §7.
CREATE TABLE booking_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  from_state TEXT NOT NULL,
  action     TEXT NOT NULL,
  to_state   TEXT NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_events_booking ON booking_events (booking_id, created_at);
```

> **Why `state` is `TEXT` and not a Postgres enum:** adding a state to a PG enum requires a
> migration and locks. The Java enum is the source of truth; the database stores its name.
> The state machine is what enforces legality — not a `CHECK` constraint that would have to be
> kept in sync with it in two places.

- [ ] **Step 2: Write the failing test**

`src/test/java/com/sethu/booking/BookingServiceTest.java`:
```java
package com.sethu.booking;

import com.sethu.AbstractDbTest;
import com.sethu.address.AddressService;
import com.sethu.address.LatLng;
import com.sethu.address.NewAddress;
import com.sethu.catalog.CatalogSeeder;
import com.sethu.identity.IdentityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static com.sethu.booking.BookingAction.*;
import static com.sethu.booking.BookingState.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingServiceTest extends AbstractDbTest {

    @Autowired BookingService bookings;
    @Autowired IdentityService identity;
    @Autowired AddressService addresses;
    @Autowired CatalogSeeder seeder;

    UUID customerId, addressId, serviceId, variantId;

    @BeforeEach
    void setUp() {
        seeder.seed();
        customerId = identity.createCustomer("+919600000001", "Priya");
        addressId = addresses.create(new NewAddress(
            customerId, "Home", "4 Church St", "Bengaluru", "560001",
            new LatLng(12.9752, 77.6068)));

        serviceId = db.sql("SELECT id FROM services WHERE slug = 'ac-repair'")
            .query(UUID.class).single();
        variantId = db.sql("""
            SELECT id FROM service_variants
            WHERE service_id = ? AND name = 'Diagnostic Visit'
            """).param(serviceId).query(UUID.class).single();
    }

    private UUID newBooking() {
        return bookings.create(new NewBooking(customerId, serviceId, variantId, addressId, null, null));
    }

    @Test
    void aNewBookingStartsInDraftAndIsQuoted() {
        UUID id = newBooking();

        assertThat(bookings.find(id)).get().satisfies(b -> {
            assertThat(b.state()).isEqualTo(DRAFT);
            assertThat(b.quotedTotalPaise()).isEqualTo(49_900L);
        });
    }

    @Test
    void walksTheEntireHappyPathToCompleted() {
        UUID id = newBooking();

        assertThat(bookings.apply(id, CONFIRM, Map.of())).isEqualTo(CONFIRMED);
        assertThat(bookings.apply(id, SEARCH, Map.of())).isEqualTo(SEARCHING);
        assertThat(bookings.apply(id, ASSIGN, Map.of())).isEqualTo(ASSIGNED);
        assertThat(bookings.apply(id, DEPART, Map.of())).isEqualTo(EN_ROUTE);
        assertThat(bookings.apply(id, ARRIVE, Map.of())).isEqualTo(ARRIVED);
        assertThat(bookings.apply(id, VERIFY_START, Map.of())).isEqualTo(IN_PROGRESS);
        assertThat(bookings.apply(id, REQUEST_COMPLETION, Map.of())).isEqualTo(AWAITING_COMPLETION);
        assertThat(bookings.apply(id, VERIFY_COMPLETION, Map.of())).isEqualTo(COMPLETED);
    }

    @Test
    void rejectsAnIllegalTransitionAndLeavesTheBookingUNTOUCHED() {
        UUID id = newBooking();

        assertThatThrownBy(() -> bookings.apply(id, VERIFY_COMPLETION, Map.of()))
            .isInstanceOf(IllegalTransitionException.class);

        // The booking did not move...
        assertThat(bookings.find(id)).get().extracting(Booking::state).isEqualTo(DRAFT);
        // ...and NOTHING was written to the log. A rejected action is not an event.
        assertThat(bookings.history(id)).isEmpty();
    }

    @Test
    void cannotActOnATerminalBooking() {
        UUID id = newBooking();
        bookings.apply(id, CANCEL, Map.of());

        assertThatThrownBy(() -> bookings.apply(id, CONFIRM, Map.of()))
            .isInstanceOf(IllegalTransitionException.class);
    }

    @Test
    void everyTransitionWritesExactlyOneBookingEventRow() {
        UUID id = newBooking();
        bookings.apply(id, CONFIRM, Map.of());
        bookings.apply(id, SEARCH, Map.of());
        bookings.apply(id, ESCALATE, Map.of("reason", "no takers"));

        assertThat(bookings.history(id))
            .extracting(BookingEvent::fromState, BookingEvent::action, BookingEvent::toState)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(DRAFT, CONFIRM, CONFIRMED),
                org.assertj.core.groups.Tuple.tuple(CONFIRMED, SEARCH, SEARCHING),
                org.assertj.core.groups.Tuple.tuple(SEARCHING, ESCALATE, ESCALATED));
    }

    @Test
    void anEscalatedBookingCanStillBeAssigned() {
        // The human escape hatch. P1 runs the business on exactly this path,
        // and P2's offer engine falls back to it. ROADMAP §4.4.
        UUID id = newBooking();
        bookings.apply(id, CONFIRM, Map.of());
        bookings.apply(id, SEARCH, Map.of());
        bookings.apply(id, ESCALATE, Map.of("reason", "nobody accepted"));

        assertThat(bookings.apply(id, ASSIGN, Map.of())).isEqualTo(ASSIGNED);
    }

    @Test
    void aFailedBookingIsTerminal() {
        // No six-hour "searching..." purgatory. ROADMAP §5.2, tier 5.
        UUID id = newBooking();
        bookings.apply(id, CONFIRM, Map.of());
        bookings.apply(id, SEARCH, Map.of());
        bookings.apply(id, FAIL, Map.of("reason", "no technician available"));

        assertThatThrownBy(() -> bookings.apply(id, ASSIGN, Map.of()))
            .isInstanceOf(IllegalTransitionException.class);
    }

    @Test
    void assigningRecordsWhichTechnicianGotTheJob() {
        UUID tech = identity.createTechnician(com.sethu.identity.NewTechnician.of(
            "+919700000002", "Iqbal", "Bengaluru", java.util.List.of("ac_repair")));

        UUID id = newBooking();
        bookings.apply(id, CONFIRM, Map.of());
        bookings.apply(id, SEARCH, Map.of());
        bookings.apply(id, ASSIGN, Map.of("technicianId", tech.toString()));

        assertThat(bookings.find(id)).get().extracting(Booking::technicianId).isEqualTo(tech);
    }
}
```

- [ ] **Step 3: Run it, watch it fail**

```bash
mvn test -Dtest=BookingServiceTest
```
Expected: FAIL — `cannot find symbol: class BookingService`.

- [ ] **Step 4: Implement the records**

`src/main/java/com/sethu/booking/Booking.java`:
```java
package com.sethu.booking;

import java.time.Instant;
import java.util.UUID;

public record Booking(
    UUID id,
    UUID customerId,
    UUID serviceId,
    UUID variantId,
    UUID addressId,
    UUID productUnitId,
    UUID technicianId,
    BookingState state,
    long quotedTotalPaise,
    Instant createdAt
) { }
```

`src/main/java/com/sethu/booking/BookingEvent.java`:
```java
package com.sethu.booking;

import java.time.Instant;
import java.util.UUID;

public record BookingEvent(UUID id, UUID bookingId, BookingState fromState,
                           BookingAction action, BookingState toState, Instant createdAt) { }
```

`src/main/java/com/sethu/booking/NewBooking.java`:
```java
package com.sethu.booking;

import java.time.Instant;
import java.util.UUID;

public record NewBooking(UUID customerId, UUID serviceId, UUID variantId, UUID addressId,
                         UUID productUnitId, Instant scheduledFor) { }
```

- [ ] **Step 5: Implement the repository**

`src/main/java/com/sethu/booking/internal/BookingRepository.java`:
```java
package com.sethu.booking.internal;

import com.sethu.booking.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class BookingRepository {

    private final JdbcClient db;

    public BookingRepository(JdbcClient db) {
        this.db = db;
    }

    public UUID insert(NewBooking b, long quotedTotalPaise) {
        return db.sql("""
            INSERT INTO bookings
              (customer_id, service_id, variant_id, address_id, product_unit_id,
               scheduled_for, quoted_total_paise, state)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT')
            RETURNING id
            """)
            .params(b.customerId(), b.serviceId(), b.variantId(), b.addressId(),
                    b.productUnitId(),
                    b.scheduledFor() == null ? null : Timestamp.from(b.scheduledFor()),
                    quotedTotalPaise)
            .query(UUID.class)
            .single();
    }

    private Booking map(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        return new Booking(
            rs.getObject("id", UUID.class),
            rs.getObject("customer_id", UUID.class),
            rs.getObject("service_id", UUID.class),
            rs.getObject("variant_id", UUID.class),
            rs.getObject("address_id", UUID.class),
            rs.getObject("product_unit_id", UUID.class),
            rs.getObject("technician_id", UUID.class),
            BookingState.valueOf(rs.getString("state")),
            rs.getLong("quoted_total_paise"),
            rs.getTimestamp("created_at").toInstant());
    }

    private static final String COLUMNS = """
        id, customer_id, service_id, variant_id, address_id, product_unit_id,
        technician_id, state, quoted_total_paise, created_at
        """;

    public Optional<Booking> find(UUID id) {
        return db.sql("SELECT " + COLUMNS + " FROM bookings WHERE id = ?")
            .param(id).query(this::map).optional();
    }

    public List<Booking> listAll() {
        return db.sql("SELECT " + COLUMNS + " FROM bookings ORDER BY created_at DESC LIMIT 200")
            .query(this::map).list();
    }

    public void updateState(UUID id, BookingState next, UUID technicianId) {
        db.sql("""
            UPDATE bookings
            SET state = ?,
                technician_id = COALESCE(?, technician_id),
                updated_at = now()
            WHERE id = ?
            """)
            .params(next.name(), technicianId, id)
            .update();
    }

    public void appendEvent(UUID bookingId, BookingState from, BookingAction action,
                            BookingState to, String metaJson) {
        db.sql("""
            INSERT INTO booking_events (booking_id, from_state, action, to_state, meta)
            VALUES (?, ?, ?, ?, ?::jsonb)
            """)
            .params(bookingId, from.name(), action.name(), to.name(), metaJson)
            .update();
    }

    public List<BookingEvent> history(UUID bookingId) {
        return db.sql("""
            SELECT id, booking_id, from_state, action, to_state, created_at
            FROM booking_events WHERE booking_id = ? ORDER BY created_at ASC
            """)
            .param(bookingId)
            .query((rs, n) -> new BookingEvent(
                rs.getObject("id", UUID.class),
                rs.getObject("booking_id", UUID.class),
                BookingState.valueOf(rs.getString("from_state")),
                BookingAction.valueOf(rs.getString("action")),
                BookingState.valueOf(rs.getString("to_state")),
                rs.getTimestamp("created_at").toInstant()))
            .list();
    }
}
```

- [ ] **Step 6: Implement the service — the heart of P0**

`src/main/java/com/sethu/booking/BookingService.java`:
```java
package com.sethu.booking;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sethu.booking.internal.BookingRepository;
import com.sethu.events.DomainEvent;
import com.sethu.pricing.PricingService;
import com.sethu.pricing.Quote;
import com.sethu.pricing.QuoteRequest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class BookingService {

    private final BookingRepository repo;
    private final PricingService pricing;
    private final ApplicationEventPublisher events;
    private final ObjectMapper json = new ObjectMapper();

    public BookingService(BookingRepository repo, PricingService pricing,
                          ApplicationEventPublisher events) {
        this.repo = repo;
        this.pricing = pricing;
        this.events = events;
    }

    @Transactional
    public UUID create(NewBooking b) {
        Quote quote = pricing.quote(
            new QuoteRequest(b.variantId(), b.productUnitId(), b.customerId(), Instant.now()));

        UUID id = repo.insert(b, quote.totalPaise());

        events.publishEvent(new DomainEvent.BookingCreated(id, b.customerId()));

        return id;
    }

    /**
     * THE ONLY WAY A BOOKING'S STATE EVER CHANGES.
     *
     * The state machine decides legality BEFORE we touch the database. If it says no,
     * we throw and nothing is written — no partial update, no orphaned event row, no
     * event published to a listener for a thing that did not happen.
     *
     * The booking UPDATE and the booking_events INSERT are in ONE transaction. If the
     * log write fails, the transition fails. ROADMAP §7.
     *
     * Domain events are published via Spring Modulith, which delivers them only AFTER
     * this transaction commits. A rolled-back transition notifies nobody.
     */
    @Transactional
    public BookingState apply(UUID bookingId, BookingAction action, Map<String, Object> meta) {
        Booking current = repo.find(bookingId)
            .orElseThrow(() -> new IllegalArgumentException("no such booking: " + bookingId));

        // Throws IllegalTransitionException. Nothing below runs if it does.
        BookingState next = BookingStateMachine.transition(current.state(), action);

        UUID technicianId = meta.get("technicianId") instanceof String s
            ? UUID.fromString(s)
            : null;

        repo.updateState(bookingId, next, technicianId);
        repo.appendEvent(bookingId, current.state(), action, next, toJson(meta));

        toDomainEvent(bookingId, action, current, technicianId, meta)
            .ifPresent(events::publishEvent);

        return next;
    }

    public Optional<Booking> find(UUID id)          { return repo.find(id); }
    public List<Booking> listAll()                  { return repo.listAll(); }
    public List<BookingEvent> history(UUID id)      { return repo.history(id); }

    /** Maps a state transition onto the published event catalog. ROADMAP §8. */
    private Optional<DomainEvent> toDomainEvent(UUID id, BookingAction action, Booking current,
                                                UUID newTechnicianId, Map<String, Object> meta) {
        UUID tech = newTechnicianId != null ? newTechnicianId : current.technicianId();
        String reason = String.valueOf(meta.getOrDefault("reason", "unspecified"));

        return Optional.ofNullable(switch (action) {
            case CONFIRM            -> new DomainEvent.BookingConfirmed(id, current.serviceId());
            case ASSIGN             -> new DomainEvent.BookingAssigned(id, tech);
            case DEPART             -> new DomainEvent.TechnicianEnRoute(id, tech);
            case ARRIVE             -> new DomainEvent.TechnicianArrived(id, tech);
            case VERIFY_START       -> new DomainEvent.BookingStarted(id);
            case VERIFY_COMPLETION  -> new DomainEvent.BookingCompleted(id, current.quotedTotalPaise());
            case ESCALATE           -> new DomainEvent.BookingEscalated(id, reason);
            case FAIL               -> new DomainEvent.BookingFailed(id, reason);
            case CANCEL             -> new DomainEvent.BookingCancelled(
                                            id, String.valueOf(meta.getOrDefault("by", "ops")));
            case RESCHEDULE         -> new DomainEvent.BookingRescheduled(
                                            id, String.valueOf(meta.getOrDefault("newSlot", "")));
            // Internal steps. Nobody outside Booking needs to know. Publishing them
            // would be noise, and noise is how real events get ignored.
            case SEARCH, REQUEST_COMPLETION, RESUME -> null;
        });
    }

    private String toJson(Map<String, Object> meta) {
        try {
            return json.writeValueAsString(meta);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("booking meta is not serialisable", e);
        }
    }
}
```

- [ ] **Step 7: Verify green and commit**

```bash
mvn test -Dtest=BookingServiceTest    # Expected: 8 passed
mvn test -Dtest=ModularityTests
git add -A && git commit -m "feat(booking): state machine wired to the database with an append-only event log"
```

---

## Task 13: Notifications — Proving the Event Bus Actually Fires

> Small task, real purpose. Every module publishes events, but until something
> **subscribes**, the bus is untested plumbing — and you would not find out it was never
> wired until P1, when a customer doesn't get their "technician assigned" push. This makes a
> subscriber exist, react, and be asserted on. **It sends nothing.** Delivery is P1.

**Files:**
- Create: `src/main/java/com/sethu/notifications/internal/{NotificationListener,SentNotification}.java`
- Test: `src/test/java/com/sethu/notifications/NotificationListenerTest.java`

**Interfaces:**
- Consumes: `DomainEvent` (the catalog).
- Produces: **no public API at all.** This module is purely reactive — nothing calls it, it only listens. That is itself a design statement: notifications can never become a dependency of the booking flow.

- [ ] **Step 1: Write the failing test using Spring Modulith's `Scenario` API**

`src/test/java/com/sethu/notifications/NotificationListenerTest.java`:
```java
package com.sethu.notifications;

import com.sethu.TestcontainersConfig;
import com.sethu.events.DomainEvent;
import com.sethu.notifications.internal.NotificationListener;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.modulith.test.Scenario;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @ApplicationModuleTest boots ONLY the notifications module plus what it needs.
 * If this test needs half the application to start, the module is not isolated.
 */
@ApplicationModuleTest
@Import(TestcontainersConfig.class)
class NotificationListenerTest {

    @Autowired NotificationListener listener;

    @BeforeEach
    void clear() {
        listener.sent().clear();
    }

    @Test
    void reactsToBookingConfirmed(Scenario scenario) {
        UUID booking = UUID.randomUUID();

        scenario.publish(new DomainEvent.BookingConfirmed(booking, UUID.randomUUID()))
            .andWaitForStateChange(() -> listener.sent())
            .andVerify(sent -> assertThat(sent)
                .containsExactly(new SentNotification("customer", "booking_confirmed", booking)));
    }

    @Test
    void anAssignmentTellsBOTHSides(Scenario scenario) {
        UUID booking = UUID.randomUUID();

        scenario.publish(new DomainEvent.BookingAssigned(booking, UUID.randomUUID()))
            .andWaitForStateChange(() -> listener.sent())
            .andVerify(sent -> assertThat(sent).containsExactlyInAnyOrder(
                new SentNotification("customer", "technician_assigned", booking),
                new SentNotification("technician", "job_assigned", booking)));
    }

    @Test
    void anEscalationNotifiesOPSNotJustTheCustomer(Scenario scenario) {
        // ROADMAP §5.3 — the system chases ops. Ops does not wait to be chased.
        // If the ONLY escalation were "customer calls us", every customer who does
        // not bother to call is a booking that dies silently.
        UUID booking = UUID.randomUUID();

        scenario.publish(new DomainEvent.BookingEscalated(booking, "no takers"))
            .andWaitForStateChange(() -> listener.sent())
            .andVerify(sent -> assertThat(sent).containsExactlyInAnyOrder(
                new SentNotification("ops", "booking_needs_a_human", booking),
                new SentNotification("customer", "arranging_personally", booking)));
    }

    @Test
    void ignoresEventsItDoesNotCareAbout(Scenario scenario) {
        scenario.publish(new DomainEvent.BookingCreated(UUID.randomUUID(), UUID.randomUUID()))
            .andWaitForStateChange(() -> listener.sent(), sent -> true)
            .andVerify(sent -> assertThat(sent).isEmpty());   // nothing confirmed; nothing to say
    }
}
```

Move `SentNotification` to the public package so the test can import it —
`src/main/java/com/sethu/notifications/SentNotification.java`:
```java
package com.sethu.notifications;

import java.util.UUID;

public record SentNotification(String to, String template, UUID bookingId) { }
```
(and update the test's import to `com.sethu.notifications.SentNotification`).

- [ ] **Step 2: Run it, watch it fail**

```bash
mvn test -Dtest=NotificationListenerTest
```
Expected: FAIL — `cannot find symbol: class NotificationListener`.

- [ ] **Step 3: Implement**

`src/main/java/com/sethu/notifications/internal/NotificationListener.java`:
```java
package com.sethu.notifications.internal;

import com.sethu.events.DomainEvent;
import com.sethu.notifications.SentNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * P0: records what it WOULD send. Sends nothing.
 * P1 swaps the body of send() for FCM + MSG91 and nothing else changes.
 *
 * @ApplicationModuleListener = @Async + @Transactional(REQUIRES_NEW) + @TransactionalEventListener.
 * The important part: it fires only AFTER the publishing transaction COMMITS. A booking
 * that rolled back notifies nobody. And because Spring Modulith persists every publication
 * to `event_publication`, a listener that throws leaves an INCOMPLETE row we can retry —
 * instead of a notification that silently evaporated into a log line.
 */
@Component
public class NotificationListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationListener.class);

    private final List<SentNotification> sent = new CopyOnWriteArrayList<>();

    public List<SentNotification> sent() {
        return sent;
    }

    @ApplicationModuleListener
    void on(DomainEvent.BookingConfirmed e) {
        send("customer", "booking_confirmed", e.bookingId());
    }

    @ApplicationModuleListener
    void on(DomainEvent.BookingAssigned e) {
        send("customer", "technician_assigned", e.bookingId());
        send("technician", "job_assigned", e.bookingId());
    }

    @ApplicationModuleListener
    void on(DomainEvent.TechnicianArrived e) {
        send("customer", "technician_arrived", e.bookingId());
    }

    @ApplicationModuleListener
    void on(DomainEvent.BookingCompleted e) {
        send("customer", "job_completed", e.bookingId());
    }

    /** ROADMAP §5.3 — Tier 4 does TWO things at once. This is the second one. */
    @ApplicationModuleListener
    void on(DomainEvent.BookingEscalated e) {
        send("ops", "booking_needs_a_human", e.bookingId());
        send("customer", "arranging_personally", e.bookingId());
    }

    @ApplicationModuleListener
    void on(DomainEvent.BookingFailed e) {
        send("customer", "could_not_staff_apology", e.bookingId());
    }

    private void send(String to, String template, java.util.UUID bookingId) {
        sent.add(new SentNotification(to, template, bookingId));
        log.info("[would send] {} -> {} (booking {})", template, to, bookingId);
    }
}
```

- [ ] **Step 4: Verify green and commit**

```bash
mvn test -Dtest=NotificationListenerTest    # Expected: 4 passed
git add -A && git commit -m "feat(notifications): event listeners (log only — sends nothing in P0)"
```

---

## Task 14: The Ops API, the Seed, and the Bare Admin Shell

**Files:**
- Create: `src/main/java/com/sethu/ops/internal/OpsController.java`, `src/main/java/com/sethu/ops/internal/DevSeeder.java`, `admin/` (Next.js)
- Test: `src/test/java/com/sethu/ops/OpsControllerTest.java`

**Interfaces:**
- Consumes: `BookingService`, `LedgerService`, `IdentityService`, `CatalogSeeder`, `AddressService` — **all public APIs.**
- Produces:
  - `GET /ops/bookings` · `GET /ops/bookings/{id}` · `GET /ops/bookings/{id}/history`
  - `POST /ops/bookings/{id}/actions/{action}` → `{"state": "..."}`, **HTTP 409** on illegal transition
  - `GET /ops/cash-reconciliation`
  - All admin-only, enforced by `SecurityConfig` (Task 6).

> **Stop line:** the admin shell is deliberately ugly. Unstyled HTML. No component library.
> Its only job is to satisfy the P0 exit criterion — a human can drive a booking through every
> state and every failure path. **Do not spend an afternoon on it.**

- [ ] **Step 1: Write the failing controller test**

`src/test/java/com/sethu/ops/OpsControllerTest.java`:
```java
package com.sethu.ops;

import com.sethu.AbstractDbTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class OpsControllerTest extends AbstractDbTest {

    @Autowired MockMvc mvc;
    @Autowired com.sethu.ops.internal.DevSeeder seeder;

    private java.util.UUID seedOneBooking() {
        return seeder.seed();
    }

    @Test
    void refusesAnAnonymousCaller() throws Exception {
        mvc.perform(get("/ops/bookings")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void refusesANonAdmin() throws Exception {
        mvc.perform(get("/ops/bookings")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void listsBookings() throws Exception {
        seedOneBooking();

        mvc.perform(get("/ops/bookings"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].state").value("DRAFT"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void appliesALegalActionAndReturnsTheNewState() throws Exception {
        var id = seedOneBooking();

        mvc.perform(post("/ops/bookings/{id}/actions/{action}", id, "CONFIRM"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.state").value("CONFIRMED"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void returns409ConflictOnAnIllegalActionNotA500() throws Exception {
        // An illegal transition is the caller asking for something impossible.
        // That is a 409, not a 500. The state machine did its job correctly.
        var id = seedOneBooking();

        mvc.perform(post("/ops/bookings/{id}/actions/{action}", id, "VERIFY_COMPLETION"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message")
                .value("cannot verify_completion a booking in state DRAFT"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void returnsTheTransitionHistory() throws Exception {
        var id = seedOneBooking();
        mvc.perform(post("/ops/bookings/{id}/actions/{action}", id, "CONFIRM"));

        mvc.perform(get("/ops/bookings/{id}/history", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].toState").value("CONFIRMED"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void anUnknownActionIs400NotAServerError() throws Exception {
        var id = seedOneBooking();

        mvc.perform(post("/ops/bookings/{id}/actions/{action}", id, "TELEPORT"))
            .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: Run it, watch it fail**

```bash
mvn test -Dtest=OpsControllerTest
```
Expected: FAIL — `cannot find symbol: class DevSeeder`.

- [ ] **Step 3: Implement the dev seeder**

`src/main/java/com/sethu/ops/internal/DevSeeder.java`:
```java
package com.sethu.ops.internal;

import com.sethu.address.AddressService;
import com.sethu.address.LatLng;
import com.sethu.address.NewAddress;
import com.sethu.booking.BookingService;
import com.sethu.booking.NewBooking;
import com.sethu.catalog.CatalogSeeder;
import com.sethu.catalog.CatalogService;
import com.sethu.identity.IdentityService;
import com.sethu.identity.NewTechnician;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Creates an admin to log in as, a technician, a customer, and one DRAFT booking.
 * Without this there is nothing to drive in the admin shell.
 * Idempotent in the sense that tests truncate first; run it as often as you like.
 */
@Component
public class DevSeeder {

    private final CatalogSeeder catalogSeeder;
    private final CatalogService catalog;
    private final IdentityService identity;
    private final AddressService addresses;
    private final BookingService bookings;
    private final JdbcClient db;

    public DevSeeder(CatalogSeeder catalogSeeder, CatalogService catalog, IdentityService identity,
                     AddressService addresses, BookingService bookings, JdbcClient db) {
        this.catalogSeeder = catalogSeeder;
        this.catalog = catalog;
        this.identity = identity;
        this.addresses = addresses;
        this.bookings = bookings;
        this.db = db;
    }

    /** @return the id of the seeded DRAFT booking. */
    @Transactional
    public UUID seed() {
        catalogSeeder.seed();

        identity.createAdmin("+919500000099", "Ops Lead");

        identity.createTechnician(new NewTechnician(
            "+919700000001", "Iqbal", "Bengaluru",
            List.of("ac_repair", "refrigerator_repair"),
            true, false, 540, 1080, 10_000, 1));

        UUID customerId = identity.createCustomer("+919600000001", "Priya");

        UUID addressId = addresses.create(new NewAddress(
            customerId, "Home", "4 Church St", "Bengaluru", "560001",
            new LatLng(12.9752, 77.6068)));

        var service = catalog.findBySlug("ac-repair").orElseThrow();
        UUID variantId = db.sql("""
            SELECT id FROM service_variants
            WHERE service_id = ? AND name = 'Diagnostic Visit'
            """).param(service.id()).query(UUID.class).single();

        return bookings.create(
            new NewBooking(customerId, service.id(), variantId, addressId, null, null));
    }
}
```

- [ ] **Step 4: Implement the ops controller**

`src/main/java/com/sethu/ops/internal/OpsController.java`:
```java
package com.sethu.ops.internal;

import com.sethu.booking.*;
import com.sethu.ledger.LedgerService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/ops")
public class OpsController {

    private final BookingService bookings;
    private final LedgerService ledger;
    private final JdbcClient db;

    public OpsController(BookingService bookings, LedgerService ledger, JdbcClient db) {
        this.bookings = bookings;
        this.ledger = ledger;
        this.db = db;
    }

    @GetMapping("/bookings")
    public List<Booking> list() {
        return bookings.listAll();
    }

    @GetMapping("/bookings/{id}")
    public Booking get(@PathVariable UUID id) {
        return bookings.find(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no such booking"));
    }

    @GetMapping("/bookings/{id}/history")
    public List<BookingEvent> history(@PathVariable UUID id) {
        return bookings.history(id);
    }

    @PostMapping("/bookings/{id}/actions/{action}")
    public Map<String, String> act(@PathVariable UUID id,
                                   @PathVariable String action,
                                   @RequestBody(required = false) Map<String, Object> meta) {
        BookingAction parsed;
        try {
            parsed = BookingAction.valueOf(action.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown action: " + action);
        }

        BookingState next = bookings.apply(id, parsed, meta == null ? Map.of() : meta);
        return Map.of("state", next.name());
    }

    /** ROADMAP §6 — what each technician collected vs deposited. The gap is what ops chases. */
    @GetMapping("/cash-reconciliation")
    public List<Map<String, Object>> cashReconciliation() {
        return db.sql("""
            SELECT u.id, u.name,
                   COALESCE(SUM(le.amount_paise) FILTER (WHERE le.kind = 'CASH_CUSTODY'), 0)
                 - COALESCE(SUM(le.amount_paise) FILTER (WHERE le.kind = 'CASH_DEPOSIT'), 0)
                   AS outstanding
            FROM users u
            JOIN technicians t ON t.user_id = u.id
            LEFT JOIN ledger_entries le ON le.technician_id = u.id
            GROUP BY u.id, u.name
            ORDER BY outstanding DESC
            """)
            .query((rs, n) -> Map.<String, Object>of(
                "technicianId", rs.getObject("id", UUID.class).toString(),
                "name", rs.getString("name"),
                "outstandingPaise", rs.getLong("outstanding")))
            .list();
    }

    /**
     * An illegal transition is the CALLER asking for something impossible, not a
     * server fault. 409 CONFLICT, with the state machine's own message.
     */
    @ExceptionHandler(IllegalTransitionException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> onIllegalTransition(IllegalTransitionException e) {
        return Map.of("message", e.getMessage());
    }
}
```

- [ ] **Step 5: Verify the API is green, then un-disable the auth test from Task 6**

```bash
mvn test -Dtest=OpsControllerTest      # Expected: 7 passed
```
Now **remove the `@Disabled("Task 13")` annotation** from
`AuthControllerTest.anAdminOnlyRouteRefusesACustomerToken` and re-run:
```bash
mvn test -Dtest=AuthControllerTest     # Expected: 5 passed
```

- [ ] **Step 6: Build the deliberately-ugly admin shell**

```bash
npx create-next-app@latest admin --typescript --app --no-tailwind --no-eslint --no-src-dir --import-alias "@/*"
```

`admin/app/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

const API = 'http://localhost:8080';
const ACTIONS = [
  'CONFIRM', 'SEARCH', 'ASSIGN', 'DEPART', 'ARRIVE', 'VERIFY_START',
  'REQUEST_COMPLETION', 'VERIFY_COMPLETION', 'RESUME', 'ESCALATE',
  'RESCHEDULE', 'CANCEL', 'FAIL',
];

export default function Page() {
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('+919500000099');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');

  const [bookings, setBookings] = useState<any[]>([]);
  const [cash, setCash] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');

  const authed = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  async function requestOtp() {
    const res = await fetch(`${API}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json();
    setChallengeId(body.challengeId);
    setCode(body.devCode);          // dev only — the API returns null for this in prod
  }

  async function verifyOtp() {
    const res = await fetch(`${API}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, code }),
    });
    if (!res.ok) { setError('login failed'); return; }
    setToken((await res.json()).accessToken);
  }

  async function refresh() {
    if (!token) return;
    setBookings(await (await fetch(`${API}/ops/bookings`, authed())).json());
    setCash(await (await fetch(`${API}/ops/cash-reconciliation`, authed())).json());
    if (selected) {
      setHistory(await (await fetch(`${API}/ops/bookings/${selected}/history`, authed())).json());
    }
  }

  useEffect(() => { void refresh(); }, [selected, token]);

  async function act(id: string, action: string) {
    setError('');
    const res = await fetch(`${API}/ops/bookings/${id}/actions/${action}`, authed({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    if (!res.ok) setError((await res.json()).message ?? `HTTP ${res.status}`);
    await refresh();
  }

  if (!token) {
    return (
      <main style={{ fontFamily: 'monospace', padding: 24 }}>
        <h1>SETHU Ops — login</h1>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} size={20} />
        <button onClick={requestOtp}>send OTP</button>
        {challengeId && (
          <p>
            code: <input value={code} onChange={(e) => setCode(e.target.value)} size={8} />
            <button onClick={verifyOtp}>verify</button>
          </p>
        )}
        {error && <p style={{ color: 'red' }}>⚠ {error}</p>}
      </main>
    );
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: 24 }}>
      <h1>SETHU Ops — P0 Booking Driver</h1>
      {error && <p style={{ color: 'red' }}>⚠ {error}</p>}

      <table border={1} cellPadding={6}>
        <thead>
          <tr><th>Booking</th><th>State</th><th>Total</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td><button onClick={() => setSelected(b.id)}>{b.id.slice(0, 8)}</button></td>
              <td><b>{b.state}</b></td>
              <td>₹{(b.quotedTotalPaise / 100).toFixed(2)}</td>
              <td>
                {ACTIONS.map((a) => (
                  <button key={a} onClick={() => act(b.id, a)} style={{ margin: 2 }}>{a}</button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <>
          <h2>History — {selected.slice(0, 8)}</h2>
          <ol>
            {history.map((h) => (
              <li key={h.id}>{h.fromState} —{h.action}→ {h.toState}</li>
            ))}
          </ol>
        </>
      )}

      <h2>Cash reconciliation — ROADMAP §6</h2>
      <table border={1} cellPadding={6}>
        <thead><tr><th>Technician</th><th>Outstanding</th></tr></thead>
        <tbody>
          {cash.map((c) => (
            <tr key={c.technicianId}>
              <td>{c.name}</td>
              <td style={{ color: c.outstandingPaise > 0 ? 'red' : 'green' }}>
                ₹{(c.outstandingPaise / 100).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

Add CORS for the shell — in `SecurityConfig`, add a `CorsConfigurationSource` bean:
```java
@Bean
org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource() {
    var config = new org.springframework.web.cors.CorsConfiguration();
    config.setAllowedOrigins(java.util.List.of("http://localhost:3000"));
    config.setAllowedMethods(java.util.List.of("GET", "POST", "OPTIONS"));
    config.setAllowedHeaders(java.util.List.of("*"));
    var source = new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

- [ ] **Step 7: Drive it by hand — THIS IS THE P0 EXIT CRITERION**

Expose the seeder for local use only. Add to `OpsController`:
```java
@PostMapping("/dev/seed")
public Map<String, String> devSeed(@org.springframework.beans.factory.annotation.Autowired DevSeeder seeder) {
    return Map.of("bookingId", seeder.seed().toString());
}
```
(Constructor-inject `DevSeeder` instead if you prefer — the point is it must be reachable.)

```bash
docker compose up -d
mvn spring-boot:run &
# in another shell:
cd admin && npm run dev          # http://localhost:3000
```

Log in as `+919500000099` (the dev OTP lands straight in the code box), hit the seed endpoint
once, and confirm **by clicking**:

1. A booking walks `DRAFT → CONFIRMED → SEARCHING → ASSIGNED → EN_ROUTE → ARRIVED → IN_PROGRESS → AWAITING_COMPLETION → COMPLETED`.
2. Clicking **any** action that is not legal from the current state shows a **red error** and the state **does not change**.
3. The escalation path works: `SEARCHING → ESCALATE → ESCALATED → ASSIGN → ASSIGNED`.
4. `SEARCHING → FAIL → FAILED` is terminal — every further action errors.
5. The history list shows exactly one line per **successful** transition, and **nothing** for rejected ones.
6. The API log shows `[would send] booking_needs_a_human -> ops` when you escalate. **The event bus is alive.**

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ops): booking driver API, dev seed, and bare admin shell"
```

---

## Task 15: The Written Decisions and the Exit-Criteria Proof

> These are the two artifacts ROADMAP §11 kept from the external review, because they are
> **decisions, not documentation.** They take an hour, not a week.

**Files:**
- Create: `docs/PERMISSION-MATRIX.md`, `docs/AGGREGATE-OWNERSHIP.md`
- Test: `src/test/java/com/sethu/booking/ExitCriteriaTest.java`

- [ ] **Step 1: Write the permission matrix**

`docs/PERMISSION-MATRIX.md`:
```markdown
# Permission Matrix

| Capability | Customer | Technician | Admin |
|---|---|---|---|
| Create booking | own only | — | any customer |
| View booking | own only | assigned only | all |
| Cancel booking | own, before ARRIVED | — | any, any state |
| Reschedule booking | own, before EN_ROUTE | — | any |
| Apply arbitrary state action | — | — | **yes (P0 admin shell)** |
| Mark en route / arrived | — | assigned only | any |
| Verify start OTP | — | assigned only | any (override) |
| Verify completion OTP | — | assigned only | any (override) |
| Record payment | — | assigned only | any |
| Deposit cash | — | own custody | any |
| View cash reconciliation | — | own balance only | **all technicians** |
| Create / edit services | — | — | yes |
| Register warranty | own appliance | — | any |
| View technician capacity | — | own only | all |

**P0 note:** only the ADMIN role is enforced today, because P0 has no customer or technician
client. `SecurityConfig` locks `/ops/**` to `ADMIN` and leaves `/auth/**` public. The
customer and technician endpoints — and the per-row ownership checks above — arrive in P1.
```

- [ ] **Step 2: Write the aggregate ownership map**

`docs/AGGREGATE-OWNERSHIP.md`:
```markdown
# Aggregate Ownership

**The rule:** exactly one module may WRITE an aggregate. Everyone else reads it through that
module's public API, or reacts to its events.

`ModularityTests.modulesRespectTheirBoundaries()` fails the build if this is violated. It is
a test, not a convention.

| Aggregate | Owner | Readable by |
|---|---|---|
| User, Customer, Technician | `identity` | all (public API) |
| OtpChallenge | `identity` | **nobody** (lives in `internal`) |
| Category, Service, Variant, QuestionDef | `catalog` | all |
| ProductModel, ProductUnit, Warranty | `products` | `pricing`, `booking` |
| Address | `address` | `booking`, `assignment` (P2) |
| **Booking, BookingEvent** | **`booking`** | `ops`, `ledger`, `assignment` (P2) |
| Quote, Discount | `pricing` | `booking` |
| LedgerEntry | `ledger` | `ops` |
| Offer, TechnicianLocation | `assignment` (P2) | `ops` |
| — (none) | `notifications` | *purely reactive; nothing calls it* |
| — (none) | `ops` | *reads all, commands via public APIs* |

## Booking is the spine, NOT a god aggregate

Assignment, Payment, OTP, Notification, Review and Invoice **listen** to Booking's events.
They do not live inside it.

If they did, `BookingService` would grow to three thousand lines touching every table — and
**the Assignment port could not exist.** You cannot swap manual dispatch for auto dispatch if
dispatch lives inside Booking. The god-aggregate is precisely the thing that kills phased
delivery.
```

- [ ] **Step 3: Write the exit-criteria proof — the one test that says "P0 is done"**

`src/test/java/com/sethu/booking/ExitCriteriaTest.java`:
```java
package com.sethu.booking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ROADMAP P0 EXIT CRITERION:
 *
 *   "From the admin shell, a booking can be driven through EVERY state and EVERY
 *    failure path, and the state machine REJECTS every illegal transition."
 *
 * This file is the machine-checkable half of that proof. If it is green, and a human
 * has clicked through the shell (Task 14, Step 7), P0's spine is done.
 */
@DisplayName("P0 EXIT CRITERIA")
class ExitCriteriaTest {

    @Test
    void everyStateIsReachableFromDraft() {
        Set<BookingState> reachable = EnumSet.of(BookingState.DRAFT);
        Deque<BookingState> queue = new ArrayDeque<>(reachable);

        while (!queue.isEmpty()) {
            BookingState state = queue.poll();
            for (BookingAction action : BookingAction.values()) {
                if (!BookingStateMachine.canTransition(state, action)) continue;
                BookingState next = BookingStateMachine.transition(state, action);
                if (reachable.add(next)) queue.add(next);
            }
        }

        List<BookingState> unreachable = new ArrayList<>();
        for (BookingState s : BookingState.values()) {
            if (!reachable.contains(s)) unreachable.add(s);
        }

        // A state you cannot reach is dead code pretending to be a feature.
        assertThat(unreachable).isEmpty();
        assertThat(reachable).hasSize(13);
    }

    @Test
    void everyNonTerminalStateHasAWayOut() {
        // No purgatory. A booking stuck with no legal action is a customer on hold forever.
        for (BookingState state : BookingState.values()) {
            if (BookingStateMachine.isTerminal(state)) continue;

            long exits = java.util.Arrays.stream(BookingAction.values())
                .filter(a -> BookingStateMachine.canTransition(state, a))
                .count();

            assertThat(exits).as("%s has no way out", state).isPositive();
        }
    }

    @Test
    void everyNonTerminalStateCanReachATerminalState() {
        // No booking is immortal. ROADMAP §5.2, tier 5.
        for (BookingState start : BookingState.values()) {
            if (BookingStateMachine.isTerminal(start)) continue;

            Set<BookingState> seen = EnumSet.of(start);
            Deque<BookingState> queue = new ArrayDeque<>(seen);
            boolean foundTerminal = false;

            while (!queue.isEmpty() && !foundTerminal) {
                BookingState state = queue.poll();
                for (BookingAction action : BookingAction.values()) {
                    if (!BookingStateMachine.canTransition(state, action)) continue;
                    BookingState next = BookingStateMachine.transition(state, action);
                    if (BookingStateMachine.isTerminal(next)) { foundTerminal = true; break; }
                    if (seen.add(next)) queue.add(next);
                }
            }

            assertThat(foundTerminal).as("%s can never terminate", start).isTrue();
        }
    }

    @Test
    void rejectsEveryIllegalPairAndAcceptsEveryLegalOne() {
        int allowed = 0;
        int rejected = 0;

        for (BookingState state : BookingState.values()) {
            for (BookingAction action : BookingAction.values()) {
                if (BookingStateMachine.canTransition(state, action)) {
                    allowed++;
                    BookingStateMachine.transition(state, action);   // must not throw
                } else {
                    rejected++;
                    assertThatThrownBy(() -> BookingStateMachine.transition(state, action))
                        .isInstanceOf(IllegalTransitionException.class);
                }
            }
        }

        assertThat(allowed + rejected).isEqualTo(13 * 13);
        assertThat(allowed).as("legal transitions in ROADMAP §7").isEqualTo(30);
        assertThat(rejected).isEqualTo(139);
    }
}
```

- [ ] **Step 4: Run everything**

```bash
mvn verify
```
Expected: **all tests green** — including `ModularityTests` (the walls), `ArchitectureTests`
(state-machine purity), and `ExitCriteriaTest`.

If `allowed` is not **30**, the state machine has drifted from ROADMAP §7. **Reconcile them
before declaring P0 done.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: permission matrix, aggregate ownership, and the P0 exit-criteria proof"
```

---

## Schedule — 15 working days, 1–2 developers

| Task | Est. | Depends on | Parallel with |
|---|---|---|---|
| 1 · Project, Docker, module walls | 0.5 d | — | *(must land first)* |
| 2 · Flyway, PostGIS, Testcontainers, Money | 1 d | 1 | 3, 4 |
| 3 · Event catalog | 0.5 d | 1 | 2, 4 |
| **4 · Booking state machine** | **1 d** | 1 | 2, 3 · **zero deps — start day one** |
| 5 · Identity + capacity model | 1 d | 2 | 7, 8, 9 |
| 6 · OTP + JWT + role guards | 1.5 d | 5 | 7, 8, 9 |
| 7 · Catalog (HSOS) + seed | 1 d | 2 | 5, 8, 9 |
| 8 · Addresses + PostGIS | 1 d | 2 | 5, 7, 9 |
| 9 · Products & warranty | 0.5 d | 2 | 5, 7, 8 |
| 10 · Pricing + discount seam | 1 d | 7, 9 | 11 |
| 11 · Ledger + cash custody | 1 d | 3 | 10 |
| 12 · Booking service (SM ↔ DB) | 1.5 d | 3, 4, 10 | — |
| 13 · Notifications listener | 0.5 d | 3 | 12 |
| 14 · Ops API + seed + admin shell | 1.5 d | 6, 11, 12 | — |
| 15 · Docs + exit-criteria proof | 0.5 d | 12 | — |
| **Total** | **~14 d** | | **+1 d buffer = 15 d ≈ 3 weeks** |

### Two developers

- **Dev A (the spine):** 1 → 4 → 3 → 11 → 12 → 15. The critical path and the hardest reasoning. **Task 4 has zero dependencies — write it on day one, in parallel with everything.**
- **Dev B (the edges):** 2 → 5 → 7 → 8 → 9 → 6 → 10. Independent, CRUD-shaped modules with clear contracts.
- **Converge** at Task 12 (Dev A needs Dev B's Pricing). Then Dev B takes 14 while Dev A takes 13 and 15.

The public-API-vs-`internal` split exists precisely so the two of you can work without reading
each other's code. **If you find yourself needing to know how another module works inside, its
public API is wrong — fix the API, don't reach through the wall.** The build will stop you anyway.

### One developer

Go in numerical order. There is no hidden ordering trap. Expect ~14 focused days.

---

## Definition of Done for P0

- [ ] `mvn verify` is green.
- [ ] **`ModularityTests` passes** — no module reaches into another's `internal`, no cycles.
- [ ] **The wall has been proven to fire** (Task 1, Step 7). A wall you have never seen reject anything is just a comment.
- [ ] **`ArchitectureTests` passes and has been proven to fire** (Task 4, Step 6) — the state machine imports nothing.
- [ ] **`ExitCriteriaTest` passes:** all 13 states reachable, no purgatory, no immortal bookings, exactly **30 legal / 139 illegal** transitions.
- [ ] A human has driven a booking through the full happy path *in the admin shell*, and watched an illegal action be refused with a red error and **no state change**.
- [ ] Cash custody reconciles: a cash payment raises the technician's outstanding balance; a deposit clears it; the admin screen shows the gap in red.
- [ ] An escalation **observably reaches the Notifications listener** (`[would send] booking_needs_a_human -> ops` in the log). The event bus is wired, not merely written.
- [ ] `docs/PERMISSION-MATRIX.md` and `docs/AGGREGATE-OWNERSHIP.md` exist.

**Not in P0, by design:** mobile apps · dispatch/offer engine · real payment gateway · notification *delivery* · live GPS · **dual-OTP verification and work photos (P1)** · any styling whatsoever.

---

## When Things Go Wrong

| Symptom | Cause | Fix |
|---|---|---|
| Every admin request 403s | `hasRole("ADMIN")` looks for the authority `ROLE_ADMIN` | `setAuthorityPrefix("ROLE_")` on the `JwtGrantedAuthoritiesConverter`, with a bare `"ADMIN"` in the claim. Task 6, Step 6. **The single biggest Spring Security time-sink.** |
| App won't start: "Validate failed: migration checksum mismatch" | You **edited an applied Flyway migration** | Never edit `V<n>__*.sql` once applied. New change ⇒ new file. To recover locally: `docker compose down -v && docker compose up -d`. |
| `@ApplicationModuleListener` never fires in a test | Test is `@Transactional` and rolls back — the listener waits for COMMIT | Do not put `@Transactional` on tests that assert on listeners. `AbstractDbTest` truncates instead, deliberately. |
| Technicians dispatched to the wrong hemisphere | `ST_MakePoint(lat, lng)` — arguments swapped | It is `ST_MakePoint(X, Y)` = **(longitude, latitude)**. Task 8. |
| `ModularityTests` fails after a refactor | A module reached into another's `internal` | **This is the wall doing its job.** Move the needed type into the owning module's public package *deliberately*, or add a method to its public service. Do not delete the test. |
| Illegal-transition count is not 139 | `legalTransitions()` and `TRANSITIONS` disagree | **This is the bug Task 4 exists to catch.** Reconcile against ROADMAP §7 before anything else. |
| Tests race / flake | Someone enabled JUnit parallelism | Turn it off. Tests share one Testcontainers database. |
| `Service` name collision in catalog | Spring's `@Service` vs. a domain class called `Service` | The domain record is `ServiceDef`. Task 7. |

---

## Self-Review Notes

### Spec coverage against ROADMAP §12 (P0 "Ships" list)

| ROADMAP P0 requirement | Task |
|---|---|
| Modular monolith with enforced walls | 1 |
| Postgres + PostGIS + Redis | 1, 2 |
| OTP auth, 3 roles | 6 |
| HSOS catalog incl. `assignment_mode`, 4–5 services | 7 |
| Technician model with full capacity fields | 5 |
| Addresses + geocoding | 8 |
| Booking state machine, all transitions, illegal rejection | 4, 12, 15 |
| `booking_events` append-only | 12 |
| Append-only ledger skeleton | 11 |
| Event catalog (§8) | 3 |
| Permission matrix | 15 |
| Aggregate ownership map | 15 |
| Bare admin shell | 14 |
| *(added)* Event bus proven live end-to-end | 13 |

### Deliberate deviations from ROADMAP — recorded so nobody "fixes" them later

**1. One ledger table, not four.** §9 lists `payments`, `cash_custody`, and `credits`
separately. We use **one append-only `ledger_entries` table discriminated by `kind`**. Four
tables each need their own reconciliation query and can drift apart from one another; one
append-only log cannot. Reconciliation becomes a single `FILTER`ed aggregate.

**2. Redis is provisioned but unused in P0.** Docker starts it so the infrastructure is
already right when P2 needs offer timers and the first-accept-wins lock. Nothing in P0 talks
to it. **This is not an oversight — do not invent a use for it.**

**3. Dual-OTP verification and work photos are NOT in P0.** ROADMAP §4.2 lists a Verification
module owning `OtpChallenge` and `WorkPhoto`. In P0, `VERIFY_START` and `VERIFY_COMPLETION`
are **plain state transitions with no OTP behind them** — the admin shell simply clicks them.
The real challenge, the photo upload, and the retry rules are **P1**, in their own
Verification module. The state machine already has the right shape; only the guard behind the
transition is missing.

**4. `bookings.state` is `TEXT`, not a Postgres enum.** The Java enum is the source of truth
and the state machine enforces legality. A PG enum would need a locking migration every time
we add a state, and a `CHECK` constraint would duplicate the rules in a second place where
they could silently disagree.

**5. Pricing persists nothing.** A quote is computed on demand and denormalised onto the
booking as `quoted_total_paise`. `Quote` and `Discount` become real tables in **P4**, when a
membership needs an audit trail of *why* a price was what it was.
