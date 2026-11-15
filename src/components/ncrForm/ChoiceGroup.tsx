import type { ReactNode } from "react";

export default function ChoiceGroup(props: {
	id: string;
	legend: string;
	required?: boolean;
	helpText?: string;
	error?: string;
	children: ReactNode;
}) {
	const { id, legend, required, helpText, error, children } = props;
	const describedBy =
		[helpText && `${id}-help`, error && `${id}-error`]
			.filter(Boolean)
			.join(" ") || undefined;
	return (
		<fieldset className="ncr-fieldset" aria-describedby={describedBy}>
			<legend>
				{legend}
				{required && <span className="ncr-req"> (required)</span>}
			</legend>
			{helpText && (
				<p id={`${id}-help`} className="ncr-help">
					{helpText}
				</p>
			)}
			{children}
			{error && (
				<p id={`${id}-error`} className="ncr-error">
					<strong>Error: </strong>
					{error}
				</p>
			)}
		</fieldset>
	);
}