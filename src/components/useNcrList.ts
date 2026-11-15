import { useCallback, useEffect, useState } from "react";
import { loadAllNcrRows, type NcrListRow } from "./ncrService";

/**
 * Every NCR, newest first, as flat rows with status, supplier, item and QA
 * answers (see the `ncr_list` view). Access columns directly, for example
 * `row.ncr_number` and `row.status_label`.
 */
export function useNcrList() {
	const [rows, setRows] = useState<NcrListRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const refetch = useCallback(async () => {
		try {
			setRows(await loadAllNcrRows());
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	return { rows, loading, error, refetch };
}