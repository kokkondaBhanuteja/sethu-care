-- Platform helpers shared by every module.

-- +goose Up

-- APPEND-ONLY ENFORCEMENT, IN THE DATABASE.
--
-- ROADMAP §6: "ledger_entries is append-only. Never mutate a row; correct with an
-- offsetting entry." That sentence is worthless if it lives only in a comment. An ops
-- engineer with psql, a migration script, or a well-meant `UPDATE ... SET amount = ...`
-- can undo it in one line, and the row that proves what happened is gone forever.
--
-- So the guarantee is enforced where it cannot be argued with. Any UPDATE or DELETE on a
-- table carrying this trigger RAISES — it does not silently no-op, because a silent no-op
-- would let a caller believe the write succeeded.
--
-- goose needs StatementBegin/End around a function body: the body contains semicolons,
-- and without these markers goose would split it into fragments and fail.

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'table % is APPEND-ONLY: % is forbidden. Correct a mistake with a new, offsetting row.',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION IF EXISTS forbid_mutation();
