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
	if (props.type === InputType.DROPDOWN) {
		var { items, value, onChange, name } = props;
		return (
			<div>
				<select name={name} value={value} onChange={onChange}>
					{items.map((item) => (
						<option key={item} value={item}>
							{item}
						</option>
					))}
				</select>
				<label htmlFor={name}>{props.label}</label>
			</div>
		);
	}

	if (props.type === InputType.RADIO) {
		var { groupName, name, value, onChange } = props;
		return (
			<div>
				<input
					type="radio"
					name={groupName}
					id={name}
					value={value}
					onChange={onChange}
				/>
				<label htmlFor={name}>{props.label}</label>
			</div>
		);
	}

	if (props.type === InputType.PARAGRAPH) {
		var { name, placeholder, value, onChange } = props;
		return (
			<div>
				<textarea
					name={name}
					placeholder={placeholder}
					value={value}
					onChange={onChange}
				/>
				<label htmlFor={name}>{props.label}</label>
			</div>
		);
	}

	var { type, name, placeholder, value, onChange } = props;
	return (
		<div>
			<input
				type={type}
				name={name}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
			/>
			<label htmlFor={name}>{props.label}</label>
		</div>
	);
};

export var Input = Object.assign(InputComponent, InputType);
export default Input;
