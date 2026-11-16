import Input from "../input";
import type { FormLookups } from "../ncrService";
import ChoiceGroup from "./ChoiceGroup";
import { ADD_SUPPLIER, type SectionProps } from "./formModel";

interface ProcessSectionProps extends SectionProps<"process"> {
	edit: boolean;
	suppliers: FormLookups["suppliers"];
}

export default function ProcessSection({
	values: p,
	errors,
	update,
	text,
	edit,
	suppliers,
}: ProcessSectionProps) {
	const isSupplierProcess = p.processType === "supplier";
	return (
		<>
			<Input
				type={Input.TEXT}
				name="ncrNumber"
				label="NCR number"
				value={p.ncrNumber}
				readOnly
				placeholder="Looking up the next number..."
				error={errors.ncrNumber}
				helpText={
					edit
						? "This number cannot be changed."
						: "The next number in the sequence. It is checked again when you submit."
				}
			/>
			<ChoiceGroup
				id="processType"
				legend="Which process does this report cover?"
				required
				helpText="Choose Supplier or receiving inspection for purchased items. Choose Work in progress for items made in-house."
				error={errors.processType}
			>
				<Input
					type={Input.RADIO}
					name="processType-supplier"
					groupName="processType"
					value="supplier"
					label="Supplier or receiving inspection"
					checked={p.processType === "supplier"}
					required
					onChange={() => update({ processType: "supplier" })}
				/>
				<Input
					type={Input.RADIO}
					name="processType-wip"
					groupName="processType"
					value="wip"
					label="Work in progress (production order)"
					checked={p.processType === "wip"}
					required
					onChange={() => update({ processType: "wip" })}
				/>
			</ChoiceGroup>
			<Input
				type={Input.DROPDOWN}
				name="supplier"
				label={isSupplierProcess ? "Supplier" : "Supplier (optional)"}
				items={[...suppliers.map((s) => s.name), ADD_SUPPLIER]}
				value={p.supplier}
				required={isSupplierProcess}
				onChange={text("supplier")}
				error={errors.supplier}
				helpText={
					isSupplierProcess
						? "Pick the supplier that sent the item."
						: "Leave empty for in-house production."
				}
			/>
			{p.supplier === ADD_SUPPLIER && (
				<Input
					type={Input.TEXT}
					name="newSupplierName"
					label="New supplier name"
					value={p.newSupplierName}
					required
					maxLength={200}
					placeholder="e.g. Lakeshore Tooling Co."
					autoComplete="off"
					onChange={text("newSupplierName")}
					error={errors.newSupplierName}
				/>
			)}
			<Input
				type={Input.TEXT}
				name="poNumber"
				label={
					p.processType === "wip"
						? "Production order number"
						: "Purchase order number"
				}
				value={p.poNumber}
				required
				inputMode="numeric"
				maxLength={18}
				autoComplete="off"
				placeholder="e.g. 4500123456"
				helpText="Type it exactly as it appears on the paperwork. Digits only."
				onChange={text("poNumber")}
				error={errors.poNumber}
			/>
			<Input
				type={Input.TEXT}
				name="salesOrderNumber"
				label="Sales order number"
				value={p.salesOrderNumber}
				required
				inputMode="numeric"
				maxLength={18}
				autoComplete="off"
				placeholder="e.g. 1012345"
				helpText="Digits only."
				onChange={text("salesOrderNumber")}
				error={errors.salesOrderNumber}
			/>
		</>
	);
}