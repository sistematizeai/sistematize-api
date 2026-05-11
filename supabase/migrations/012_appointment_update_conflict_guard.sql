-- Atomic conflict check + update for appointment reschedule
CREATE OR REPLACE FUNCTION update_appointment_no_conflict(
  p_appointment_id uuid,
  p_business_id uuid,
  p_collaborator_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_notes text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_cancel_reason text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_conflict_count int;
  v_current_status text;
BEGIN
  SELECT status INTO v_current_status
  FROM appointments
  WHERE id = p_appointment_id AND business_id = p_business_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_status IN ('completed', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'APPOINTMENT_TERMINAL_STATUS' USING ERRCODE = 'P0003';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(p_collaborator_id::text || p_date::text)
  );

  SELECT count(*) INTO v_conflict_count
  FROM appointments
  WHERE collaborator_id = p_collaborator_id
    AND date = p_date
    AND id != p_appointment_id
    AND status NOT IN ('cancelled', 'no_show')
    AND start_time < p_end_time
    AND end_time > p_start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE appointments SET
    collaborator_id = p_collaborator_id,
    date = p_date,
    start_time = p_start_time,
    end_time = p_end_time,
    notes = COALESCE(p_notes, notes),
    payment_method = COALESCE(p_payment_method, payment_method),
    cancel_reason = COALESCE(p_cancel_reason, cancel_reason),
    updated_at = now()
  WHERE id = p_appointment_id AND business_id = p_business_id;

  RETURN p_appointment_id;
END;
$$ LANGUAGE plpgsql;
