import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, Ref } from "react";

export interface FormNavProps {
	sections: readonly { id: string; title: string }[];
	step: number;
	onSelect: (index: number) => void;
	/** The title doubles as the section heading, so the form's focus-on-step-change lands here. */
	headingRef: Ref<HTMLHeadingElement>;
}

/**
 * Height scale and lift for a bar `stepDistance` bar-pitches from the pointer.
 * On the bar: 150% tall, lifted 25%. One bar away: 113% and 10%.
 * The height is back to 100% by about 1.35 bars and the lift is gone by about 1.67.
 */
function dockShape(stepDistance: number) {
	return {
		scale: Math.max(1, 1.5 - 0.37 * stepDistance),
		lift: Math.max(0, 0.25 - 0.15 * stepDistance),
	};
}

export default function FormNav({
	sections,
	step,
	onSelect,
	headingRef,
}: FormNavProps) {
	const listRef = useRef<HTMLOListElement>(null);
	const bars = useRef<(HTMLSpanElement | null)[]>([]);
	const [hovered, setHovered] = useState<number | null>(null);
	const [focused, setFocused] = useState<number | null>(null);

	function onPointerMove(e: PointerEvent<HTMLOListElement>) {
		// Touch has no hover. A tap just selects, so leave the bars at rest.
		if (e.pointerType === "touch") return;
		const els = bars.current.slice(0, sections.length);
		if (els.length < 2 || els.some((el) => !el)) return;
		const centers = els.map((el) => {
			const r = el!.getBoundingClientRect();
			return r.left + r.width / 2;
		});
		const pitch = centers[1] - centers[0];
		// The class goes on before the heights are written so the bars follow the pointer with no easing.
		// It is set here rather than in state so React never repaints the nav on every mouse move.
		listRef.current?.classList.add("is-hovering");
		let closest = 0;
		let nearest = Infinity;
		els.forEach((el, i) => {
			const distance = Math.abs(e.clientX - centers[i]);
			if (distance < nearest) {
				nearest = distance;
				closest = i;
			}
			const { scale, lift } = dockShape(distance / pitch);
			el!.style.height = `calc(var(--dock-bar-height) * ${scale.toFixed(3)})`;
			el!.style.transform = `translateY(calc(var(--dock-bar-height) * -${lift.toFixed(3)}))`;
		});
		setHovered(closest);
	}

	function onPointerLeave() {
		// Clearing the inline values lets the resting rules take over with the settle transition.
		listRef.current?.classList.remove("is-hovering");
		for (const el of bars.current) {
			if (!el) continue;
			el.style.height = "";
			el.style.transform = "";
		}
		setHovered(null);
	}

	function onKeyDown(e: KeyboardEvent<HTMLOListElement>) {
		// Arrows only move focus. Enter or Space picks the section.
		// Picking on arrow would send focus to the section heading after the first press.
		if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
		const buttons = Array.from(
			e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
		);
		const at = buttons.indexOf(e.target as HTMLButtonElement);
		if (at === -1) return;
		e.preventDefault();
		const to =
			e.key === "Home"
				? 0
				: e.key === "End"
					? buttons.length - 1
					: e.key === "ArrowLeft"
						? Math.max(0, at - 1)
						: Math.min(buttons.length - 1, at + 1);
		buttons[to].focus();
	}

	// The title follows the pointer, then keyboard focus, then the current section.
	const shown = hovered ?? focused ?? step;
	const shownTitle = sections[shown]
		? `${shown + 1}. ${sections[shown].title}`
		: "";

	return (
		<div className="ncr-dock">
			<nav aria-label="Form sections">
				<ol
					ref={listRef}
					role="list"
					className="dock-track"
					onPointerMove={onPointerMove}
					onPointerLeave={onPointerLeave}
					onKeyDown={onKeyDown}
				>
					{sections.map((s, i) => (
						<li key={s.id}>
							<button
								type="button"
								className="dock-item"
								aria-label={`${i + 1}. ${s.title}`}
								aria-current={i === step ? "step" : undefined}
								onClick={() => onSelect(i)}
								onFocus={() => setFocused(i)}
								onBlur={() => setFocused(null)}
							>
								<span
									className="dock-bar"
									ref={(el) => {
										bars.current[i] = el;
									}}
								/>
							</button>
						</li>
					))}
				</ol>
			</nav>
			<h2 ref={headingRef} tabIndex={-1} className="dock-title">
				{shownTitle}
			</h2>

			<style jsx>{`
				.ncr-dock {
					--dock-bar-height: 50px;
					--dock-bar-width: 10px;
					/* Each bar's click area is this wide and the full height of the track. */
					--dock-target: 44px;
					--dock-inactive: color-mix(in srgb, var(--text) 65%, var(--bg));
					--dock-active: var(--accent);
					--dock-settle-speed: 220ms;
					--dock-settle-curve: cubic-bezier(0.22, 1, 0.36, 1);
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					max-width: 100%;
					margin: 0;
				}

				.dock-track {
					display: flex;
					height: 76px;
					/* Pulls the first bar flush with the title's left edge. */
					margin: 0 0 0 calc((var(--dock-target) - var(--dock-bar-width)) / -2);
					padding: 0;
					list-style: none;
					user-select: none;
				}

				.dock-track li {
					display: flex;
					flex: 0 0 var(--dock-target);
				}

				.dock-item {
					display: flex;
					flex: 1;
					align-items: flex-end;
					justify-content: center;
					padding: 0;
					background: transparent;
					border: none;
					border-radius: 0.5rem;
					cursor: pointer;
				}

				.dock-item:focus-visible {
					outline: 3px solid var(--focus);
					outline-offset: 2px;
				}

				.dock-bar {
					display: block;
					width: var(--dock-bar-width);
					height: var(--dock-bar-height);
					background-color: var(--dock-inactive);
					border-radius: 999px;
					transform: translateY(0);
					transition:
						height var(--dock-settle-speed) var(--dock-settle-curve),
						transform var(--dock-settle-speed) var(--dock-settle-curve),
						background-color 180ms ease;
					will-change: height, transform;
				}

				/* While the pointer is on the nav the bars follow it 1:1, so only the colour eases. */
				.dock-track.is-hovering .dock-bar {
					transition: background-color 180ms ease;
				}

				.dock-item[aria-current="step"] .dock-bar {
					background-color: var(--dock-active);
				}

				.dock-track:not(.is-hovering) .dock-item[aria-current="step"] .dock-bar {
					height: calc(var(--dock-bar-height) * 1.5);
					transform: translateY(0);
				}

				.dock-title {
					min-height: 2.2rem;
					margin-top: 1rem;
					font-size: 1.75rem;
					font-weight: 400;
					line-height: 1.3;
					letter-spacing: -0.015em;
					color: var(--text-h);
				}

				.dock-title:focus-visible {
					outline: 3px solid var(--focus);
					outline-offset: 2px;
				}

				/* Narrow screens: shrink the click areas so all the bars fit. */
				@media (max-width: 520px) {
					.ncr-dock {
						--dock-target: 32px;
					}
				}

				@media (forced-colors: active) {
					.dock-bar {
						forced-color-adjust: none;
						background-color: ButtonText;
					}

					.dock-item[aria-current="step"] .dock-bar {
						background-color: Highlight;
					}
				}
			`}</style>
		</div>
	);
}