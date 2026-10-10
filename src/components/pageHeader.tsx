import type { ReactNode } from "react";

/**
 * Props for {@link PageHeader}.
 */
interface PageHeaderProps {
	/** The page title. It is the page's only `h1`. */
	title: string;

	/** One line under the title that says what the page is for. */
	description?: string;

	/**
	 * Announces changes to the description to screen readers, for text such
	 * as "Updated at 3:04 PM".
	 * @defaultValue `false`
	 */
	live?: boolean;

	/** Controls shown at the end of the header, such as a Refresh button. */
	children?: ReactNode;
}

/**
 * The title block at the top of every page, so all pages share one heading
 * style. The `h1` itself is styled in `index.css`.
 *
 * @param props - Component props, see {@link PageHeaderProps}.
 * @returns A `<header>` with the title, the description and any controls.
 *
 * @example
 * <PageHeader title="Reports" description="Updated at 3:04 PM" live>
 *   <Button text="Refresh" aria="Refresh reports" onClick={reload} />
 * </PageHeader>
 */
const PageHeader = ({
	title,
	description,
	live = false,
	children,
}: PageHeaderProps) => (
	<header className="pageHeader">
		<div>
			<h1>{title}</h1>
			{description && <p role={live ? "status" : undefined}>{description}</p>}
		</div>
		{children}

		<style jsx>{`
			.pageHeader {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem 1.5rem;
			}

			p {
				max-width: 60ch;
				margin-top: 0.375rem;
				color: var(--text);
			}
		`}</style>
	</header>
);

export default PageHeader;
