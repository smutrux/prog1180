import Input from "../input";
import type { FormLookups } from "../ncrService";
import { ADD_INSPECTOR, fullName, type SectionProps } from "./formModel";

interface InspectorSectionProps extends SectionProps<"inspector"> {
	inspectors: FormLookups["inspectors"];
}

export default function InspectorSection({
	values,
	errors,
	text,
	inspectors,
}: InspectorSectionProps) {
	return (
		<>
			<Input
				type={Input.DROPDOWN}
				name="inspector"
				label="Inspector name"
				items={[...inspectors.map(fullName), ADD_INSPECTOR]}
				value={values.inspector}
				required
				helpText="Filled in with your name if you are on the list. Change it if someone else did the inspection."
				onChange={text("inspector")}
				error={errors.inspector}
			/>
			{values.inspector === ADD_INSPECTOR && (
				<>
					<Input
						type={Input.TEXT}
						name="newFirstName"
						label="First name"
						value={values.newFirstName}
						required
						maxLength={75}
						autoComplete="off"
						onChange={text("newFirstName")}
						error={errors.newFirstName}
					/>
					<Input
						type={Input.TEXT}
						name="newMiddleName"
						label="Middle name (optional)"
						value={values.newMiddleName}
						maxLength={75}
						autoComplete="off"
						onChange={text("newMiddleName")}
						error={errors.newMiddleName}
					/>
					<Input
						type={Input.TEXT}
						name="newLastName"
						label="Last name"
						value={values.newLastName}
						required
						maxLength={75}
						autoComplete="off"
						onChange={text("newLastName")}
						error={errors.newLastName}
					/>
				</>
			)}
		</>
	);
}