const mockData = [
  { id: 1, ncrNumber: 'NCR-2026-009', dateCreated: 'Sep 16, 2026', supplierName: 'Precision Parts Ltd.', projectDescription: 'Bearing Housing', status: 'Open' },
  { id: 2, ncrNumber: 'NCR-2026-010', dateCreated: 'Sep 14, 2026', supplierName: 'Maple Industrial', projectDescription: 'Stainless Steel Frame', status: 'Closed' },
  { id: 3, ncrNumber: 'NCR-2026-011', dateCreated: 'Sep 12, 2026', supplierName: 'Ontario Fabrication', projectDescription: 'Motor Mount', status: 'Open' },
  { id: 4, ncrNumber: 'NCR-2026-012', dateCreated: 'Sep 10, 2026', supplierName: 'Great Lakes Supply', projectDescription: 'Pressure Regulator', status: 'Closed' },
];

const NcrsTable = () => {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>NCR NUMBER</th>
            <th>DATE CREATED</th>
            <th>SUPPLIER NAME</th>
            <th>PROJECT DESCRIPTION</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {mockData.map((report) => (
            <tr key={report.id}>
              <td style={{ color: '#2563eb', fontWeight: 'bold' }}>{report.ncrNumber}</td>
              <td>{report.dateCreated}</td>
              <td>{report.supplierName}</td>
              <td>{report.projectDescription}</td>
              <td>
                <span className={`status-pill ${report.status.toLowerCase()}`}>
                  {report.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style jsx>{`
        .table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 2rem;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          background-color: #1e293b;
          color: white;
          text-align: left;
          padding: 1rem;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        td {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          color: #4b5563;
          font-size: 0.9rem;
        }
        .status-pill {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: capitalize;
        }
        .status-pill.open {
          background-color: #fee2e2;
          color: #dc2626;
        }
        .status-pill.closed {
          background-color: #dcfce7;
          color: #16a34a;
        }
      `}</style>
    </div>
  );
};

export default NcrsTable;