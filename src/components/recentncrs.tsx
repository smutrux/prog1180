import { useEffect, useRef, useState } from "react";
import { FiEdit3, FiX } from "react-icons/fi";

const RecentNcrs = () => {
    const [ncrs, setNcrs] = useState([
        {
            number: "NCR-2026-001",
            date: "Oct 2, 2026",
            supplier: "Acme Manufacturing",
            product: "Steel Bracket 42A",
            status: "Open"
        },
        {
            number: "NCR-2026-002",
            date: "Oct 1, 2026",
            supplier: "Northern Components",
            product: "Aluminum Housing",
            status: "Closed"
        },
        {
            number: "NCR-2026-003",
            date: "Sep 29, 2026",
            supplier: "Precision Parts Ltd.",
            product: "Drive Shaft Assembly",
            status: "Open"
        },
        {
            number: "NCR-2026-004",
            date: "Sep 27, 2026",
            supplier: "Maple Industrial",
            product: "Mounting Plate",
            status: "Closed"
        },
        {
            number: "NCR-2026-005",
            date: "Sep 25, 2026",
            supplier: "Ontario Fabrication",
            product: "Control Panel Cover",
            status: "Open"
        },
        {
            number: "NCR-2026-006",
            date: "Sep 23, 2026",
            supplier: "Great Lakes Supply",
            product: "Hydraulic Valve",
            status: "Closed"
        },
        {
            number: "NCR-2026-007",
            date: "Sep 21, 2026",
            supplier: "Acme Manufacturing",
            product: "Steel Support Arm",
            status: "Open"
        },
        {
            number: "NCR-2026-008",
            date: "Sep 18, 2026",
            supplier: "Northern Components",
            product: "Electrical Enclosure",
            status: "Closed"
        },
        {
            number: "NCR-2026-009",
            date: "Sep 16, 2026",
            supplier: "Precision Parts Ltd.",
            product: "Bearing Housing",
            status: "Open"
        },
        {
            number: "NCR-2026-010",
            date: "Sep 14, 2026",
            supplier: "Maple Industrial",
            product: "Stainless Steel Frame",
            status: "Closed"
        },
        {
            number: "NCR-2026-011",
            date: "Sep 12, 2026",
            supplier: "Ontario Fabrication",
            product: "Motor Mount",
            status: "Open"
        },
        {
            number: "NCR-2026-012",
            date: "Sep 10, 2026",
            supplier: "Great Lakes Supply",
            product: "Pressure Regulator",
            status: "Closed"
        },
        {
            number: "NCR-2026-013",
            date: "Sep 8, 2026",
            supplier: "Acme Manufacturing",
            product: "Gear Assembly",
            status: "Open"
        },
        {
            number: "NCR-2026-014",
            date: "Sep 6, 2026",
            supplier: "Northern Components",
            product: "Cooling Fan Housing",
            status: "Closed"
        },
        {
            number: "NCR-2026-015",
            date: "Sep 4, 2026",
            supplier: "Precision Parts Ltd.",
            product: "Steel Retaining Ring",
            status: "Open"
        }
    ]);

    const [currentPage, setCurrentPage] = useState(1);
    const [editingNcr, setEditingNcr] = useState<any>(null);

    const editButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const firstInputRef = useRef<HTMLInputElement | null>(null);

    const ncrsPerPage = 4;

    const totalPages = Math.ceil(ncrs.length / ncrsPerPage);

    const startIndex = (currentPage - 1) * ncrsPerPage;

    const currentNcrs = ncrs.slice(
        startIndex,
        startIndex + ncrsPerPage
    );

    const previousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const openEdit = (
        ncr: any,
        button: HTMLButtonElement
    ) => {
        const date = new Date(ncr.date);

        const formattedDate =
            date.getFullYear() +
            "-" +
            String(date.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(date.getDate()).padStart(2, "0");

        setEditingNcr({
            ...ncr,
            date: formattedDate
        });

        editButtonRef.current = button;
    };

    const closeEdit = () => {
        setEditingNcr(null);

        setTimeout(() => {
            editButtonRef.current?.focus();
        }, 0);
    };

    useEffect(() => {
        if (!editingNcr) {
            return;
        }

        setTimeout(() => {
            firstInputRef.current?.focus();
        }, 0);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeEdit();
                return;
            }

            if (e.key !== "Tab" || !modalRef.current) {
                return;
            }

            const focusableElements =
                modalRef.current.querySelectorAll<HTMLElement>(
                    "button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
                );

            if (focusableElements.length === 0) {
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement =
                focusableElements[focusableElements.length - 1];

            if (
                e.shiftKey &&
                document.activeElement === firstElement
            ) {
                e.preventDefault();
                lastElement.focus();
            }

            if (
                !e.shiftKey &&
                document.activeElement === lastElement
            ) {
                e.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [editingNcr]);

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement
        >
    ) => {
        const { name, value } = e.target;

        setEditingNcr({
            ...editingNcr,
            [name]: value
        });
    };

    const saveEdit = () => {
        const formattedDate = new Date(
            editingNcr.date + "T00:00:00"
        ).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });

        const updatedNcr = {
            ...editingNcr,
            date: formattedDate
        };

        setNcrs((currentNcrs) =>
            currentNcrs.map((ncr) =>
                ncr.number === editingNcr.number
                    ? updatedNcr
                    : ncr
            )
        );

        closeEdit();
    };

    const openCalendar = (
        e: React.MouseEvent<HTMLInputElement>
    ) => {
        const input = e.currentTarget;

        if ("showPicker" in input) {
            try {
                (
                    input as HTMLInputElement & {
                        showPicker: () => void;
                    }
                ).showPicker();
            } catch {
                // Browser may prevent showPicker in some situations.
            }
        }
    };

    return (
        <div className="recentNcrs">
            <p className="recentNcrsTitle">
                Recent NCR Table
            </p>

            <table>
                <thead>
                    <tr>
                        <th scope="col">NCR NUMBER</th>
                        <th scope="col">DATE</th>
                        <th scope="col">SUPPLIER</th>
                        <th scope="col">PRODUCT</th>
                        <th scope="col">STATUS</th>
                        <th scope="col">EDIT</th>
                    </tr>
                </thead>

                <tbody>
                    {currentNcrs.map((ncr, index) => (
                        <tr key={`${ncr.number}-${index}`}>
                            <td className="ncrNumber">
                                {ncr.number}
                            </td>

                            <td>{ncr.date}</td>

                            <td>{ncr.supplier}</td>

                            <td>{ncr.product}</td>

                            <td>
                                <span
                                    className={`status ${ncr.status.toLowerCase()}`}
                                >
                                    <span
                                        className="statusDot"
                                        aria-hidden="true"
                                    ></span>

                                    {ncr.status}
                                </span>
                            </td>

                            <td>
                                <button
                                    className="editButton"
                                    type="button"
                                    aria-label={`Edit ${ncr.number}`}
                                    onClick={(e) =>
                                        openEdit(
                                            ncr,
                                            e.currentTarget
                                        )
                                    }
                                >
                                    <FiEdit3 aria-hidden="true" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pagination">
                <button
                    type="button"
                    onClick={previousPage}
                    disabled={currentPage === 1}
                    aria-label="Go to previous page"
                >
                    Previous
                </button>

                <span aria-live="polite">
                    Page {currentPage} of {totalPages}
                </span>

                <button
                    type="button"
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    aria-label="Go to next page"
                >
                    Next
                </button>
            </div>

            {editingNcr && (
                <div
                    className="modalOverlay"
                    onClick={closeEdit}
                >
                    <div
                        ref={modalRef}
                        className="editModal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="edit-ncr-title"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >
                        <div className="modalHeader">
                            <div>
                                <h2 id="edit-ncr-title">
                                    Edit NCR
                                </h2>

                                <p>
                                    {editingNcr.number}
                                </p>
                            </div>

                            <button
                                className="closeButton"
                                type="button"
                                aria-label="Close edit NCR"
                                onClick={closeEdit}
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </div>

                        <div className="form">
                            <div className="formGroup fullWidth">
                                <label htmlFor="ncr-number">
                                    NCR Number
                                </label>

                                <input
                                    id="ncr-number"
                                    type="text"
                                    name="number"
                                    value={
                                        editingNcr.number
                                    }
                                    disabled
                                />
                            </div>

                            <div className="formGroup">
                                <label htmlFor="ncr-date">
                                    Date
                                </label>

                                <div
                                    className="dateInputWrapper"
                                    onClick={(e) => {
                                        const input =
                                            e.currentTarget.querySelector(
                                                "input"
                                            ) as HTMLInputElement;

                                        if (
                                            input &&
                                            "showPicker" in input
                                        ) {
                                            try {
                                                (
                                                    input as HTMLInputElement & {
                                                        showPicker: () => void;
                                                    }
                                                ).showPicker();
                                            } catch {
                                                // Native picker fallback
                                            }
                                        }
                                    }}
                                >
                                    <input
                                        ref={firstInputRef}
                                        id="ncr-date"
                                        type="date"
                                        name="date"
                                        value={
                                            editingNcr.date
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        onClick={
                                            openCalendar
                                        }
                                    />
                                </div>
                            </div>

                            <div className="formGroup">
                                <label htmlFor="ncr-status">
                                    Status
                                </label>

                                <select
                                    id="ncr-status"
                                    name="status"
                                    value={
                                        editingNcr.status
                                    }
                                    onChange={
                                        handleChange
                                    }
                                >
                                    <option value="Open">
                                        Open
                                    </option>

                                    <option value="Closed">
                                        Closed
                                    </option>
                                </select>
                            </div>

                            <div className="formGroup fullWidth">
                                <label htmlFor="ncr-supplier">
                                    Supplier
                                </label>

                                <input
                                    id="ncr-supplier"
                                    type="text"
                                    name="supplier"
                                    value={
                                        editingNcr.supplier
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />
                            </div>

                            <div className="formGroup fullWidth">
                                <label htmlFor="ncr-product">
                                    Product
                                </label>

                                <input
                                    id="ncr-product"
                                    type="text"
                                    name="product"
                                    value={
                                        editingNcr.product
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />
                            </div>
                        </div>

                        <div className="modalActions">
                            <button
                                className="cancelButton"
                                type="button"
                                onClick={closeEdit}
                            >
                                Cancel
                            </button>

                            <button
                                className="saveButton"
                                type="button"
                                onClick={saveEdit}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:ital,wght@0,100..900;1,100..900&display=swap');

                .recentNcrs {
                    position: relative;
                    width: 100%;
                    height: 620px;
                    background-color: #e4e4e4;
                    padding: 2rem;
                    border-radius: 12px;
                    box-sizing: border-box;
                }

                .recentNcrsTitle {
                    font-size: 1.5rem;
                    color: black;
                    font-weight: 700;
                }

                table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0 1rem;
                }

                th {
                    text-align: left;
                    padding: 0.75rem 1.5rem;
                    background-color: #f8fafc;
                    color: #64748b;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                th:first-child {
                    border-radius: 10px 0 0 10px;
                }

                th:last-child {
                    border-radius: 0 10px 10px 0;
                }

                td {
                    padding: 1rem 1.5rem;
                    background-color: white;
                    color: #1e293b;
                    font-size: 0.9rem;
                }

                td:first-child {
                    border-radius: 10px 0 0 10px;
                }

                td:last-child {
                    border-radius: 0 10px 10px 0;
                }

                .ncrNumber {
                    font-family: "Geist Mono", monospace;
                    color: #2563eb;
                    font-weight: 600;
                }

                .status {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    width: 5.5rem;
                    box-sizing: border-box;
                    padding: 0.3rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .statusDot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                }

                .open {
                    color: #dc2626;
                    background-color: #fef2f2;
                    border: 1px solid #fecaca;
                }

                .open .statusDot {
                    background-color: #dc2626;
                }

                .closed {
                    color: #16a34a;
                    background-color: #f0fdf4;
                    border: 1px solid #bbf7d0;
                }

                .closed .statusDot {
                    background-color: #16a34a;
                }

                .editButton {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.4rem;
                    background-color: white;
                    border: 1px solid #dbe2ea;
                    border-radius: 6px;
                    color: #475569;
                    cursor: pointer;
                    font-size: 1rem;
                }

                .editButton:hover {
                    background-color: #f8fafc;
                }

                .pagination {
                    position: absolute;
                    bottom: 1rem;
                    right: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                }

                .pagination button {
                    padding: 0.9rem 2.5rem;
                    border: none;
                    border-radius: 10px;
                    background-color: #f8fafc;
                    color: #1e293b;
                    cursor: pointer;
                }

                .pagination button:hover {
                    background-color: #fff;
                }

                .pagination button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .modalOverlay {
                    position: fixed;
                    inset: 0;
                    background-color: rgba(
                        15,
                        23,
                        42,
                        0.45
                    );
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }

                .editModal {
                    width: 100%;
                    max-width: 520px;
                    background-color: white;
                    border-radius: 14px;
                    box-shadow: 0 20px 50px
                        rgba(0, 0, 0, 0.2);
                    overflow: hidden;
                }

                .modalHeader {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    padding: 1.5rem;
                    border-bottom: 1px solid #e5e7eb;
                }

                .modalHeader h2 {
                    margin: 0;
                    font-size: 1.3rem;
                    color: #111827;
                }

                .modalHeader p {
                    margin: 0.35rem 0 0;
                    color: #64748b;
                    font-family: "Geist Mono",
                        monospace;
                    font-size: 0.8rem;
                }

                .closeButton {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 34px;
                    border: none;
                    border-radius: 7px;
                    background-color: transparent;
                    color: #64748b;
                    cursor: pointer;
                    font-size: 1.1rem;
                }

                .closeButton:hover {
                    background-color: #f1f5f9;
                }

                .form {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    padding: 1.5rem;
                }

                .formGroup {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }

                .fullWidth {
                    grid-column: span 2;
                }

                .formGroup label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #475569;
                }

                .formGroup input,
                .formGroup select {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 0.75rem;
                    border: 1px solid #dbe2ea;
                    border-radius: 8px;
                    background-color: white;
                    color: #1e293b;
                    font-family: inherit;
                    outline: none;
                }

                .formGroup input:focus,
                .formGroup select:focus {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 2px
                        rgba(
                            37,
                            99,
                            235,
                            0.1
                        );
                }

        
                .editButton:focus-visible,
                .closeButton:focus-visible,
                .pagination button:focus-visible,
                .cancelButton:focus-visible,
                .saveButton:focus-visible {
                    outline: 2px solid #2563eb;
                    outline-offset: 2px;
                }

                .formGroup input:focus-visible,
                .formGroup select:focus-visible {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px
                        rgba(
                            37,
                            99,
                            235,
                            0.2
                        );
                }

                .formGroup input:disabled {
                    background-color: #f8fafc;
                    color: #64748b;
                    cursor: not-allowed;
                }

                /* DATE PICKER */

                .dateInputWrapper {
                    width: 100%;
                    cursor: pointer;
                }

                .dateInputWrapper input[type="date"] {
                    cursor: pointer;
                }

                .dateInputWrapper input[type="date"]::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    opacity: 0.8;
                    padding: 0.2rem;
                }

                .dateInputWrapper input[type="date"]::-webkit-calendar-picker-indicator:hover {
                    opacity: 1;
                }

                .modalActions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 1rem 1.5rem 1.5rem;
                }

                .cancelButton,
                .saveButton {
                    padding: 0.75rem 1.25rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .cancelButton {
                    border: 1px solid #dbe2ea;
                    background-color: white;
                    color: #475569;
                }

                .cancelButton:hover {
                    background-color: #f8fafc;
                }

                .saveButton {
                    border: none;
                    background-color: #2563eb;
                    color: white;
                }

                .saveButton:hover {
                    background-color: #1d4ed8;
                }

                @media (max-width: 900px) {
                    .recentNcrs {
                        overflow-x: auto;
                    }

                    table {
                        min-width: 800px;
                    }
                }

                @media (max-width: 600px) {
                    .recentNcrs {
                        height: 650px;
                        padding: 1rem;
                    }

                    .pagination {
                        right: 1rem;
                        bottom: 1rem;
                    }

                    .form {
                        grid-template-columns: 1fr;
                    }

                    .fullWidth {
                        grid-column: span 1;
                    }

                    .modalActions {
                        flex-direction: column-reverse;
                    }

                    .cancelButton,
                    .saveButton {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
};

export default RecentNcrs;