-- =====================================================================
-- OPTIONAL: the rules ncrConstraints.tsx used to enforce in the browser,
-- now enforced by the database. Run after 01_ncr_functions.sql.
--
-- Each statement is independent. If one fails because existing rows break
-- the rule, fix or delete those rows and run that statement again.
-- The app works without this file; with it, bad data cannot get in even
-- through the SQL editor or another client.
-- =====================================================================

-- NCR
alter table public.ncr
  add constraint ncr_number_format check (ncr_number ~ '^\d{4}-\d{3,}$'),
  add constraint ncr_closed_after_created check (ncr_closed_at is null or ncr_closed_at >= ncr_created_at);

-- QA
alter table public.qa
  add constraint qa_defect_desc_len check (char_length(qa_defect_desc) <= 400);

-- Engineering: a drawing update needs the new revision number
alter table public.engineering
  add constraint engineering_updated_rev_required check (
    not engineering_is_drawing_update_required
    or nullif(btrim(engineering_updated_rev_number), '') is not null);

-- Orders: digits only, up to 18 (the form's rule)
alter table public.purchase_order
  add constraint purchase_order_number_format check (purchase_order_number ~ '^\d{1,18}$');
alter table public.sales_order
  add constraint sales_order_number_format check (sales_order_number ~ '^\d{1,18}$'),
  add constraint sales_order_sap_len check (char_length(item_sap_number) <= 20);

-- Supplier names are unique, ignoring case and edge spaces
alter table public.supplier
  add constraint supplier_name_len check (char_length(supplier_name) <= 200);
create unique index supplier_name_lower_uq on public.supplier (lower(btrim(supplier_name)));

-- Item
alter table public.item
  add constraint item_name_len check (char_length(item_name) <= 200),
  add constraint item_desc_len check (char_length(item_desc) <= 300),
  add constraint item_price_nonneg check (item_unit_price is null or item_unit_price >= 0);

-- Order lines
alter table public.so_line_item
  add constraint so_line_qty_min check (so_line_item_quantity_ordered >= 1),
  add constraint so_line_price_nonneg check (so_line_item_unit_price is null or so_line_item_unit_price >= 0),
  add constraint so_line_order_item_uq unique (sales_order_id, item_id);
alter table public.po_line_item
  add constraint po_line_qty_min check (po_line_item_quantity_ordered >= 1),
  add constraint po_line_price_nonneg check (po_line_item_unit_price is null or po_line_item_unit_price >= 0),
  add constraint po_line_order_item_so_uq unique (purchase_order_id, item_id, so_line_item_id);

-- An NCR cannot list the same problem type twice
alter table public.ncr_problem_type
  add constraint ncr_problem_type_uq unique (ncr_id, problem_type_id);

-- Attachments
alter table public.attachment
  add constraint attachment_type_allowed check (attachment_type in ('Image', 'Document', 'Link')),
  add constraint attachment_name_len check (char_length(attachment_file_name) <= 300),
  add constraint attachment_path_len check (char_length(attachment_file_path) <= 500),
  add constraint attachment_path_uq unique (attachment_file_path);

-- People
alter table public.person
  add constraint person_name_len check (
    char_length(person_first_name) <= 75
    and char_length(person_last_name) <= 75
    and char_length(person_middle_name) <= 75),
  add constraint person_email_format check (person_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$');
create unique index person_email_lower_uq on public.person (lower(person_email));
