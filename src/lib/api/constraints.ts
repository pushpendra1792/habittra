/**
 * Database object names the app needs to recognise in an error message.
 *
 * Postgres reports a unique violation as: `duplicate key value violates unique
 * constraint "checkins_habit_id_date_key"`. The name is the only way to tell one
 * duplicate from another, so it is written down once here rather than spelled
 * out as a literal in the code that needs it. Keep in step with
 * supabase/migrations/0001_init.sql.
 */

/** Unique constraint that makes a habit's check-in unique per day. */
export const CHECKINS_HABIT_DATE_CONSTRAINT = 'checkins_habit_id_date_key'
