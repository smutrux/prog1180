import { useEffect, useRef, useState } from "react";
import { FiEdit3, FiX } from "react-icons/fi";

type Ncr = {
    number: string;
    date: string;
    supplier: string;
    product: string;
    status: "Open" | "Closed";
};

const RecentNcrs = () => {
    const [ncrs, setNcrs] = useState<Ncr[]>([
        { number: "NCR-2026-001", date: "Oct 2, 2026", supplier: "Acme Manufacturing", product: "Steel Bracket 42A", status: "Open" },
        { number: "NCR-2026-002", date: "Oct 1, 2026", supplier: "Northern Components", product: "Aluminum Housing", status: "Closed" },
        { number: "NCR-2026-003", date: "Sep 29, 2026", supplier: "Precision Parts Ltd.", product: "Drive Shaft Assembly", status: "Open" },
        { number: "NCR-2026-004", date: "Sep 27, 2026", supplier: "Maple Industrial", product: "Mounting Plate", status: "Closed" },
        { number: "NCR-2026-005", date: "Sep 25, 2026", supplier: "Ontario Fabrication", product: "Control Panel Cover", status: "Open" },
        { number: "NCR-2026-006", date: "Sep 23, 2026", supplier: "Great Lakes Supply", product: "Hydraulic Valve", status: "Closed" },
        { number: "NCR-2026-007", date: "Sep 21, 2026", supplier: "Acme Manufacturing", product: "Steel Support Arm", status: "Open" },
        { number: "NCR-2026-008", date: "Sep 18, 2026", supplier: "Northern Components", product: "Electrical Enclosure", status: "Closed" },
        { number: "NCR-2026-009", date: "Sep 16, 2026", supplier: "Precision Parts Ltd.", product: "Bearing Housing", status: "Open" },
        { number: "NCR-2026-010", date: "Sep 14, 2026", supplier: "Maple Industrial", product: "Stainless Steel Frame", status: "Closed" },
        { number: "NCR-2026-011", date: "Sep 12, 2026", supplier: "Ontario Fabrication", product: "Motor Mount", status: "Open" },
        { number: "NCR-2026-012", date: "Sep 10, 2026", supplier: "Great Lakes Supply", product: "Pressure Regulator", status: "Closed" },
        { number: "NCR-2026-013", date: "Sep 8, 2026", supplier: "Acme Manufacturing", product: "Gear Assembly", status: "Open" },
        { number: "NCR-2026-014", date: "Sep 6, 2026", supplier: "Northern Components", product: "Cooling Fan Housing", status: "Closed" },
        { number: "NCR-2026-015", date: "Sep 4, 2026", supplier: "Precision Parts Ltd.", product: "Steel Retaining Ring", status: "Open" }
    ]);

    const [currentPage, setCurrentPage] = useState(1);
    const [editingNcr, setEditingNcr] = useState<Ncr | null>(null);
    const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

    const tableRef = useRef<HTMLDivElement | null>(null);
    const shouldScrollToTable = useRef(false);

    const editButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const firstInputRef = useRef<HTMLInputElement | null>(null);
    const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

    const ncrsPerPage = 4;
    const totalPages = Math.ceil(ncrs.length / ncrsPerPage);
    const startIndex = (currentPage - 1) * ncrsPerPage;
    const currentNcrs = ncrs.slice(startIndex, startIndex + ncrsPerPage);

    const previousPage = () => {
        if (currentPage > 1) {
            shouldScrollToTable.current = true;
            setCurrentPage(currentPage - 1);
        }
    };

    const nextPage = () => {
        if (currentPage < totalPages) {
            shouldScrollToTable.current = true;
            setCurrentPage(currentPage + 1);
        }
    };

    // Scroll after React has rendered the new page.
    useEffect(() => {
        if (!shouldScrollToTable.current) return;

        shouldScrollToTable.current = false;

        tableRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }, [currentPage]);

    const openEdit = (ncr: Ncr, button: HTMLButtonElement) => {
        const date = new Date(ncr.date);
        const formattedDate =
            date.getFullYear() +
            "-" +
            String(date.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(date.getDate()).padStart(2, "0");

        setEditingNcr({ ...ncr, date: formattedDate });
        editButtonRef.current = button;
    };

    const closeEdit = () => {
        setShowSaveConfirmation(false);
        setEditingNcr(null);

        setTimeout(() => {
            editButtonRef.current?.focus();
        }, 0);
    };

    useEffect(() => {
        if (!editingNcr) return;

        const focusTimeout = window.setTimeout(() => {
            if (showSaveConfirmation) {
                confirmButtonRef.current?.focus();
            } else {
                firstInputRef.current?.focus();
            }
        }, 0);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showSaveConfirmation) {
                    setShowSaveConfirmation(false);
                } else {
                    closeEdit();
                }
                return;
            }

            if (e.key !== "Tab" || !modalRef.current) return;

            const focusableElements =
                modalRef.current.querySelectorAll<HTMLElement>(
                    "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
                );

            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            window.clearTimeout(focusTimeout);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [editingNcr, showSaveConfirmation]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        if (!editingNcr) return;

        const { name, value } = e.target;

        setEditingNcr({
            ...editingNcr,
            [name]: value
        });
    };

    const saveEdit = () => {
        setShowSaveConfirmation(true);
    };

    const confirmSave = () => {
        if (!editingNcr) return;

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
                ncr.number === editingNcr.number ? updatedNcr : ncr
            )
        );

        closeEdit();
    };

    const cancelSave = () => {
        setShowSaveConfirmation(false);

        setTimeout(() => {
            firstInputRef.current?.focus();
        }, 0);
    };

    const openCalendar = (e: React.MouseEvent<HTMLInputElement>) => {
        const input = e.currentTarget;

        if (typeof input.showPicker === "function") {
            try {
                input.showPicker();
            } catch {
                // The browser can open the native picker normally.
            }
        }
    };

    const renderStatus = (status: Ncr["status"]) => (
        <span className={`status ${status.toLowerCase()}`}>
            <span className="statusDot" aria-hidden="true" />
            {status}
        </span>
    );

    const renderEditButton = (ncr: Ncr) => (
        <button
            className="editButton"
            type="button"
            aria-label={`Edit ${ncr.number}`}
            onClick={(e) => openEdit(ncr, e.currentTarget)}
        >
            <FiEdit3 aria-hidden="true" />
        </button>
    );

    return (
        <div ref={tableRef} className="recentNcrs">
            <p className="recentNcrsTitle">Recent NCR Table</p>

            {/* Desktop and tablet table */}
            <div className="desktopTable">
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
                        {currentNcrs.map((ncr) => (
                            <tr key={ncr.number}>
                                <td className="ncrNumber">{ncr.number}</td>
                                <td>{ncr.date}</td>
                                <td>{ncr.supplier}</td>
                                <td>{ncr.product}</td>
                                <td>{renderStatus(ncr.status)}</td>
                                <td>{renderEditButton(ncr)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile cards */}
            <div className="mobileCards">
                {currentNcrs.map((ncr) => (
                    <article className="ncrCard" key={ncr.number}>
                        <div className="ncrCardHeader">
                            <span className="ncrNumber">{ncr.number}</span>
                            {renderStatus(ncr.status)}
                        </div>

                        <div className="ncrCardDetails">
                            <div className="ncrCardField">
                                <span className="fieldLabel">Date</span>
                                <span>{ncr.date}</span>
                            </div>

                            <div className="ncrCardField">
                                <span className="fieldLabel">Supplier</span>
                                <span>{ncr.supplier}</span>
                            </div>

                            <div className="ncrCardField">
                                <span className="fieldLabel">Product</span>
                                <span>{ncr.product}</span>
                            </div>
                        </div>

                        <div className="ncrCardActions">
                            {renderEditButton(ncr)}
                        </div>
                    </article>
                ))}
            </div>

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
                    onClick={() => {
                        if (!showSaveConfirmation) closeEdit();
                    }}
                >
                    <div
                        ref={modalRef}
                        className={
                            showSaveConfirmation
                                ? "confirmationModal"
                                : "editModal"
                        }
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={
                            showSaveConfirmation
                                ? "confirm-save-title"
                                : "edit-ncr-title"
                        }
                        onClick={(e) => e.stopPropagation()}
                    >
                        {!showSaveConfirmation ? (
                            <>
                                <div className="modalHeader">
                                    <div>
                                        <h2 id="edit-ncr-title">Edit NCR</h2>
                                        <p>{editingNcr.number}</p>
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
                                            value={editingNcr.number}
                                            disabled
                                        />
                                    </div>

                                    <div className="formGroup">
                                        <label htmlFor="ncr-date">Date</label>
                                        <input
                                            ref={firstInputRef}
                                            id="ncr-date"
                                            type="date"
                                            name="date"
                                            value={editingNcr.date}
                                            onChange={handleChange}
                                            onClick={openCalendar}
                                        />
                                    </div>

                                    <div className="formGroup">
                                        <label htmlFor="ncr-status">
                                            Status
                                        </label>
                                        <select
                                            id="ncr-status"
                                            name="status"
                                            value={editingNcr.status}
                                            onChange={handleChange}
                                        >
                                            <option value="Open">Open</option>
                                            <option value="Closed">Closed</option>
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
                                            value={editingNcr.supplier}
                                            onChange={handleChange}
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
                                            value={editingNcr.product}
                                            onChange={handleChange}
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
                            </>
                        ) : (
                            <>
                                <div className="confirmationContent">
                                    <div className="confirmationIcon" aria-hidden="true">
                                        ?
                                    </div>

                                    <h2 id="confirm-save-title">
                                        Save changes?
                                    </h2>

                                    <p>
                                        Are you sure you want to save the
                                        changes made to{" "}
                                        <strong>{editingNcr.number}</strong>?
                                    </p>
                                </div>

                                <div className="confirmationActions">
                                    <button
                                        className="cancelButton"
                                        type="button"
                                        onClick={cancelSave}
                                    >
                                        Go Back
                                    </button>

                                    <button
                                        ref={confirmButtonRef}
                                        className="saveButton"
                                        type="button"
                                        onClick={confirmSave}
                                    >
                                        Confirm Save
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:ital,wght@0,100..900;1,100..900&display=swap');

                .recentNcrs {
                    scroll-margin-top: 20px;
                    position: relative;
                    width: 100%;
                    min-width: 0;
                    height: 620px;
                    background-color: #e4e4e4;
                    padding: 2rem;
                    border-radius: 12px;
                    box-sizing: border-box;
                }

                .recentNcrsTitle {
                    margin: 0 0 1rem;
                    font-size: 1.5rem;
                    color: black;
                    font-weight: 700;
                }

                .desktopTable {
                    width: 100%;
                    overflow-x: auto;
                }

                table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0 1rem;
                }

                th {
                    text-align: left;
                    padding: 0.75rem 1rem;
                    background-color: #f8fafc;
                    color: #64748b;
                    font-size: 0.75rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                th:first-child {
                    border-radius: 10px 0 0 10px;
                }

                th:last-child {
                    border-radius: 0 10px 10px 0;
                }

                td {
                    padding: 1rem;
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
                    overflow-wrap: anywhere;
                }

                .status {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    width: 5.5rem;
                    min-width: 5.5rem;
                    box-sizing: border-box;
                    padding: 0.2rem 0.4rem;
                    border-radius: 1000em;
                    font-size: 0.75rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .statusDot {
                    width: 6px;
                    height: 6px;
                    flex-shrink: 0;
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
                    min-width: 36px;
                    min-height: 36px;
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

                .mobileCards {
                    display: none;
                }

                .pagination {
                    position: absolute;
                    bottom: 1rem;
                    right: 2rem;
                    left: 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 1rem;
                }

                .pagination span {
                    color: #334155;
                    font-size: 0.85rem;
                    white-space: nowrap;
                }

                .pagination button {
                    padding: 0.8rem 1.5rem;
                    border: none;
                    border-radius: 10px;
                    background-color: #f8fafc;
                    color: #1e293b;
                    cursor: pointer;
                }

                .pagination button:hover:not(:disabled) {
                    background-color: white;
                }

                .pagination button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .modalOverlay {
                    position: fixed;
                    inset: 0;
                    background-color: rgba(15, 23, 42, 0.45);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                    overflow-y: auto;
                }

                .editModal,
                .confirmationModal {
                    width: 100%;
                    background-color: white;
                    border-radius: 14px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
                    overflow: hidden;
                }

                .editModal {
                    max-width: 520px;
                }

                .confirmationModal {
                    max-width: 420px;
                }

                .confirmationContent {
                    padding: 2rem;
                    text-align: center;
                }

                .confirmationIcon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 48px;
                    height: 48px;
                    margin: 0 auto 1rem;
                    border-radius: 50%;
                    background-color: #eff6ff;
                    color: #2563eb;
                    font-size: 1.3rem;
                    font-weight: 700;
                }

                .confirmationContent h2 {
                    margin: 0;
                    color: #111827;
                    font-size: 1.25rem;
                }

                .confirmationContent p {
                    margin: 0.75rem 0 0;
                    color: #64748b;
                    font-size: 0.9rem;
                    line-height: 1.5;
                }

                .confirmationActions,
                .modalActions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 1rem 1.5rem 1.5rem;
                    border-top: 1px solid #e5e7eb;
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
                    font-family: "Geist Mono", monospace;
                    font-size: 0.8rem;
                }

                .closeButton {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
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
                    min-width: 0;
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
                    min-width: 0;
                    min-height: 44px;
                    box-sizing: border-box;
                    padding: 0.75rem;
                    border: 1px solid #dbe2ea;
                    border-radius: 8px;
                    background-color: white;
                    color: #1e293b;
                    font-family: inherit;
                    font-size: 1rem;
                }

                .formGroup input:focus-visible,
                .formGroup select:focus-visible {
                    outline: 2px solid #2563eb;
                    outline-offset: 2px;
                }

                .formGroup input:disabled {
                    background-color: #f8fafc;
                    color: #64748b;
                    cursor: not-allowed;
                }

                .editButton:focus-visible,
                .closeButton:focus-visible,
                .pagination button:focus-visible,
                .cancelButton:focus-visible,
                .saveButton:focus-visible {
                    outline: 2px solid #2563eb;
                    outline-offset: 3px;
                }

                .cancelButton,
                .saveButton {
                    min-height: 44px;
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

                @media (max-width: 1000px) {
                    .recentNcrs {
                        padding: 1.5rem;
                    }

                    table {
                        min-width: 720px;
                    }
                }

                @media (max-width: 600px) {
                    .recentNcrs {
                        height: auto;
                        min-height: 0;
                        padding: 1rem;
                        padding-bottom: 5.5rem;
                    }

                    .recentNcrsTitle {
                        font-size: 1.25rem;
                        margin-bottom: 1.25rem;
                    }

                    .desktopTable {
                        display: none;
                    }

                    .mobileCards {
                        display: flex;
                        flex-direction: column;
                        gap: 0.85rem;
                    }

                    .ncrCard {
                        min-width: 0;
                        padding: 1rem;
                        background-color: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                    }

                    .ncrCardHeader {
                        display: flex;
                        align-items: flex-start;
                        justify-content: space-between;
                        flex-wrap: wrap;
                        gap: 0.75rem;
                        padding-bottom: 0.85rem;
                        border-bottom: 1px solid #e2e8f0;
                    }

                    .ncrCardHeader .ncrNumber {
                        font-size: 0.85rem;
                    }

                    .ncrCardDetails {
                        display: flex;
                        flex-direction: column;
                        gap: 0.85rem;
                        padding: 1rem 0;
                    }

                    .ncrCardField {
                        display: flex;
                        flex-direction: column;
                        gap: 0.3rem;
                        min-width: 0;
                        color: #1e293b;
                        font-size: 0.9rem;
                        overflow-wrap: anywhere;
                    }

                    .fieldLabel {
                        color: #64748b;
                        font-size: 0.75rem;
                        font-weight: 600;
                    }

                    .ncrCardActions {
                        display: flex;
                        justify-content: flex-end;
                        padding-top: 0.75rem;
                        border-top: 1px solid #e2e8f0;
                    }

                    .pagination {
                        position: absolute;
                        bottom: 1rem;
                        left: 1rem;
                        right: 1rem;
                        justify-content: space-between;
                        gap: 0.5rem;
                    }

                    .pagination button {
                        min-height: 44px;
                        padding: 0.7rem 0.8rem;
                    }

                    .pagination span {
                        font-size: 0.8rem;
                    }

                    .form {
                        grid-template-columns: 1fr;
                        padding: 1rem;
                    }

                    .fullWidth {
                        grid-column: span 1;
                    }

                    .modalOverlay {
                        align-items: flex-start;
                    }

                    .editModal,
                    .confirmationModal {
                        margin: auto 0;
                    }

                    .modalActions,
                    .confirmationActions {
                        flex-direction: column-reverse;
                        padding: 1rem;
                    }

                    .cancelButton,
                    .saveButton {
                        width: 100%;
                    }

                    .confirmationContent {
                        padding: 1.5rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default RecentNcrs;