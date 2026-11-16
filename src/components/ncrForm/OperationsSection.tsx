import {
	DEPARTMENT_TEXT_MAX_LENGTH,
	isReworkDisposition,
} from "../ncrConstraints";
import Input from "../input";
import type { FormLookups } from "../ncrService";
import { countHelp, type ChangeEvt, type SectionProps } from "./formModel";

interface OperationsSectionProps extends SectionProps<"operations"> {
	dispositions: FormLookups["dispositions"];
	/** Announces a change to screen readers (the form's status line). */
	announce: (message: string) => void;
}

export default function OperationsSection({
	values,
	errors,
	update,
	text,
	dispositions,
	announce,
}: OperationsSectionProps) {
	return (
		<>
			<Input
				type={Input.DROPDOWN}
				name="operationsDisposition"
				label="Operations disposition (optional)"
				value={values.disposition}
				items={dispositions}
				helpText="If you choose rework or repair, a box for the instructions appears and you must fill it in."
				onChange={(e: ChangeEvt) => {
					const next = e.target.value;
					const was = isReworkDisposition(values.disposition);
					const now = isReworkDisposition(next);
					update(
						now
							? { disposition: next }
							: { disposition: next, instructions: "" },
					);
					if (now && !was)
						announce(
							"A required box for the rework or repair instructions has appeared below.",
						);
					else if (!now && was)
						announce("The rework or repair instructions box was removed.");
				}}
			/>
			{isReworkDisposition(values.disposition) && (
				<Input
					type={Input.PARAGRAPH}
					name="operationsInstructions"
					label="Rework/repair instructions"
					value={values.instructions}
					required
					maxLength={DEPARTMENT_TEXT_MAX_LENGTH}
					placeholder="Say what must be reworked or repaired, and how."
					helpText={countHelp(values.instructions.length)}
					error={errors.operationsInstructions}
					onChange={text("instructions")}
				/>
			)}
			<Input
				type={Input.PARAGRAPH}
				name="operationsComments"
				label="Operations comments (optional)"
				value={values.comments}
				maxLength={DEPARTMENT_TEXT_MAX_LENGTH}
				placeholder="e.g. Parts are on the rework shelf, row 4."
				helpText={countHelp(values.comments.length)}
				error={errors.operationsComments}
				onChange={text("comments")}
			/>
		</>
	);
}