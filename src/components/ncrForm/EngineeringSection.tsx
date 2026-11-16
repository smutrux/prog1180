import Input from "../input";
import { DEPARTMENT_TEXT_MAX_LENGTH } from "../ncrConstraints";
import type { FormLookups } from "../ncrService";
import YesNoField from "./YesNoField";
import { countHelp, type SectionProps } from "./formModel";

interface EngineeringSectionProps extends SectionProps<"engineering"> {
	dispositions: FormLookups["dispositions"];
}

export default function EngineeringSection({
	values,
	errors,
	update,
	text,
	dispositions,
}: EngineeringSectionProps) {
	return (
		<>
			<Input
				type={Input.DROPDOWN}
				name="engineeringDisposition"
				label="Engineering disposition"
				value={values.disposition}
				items={dispositions}
				helpText="Leave this section empty until engineering has decided. Once you answer anything here, the disposition and both Yes/No questions are needed."
				error={errors.engineeringDisposition}
				onChange={text("disposition")}
			/>
			<Input
				type={Input.PARAGRAPH}
				name="engineeringInstructions"
				label="Engineering instructions (optional)"
				value={values.instructions}
				maxLength={DEPARTMENT_TEXT_MAX_LENGTH}
				placeholder="e.g. Rework to drawing revision C, or use as is."
				helpText={countHelp(values.instructions.length)}
				error={errors.engineeringInstructions}
				onChange={text("instructions")}
			/>
			<YesNoField
				id="engineeringDrawingUpdate"
				legend="Does the drawing need an update?"
				value={values.drawingUpdateRequired}
				error={errors.engineeringDrawingUpdate}
				onChange={(next) => update({ drawingUpdateRequired: next })}
			/>
			<YesNoField
				id="engineeringNotification"
				legend="Does someone need to be notified?"
				value={values.notificationRequired}
				error={errors.engineeringNotification}
				onChange={(next: any) => update({ notificationRequired: next })}
			/>
			<Input
				type={Input.TEXT}
				name="engineeringOriginalRev"
				label="Original revision (optional)"
				value={values.originalRev}
				maxLength={50}
				error={errors.engineeringOriginalRev}
				onChange={text("originalRev")}
			/>
			<Input
				type={Input.TEXT}
				name="engineeringUpdatedRev"
				label={
					values.drawingUpdateRequired === "yes"
						? "Updated revision"
						: "Updated revision (optional)"
				}
				value={values.updatedRev}
				required={values.drawingUpdateRequired === "yes"}
				maxLength={50}
				helpText="Needed when the drawing needs an update."
				error={errors.engineeringUpdatedRev}
				onChange={text("updatedRev")}
			/>
			<Input
				type={Input.TEXT}
				name="engineeringRevisionDate"
				label="Revision date (optional)"
				value={values.revisionDate}
				maxLength={10}
				placeholder="YYYY-MM-DD"
				error={errors.engineeringRevisionDate}
				onChange={text("revisionDate")}
			/>
		</>
	);
}