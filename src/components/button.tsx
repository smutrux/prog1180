import type { IconType } from "react-icons";

/**
 * Picks black or white text for a given background colour.
 *
 * Computes the WCAG relative luminance of the background and returns
 * whichever of black or white has more contrast against it.
 *
 * Only hex colours are parsed (`#rgb` or `#rrggbb`). Anything else, such as
 * named colours, `rgb()` strings or `var(--x)`, falls back to white.
 *
 * @param background - Background colour as a hex string, with or without
 *   the leading `#`.
 * @returns `"#000000"` for light backgrounds, `"#ffffff"` for dark ones
 *   and for unparseable input.
 *
 * @example
 * getTextColour("#ffffff"); // "#000000"
 * getTextColour("#2563eb"); // "#ffffff"
 */
var getTextColour = (background: string): "#000000" | "#ffffff" => {
	let hex = background.replace("#", "");
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";

	var [r, g, b] = [0, 2, 4].map((i) => {
		var channel = parseInt(hex.slice(i, i + 2), 16) / 255;
		return channel <= 0.03928
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4;
	});

	var luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luminance > 0.179 ? "#000000" : "#ffffff";
};

/**
 * Props for {@link Button}.
 */
interface ButtonProps {
	/** Label shown on the button. */
	text: string;
 
	/** Called when the button is clicked. Not called while the button is disabled. */
	onClick: () => void;
 
	/**
	 * Optional icon, shown to the left of the text. Pass the component
	 * reference from react-icons (`FaBeer`), not an element (`<FaBeer />`).
	 */
	icon?: IconType;
 
	/**
	 * Whether the button can be clicked. Set to `false` to disable it.
	 * @defaultValue `true`
	 */
	enabled?: boolean;
 
	/**
	 * Background colour of the button. The text and icon colour is chosen
	 * automatically (black or white) for contrast, so use a hex value
	 * (`#rgb` or `#rrggbb`) to get the right result.
	 * @defaultValue `var(--accent)`
	 */
	colour?: string;
 
	/**
	 * Font size of the button, as any CSS size string (`"1rem"`, `"18px"`).
	 * Icons are sized in `em`, so they scale with this value.
	 * @defaultValue inherited from CSS
	 */
	size?: string;
 
	/**
	 * Renders the button text in bold. This only affects the text, not the
	 * icon, because font weight doesn't apply to SVGs.
	 * @defaultValue `false`
	 */
	bold?: boolean;

	/**
	 * ARIA label for the button, used for accessibility. This should describe the action of the button for screen readers.
	 */
	aria: string;
}

/**
 * A button with optional icon, custom background colour and automatic
 * text contrast.
 *
 * The text and icon colour is computed from `colour` with
 * {@link getTextColour}. When `colour` is omitted, the background uses
 * `var(--accent)`. That variable can't be parsed from JS, so the text
 * falls back to white in that case.
 *
 * @param props - Component props, see {@link ButtonProps}.
 * @param props.text - Label shown on the button.
 * @param props.onClick - Click handler.
 * @param props.icon - Optional react-icons component, renamed to `Icon`
 *   internally so JSX treats it as a component.
 * @param props.enabled - Enables or disables the button. Defaults to `true`.
 * @param props.colour - Background colour. Defaults to `var(--accent)`.
 * @param props.size - CSS font size for the button.
 * @param props.bold - Bold text when `true`. Defaults to `false`.
 * @returns A `<button type="button">` element.
 *
 * @example
 * import { FaBeer } from "react-icons/fa";
 *
 * <Button
 *   text="Cheers"
 *   onClick={() => console.log("clicked")}
 *   icon={FaBeer}
 *   colour="#f59e0b"
 *   size="1.25rem"
 *   bold
 * />
 */
var Button = ({
	text,
	onClick,
	icon: Icon,
	enabled = true,
	colour,
	size,
	bold,
	aria,
}: ButtonProps) => {
	return (
		<button
			type="button"
			className="counter"
			onClick={onClick}
			disabled={!enabled}
			aria-label={aria}
			style={{
				color: getTextColour(colour ?? "var(--accent)"),
				fontWeight: bold ? "bold" : "normal",
				fontSize: size,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: "0.25rem",
				backgroundColor: colour ? colour : "var(--accent)",
        borderRadius: '0.5rem',
			}}
		>
			{Icon && <Icon aria-hidden="true" />}
			{text}
		</button>
	);
};

export default Button;
