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
const getTextColour = (background: string): "#000000" | "#ffffff" => {
	let hex = background.replace("#", "");
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";

	const [r, g, b] = [0, 2, 4].map((i) => {
		const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
		return channel <= 0.03928
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4;
	});

	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
	 * (`#rgb` or `#rrggbb`) to get the right result. Check the result still
	 * has 7:1 contrast.
	 * @defaultValue `var(--accent)`, with text in `var(--on-accent)`
	 */
	colour?: string;

	/**
	 * Font size of the button, as any CSS size string (`"1rem"`, `"18px"`).
	 * Icons are sized in `em`, so they scale with this value.
	 * @defaultValue `"1rem"`
	 */
	size?: string;

	/**
	 * Renders the button text in bold. This only affects the text, not the
	 * icon, because font weight doesn't apply to SVGs.
	 * @defaultValue `false`
	 */
	bold?: boolean;

	/**
	 * ARIA label for the button. It describes the action for screen readers
	 * and must contain the visible text, for example "Edit NCR 12" for a
	 * button that says "Edit".
	 */
	aria: string;
}

/**
 * A button with an optional icon, custom background colour and automatic
 * text contrast. It is at least 44 by 44 pixels, and shows an underline on
 * hover as well as a colour change.
 *
 * @param props - Component props, see {@link ButtonProps}.
 * @returns A `<button type="button">` element.
 *
 * @example
 * import { FaBeer } from "react-icons/fa";
 *
 * <Button text="Cheers" aria="Cheers" onClick={() => console.log("clicked")} icon={FaBeer} bold />
 */
const Button = ({
	text,
	onClick,
	icon: Icon,
	enabled = true,
	colour,
	size = "1rem",
	bold,
	aria,
}: ButtonProps) => (
	<>
		<button
			type="button"
			onClick={onClick}
			disabled={!enabled}
			aria-label={aria}
		>
			{Icon && <Icon aria-hidden="true" />}
			{text}
		</button>

		<style jsx>{`
			button {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.25rem;
				min-width: 2.75rem;
				min-height: 2.75rem;
				padding: 0.5rem 1rem;
				border: none;
				border-radius: 0.5rem;
				background-color: ${colour ?? "var(--accent)"};
				color: ${colour ? getTextColour(colour) : "var(--on-accent)"};
				font-family: inherit;
				font-size: ${size};
				font-weight: ${bold ? "bold" : "normal"};
				cursor: pointer;
			}

			button:hover:not(:disabled) {
				text-decoration: underline;
			}

			button:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		`}</style>
	</>
);

export default Button;
