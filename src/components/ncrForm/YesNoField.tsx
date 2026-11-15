import Input from "../input";
import ChoiceGroup from "./ChoiceGroup";
import type { YesNo } from "./formModel";

/**
 * A Yes/No pair of radio buttons. `id` is also the error key, and the first
 * radio is "<id>-yes", which is where focus goes when the answer is missing.
 */
export default function YesNoField({
	id,
	legend,
	value,
	onChange,
	required,
	helpText,
	error,
}: {
	id: string;
	legend: string;
	value: YesNo;
	onChange: (next: "yes" | "no") => void;
	required?: boolean;
	helpText?: string;
	error?: string;
}) {
	return (
		<ChoiceGroup
			id={id}
			legend={legend}
			required={required}
			helpText={helpText}
			error={error}
		>
			<Input
				type={Input.RADIO}
				name={`${id}-yes`}
				groupName={id}
				value="yes"
				label="Yes"
				checked={value === "yes"}
				required={required}
				onChange={() => onChange("yes")}
			/>
			<Input
				type={Input.RADIO}
				name={`${id}-no`}
				groupName={id}
				value="no"
				label="No"
				checked={value === "no"}
				required={required}
				onChange={() => onChange("no")}
			/>
		</ChoiceGroup>
	);
}