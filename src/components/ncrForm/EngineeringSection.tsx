import { DEPARTMENT_TEXT_MAX_LENGTH } from "../ncrConstraints";
import Input from "../input";
import { countHelp, type SectionProps } from "./formModel";

export default function EngineeringSection({
	values,
	errors,
	text,
}: SectionProps<"engineering">) {
	return (
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
	);
}