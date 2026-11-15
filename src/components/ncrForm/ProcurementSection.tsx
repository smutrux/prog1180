import { DEPARTMENT_TEXT_MAX_LENGTH } from "../ncrConstraints";
import Input from "../input";
import { countHelp, type SectionProps } from "./formModel";

export default function ProcurementSection({
	values,
	errors,
	text,
}: SectionProps<"procurement">) {
	return (
		<Input
			type={Input.PARAGRAPH}
			name="procurementDelayCommunication"
			label="Communication of a delay due to quality rejection (optional)"
			value={values.delayCommunication}
			maxLength={DEPARTMENT_TEXT_MAX_LENGTH}
			placeholder="e.g. The supplier was told the order is on hold until a replacement ships."
			helpText={countHelp(values.delayCommunication.length)}
			error={errors.procurementDelayCommunication}
			onChange={text("delayCommunication")}
		/>
	);
}