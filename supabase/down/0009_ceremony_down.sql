-- Drops the ceremony configuration row.
--
-- Rolling this back removes the only place the ceremony date, time and stream
-- credentials exist. Whatever reads them goes back to each surface holding its
-- own copy, which is the state this migration exists to end — a down script
-- restores the previous state, it does not improve it.
--
-- The seeded values are placeholders, so nothing the couple typed is lost by
-- this. Once task 7.1 replaces them with real details, capture the row before
-- running this.

drop table if exists ceremony;
