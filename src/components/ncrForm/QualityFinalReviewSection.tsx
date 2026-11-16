import { DEPARTMENT_TEXT_MAX_LENGTH } from "../ncrConstraints";
import Input from "../input";
import ChoiceGroup from "./ChoiceGroup";
import { countHelp, type SectionProps } from "./formModel";

export default function QualityFinalReviewSection({
	values,
	errors,
	update,
	text,
}: SectionProps<"qualityFinalReview">) {
	return (
		<>
			<Input
				type={Input.TEXT}
				name="qualityFinalInspectionResult"
				label="Final inspection result (optional)"
				value={values.inspectionResult}
				maxLength={300}
				autoComplete="off"
				placeholder="e.g. Passed re-inspection, no defects found"
				helpText={`Up to 300 characters. ${values.inspectionResult.length} used.`}
				onChange={text("inspectionResult")}
			/>
			<Input
				type={Input.PARAGRAPH}
				name="qualityFinalComments"
				label="Quality comments (optional)"
				value={values.comments}
				maxLength={DEPARTMENT_TEXT_MAX_LENGTH}
				placeholder="e.g. Accepted after rework. Measurements are in the attached picture."
				helpText={countHelp(values.comments.length)}
				error={errors.qualityFinalComments}
				onChange={text("comments")}
			/>
			<ChoiceGroup
				id="qualityAcceptanceConfirmed"
				legend="Final acceptance confirmation"
				required
				helpText="Choose Yes if the item is accepted after the final review."
				error={errors.qualityAcceptanceConfirmed}
			>
				<Input
					type={Input.RADIO}
					name="qualityAcceptanceConfirmed-yes"
					groupName="qualityAcceptanceConfirmed"
					value="yes"
					label="Yes"
					checked={values.acceptanceConfirmed === "yes"}
					required
					onChange={() => update({ acceptanceConfirmed: "yes" })}
				/>
				<Input
					type={Input.RADIO}
					name="qualityAcceptanceConfirmed-no"
					groupName="qualityAcceptanceConfirmed"
					value="no"
					label="No"
					checked={values.acceptanceConfirmed === "no"}
					required
					onChange={() => update({ acceptanceConfirmed: "no" })}
				/>
			</ChoiceGroup>
		</>
	);
}