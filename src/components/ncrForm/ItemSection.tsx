import Input from "../input";
import type { SectionProps } from "./formModel";

export default function ItemSection({
	values,
	errors,
	text,
}: SectionProps<"item">) {
	return (
		<>
			<Input
				type={Input.TEXT}
				name="itemName"
				label="Item name"
				value={values.itemName}
				required
				maxLength={200}
				autoComplete="off"
				placeholder="e.g. Hydraulic fitting, 1/2 in"
				onChange={text("itemName")}
				error={errors.itemName}
			/>
			<Input
				type={Input.TEXT}
				name="itemSapNumber"
				label="SAP number"
				value={values.itemSapNumber}
				required
				maxLength={20}
				autoComplete="off"
				placeholder="e.g. 100234567"
				onChange={text("itemSapNumber")}
				error={errors.itemSapNumber}
			/>
			<Input
				type={Input.PARAGRAPH}
				name="itemDescription"
				label="Item description (optional)"
				value={values.itemDescription}
				maxLength={300}
				placeholder="e.g. Stainless steel, drawing rev C, lot 24-0815"
				helpText={`Material, revision or lot help identify the item. Up to 300 characters. ${values.itemDescription.length} used.`}
				onChange={text("itemDescription")}
				error={errors.itemDescription}
			/>
		</>
	);
}