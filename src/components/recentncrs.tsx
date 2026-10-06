import { FiEdit3 } from "react-icons/fi";

const RecentNcrs = () => {
    const ncrs = [
        {
            number: "NCR-2026-001",
            date: "Oct 2, 2026",
            supplier: "Random blah blah",
            product: "Yada Yada Yada",
            status: "Open"
        },
        {
            number: "NCR-2026-002",
            date: "Oct 2, 2026",
            supplier: "Random blah blah",
            product: "Yada Yada Yada",
            status: "Closed"
        }
    ];

    return (
        <div className="recentNcrs">
            <p className="recentNcrsTitle">RECENT NCR'S</p>

            <table>
                <thead>
                    <tr>
                        <th>NCR NUMBER</th>
                        <th>DATE</th>
                        <th>SUPPLIER</th>
                        <th>PRODUCT</th>
                        <th>STATUS</th>
                        <th>EDIT</th>
                    </tr>
                </thead>

                <tbody>
                    {ncrs.map((ncr) => (
                        <tr key={ncr.number}>
                            <td className="ncrNumber">{ncr.number}</td>
                            <td>{ncr.date}</td>
                            <td>{ncr.supplier}</td>
                            <td>{ncr.product}</td>

                            <td>
                                <span className={`status ${ncr.status.toLowerCase()}`}>
                                    <span className="statusDot"></span>
                                    {ncr.status}
                                </span>
                            </td>

                            <td>
                                <button className="editButton">
                                    <FiEdit3 />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pagination">
                <button>Previous</button>
                <button>Next</button>
            </div>

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:ital,wght@0,100..900;1,100..900&display=swap');
                .recentNcrs {
                    width: 100%;
                    background-color: #e4e4e4;
                    padding: 2rem;
                    border-radius: 12px;
                }

                .recentNcrsTitle {
                    margin-left: 1.5rem;
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
                    gap: 0.4rem;
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
                    display: flex;
                    justify-content: flex-end;
                    gap: 2rem;
                    margin-top: 2rem;
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

                @media (max-width: 900px) {
                    .recentNcrs {
                        overflow-x: auto;
                    }

                    table {
                        min-width: 800px;
                    }
                }
            `}</style>
        </div>
    );
};

export default RecentNcrs;