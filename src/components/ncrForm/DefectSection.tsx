import Input from "../input";
import type { FormLookups } from "../ncrService";
import ChoiceGroup from "./ChoiceGroup";
import type { SectionProps } from "./formModel";

interface DefectSectionProps extends SectionProps<"defect"> {
	problemTypes: FormLookups["problemTypes"];
}

export default function DefectSection({
	values,
	errors,
	update,
	text,
	problemTypes,
}: DefectSectionProps) {
	const selectedProblems = values.problemTypeIds;
	return (
		<>
			<Input
				type={Input.NUMBER}
				name="qtyOrdered"
				label="Quantity ordered"
				value={values.qtyOrdered}
				required
				min={1}
				step={1}
				inputMode="numeric"
				placeholder="e.g. 50"
				onChange={text("qtyOrdered")}
				error={errors.qtyOrdered}
			/>
			<Input
				type={Input.NUMBER}
				name="qtyDefective"
				label="Quantity defective"
				value={values.qtyDefective}
				required
				min={1}
				max={values.qtyOrdered || undefined}
				step={1}
				inputMode="numeric"
				placeholder="e.g. 3"
				helpText="Count only the items that do not meet requirements."
				onChange={text("qtyDefective")}
				error={errors.qtyDefective}
			/>
			<ChoiceGroup
				id="problemTypeIds"
				legend="Problem types"
				required
				helpText="Tick every problem that applies."
				error={errors.problemTypeIds}
			>
				{problemTypes.length === 0 && (
					<p className="ncr-help">
						No problem types are set up in the database yet.
					</p>
				)}
				{problemTypes.map((t, idx) => {
					const idStr = String(t.id);
					return (
						<Input
							key={t.id}
							type={Input.CHECKBOX}
							id={idx === 0 ? "problemTypeIds" : undefined}
							name={`problemType-${t.id}`}
							value={idStr}
							label={t.label}
							helpText={t.description || undefined}
							checked={selectedProblems.includes(idStr)}
							onChange={() =>
								update({
									problemTypeIds: selectedProblems.includes(idStr)
										? selectedProblems.filter((x) => x !== idStr)
										: [...selectedProblems, idStr],
								})
							}
						/>
					);
				})}
			</ChoiceGroup>
			<Input
				type={Input.PARAGRAPH}
				name="defectDescription"
				label="Description of defect"
				value={values.defectDescription}
				required
				maxLength={400}
				placeholder="Say what is wrong, where on the item, and how you found it. Include measurements if you have them."
				helpText={`Up to 400 characters. ${values.defectDescription.length} used.`}
				onChange={text("defectDescription")}
				error={errors.defectDescription}
			/>
			<ChoiceGroup
				id="isNonconforming"
				legend="Is the item marked as nonconforming?"
				required
				helpText="Choose Yes if the item has been tagged or marked as nonconforming."
				error={errors.isNonconforming}
			>
				<Input
					type={Input.RADIO}
					name="isNonconforming-yes"
					groupName="isNonconforming"
					value="yes"
					label="Yes"
					checked={values.isNonconforming === "yes"}
					required
					onChange={() => update({ isNonconforming: "yes" })}
				/>
				<Input
					type={Input.RADIO}
					name="isNonconforming-no"
					groupName="isNonconforming"
					value="no"
					label="No"
					checked={values.isNonconforming === "no"}
					required
					onChange={() => update({ isNonconforming: "no" })}
				/>
			</ChoiceGroup>
			<ChoiceGroup
				id="engineeringRequired"
				legend="Is Engineering review required?"
				required
				helpText="Choose Yes to route this NCR to Engineering for disposition."
				error={errors.engineeringRequired}
			>
				<Input
					type={Input.RADIO}
					name="engineeringRequired-yes"
					groupName="engineeringRequired"
					value="yes"
					label="Yes"
					checked={values.engineeringRequired === "yes"}
					required
					onChange={() => update({ engineeringRequired: "yes" })}
				/>
				<Input
					type={Input.RADIO}
					name="engineeringRequired-no"
					groupName="engineeringRequired"
					value="no"
					label="No"
					checked={values.engineeringRequired === "no"}
					required
					onChange={() => update({ engineeringRequired: "no" })}
				/>
			</ChoiceGroup>
		</>
	);
}