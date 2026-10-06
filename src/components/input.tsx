import { useState } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

const InputType = {
	DATE: "date",
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

interface BaseInputProps {
	name: string;
	placeholder?: string;
	value?: string;
	onChange?: (
		event: React.ChangeEvent<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>,
	) => void;
	groupName?: string;
	items?: string[];
	aria: string;
	label: string;
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

var InputComponent = (props: InputProps) => {
	switch (props.type) {
		case InputType.DROPDOWN:
			var { items, value, onChange, name, label } = props;
			const listId = `${name}-datalist`;
			const isLargeList = items.length > 20;

			return (
				<div className="input-wrapper">
					{isLargeList ? (
						<>
							<input
								type="text"
								name={name}
								id={name}
								list={listId}
								value={value}
								onChange={onChange}
								placeholder="Select or type an option..."
								className="dropdown-input"
							/>
							<datalist id={listId}>
								{items.map((item) => (
									<option key={item} value={item} />
								))}
							</datalist>
						</>
					) : (
						<>
							<select name={name} value={value} onChange={onChange}>
								<option disabled selected>
									Select an option
								</option>
								{items.map((item) => (
									<option key={item} value={item}>
										{item}
									</option>
								))}
							</select>
						</>
					)}

					<label htmlFor={name}>{label}</label>

					<style jsx>{`
						select {
							background-color: var(--code-bg);
							border-radius: 0.5rem;
							border: 1px solid var(--border);
							padding: 0.5rem;
							color: var(--text-h);
							font-family: var(--sans);
						}
					`}</style>
				</div>
			);

		case InputType.RADIO:
			var { groupName, name, value, onChange, label } = props;
			return (
				<div className="radio-wrapper">
					<input
						type="radio"
						name={groupName}
						id={name}
						value={value}
						onChange={onChange}
					/>
					<label htmlFor={name}>{label}</label>
					<style jsx>{`
						.radio-wrapper {
							display: flex;
							flex-direction: row;
						}
					`}</style>
				</div>
			);

		case InputType.PARAGRAPH:
			var { name, placeholder, value, onChange, label } = props;
			return (
				<div className="input-wrapper">
					<textarea
						name={name}
						placeholder={placeholder}
						value={value}
						onChange={onChange}
					/>
					<label htmlFor={name}>{label}</label>
					<style jsx>{`
						textarea {
							background-color: var(--code-bg);
							border-radius: 0.5rem;
							border: 1px solid var(--border);
							padding: 0.5rem;
							color: var(--text-h);
							font-family: var(--sans);
						}
					`}</style>
				</div>
			);

		default:
			var { name, placeholder, value, onChange, label, type } = props;
			const [showPassword, setShowPassword] = useState(false);
			var isPasswordType = type === InputType.PASSWORD;
			var inputType = isPasswordType
				? showPassword
					? "text"
					: "password"
				: type;

			return (
				<div className="input-wrapper">
					<div className="input-field-container">
						<input
							type={inputType}
							name={name}
							placeholder={placeholder}
							value={value}
							onChange={onChange}
						/>
						{isPasswordType && (
							<button
								type="button"
								className="toggle-password-btn"
								onClick={() => setShowPassword((prev) => !prev)}
								aria-label={showPassword ? "Hide password" : "Show password"}
							>
								{showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
							</button>
						)}
					</div>
					<label htmlFor={name}>{label}</label>
					<style jsx>{`
						.input-wrapper {
							display: flex;
							flex-direction: column-reverse;
						}

						.input-field-container {
							position: relative;
							display: flex;
							align-items: center;
							width: 100%;
						}

						input {
							background-color: var(--code-bg);
							border-radius: 0.5rem;
							border: 1px solid var(--border);
							padding: 0.5rem;
							resize: none;
							color: var(--text-h);
							font-family: var(--sans);
						}

						label {
							text-align: left;
							margin-left: 3px;
							font-family: var(--sans);
						}

						.toggle-password-btn {
							position: absolute;
							right: 0.5rem;
							background: transparent;
							border: none;
							color: var(--text-h);
							cursor: pointer;
							display: flex;
							align-items: center;
							justify-content: center;
							padding: 0.25rem;
							opacity: 0.7;
							transition: opacity 0.2s ease;
						}

						.toggle-password-btn:hover {
							opacity: 1;
						}
					`}</style>
				</div>
			);
	}
};

export var Input = Object.assign(InputComponent, InputType);
export default Input;
