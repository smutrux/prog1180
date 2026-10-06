import { useState } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

const InputType = {
	DATE: "date",
	DATETIME: "datetime-local",
	DROPDOWN: "dropdown",
	EMAIL: "email",
	FILE: "file",
	NUMBER: "number",
	PARAGRAPH: "paragraph",
	PASSWORD: "password",
	RADIO: "radio",
	TEXT: "text",
	URL: "url",
} as const;

type InputTypeKey = (typeof InputType)[keyof typeof InputType];

type FieldChangeEvent = React.ChangeEvent<
	HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

interface BaseInputProps {
	name: string;
	/** Defaults to `name`. Must be unique on the page. */
	id?: string;
	label: string;
	/** Extra description read only by screen readers. */
	aria?: string;
	placeholder?: string;
	value?: string;
	onChange?: (event: FieldChangeEvent) => void;
	groupName?: string;
	items?: string[];
	required?: boolean;
	readOnly?: boolean;
	disabled?: boolean;
	/** Visible hint shown under the label and linked with aria-describedby. */
	helpText?: string;
	/** Visible error message, linked with aria-describedby. */
	error?: string;
	checked?: boolean;
	min?: number | string;
	max?: number | string;
	step?: number | string;
	maxLength?: number;
	pattern?: string;
	inputMode?: React.HTMLAttributes<HTMLElement>["inputMode"];
	autoComplete?: string;
	accept?: string;
	multiple?: boolean;
}

interface RadioInputProps extends BaseInputProps {
	type: typeof InputType.RADIO;
	groupName: string;
}

interface DropdownInputProps extends BaseInputProps {
	type: typeof InputType.DROPDOWN;
	items: string[];
}

interface StandardInputProps extends BaseInputProps {
	type: Exclude<
		InputTypeKey,
		typeof InputType.RADIO | typeof InputType.DROPDOWN
	>;
}

type InputProps = StandardInputProps | RadioInputProps | DropdownInputProps;

const describedBy = (
	id: string,
	p: Pick<BaseInputProps, "helpText" | "error" | "aria">,
) =>
	[
		p.helpText && `${id}-help`,
		p.aria && `${id}-aria`,
		p.error && `${id}-error`,
	]
		.filter(Boolean)
		.join(" ") || undefined;

/* Label first in the DOM so reading order matches the visual order. */
const Field = ({
	id,
	label,
	required,
	helpText,
	error,
	aria,
	children,
}: {
	id: string;
	label: string;
	required?: boolean;
	helpText?: string;
	error?: string;
	aria?: string;
	children: React.ReactNode;
}) => (
	<div className="fld">
		<label htmlFor={id} className="fld-label">
			{label}
			{required && <span className="fld-req"> (required)</span>}
		</label>
		{helpText && (
			<p id={`${id}-help`} className="fld-help">
				{helpText}
			</p>
		)}
		{aria && (
			<span id={`${id}-aria`} className="fld-sr">
				{aria}
			</span>
		)}
		{children}
		{error && (
			<p id={`${id}-error`} className="fld-error">
				<strong>Error: </strong>
				{error}
			</p>
		)}
	</div>
);

const DropdownField = (props: DropdownInputProps) => {
	const { items, value, onChange, name, label, required, disabled, error } =
		props;
	const id = props.id ?? name;
	const common = {
		id,
		name,
		onChange,
		required,
		disabled,
		"aria-invalid": error ? (true as const) : undefined,
		"aria-describedby": describedBy(id, props),
	};
	const listId = `${id}-datalist`;
	const isLargeList = items.length > 20;

	return (
		<Field {...props} id={id}>
			{isLargeList ? (
				<>
					<input
						{...common}
						type="text"
						list={listId}
						value={value}
						placeholder="Select or type an option..."
						className="fld-control"
					/>
					<datalist id={listId}>
						{items.map((item) => (
							<option key={item} value={item} />
						))}
					</datalist>
				</>
			) : (
				<select
					{...common}
					value={value}
					defaultValue={value === undefined ? "" : undefined}
					className="fld-control"
				>
					<option value="" disabled>
						Select an option
					</option>
					{items.map((item) => (
						<option key={item} value={item}>
							{item}
						</option>
					))}
				</select>
			)}
		</Field>
	);
};

const RadioField = (props: RadioInputProps) => {
	const { groupName, name, value, onChange, label, checked, required, disabled } =
		props;
	const id = props.id ?? name;
	return (
		<div className="fld-radio">
			<input
				type="radio"
				id={id}
				name={groupName}
				value={value}
				checked={checked}
				onChange={onChange}
				required={required}
				disabled={disabled}
				aria-describedby={describedBy(id, props)}
			/>
			<label htmlFor={id}>{label}</label>
			{props.aria && (
				<span id={`${id}-aria`} className="fld-sr">
					{props.aria}
				</span>
			)}
		</div>
	);
};

const ParagraphField = (props: StandardInputProps) => {
	const { name, placeholder, value, onChange, required, readOnly, disabled, error, maxLength } = props;
	const id = props.id ?? name;
	return (
		<Field {...props} id={id}>
			<textarea
				id={id}
				name={name}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				required={required}
				readOnly={readOnly}
				disabled={disabled}
				maxLength={maxLength}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy(id, props)}
				className="fld-control"
			/>
		</Field>
	);
};

const TextLikeField = (props: StandardInputProps) => {
	const [showPassword, setShowPassword] = useState(false);
	const {
		type, name, placeholder, value, onChange, required, readOnly, disabled,
		error, min, max, step, maxLength, pattern, inputMode, autoComplete,
		accept, multiple,
	} = props;
	const id = props.id ?? name;
	const isPassword = type === InputType.PASSWORD;
	const isFile = type === InputType.FILE;
	const inputType = isPassword && showPassword ? "text" : type;

	return (
		<Field {...props} id={id}>
			<div className="fld-field-container">
				<input
					type={inputType}
					id={id}
					name={name}
					placeholder={placeholder}
					value={isFile ? undefined : value}
					onChange={onChange}
					required={required}
					readOnly={readOnly}
					disabled={disabled}
					min={min}
					max={max}
					step={step}
					maxLength={maxLength}
					pattern={pattern}
					inputMode={inputMode}
					autoComplete={autoComplete}
					accept={accept}
					multiple={multiple}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy(id, props)}
					className="fld-control"
				/>
				{isPassword && (
					<button
						type="button"
						className="fld-toggle"
						onClick={() => setShowPassword((prev) => !prev)}
						aria-label={showPassword ? "Hide password" : "Show password"}
					>
						{showPassword ? <LuEyeOff size={20} /> : <LuEye size={20} />}
					</button>
				)}
			</div>
		</Field>
	);
};

const InputComponent = (props: InputProps) => {
	let content: React.ReactNode;
	switch (props.type) {
		case InputType.DROPDOWN:
			content = <DropdownField {...props} />;
			break;
		case InputType.RADIO:
			content = <RadioField {...props} />;
			break;
		case InputType.PARAGRAPH:
			content = <ParagraphField {...props} />;
			break;
		default:
			content = <TextLikeField {...props} />;
	}

	return (
		<>
			{content}
			<style jsx global>{`
				.fld {
					display: flex;
					flex-direction: column;
					gap: 0.375rem;
					text-align: left;
					font-family: var(--sans);
					line-height: 1.5;
				}
				.fld-label {
					font-weight: 600;
					color: var(--text-h);
				}
				.fld-req {
					font-weight: 400;
				}
				.fld-help {
					margin: 0;
					color: var(--text-h);
					font-size: 0.95rem;
				}
				.fld-error {
					margin: 0;
					color: var(--error, #b3001b);
				}
				.fld-sr {
					position: absolute;
					width: 1px;
					height: 1px;
					overflow: hidden;
					clip: rect(0 0 0 0);
					white-space: nowrap;
				}
				.fld-field-container {
					position: relative;
					display: flex;
					align-items: center;
					width: 100%;
				}
				.fld-control {
					box-sizing: border-box;
					width: 100%;
					min-height: 2.75rem;
					padding: 0.5rem 0.75rem;
					background-color: var(--code-bg);
					border: 1px solid var(--text-h);
					border-radius: 0.5rem;
					color: var(--text-h);
					font-family: var(--sans);
					font-size: 1rem;
					line-height: 1.5;
				}
				textarea.fld-control {
					min-height: 8rem;
					resize: vertical;
				}
				.fld-control::placeholder {
					color: var(--text-h);
					opacity: 0.7;
				}
				.fld-control[readonly] {
					border-style: dashed;
				}
				.fld-control[aria-invalid="true"] {
					border: 3px solid var(--error, #b3001b);
				}
				.fld-control:focus-visible,
				.fld-radio input:focus-visible,
				.fld-toggle:focus-visible {
					outline: 3px solid var(--text-h);
					outline-offset: 2px;
				}
				.fld-radio {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					min-height: 2.75rem;
					font-family: var(--sans);
					color: var(--text-h);
				}
				.fld-radio input {
					width: 1.5rem;
					height: 1.5rem;
					margin: 0;
					flex: none;
				}
				.fld-radio label {
					flex: 1;
					display: flex;
					align-items: center;
					min-height: 2.75rem;
					cursor: pointer;
				}
				.fld-toggle {
					position: absolute;
					right: 0.25rem;
					display: flex;
					align-items: center;
					justify-content: center;
					width: 2.75rem;
					height: 2.75rem;
					background: transparent;
					border: none;
					color: var(--text-h);
					cursor: pointer;
				}
				@media (prefers-reduced-motion: no-preference) {
					.fld-toggle {
						transition: opacity 0.2s ease;
					}
				}
			`}</style>
		</>
	);
};

export var Input = Object.assign(InputComponent, InputType);
export default Input;