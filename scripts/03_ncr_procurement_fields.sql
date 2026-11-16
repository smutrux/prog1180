-- Procurement (buyer) fields from the client's NCR process document.
-- Run once, before using the new Procurement section. Existing rows get the defaults.

alter table ncr_procurement
	add column if not exists procurement_return_requested boolean,                 -- does the supplier want the items back? null = not asked
	add column if not exists procurement_rma_number text,
	add column if not exists procurement_carrier_name text,
	add column if not exists procurement_carrier_account_number text,
	add column if not exists procurement_dispose_on_site boolean not null default false,
	add column if not exists procurement_replacement_expected_date date,
	add column if not exists procurement_sap_return_completed boolean not null default false,
	add column if not exists procurement_credit_expected boolean not null default false,
	add column if not exists procurement_bill_supplier boolean not null default false;

alter table ncr_procurement
	add constraint procurement_rma_len
		check (char_length(procurement_rma_number) <= 50),
	add constraint procurement_carrier_name_len
		check (char_length(procurement_carrier_name) <= 100),
	add constraint procurement_carrier_account_len
		check (char_length(procurement_carrier_account_number) <= 50),
	-- Items are being returned: the RMA number, carrier and carrier account number must all be filled in.
	add constraint procurement_return_info_required
		check (
			procurement_return_requested is distinct from true
			or (
				nullif(btrim(procurement_rma_number), '') is not null
				and nullif(btrim(procurement_carrier_name), '') is not null
				and nullif(btrim(procurement_carrier_account_number), '') is not null
			)
		),
	-- "Dispose on site" only goes with No, and "return completed in SAP" only goes with Yes.
	add constraint procurement_return_flags
		check (
			(not procurement_dispose_on_site or procurement_return_requested is not distinct from false)
			and (not procurement_sap_return_completed or procurement_return_requested is true)
		);
