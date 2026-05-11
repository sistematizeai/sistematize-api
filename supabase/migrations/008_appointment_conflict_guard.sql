-- 008_appointment_conflict_guard.sql
-- Atomic conflict check + insert for appointments and services

CREATE OR REPLACE FUNCTION create_appointment_no_conflict(
  p_business_id uuid,
  p_client_id uuid,
  p_collaborator_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_total_price decimal,
  p_total_duration int,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'dashboard',
  p_services jsonb DEFAULT '[]'
) RETURNS uuid AS $$
DECLARE
  v_conflict_count int;
  v_appointment_id uuid;
  v_svc jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(p_collaborator_id::text || p_date::text)
  );

  SELECT count(*) INTO v_conflict_count
  FROM appointments
  WHERE collaborator_id = p_collaborator_id
    AND date = p_date
    AND status NOT IN ('cancelled', 'no_show')
    AND start_time < p_end_time
    AND end_time > p_start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'APPOINTMENT_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO appointments (
    business_id, client_id, collaborator_id,
    date, start_time, end_time,
    total_price, total_duration,
    status, notes, source
  ) VALUES (
    p_business_id, p_client_id, p_collaborator_id,
    p_date, p_start_time, p_end_time,
    p_total_price, p_total_duration,
    'scheduled', p_notes, p_source
  )
  RETURNING id INTO v_appointment_id;

  FOR v_svc IN SELECT * FROM jsonb_array_elements(p_services)
  LOOP
    INSERT INTO appointment_services (
      business_id, appointment_id, service_id, price, duration_minutes
    ) VALUES (
      p_business_id,
      v_appointment_id,
      (v_svc->>'service_id')::uuid,
      (v_svc->>'price')::decimal,
      (v_svc->>'duration_minutes')::int
    );
  END LOOP;

  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql;
