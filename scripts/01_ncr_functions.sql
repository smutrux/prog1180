-- =====================================================================
-- NCR app: seed rows, server-side functions and the list view.
-- Run the whole file once in the Supabase SQL editor. Safe to re-run.
-- Re-run this file after app updates to install workflow persistence changes.
--
-- Every function runs as the caller (SECURITY INVOKER), so your row-level
-- security policies still apply. Each public function is one transaction:
-- if any step fails, nothing is saved.
--
-- Errors raised on purpose use SQLSTATE P0001, with the form field name in
-- DETAIL and the offending value in HINT. The app reads both.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Seed rows the app looks up by name (tiny; skipped if they exist)
-- ---------------------------------------------------------------------
insert into public.role (role_name, role_desc) values
  ('Pending', 'New user. View only.'),
  ('Quality Representative', 'Raises and signs off NCRs.')
on conflict (role_name) do nothing;

insert into public.ncr_status (ncr_status_label) values
  ('Draft'), ('Open'), ('On Hold'), ('Closed')
on conflict (ncr_status_label) do nothing;

insert into public.ncr_process_applicable (ncr_process_applicable_label) values
  ('Supplier or Rec-Insp'), ('WIP (Production Order)')
on conflict (ncr_process_applicable_label) do nothing;

insert into public.ncr_disposition (ncr_disposition_label) values
  ('Pending'), ('Use As Is'), ('Repair'), ('Rework'), ('Scrap')
on conflict (ncr_disposition_label) do nothing;

-- Workflow sections use one-to-one rows so they can be saved independently.
create table if not exists public.ncr_operations (
  ncr_id integer primary key references public.ncr(ncr_id) on delete cascade,
  operations_disposition text not null default '',
  operations_instructions text not null default '',
  operations_comments text not null default '',
  operations_representative text not null default '',
  operations_date_completed date,
  updated_by_person_id integer not null references public.person(person_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ncr_procurement (
  ncr_id integer primary key references public.ncr(ncr_id) on delete cascade,
  procurement_delay_communication text not null default '',
  updated_by_person_id integer not null references public.person(person_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ncr_quality_final_review (
  ncr_id integer primary key references public.ncr(ncr_id) on delete cascade,
  quality_final_inspection_result text not null default '',
  quality_final_comments text not null default '',
  quality_final_acceptance_confirmed boolean,
  quality_date_closed date,
  quality_closed_by text not null default '',
  updated_by_person_id integer not null references public.person(person_id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 1. Private helpers (not exposed through the API)
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Raises a user-facing error. field = form field, val = the value it is about.
create or replace function private.ncr_fail(msg text, field text default null, val text default null)
returns void
language plpgsql
as $$
begin
  raise exception '%', msg
    using errcode = 'P0001', detail = coalesce(field, ''), hint = coalesce(val, '');
end $$;

create or replace function private.ncr_status_is_closed(p_status_id integer)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from ncr_status
    where ncr_status_id = p_status_id and ncr_status_label ~* 'clos'
  );
$$;

-- Finds or creates supplier, purchase order, sales order, item and the two
-- line items. Returns the sales order line id that the NCR points at.
create or replace function private.ncr_resolve_chain(p jsonb)
returns integer
language plpgsql
set search_path = public, private
as $$
declare
  v_supplier_name text    := coalesce(nullif(btrim(p->>'supplier'), ''), 'In-house production');
  v_po_number     text    := btrim(p->>'purchase_order_number');
  v_so_number     text    := btrim(p->>'sales_order_number');
  v_item_name     text    := btrim(p#>>'{item,name}');
  v_item_desc     text    := coalesce(btrim(p#>>'{item,description}'), '');
  v_sap           text    := btrim(p#>>'{item,sap_number}');
  v_qty           integer := (p->>'quantity_ordered')::integer;
  v_supplier_id   integer;
  v_po_id         integer;
  v_po_supplier   integer;
  v_po_owner      text;
  v_so_id         integer;
  v_so_sap        text;
  v_item_id       integer;
  v_so_line       integer;
begin
  -- Supplier
  select supplier_id into v_supplier_id
  from supplier
  where lower(btrim(supplier_name)) = lower(v_supplier_name)
  order by supplier_id limit 1;
  if v_supplier_id is null then
    insert into supplier (supplier_name) values (v_supplier_name)
    returning supplier_id into v_supplier_id;
  end if;

  -- Purchase order (a number belongs to one supplier)
  select purchase_order_id, supplier_id into v_po_id, v_po_supplier
  from purchase_order where purchase_order_number = v_po_number;
  if v_po_id is null then
    insert into purchase_order (purchase_order_number, purchase_order_date, supplier_id)
    values (v_po_number, now(), v_supplier_id)
    returning purchase_order_id into v_po_id;
  else
    select supplier_name into v_po_owner from supplier where supplier_id = v_po_supplier;
    if lower(btrim(v_po_owner)) <> lower(v_supplier_name) then
      perform private.ncr_fail(
        format('Purchase order %s already belongs to "%s". Choose that supplier, or use a different number.',
               v_po_number, v_po_owner),
        'poNumber', v_po_number);
    end if;
  end if;

  -- Sales order (a number keeps one SAP number)
  select sales_order_id, item_sap_number into v_so_id, v_so_sap
  from sales_order where sales_order_number = v_so_number;
  if v_so_id is null then
    insert into sales_order (sales_order_number, item_sap_number, sales_order_date)
    values (v_so_number, v_sap, now())
    returning sales_order_id into v_so_id;
  elsif v_so_sap is distinct from v_sap then
    if v_so_sap is null then
      update sales_order set item_sap_number = v_sap where sales_order_id = v_so_id;
    else
      perform private.ncr_fail(
        format('Sales order %s already exists with SAP number "%s". Use that SAP number, or a different sales order number.',
               v_so_number, v_so_sap),
        'salesOrderNumber', v_so_number);
    end if;
  end if;

  -- Item
  select item_id into v_item_id
  from item
  where lower(btrim(item_name)) = lower(v_item_name)
    and lower(coalesce(btrim(item_desc), '')) = lower(v_item_desc)
  order by item_id limit 1;
  if v_item_id is null then
    insert into item (item_name, item_desc) values (v_item_name, nullif(v_item_desc, ''))
    returning item_id into v_item_id;
  end if;

  -- Sales order line. The quantity ordered is the quantity the form reports.
  select so_line_item_id into v_so_line
  from so_line_item
  where sales_order_id = v_so_id and item_id = v_item_id
  order by so_line_item_id limit 1;
  if v_so_line is null then
    insert into so_line_item (so_line_item_quantity_ordered, item_id, sales_order_id)
    values (v_qty, v_item_id, v_so_id)
    returning so_line_item_id into v_so_line;
  else
    update so_line_item set so_line_item_quantity_ordered = v_qty
    where so_line_item_id = v_so_line and so_line_item_quantity_ordered <> v_qty;
  end if;

  -- Purchase order line
  if not exists (
    select 1 from po_line_item
    where purchase_order_id = v_po_id and item_id = v_item_id and so_line_item_id = v_so_line
  ) then
    insert into po_line_item (po_line_item_quantity_ordered, purchase_order_id, item_id, so_line_item_id)
    values (v_qty, v_po_id, v_item_id, v_so_line);
  end if;

  return v_so_line;
end $$;

-- Returns the inspector's person id, creating the person when the form asks.
create or replace function private.ncr_resolve_inspector(p jsonb)
returns integer
language plpgsql
set search_path = public, private
as $$
declare
  v_role   integer;
  v_person integer;
begin
  if p#>>'{inspector,kind}' = 'existing' then
    v_person := (p#>>'{inspector,person_id}')::integer;
    if not exists (select 1 from person where person_id = v_person) then
      perform private.ncr_fail(
        'The chosen inspector is no longer in the database. Go back and choose the inspector again.',
        'inspector');
    end if;
    return v_person;
  end if;

  select role_id into v_role from role
  where lower(btrim(role_name)) = 'quality representative' limit 1;
  if v_role is null then
    perform private.ncr_fail('The role "Quality Representative" is missing from the database.');
  end if;

  -- person_email is NOT NULL and UNIQUE, and the form does not ask for one,
  -- so new inspectors get a unique placeholder address.
  insert into person (person_first_name, person_middle_name, person_last_name, person_email, role_id)
  values (
    btrim(p#>>'{inspector,first}'),
    nullif(btrim(p#>>'{inspector,middle}'), ''),
    btrim(p#>>'{inspector,last}'),
    'no-email-' || gen_random_uuid() || '@placeholder.invalid',
    v_role
  )
  returning person_id into v_person;
  return v_person;
end $$;

-- Makes the NCR's problem types, links and files match the payload.
create or replace function private.ncr_sync_children(p jsonb, p_ncr_id integer, p_person_id integer)
returns void
language plpgsql
set search_path = public, private
as $$
declare
  v_types integer[] := array(
    select distinct x::integer
    from jsonb_array_elements_text(coalesce(p->'problem_type_ids', '[]'::jsonb)) as t(x));
  v_links text[] := array(
    select distinct x
    from jsonb_array_elements_text(coalesce(p->'links', '[]'::jsonb)) as t(x));
  f jsonb;
begin
  if coalesce(array_length(v_types, 1), 0) = 0 then
    perform private.ncr_fail('Tick at least one problem type.', 'problemTypeIds');
  end if;

  delete from ncr_problem_type
  where ncr_id = p_ncr_id and problem_type_id <> all (v_types);
  insert into ncr_problem_type (ncr_id, problem_type_id)
  select p_ncr_id, x from unnest(v_types) as x
  where not exists (
    select 1 from ncr_problem_type t where t.ncr_id = p_ncr_id and t.problem_type_id = x);

  if exists (select 1 from unnest(v_links) as l where l !~* '^https?://') then
    perform private.ncr_fail(
      'Enter a full web address that starts with http:// or https://.', 'links');
  end if;
  delete from attachment
  where ncr_id = p_ncr_id and attachment_type = 'Link'
    and attachment_file_path <> all (v_links);
  insert into attachment
    (attachment_type, attachment_file_name, attachment_file_path, ncr_id, attachment_uploaded_by_person_id)
  select 'Link',
         left(coalesce(substring(l from '^https?://([^/?#:]+)'), l), 300),
         l, p_ncr_id, p_person_id
  from unnest(v_links) as l
  where not exists (
    select 1 from attachment a
    where a.ncr_id = p_ncr_id and a.attachment_type = 'Link' and a.attachment_file_path = l);

  -- Files: only the name and path are recorded for now (no upload yet).
  for f in select * from jsonb_array_elements(coalesce(p->'files', '[]'::jsonb)) loop
    insert into attachment
      (attachment_type, attachment_file_name, attachment_file_path, ncr_id, attachment_uploaded_by_person_id)
    values (f->>'type', left(f->>'name', 300), left(f->>'path', 500), p_ncr_id, p_person_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Public functions (called with supabase.rpc)
-- ---------------------------------------------------------------------

-- Saves a workflow section immediately. When the NCR is still a draft, keep
-- its JSON snapshot in sync so Continue restores the latest saved section.
create or replace function public.save_ncr_section(
  p_ncr_id integer,
  p_section text,
  p_data jsonb,
  p_person_id integer,
  p_step integer default null
)
returns void
language plpgsql
set search_path = public, private
as $$
declare
  v_draft text;
begin
  select ncr_draft_data into v_draft
  from ncr
  where ncr_id = p_ncr_id
  for update;
  if not found then
    perform private.ncr_fail('This NCR no longer exists. Close the form and reload the list.');
  end if;

  if p_person_id is null or not exists (
    select 1 from person where person_id = p_person_id
  ) then
    perform private.ncr_fail('Your account is not loaded yet. Reload the page and try again.');
  end if;

  if p_section = 'operations' then
    insert into ncr_operations (
      ncr_id, operations_disposition, operations_instructions, operations_comments,
      operations_representative, operations_date_completed, updated_by_person_id
    )
    values (
      p_ncr_id,
      coalesce(p_data->>'disposition', ''),
      coalesce(p_data->>'instructions', ''),
      coalesce(p_data->>'comments', ''),
      coalesce(p_data->>'representative', ''),
      nullif(p_data->>'dateCompleted', '')::date,
      p_person_id
    )
    on conflict (ncr_id) do update set
      operations_disposition = excluded.operations_disposition,
      operations_instructions = excluded.operations_instructions,
      operations_comments = excluded.operations_comments,
      operations_representative = excluded.operations_representative,
      operations_date_completed = excluded.operations_date_completed,
      updated_by_person_id = excluded.updated_by_person_id,
      updated_at = now();
  elsif p_section = 'procurement' then
    insert into ncr_procurement (
      ncr_id, procurement_delay_communication, updated_by_person_id
    )
    values (
      p_ncr_id,
      coalesce(p_data->>'delayCommunication', ''),
      p_person_id
    )
    on conflict (ncr_id) do update set
      procurement_delay_communication = excluded.procurement_delay_communication,
      updated_by_person_id = excluded.updated_by_person_id,
      updated_at = now();
  elsif p_section = 'qualityFinalReview' then
    insert into ncr_quality_final_review (
      ncr_id, quality_final_inspection_result, quality_final_comments,
      quality_final_acceptance_confirmed, quality_date_closed, quality_closed_by,
      updated_by_person_id
    )
    values (
      p_ncr_id,
      coalesce(p_data->>'inspectionResult', ''),
      coalesce(p_data->>'comments', ''),
      case
        when jsonb_typeof(p_data->'acceptanceConfirmed') = 'boolean'
          then (p_data->>'acceptanceConfirmed')::boolean
        when lower(p_data->>'acceptanceConfirmed') = 'yes' then true
        when lower(p_data->>'acceptanceConfirmed') = 'no' then false
        else null
      end,
      nullif(p_data->>'dateClosed', '')::date,
      coalesce(p_data->>'closedBy', ''),
      p_person_id
    )
    on conflict (ncr_id) do update set
      quality_final_inspection_result = excluded.quality_final_inspection_result,
      quality_final_comments = excluded.quality_final_comments,
      quality_final_acceptance_confirmed = excluded.quality_final_acceptance_confirmed,
      quality_date_closed = excluded.quality_date_closed,
      quality_closed_by = excluded.quality_closed_by,
      updated_by_person_id = excluded.updated_by_person_id,
      updated_at = now();
  else
    perform private.ncr_fail('Unknown workflow section.');
  end if;

  if v_draft is not null and btrim(v_draft) <> '' then
    update ncr
    set ncr_draft_data = jsonb_set(
      coalesce(nullif(ncr_draft_data, '')::jsonb, '{}'::jsonb),
      array['values', p_section],
      coalesce(p_data, '{}'::jsonb),
      true
    )::text,
    ncr_draft_step = coalesce(p_step::text, ncr_draft_step)
    where ncr_id = p_ncr_id;
  end if;
end $$;

-- Persists all workflow sections as part of the main submit/edit transaction.
create or replace function private.ncr_sync_workflow(p jsonb, p_ncr_id integer, p_person_id integer)
returns void
language plpgsql
set search_path = public, private
as $$
begin
  perform public.save_ncr_section(p_ncr_id, 'operations', coalesce(p->'operations', '{}'::jsonb), p_person_id);
  perform public.save_ncr_section(p_ncr_id, 'procurement', coalesce(p->'procurement', '{}'::jsonb), p_person_id);
  perform public.save_ncr_section(p_ncr_id, 'qualityFinalReview', coalesce(p->'qualityFinalReview', '{}'::jsonb), p_person_id);
end $$;

-- The next free NCR number for this year, e.g. 2026-001.
create or replace function public.next_ncr_number()
returns text
language sql
stable
set search_path = public
as $$
  select to_char(now(), 'YYYY') || '-' ||
         lpad((coalesce(max(substring(ncr_number from '^\d{4}-(\d+)$')::integer), 0) + 1)::text, 3, '0')
  from ncr
  where ncr_number ~ ('^' || to_char(now(), 'YYYY') || '-\d+$');
$$;

-- Creates a draft NCR (reserving its number) or updates an existing draft.
-- p: { ncr_id | null, ncr_number, status_id, created_by_person_id, draft_data, draft_step }
create or replace function public.save_ncr_draft(p jsonb)
returns jsonb
language plpgsql
set search_path = public, private
as $$
declare
  v_ncr_id integer := nullif(p->>'ncr_id', '')::integer;
begin
  if v_ncr_id is not null then
    update ncr
    set ncr_draft_data = p->>'draft_data', ncr_draft_step = p->>'draft_step'
    where ncr_id = v_ncr_id and ncr_draft_data is not null and btrim(ncr_draft_data) <> '';
    if not found then
      perform private.ncr_fail('The saved draft could not be found. It may have been submitted or removed.');
    end if;
  else
    insert into ncr (ncr_number, ncr_status_id, ncr_created_by_person_id, ncr_draft_data, ncr_draft_step)
    values (btrim(p->>'ncr_number'), (p->>'status_id')::integer,
            (p->>'created_by_person_id')::integer, p->>'draft_data', p->>'draft_step')
    returning ncr_id into v_ncr_id;
  end if;
  return jsonb_build_object('ncr_id', v_ncr_id);
end $$;

-- Submits a new NCR, or turns a saved draft into the real NCR (ncr_id = draft id).
-- p: { ncr_id | null, ncr_number, created_by_person_id, process_label, status_id,
--      supplier | null, purchase_order_number, sales_order_number,
--      item {name, description, sap_number}, quantity_ordered, quantity_defective,
--      problem_type_ids [], defect_description, is_non_conforming,
--      inspector {kind:'existing', person_id} | {kind:'new', first, middle, last},
--      links [], files [{name, type, path}] }
create or replace function public.submit_ncr(p jsonb)
returns jsonb
language plpgsql
set search_path = public, private
as $$
declare
  v_ncr_id    integer := nullif(p->>'ncr_id', '')::integer;
  v_number    text    := btrim(p->>'ncr_number');
  v_by        integer := (p->>'created_by_person_id')::integer;
  v_status    integer := (p->>'status_id')::integer;
  v_ordered   integer := (p->>'quantity_ordered')::integer;
  v_defective integer := (p->>'quantity_defective')::integer;
  v_process   integer;
  v_so_line   integer;
  v_inspector integer;
  v_qa        integer;
  v_closed    timestamptz;
  v_draft     text;
begin
  if v_by is null then
    perform private.ncr_fail('Your account is not loaded yet. Reload the page and try again.');
  end if;
  if v_defective > v_ordered then
    perform private.ncr_fail(
      format('The quantity defective (%s) cannot be more than the quantity ordered (%s).', v_defective, v_ordered),
      'qtyDefective');
  end if;

  select ncr_process_applicable_id into v_process
  from ncr_process_applicable
  where lower(btrim(ncr_process_applicable_label)) = lower(btrim(p->>'process_label'));
  if v_process is null then
    perform private.ncr_fail('Choose which process this report covers.', 'processType');
  end if;

  v_closed    := case when private.ncr_status_is_closed(v_status) then now() end;
  v_inspector := private.ncr_resolve_inspector(p);
  v_so_line   := private.ncr_resolve_chain(p);

  if v_ncr_id is not null then
    select ncr_draft_data into v_draft from ncr where ncr_id = v_ncr_id for update;
    if not found then
      perform private.ncr_fail('The saved draft could not be found. It may have been removed.');
    end if;
    if v_draft is null or btrim(v_draft) = '' then
      perform private.ncr_fail('This NCR has already been submitted.');
    end if;
    update ncr
    set ncr_status_id = v_status, so_line_item_id = v_so_line, ncr_closed_at = v_closed,
        ncr_created_at = now(), ncr_draft_data = null, ncr_draft_step = null
    where ncr_id = v_ncr_id
    returning ncr_number into v_number;
  else
    insert into ncr (ncr_number, ncr_status_id, so_line_item_id, ncr_closed_at, ncr_created_by_person_id)
    values (v_number, v_status, v_so_line, v_closed, v_by)
    returning ncr_id into v_ncr_id;
  end if;

  perform private.ncr_sync_workflow(p, v_ncr_id, v_by);

  insert into qa (ncr_id, qa_defect_desc, qa_quantity_defective, qa_is_non_conforming,
                  qa_rep_date, ncr_process_applicable_id, qa_rep_person_id)
  values (v_ncr_id, btrim(p->>'defect_description'), v_defective,
          (p->>'is_non_conforming')::boolean, now(), v_process, v_inspector)
  returning qa_id into v_qa;

  perform private.ncr_sync_children(p, v_ncr_id, v_inspector);

  insert into audit (ncr_id, audit_person_id, audit_action, qa_id)
  values (v_ncr_id, v_by, 'Submitted', v_qa);

  return jsonb_build_object('ncr_id', v_ncr_id, 'ncr_number', v_number);
end $$;

-- Changes a submitted NCR. Takes the same payload as submit_ncr, with ncr_id required.
create or replace function public.update_ncr(p jsonb)
returns jsonb
language plpgsql
set search_path = public, private
as $$
declare
  v_ncr_id     integer := (p->>'ncr_id')::integer;
  v_by         integer := (p->>'created_by_person_id')::integer;
  v_status     integer := (p->>'status_id')::integer;
  v_ordered    integer := (p->>'quantity_ordered')::integer;
  v_defective  integer := (p->>'quantity_defective')::integer;
  v_process    integer;
  v_so_line    integer;
  v_inspector  integer;
  v_qa         integer;
  v_closed     timestamptz;
  v_old_closed timestamptz;
  v_draft      text;
  v_number     text;
begin
  if v_by is null then
    perform private.ncr_fail('Your account is not loaded yet. Reload the page and try again.');
  end if;
  if v_defective > v_ordered then
    perform private.ncr_fail(
      format('The quantity defective (%s) cannot be more than the quantity ordered (%s).', v_defective, v_ordered),
      'qtyDefective');
  end if;

  select ncr_draft_data, ncr_closed_at, ncr_number into v_draft, v_old_closed, v_number
  from ncr where ncr_id = v_ncr_id for update;
  if not found then
    perform private.ncr_fail('This NCR no longer exists. Close the form and reload the list.');
  end if;
  if v_draft is not null and btrim(v_draft) <> '' then
    perform private.ncr_fail('This NCR is still a draft. Continue it from the list instead.');
  end if;

  select ncr_process_applicable_id into v_process
  from ncr_process_applicable
  where lower(btrim(ncr_process_applicable_label)) = lower(btrim(p->>'process_label'));
  if v_process is null then
    perform private.ncr_fail('Choose which process this report covers.', 'processType');
  end if;

  v_closed    := case when private.ncr_status_is_closed(v_status) then coalesce(v_old_closed, now()) end;
  v_inspector := private.ncr_resolve_inspector(p);
  v_so_line   := private.ncr_resolve_chain(p);

  update ncr
  set ncr_status_id = v_status, so_line_item_id = v_so_line, ncr_closed_at = v_closed
  where ncr_id = v_ncr_id;

  update qa
  set qa_defect_desc = btrim(p->>'defect_description'),
      qa_quantity_defective = v_defective,
      qa_is_non_conforming = (p->>'is_non_conforming')::boolean,
      ncr_process_applicable_id = v_process,
      qa_rep_person_id = v_inspector
  where ncr_id = v_ncr_id
  returning qa_id into v_qa;
  if v_qa is null then
    perform private.ncr_fail('The QA section of this NCR is missing, so it cannot be edited.');
  end if;

  perform private.ncr_sync_workflow(p, v_ncr_id, v_by);

  perform private.ncr_sync_children(p, v_ncr_id, v_inspector);

  insert into audit (ncr_id, audit_person_id, audit_action, qa_id)
  values (v_ncr_id, v_by, 'Edited', v_qa);

  return jsonb_build_object('ncr_id', v_ncr_id, 'ncr_number', v_number);
end $$;

-- Moves a closed NCR back to an open status.
create or replace function public.restore_ncr(p_ncr_id integer, p_status_id integer, p_person_id integer)
returns void
language plpgsql
set search_path = public, private
as $$
begin
  update ncr set ncr_status_id = p_status_id, ncr_closed_at = null where ncr_id = p_ncr_id;
  if not found then
    perform private.ncr_fail('This NCR no longer exists. Close the form and reload the list.');
  end if;
  insert into audit (ncr_id, audit_person_id, audit_action)
  values (p_ncr_id, p_person_id, 'Restored');
end $$;

-- ---------------------------------------------------------------------
-- 3. One flat row per NCR, for the list page and the reports
--    (security_invoker: the caller's row-level security applies)
-- ---------------------------------------------------------------------
create or replace view public.ncr_list
with (security_invoker = true) as
select
  n.ncr_id,
  n.ncr_number,
  n.ncr_created_at,
  n.ncr_closed_at,
  n.ncr_draft_data,
  n.ncr_draft_step,
  n.ncr_is_reinspectable,
  n.ncr_status_id,
  s.ncr_status_label                                   as status_label,
  d.is_draft,
  (not d.is_draft
     and s.ncr_status_label ~* 'clos|complet|resolv|approv|archive') as is_archived,
  sup.supplier_name,
  it.item_name,
  so.sales_order_number,
  po.purchase_order_number,
  sol.so_line_item_quantity_ordered                    as quantity_ordered,
  qa.qa_quantity_defective                             as quantity_defective,
  qa.qa_defect_desc                                    as defect_description,
  pa.ncr_process_applicable_label                      as process_label,
  (eng.engineering_id is not null)                     as has_engineering,
  (pur.purchasing_id is not null)                      as has_purchasing,
  disp.ncr_disposition_label                           as disposition_label
from ncr n
join ncr_status s on s.ncr_status_id = n.ncr_status_id
cross join lateral (
  select (n.ncr_draft_data is not null and btrim(n.ncr_draft_data) <> '') as is_draft
) d
left join qa                     on qa.ncr_id = n.ncr_id
left join ncr_process_applicable pa on pa.ncr_process_applicable_id = qa.ncr_process_applicable_id
left join engineering eng        on eng.ncr_id = n.ncr_id
left join ncr_disposition disp   on disp.disposition_id = eng.disposition_id
left join purchasing pur         on pur.ncr_id = n.ncr_id
left join so_line_item sol       on sol.so_line_item_id = n.so_line_item_id
left join item it                on it.item_id = sol.item_id
left join sales_order so         on so.sales_order_id = sol.sales_order_id
left join lateral (
  -- Several purchase orders can point at one sales order line. Use the newest.
  select p2.purchase_order_number, p2.supplier_id
  from po_line_item pl
  join purchase_order p2 on p2.purchase_order_id = pl.purchase_order_id
  where pl.so_line_item_id = n.so_line_item_id
  order by pl.po_line_item_id desc
  limit 1
) po on true
left join supplier sup           on sup.supplier_id = po.supplier_id;
