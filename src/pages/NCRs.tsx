import { useState } from 'react';
import { FiSearch } from "react-icons/fi";
import NcrsTable from '../components/NcrsTable';

const NCRs = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <h1>Non-Conformance Reports</h1>
      <p>Track, manage, and resolve quality control issues in your supply chain.</p>
      
      <div className="toolbar">
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Search NCRs, suppliers, or products..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="clear-btn">Clear</button>
      </div>

      <NcrsTable />

      <style jsx>{`
        h1 {color: black; font-size: 2rem; font-weight: bold; margin-bottom: 1rem;}
        p { color: #666; margin-bottom: 2rem; }
        
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          background: white;
          padding: 1rem;
          border-radius: 8px;
        }

        .search-container {
          display: flex;
          align-items: center;
          background: #f3f4f6;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          width: 400px;
        }

        .search-icon {
          color: #9ca3af;
          margin-right: 0.5rem;
        }

        .search-container input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
        }
        
        .clear-btn {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default NCRs;