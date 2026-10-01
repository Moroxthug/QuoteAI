import { pgTable, text, uuid, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";

// Pocket 126: the latest position of a crew member who is on the clock and has chosen to share it (LiveLocation). One row per worker; deleted at clock-out.
export const crewLocationsTable = pgTable(
  "crew_locations",
  {
    workerId: uuid("worker_id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("crew_locations_user_idx").on(t.userId)],
);
