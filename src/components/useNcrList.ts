import { useCallback, useEffect, useState } from "react";
import { listAll, type NcRecord } from "./api";
import type { NcrFields } from "./ncrService";

export function useNcrList() {
	const [rows, setRows] = useState<NcRecord<NcrFields>[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const refetch = useCallback(async () => {
		try {
			setRows(await listAll<NcrFields>("NCR"));
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