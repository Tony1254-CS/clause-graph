
ALTER TABLE public.simulation_runs DROP CONSTRAINT IF EXISTS simulation_runs_run_type_check;
ALTER TABLE public.simulation_runs ADD CONSTRAINT simulation_runs_run_type_check
  CHECK (run_type = ANY (ARRAY['reactive'::text, 'forecast'::text, 'what_if'::text, 'supply_chain'::text]));
